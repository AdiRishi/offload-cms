import type { PaymentAdapterArgs } from "@payloadcms/plugin-ecommerce/types";
import type { PayloadRequest } from "payload";

import { z } from "zod";

import type { OffloadPaymentAdapter } from "../reconcile.ts";

import {
  assertPaymentMatches,
  createPendingTransaction,
  expireTransaction,
  type Finalize,
  findTransaction,
  gatewayFields,
  gatewayGroup,
  PaymentMismatch,
  settleOnServer,
  settlePaidTransaction,
  transactionSchema,
  updateGatewayGroup,
} from "../transactions.ts";
import { paymentToSettle, paymentWindowEnd, razorpayAPI, type RazorpayPayment } from "./api.ts";
import { parseWebhookEvent } from "./events.ts";
import { verifyPaymentSignature, verifyWebhookSignature } from "./signature.ts";

export type RazorpayAdapterOptions = {
  /** The key ID from the Razorpay Dashboard. The browser receives it from `initiate`. */
  keyID: string;
  keySecret: string;
  /** The secret of the webhook that posts to `/api/payments/razorpay/webhooks`. */
  webhookSecret: string;
  /** The API's origin. Defaults to `https://api.razorpay.com`. */
  apiURL?: string;
  label?: string;
  groupOverrides?: PaymentAdapterArgs["groupOverrides"];
};

const name = "razorpay";
const hour = 60 * 60 * 1000;

const documentID = z.union([z.number(), z.string()]);

// Loose, so that fields added through `groupOverrides` survive a write of the whole group.
const razorpayGroup = z.looseObject({
  orderID: z.string().nullish(),
  paymentID: z.string().nullish(),
  lastEventID: z.string().nullish(),
  ...gatewayFields,
});

const razorpayTransaction = transactionSchema.extend({ razorpay: razorpayGroup.nullish() });

type RazorpayTransaction = z.infer<typeof razorpayTransaction>;
type GroupChanges = Partial<z.infer<typeof razorpayGroup>>;

const confirmData = z.object({
  cartID: documentID,
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string(),
});

const settledOrder = z.object({ id: documentID });
const cartSchema = z.object({ purchasedAt: z.string().nullish() }).nullable();

type Outcome =
  | { kind: "settled"; orderID: z.infer<typeof documentID> }
  | { kind: "unsettled"; error?: string };

const findByOrderID = (req: PayloadRequest, orderID: string) =>
  findTransaction(req, { "razorpay.orderID": { equals: orderID } }, razorpayTransaction);

const writeGroup = (req: PayloadRequest, transaction: RazorpayTransaction, changes: GroupChanges) =>
  updateGatewayGroup(req, transaction, name, { ...transaction.razorpay, ...changes });

const cartPurchased = async (req: PayloadRequest, transaction: RazorpayTransaction) => {
  if (transaction.cart === null || transaction.cart === undefined) return false;
  const cart = await req.payload.findByID({
    collection: "carts",
    id: transaction.cart,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
    select: { purchasedAt: true },
  });
  return Boolean(cartSchema.parse(cart)?.purchasedAt);
};

/**
 * The payment adapter for Razorpay Standard Checkout. `initiate` creates a Razorpay order for the
 * cart's subtotal, and the browser's `confirm-order`, the `/webhooks` endpoint and reconciliation
 * each settle the transaction once Razorpay's API reports a captured payment for that order.
 */
export const razorpayAdapter = ({
  apiURL = "https://api.razorpay.com",
  groupOverrides,
  keyID,
  keySecret,
  label = "Razorpay",
  webhookSecret,
}: RazorpayAdapterOptions): OffloadPaymentAdapter => {
  const api = razorpayAPI({ apiURL, keyID, keySecret });

  const capture = async (payment: RazorpayPayment, transaction: RazorpayTransaction) => {
    try {
      await api.capturePayment(payment.id, {
        amount: transaction.amount,
        currency: transaction.currency,
      });
    } catch (error) {
      // Another settlement, or Razorpay's auto-capture, may have captured it first.
      const current = await api.fetchPayment(payment.id);
      if (current.status !== "captured") throw error;
    }
  };

  /**
   * Settles the transaction with a captured payment, capturing an authorized one first. Leaves an
   * authorized payment alone when the cart was already bought through another transaction, so
   * Razorpay refunds it. Writes the payment, `changes`, and any reason it didn't settle to the
   * group. Throws only for errors that a retry may fix.
   */
  const settle = async ({
    changes = {},
    finalize,
    payment,
    req,
    transaction,
  }: {
    changes?: GroupChanges;
    finalize: Finalize;
    payment: RazorpayPayment | undefined;
    req: PayloadRequest;
    transaction: RazorpayTransaction;
  }): Promise<Outcome> => {
    const attempt = async (): Promise<Outcome> => {
      if (!payment) return { kind: "unsettled" };
      if (payment.status === "authorized") {
        assertPaymentMatches(payment, transaction);
        if (await cartPurchased(req, transaction)) {
          return {
            kind: "unsettled",
            error: `Payment ${payment.id} is authorized, but the cart was already bought. Razorpay will refund it.`,
          };
        }
        await capture(payment, transaction);
      } else if (payment.status !== "captured") {
        return { kind: "unsettled" };
      }
      const order = await settlePaidTransaction({
        finalize,
        paid: payment,
        shippingAddress: transaction.razorpay?.shippingAddress,
        transaction,
      });
      return { kind: "settled", orderID: settledOrder.parse(order).id };
    };

    const outcome = await attempt().catch((error: unknown) => {
      if (error instanceof PaymentMismatch) {
        return { kind: "unsettled", error: error.message } satisfies Outcome;
      }
      throw error;
    });
    await writeGroup(req, transaction, {
      ...changes,
      ...(payment && { paymentID: payment.id }),
      ...(outcome.kind === "unsettled" && outcome.error && { lastError: outcome.error }),
    });
    return outcome;
  };

  return {
    name,
    label,
    group: gatewayGroup({
      name,
      overrides: groupOverrides,
      fields: [
        { name: "orderID", type: "text", unique: true, admin: { readOnly: true } },
        { name: "paymentID", type: "text", admin: { readOnly: true } },
        { name: "lastEventID", type: "text", admin: { readOnly: true } },
      ],
    }),

    initiatePayment: async (args) => {
      const transaction = await createPendingTransaction(args, { name, gateway: {} });
      const order = await api.createOrder({
        amount: transaction.amount,
        currency: transaction.currency,
        receipt: String(transaction.id),
        notes: { transactionID: String(transaction.id) },
      });
      await updateGatewayGroup(args.req, transaction, name, {
        orderID: order.id,
        shippingAddress: args.data.shippingAddress,
      });
      return {
        message: "Razorpay order created",
        keyID,
        orderID: order.id,
        amount: transaction.amount,
        currency: transaction.currency,
      };
    },

    confirmOrder: async ({ data, finalizeOrder, req }) => {
      const confirmation = confirmData.parse(data);
      const transaction = await findByOrderID(req, confirmation.razorpay_order_id);
      const orderID = transaction?.razorpay?.orderID;
      if (!transaction || !orderID) {
        throw new Error(`No transaction holds Razorpay order ${confirmation.razorpay_order_id}.`);
      }
      if (String(transaction.cart) !== String(confirmation.cartID)) {
        throw new Error(`Razorpay order ${orderID} belongs to another cart.`);
      }
      const authentic = await verifyPaymentSignature({
        keySecret,
        orderID,
        paymentID: confirmation.razorpay_payment_id,
        signature: confirmation.razorpay_signature,
      });
      if (!authentic) throw new Error("The Razorpay payment signature is invalid.");

      const payment = await api.fetchPayment(confirmation.razorpay_payment_id);
      if (payment.order_id !== orderID) {
        throw new PaymentMismatch(`Payment ${payment.id} doesn't belong to order ${orderID}.`);
      }
      const outcome = await settle({ finalize: finalizeOrder, payment, req, transaction });
      if (outcome.kind !== "settled") {
        throw new Error(
          outcome.error ?? `Payment ${payment.id} is ${payment.status}, not captured.`,
        );
      }
      return {
        message: "Order confirmed",
        orderID: outcome.orderID,
        transactionID: transaction.id,
      };
    },

    endpoints: [
      {
        method: "post",
        path: "/webhooks",
        handler: async (req) => {
          const body = await req.text?.();
          const signature = req.headers.get("x-razorpay-signature");
          const authentic =
            body !== undefined &&
            signature !== null &&
            (await verifyWebhookSignature({ body, signature, webhookSecret }));
          if (!authentic) {
            return Response.json({ message: "The webhook signature is invalid." }, { status: 400 });
          }
          const event = parseWebhookEvent(body);
          if (!event) {
            return Response.json(
              { message: "The webhook body is not a Razorpay event." },
              { status: 400 },
            );
          }

          const eventID = req.headers.get("x-razorpay-event-id");
          try {
            if (event.kind === "ignored") return Response.json({ received: true });
            const transaction = await findByOrderID(req, event.orderID);
            if (
              !transaction ||
              transaction.status !== "pending" ||
              (eventID !== null && transaction.razorpay?.lastEventID === eventID)
            ) {
              return Response.json({ received: true });
            }

            if (event.kind === "failed") {
              await writeGroup(req, transaction, {
                lastError: event.error,
                lastEventID: eventID,
                paymentID: event.paymentID,
              });
            } else {
              await settle({
                changes: { lastEventID: eventID },
                finalize: settleOnServer(req),
                payment: paymentToSettle(
                  await api.fetchOrderPayments(event.orderID),
                  event.orderID,
                ),
                req,
                transaction,
              });
            }
            return Response.json({ received: true });
          } catch (error) {
            req.payload.logger.error({ err: error, msg: `Razorpay event ${eventID} failed` });
            return Response.json({ message: "The event could not be handled." }, { status: 500 });
          }
        },
      },
    ],

    reconcile: async ({ req, transactionID }) => {
      const transaction = await findTransaction(
        req,
        { id: { equals: transactionID } },
        razorpayTransaction,
      );
      if (transaction?.status !== "pending") return "pending";
      const createdAt = Date.parse(transaction.createdAt);
      const expireAfter = async (due: number) =>
        Date.now() > due && (await expireTransaction(req, transaction)) ? "expired" : "pending";

      const orderID = transaction.razorpay?.orderID;
      if (!orderID) return expireAfter(createdAt + hour);
      const payments = await api.fetchOrderPayments(orderID);
      const payment = paymentToSettle(payments, orderID);
      if (!payment) return expireAfter(paymentWindowEnd(payments, createdAt));
      const outcome = await settle({ finalize: settleOnServer(req), payment, req, transaction });
      return outcome.kind === "settled" ? "settled" : "pending";
    },
  };
};

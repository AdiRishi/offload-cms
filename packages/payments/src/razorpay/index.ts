import type { PaymentAdapterArgs } from "@payloadcms/plugin-ecommerce/types";
import type { PayloadRequest } from "payload";

import { waitUntil } from "@adirishi/offload-cloudflare";
import { z } from "zod";

import type { OffloadPaymentAdapter } from "../reconcile.ts";

import {
  assertCartOpen,
  assertPaymentMatches,
  createPendingTransaction,
  currencyDecimals,
  expireTransaction,
  type Finalize,
  findTransaction,
  gatewayFields,
  gatewayGroup,
  PaymentRefused,
  reopenForLatePayment,
  settleOnServer,
  settlePaidTransaction,
  transactionSchema,
  updateGatewayGroup,
} from "../transactions.ts";
import {
  checkoutTimeoutSeconds,
  mayExpire,
  paymentToSettle,
  razorpayAPI,
  RazorpayAPIError,
  type RazorpayPayment,
  takesDecimals,
} from "./api.ts";
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
type RazorpayGroup = z.infer<typeof razorpayGroup>;

const confirmData = z.object({
  cartID: documentID,
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string(),
});

const settledOrder = z.object({ id: documentID });

type Outcome =
  | { kind: "settled"; orderID: z.infer<typeof documentID> }
  | { kind: "unsettled"; error?: string };

const findByOrderID = (req: PayloadRequest, orderID: string) =>
  findTransaction(req, { "razorpay.orderID": { equals: orderID } }, razorpayTransaction);

const writeGroup = async (
  req: PayloadRequest,
  transaction: RazorpayTransaction,
  changes: Partial<RazorpayGroup>,
) => {
  const group = { ...transaction.razorpay, ...changes };
  await updateGatewayGroup(req, transaction, name, group);
  return group;
};

/** A receipt unique across every database that shares the Razorpay keys, at most 40 characters. */
const receiptFor = (transactionID: string | number) => {
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${String(transactionID).slice(0, 27)}-${suffix}`;
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
   * Settles the transaction with a captured payment, capturing an authorized one first. A payment
   * for a transaction that reconciliation expired reopens it, unless the cart was bought through
   * another transaction. Then, and for a mismatched payment, it writes why to `lastError` and the
   * error log: the customer may have been charged with no order, and an admin refunds the payment
   * from the Razorpay Dashboard. Throws only for errors that a retry may fix.
   */
  const settle = async ({
    changes = {},
    finalize,
    payment,
    req,
    transaction,
  }: {
    changes?: Partial<RazorpayGroup>;
    finalize: Finalize;
    payment: RazorpayPayment | undefined;
    req: PayloadRequest;
    transaction: RazorpayTransaction;
  }): Promise<Outcome> => {
    const settledPayment = transaction.status === "succeeded" && transaction.razorpay?.paymentID;
    const group = await writeGroup(req, transaction, {
      ...changes,
      ...(payment && !settledPayment && { paymentID: payment.id }),
    });
    if (!payment || (payment.status !== "authorized" && payment.status !== "captured")) {
      return { kind: "unsettled" };
    }
    try {
      if (settledPayment && settledPayment !== payment.id) {
        throw new PaymentRefused(
          `Payment ${payment.id} was ${payment.status} for transaction ${transaction.id}, which payment ${settledPayment} already settled. Refund payment ${payment.id} from the Razorpay Dashboard.`,
        );
      }
      const open = await reopenForLatePayment(req, transaction, payment.id);
      if (payment.status === "authorized") {
        if (open.status !== "pending") return { kind: "unsettled" };
        assertPaymentMatches(payment, open);
        await assertCartOpen(req, open, payment.id);
        await capture(payment, open);
      }
      const order = await settlePaidTransaction({
        finalize,
        group,
        name,
        paid: payment,
        req,
        transaction: open,
      });
      return { kind: "settled", orderID: settledOrder.parse(order).id };
    } catch (error) {
      if (!(error instanceof PaymentRefused)) throw error;
      req.payload.logger.error(error.message);
      await updateGatewayGroup(req, transaction, name, { ...group, lastError: error.message });
      return { kind: "unsettled", error: error.message };
    }
  };

  /** Settles with the event's payment, or with the order's paid payment when the event names none. */
  const settleFromWebhook = async (
    req: PayloadRequest,
    transaction: RazorpayTransaction,
    event: { orderID: string; paymentID: string | undefined },
    eventID: string | null,
  ) => {
    const payment = event.paymentID
      ? await api.fetchPayment(event.paymentID)
      : paymentToSettle(await api.fetchOrderPayments(event.orderID), event.orderID);
    await settle({
      changes: { lastEventID: eventID },
      finalize: settleOnServer(req),
      payment: payment?.order_id === event.orderID ? payment : undefined,
      req,
      transaction,
    });
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
      const { currency } = args.data;
      if (!takesDecimals(currency, currencyDecimals(args))) {
        throw new Error(
          `Razorpay takes ${currency} in its smallest unit, which the configured decimals don't match.`,
        );
      }
      const transaction = await createPendingTransaction(args, { name, gateway: {} });
      const order = await api.createOrder({
        amount: transaction.amount,
        currency: transaction.currency,
        receipt: receiptFor(transaction.id),
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
        timeout: checkoutTimeoutSeconds,
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
        throw new PaymentRefused(`Payment ${payment.id} doesn't belong to order ${orderID}.`);
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

          const eventID = req.headers.get("x-razorpay-event-id");
          // Razorpay retries any other answer for 24 hours, then disables the webhook, and a retry
          // can't make an event readable.
          const event = parseWebhookEvent(body);
          if (!event) {
            req.payload.logger.error(`Razorpay event ${eventID} is signed but unreadable.`);
            return Response.json({ received: true });
          }
          if (event.kind === "ignored") return Response.json({ received: true });

          try {
            const transaction = await findByOrderID(req, event.orderID);
            if (
              !transaction ||
              (eventID !== null && transaction.razorpay?.lastEventID === eventID)
            ) {
              return Response.json({ received: true });
            }
            const settledByThisPayment =
              transaction.status === "succeeded" &&
              (event.kind === "failed" ||
                !transaction.razorpay?.paymentID ||
                transaction.razorpay.paymentID === event.paymentID);
            if (transaction.status === "processing" || settledByThisPayment) {
              return Response.json({ received: true });
            }

            if (event.kind === "failed") {
              if (transaction.status === "pending") {
                await writeGroup(req, transaction, {
                  lastError: event.error,
                  lastEventID: eventID,
                  paymentID: event.paymentID,
                });
              }
              return Response.json({ received: true });
            }

            // Razorpay waits 5 seconds for an answer, and settling can take longer on D1. Settle
            // after answering. If it fails, reconciliation settles the pending transaction later.
            await waitUntil(
              settleFromWebhook(req, transaction, event, eventID).catch((error: unknown) =>
                req.payload.logger.error({ err: error, msg: `Razorpay event ${eventID} failed` }),
              ),
            );
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
      const expire = async (lastError?: string) => {
        const expired = await expireTransaction(req, transaction);
        if (expired && lastError) await writeGroup(req, transaction, { lastError });
        return expired ? "expired" : "pending";
      };

      const orderID = transaction.razorpay?.orderID;
      if (!orderID) {
        return mayExpire({ createdAt, now: Date.now(), payments: [] }) ? expire() : "pending";
      }
      const payments = await api.fetchOrderPayments(orderID).catch((error: unknown) => {
        if (error instanceof RazorpayAPIError && error.status === 404) return undefined;
        throw error;
      });
      if (!payments) {
        return expire(
          `Razorpay has no order ${orderID}. The site's keys may have changed since the checkout.`,
        );
      }
      const payment = paymentToSettle(payments, orderID);
      if (!payment) {
        return mayExpire({ createdAt, now: Date.now(), payments }) ? expire() : "pending";
      }
      const outcome = await settle({ finalize: settleOnServer(req), payment, req, transaction });
      return outcome.kind === "settled" ? "settled" : "pending";
    },
  };
};

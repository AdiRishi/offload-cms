import type { PaymentAdapterArgs } from "@payloadcms/plugin-ecommerce/types";
import type { DefaultDocumentIDType, Endpoint, PayloadRequest } from "payload";

import { z } from "zod";

import type { OffloadPaymentAdapter } from "../reconcile.ts";
import type { OrderCheck } from "./order.ts";

import {
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
import { type MipsAPI, type MipsCredentials, mipsAPI, mipsCurrency } from "./api.ts";
import { readCryptedCallback } from "./notification.ts";
import { checkOrder } from "./order.ts";
import { createReference, referenceSchema } from "./reference.ts";

export type { MipsCredentials } from "./api.ts";

export type MipsAdapterOptions = {
  credentials: MipsCredentials;
  /**
   * The page mIPS sends the customer to after a successful payment. It is absolute, or relative to
   * the initiate request's URL. The adapter adds `?reference=<reference>`, which the page passes to
   * `confirmOrder("mips", { additionalData: { reference } })`.
   */
  returnURL: string;
  /** The mIPS API. Defaults to `https://api.mips.mu/api`. */
  apiURL?: string;
  label?: string;
  groupOverrides?: PaymentAdapterArgs["groupOverrides"];
};

const name = "mips";

/** How long reconciliation waits for a payment on an order that mIPS doesn't report as paid. */
const unpaidLifetimeMs = 24 * 60 * 60 * 1000;

const documentID = z.union([z.number(), z.string()]);

const mipsTransaction = transactionSchema.extend({
  mips: z.looseObject({
    reference: z.string(),
    paymentMethod: z.string().nullish(),
    ...gatewayFields,
  }),
});

type MipsTransaction = z.infer<typeof mipsTransaction>;

const confirmData = z.object({ cartID: documentID, reference: referenceSchema });

const createdOrder = z.object({ id: documentID });

type Settlement =
  | Exclude<OrderCheck, { result: "paid" }>
  | { result: "settled"; orderID: DefaultDocumentIDType };

/** Asks mIPS about the transaction's order and settles the transaction if mIPS holds the payment. */
const settle = async (
  api: MipsAPI,
  transaction: MipsTransaction,
  finalize: Finalize,
): Promise<Settlement> => {
  const expected = {
    amount: transaction.amount,
    currency: transaction.currency,
    reference: transaction.mips.reference,
  };
  const check = checkOrder(await api.getOrder(expected), expected);
  if (check.result !== "paid") return check;
  try {
    const order = await settlePaidTransaction({
      finalize,
      paid: check.paid,
      shippingAddress: transaction.mips.shippingAddress,
      transaction,
    });
    return { result: "settled", orderID: createdOrder.parse(order).id };
  } catch (error) {
    if (error instanceof PaymentMismatch) return { result: "mismatch", reason: error.message };
    throw error;
  }
};

const findByReference = (req: PayloadRequest, reference: string) =>
  findTransaction(req, { "mips.reference": { equals: reference } }, mipsTransaction);

const reply = (body: "success" | "fail", status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain" } });

/**
 * mIPS's Instant Merchant Notification, which it sends after a successful payment. The message
 * carries no signature, and a captured one replays cleanly, so it only prompts a lookup of the order.
 */
const notificationEndpoint = (api: MipsAPI): Endpoint => ({
  path: "/imn",
  method: "post",
  handler: async (req) => {
    try {
      if (!req.text) throw new Error("Payload passed the notification without its body.");
      const cryptedCallback = readCryptedCallback(await req.text());
      if (!cryptedCallback) return reply("fail", 400);
      const notification = await api.decryptNotification(cryptedCallback);
      if (!notification) return reply("fail", 400);

      const transaction = await findByReference(req, notification.id_order);
      if (!transaction) {
        req.payload.logger.warn(
          `mIPS notified a payment for unknown order ${notification.id_order}.`,
        );
        return reply("fail");
      }
      if (transaction.order !== null && transaction.order !== undefined) return reply("success");

      const group = {
        ...transaction.mips,
        paymentMethod: notification.payment_method ?? transaction.mips.paymentMethod,
      };
      if (transaction.status !== "pending" && transaction.status !== "processing") {
        await updateGatewayGroup(req, transaction, name, {
          ...group,
          lastError: `mIPS notified a payment for this ${transaction.status} transaction. Check whether mIPS charged the customer.`,
        });
        return reply("fail");
      }

      const settlement = await settle(api, transaction, settleOnServer(req));
      if (settlement.result === "settled") {
        await updateGatewayGroup(req, transaction, name, group);
        return reply("success");
      }
      if (settlement.result === "unpaid" && settlement.status === "waiting") {
        return reply("fail", 500);
      }
      await updateGatewayGroup(req, transaction, name, {
        ...group,
        lastError:
          settlement.result === "mismatch"
            ? settlement.reason
            : `mIPS notified a payment, but reports order ${transaction.mips.reference} as ${settlement.status}.`,
      });
      return reply("fail");
    } catch (error) {
      req.payload.logger.error({ err: error, msg: "Handling a mIPS payment notification failed" });
      return reply("fail", 500);
    }
  },
});

/**
 * Takes payments through mIPS (MIPS, Mauritius) in an iframe payment zone. The return page, the
 * payment notification at `/api/payments/mips/imn` and reconciliation each settle a transaction
 * only after mIPS's `get_order_all_data` reports a successful payment of its amount and currency.
 */
export const mipsAdapter = ({
  apiURL = "https://api.mips.mu/api",
  credentials,
  groupOverrides,
  label = "Card (mIPS)",
  returnURL,
}: MipsAdapterOptions): OffloadPaymentAdapter => {
  const api = mipsAPI({ apiURL, credentials });

  return {
    name,
    label,
    group: gatewayGroup({
      name,
      overrides: groupOverrides,
      fields: [
        { name: "reference", type: "text", unique: true, admin: { readOnly: true } },
        { name: "paymentMethod", type: "text", admin: { readOnly: true } },
      ],
    }),
    endpoints: [notificationEndpoint(api)],

    initiatePayment: async (args) => {
      const currency = mipsCurrency.safeParse(args.data.currency.toUpperCase());
      if (!currency.success) throw new Error(`mIPS does not take ${args.data.currency}.`);
      const reference = createReference();
      const redirectURL = new URL(returnURL, args.req.url);
      redirectURL.searchParams.set("reference", reference);

      const transaction = await createPendingTransaction(args, { name, gateway: { reference } });
      const paymentZone = await api.loadPaymentZone({
        amount: transaction.amount,
        currency: currency.data,
        redirectURL: redirectURL.href,
        reference,
      });
      return { message: "Payment zone loaded.", reference, paymentZone };
    },

    confirmOrder: async ({ data, finalizeOrder, req }) => {
      const { cartID, reference } = confirmData.parse(data);
      const transaction = await findByReference(req, reference);
      if (!transaction) throw new Error(`No mIPS transaction has reference ${reference}.`);
      if (String(transaction.cart) !== String(cartID)) {
        throw new Error(`Transaction ${transaction.id} belongs to another cart.`);
      }

      const settlement = await settle(api, transaction, finalizeOrder);
      if (settlement.result === "mismatch") throw new PaymentMismatch(settlement.reason);
      if (settlement.result === "unpaid") {
        throw new Error(`mIPS reports order ${reference} as ${settlement.status}.`);
      }
      return {
        message: "Payment confirmed.",
        orderID: settlement.orderID,
        transactionID: transaction.id,
      };
    },

    reconcile: async ({ req, transactionID }) => {
      const transaction = await findTransaction(
        req,
        { id: { equals: transactionID } },
        mipsTransaction,
      );
      if (!transaction) throw new Error(`Transaction ${transactionID} does not exist.`);

      const settlement = await settle(api, transaction, settleOnServer(req));
      if (settlement.result === "settled") return "settled";
      if (settlement.result === "mismatch") {
        await updateGatewayGroup(req, transaction, name, {
          ...transaction.mips,
          lastError: settlement.reason,
        });
        return "pending";
      }
      const abandoned =
        settlement.status === "expired" ||
        Date.now() - Date.parse(transaction.createdAt) > unpaidLifetimeMs;
      return abandoned && (await expireTransaction(req, transaction)) ? "expired" : "pending";
    },
  };
};

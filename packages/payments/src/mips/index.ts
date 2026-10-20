import type { PaymentAdapterArgs } from "@payloadcms/plugin-ecommerce/types";
import type { Endpoint, PayloadRequest } from "payload";

import { waitUntil } from "@adirishi/offload-cloudflare";
import { z } from "zod";

import type { OffloadPaymentAdapter } from "../reconcile.ts";
import type { OrderCheck } from "./order.ts";

import {
  createPendingTransaction,
  currencyDecimals,
  expireTransaction,
  type Finalize,
  findTransaction,
  flagPayment,
  gatewayFields,
  gatewayGroup,
  orderConfirmation,
  PaymentRefused,
  reopenForLatePayment,
  settleOnServer,
  type SettledOrder,
  settlePaidTransaction,
  transactionSchema,
  writeGatewayFields,
} from "../transactions.ts";
import {
  type MipsAPI,
  type MipsCredentials,
  type MipsNotification,
  mipsAPI,
  mipsCurrency,
} from "./api.ts";
import { readCryptedCallback } from "./notification.ts";
import { checkOrder, expiryStep } from "./order.ts";
import { createReference, referenceSchema } from "./reference.ts";

export type { MipsCredentials } from "./api.ts";

export type MipsAdapterArgs = {
  credentials: MipsCredentials;
  /**
   * The page mIPS sends the customer to after a successful payment. It is absolute, or relative to
   * the initiate request's URL. The adapter adds `?reference=<reference>`, which the page passes to
   * `confirmOrder("mips", { additionalData: { reference } })`.
   */
  returnURL: string;
  /**
   * Returns the rate limiter for payment notifications, which the adapter keys by the sender's
   * `cf-connecting-ip`. It is a getter because a Worker reads its bindings inside a request.
   */
  rateLimit: () => RateLimit;
  /** The mIPS API. Defaults to `https://api.mips.mu/api`. */
  apiURL?: string;
} & PaymentAdapterArgs;

const name = "mips";

const maxNotificationBytes = 16 * 1024;

const documentID = z.union([z.number(), z.string()]);

const mipsGroup = z.looseObject({
  reference: z.string(),
  decimals: z.number().int(),
  paymentMethod: z.string().nullish(),
  ...gatewayFields,
});

const mipsTransaction = transactionSchema.extend({ mips: mipsGroup });

type MipsTransaction = z.infer<typeof mipsTransaction>;

const confirmData = z.object({ cartID: documentID, reference: referenceSchema });

/** The result of acting on mIPS's record of an order. */
type Outcome =
  | { result: "settled"; order: SettledOrder }
  | { result: "refused"; reason: string }
  | Extract<OrderCheck, { result: "unpaid" | "unanswered" }>;

const orderOf = (transaction: MipsTransaction) => ({
  amount: transaction.amount,
  currency: transaction.currency,
  decimals: transaction.mips.decimals,
  reference: transaction.mips.reference,
});

const findByReference = (req: PayloadRequest, reference: string) =>
  findTransaction(req, { "mips.reference": { equals: reference } }, mipsTransaction);

/** Logs `message` and writes it to the transaction's `lastError`. A refused payment is an error. */
const record = async (
  req: PayloadRequest,
  transaction: MipsTransaction,
  message: string,
  level: "warn" | "error",
) => {
  if (level === "error") return flagPayment(req, transaction, name, message);
  req.payload.logger.warn(message);
  await writeGatewayFields(req, transaction, name, { lastError: message });
};

/** Asks mIPS about the transaction's order and checks the answer against the transaction. */
const lookUp = async (api: MipsAPI, req: PayloadRequest, transaction: MipsTransaction) => {
  const order = orderOf(transaction);
  const check = checkOrder(await api.getOrder(order), order);
  if (check.result === "paid") {
    req.payload.logger.warn(
      `mIPS wrote the amount of order ${order.reference} in ${check.unit === "decimal" ? "decimal major units" : "minor units"}.`,
    );
  }
  return check;
};

/**
 * Settles the transaction when `check` reports a matching payment. A payment that can't settle,
 * because it contradicts the transaction or arrived for a transaction that can't take it any more,
 * goes to `lastError` and the error log.
 */
const resolve = async (
  req: PayloadRequest,
  transaction: MipsTransaction,
  check: OrderCheck,
  finalize: Finalize,
): Promise<Outcome> => {
  if (check.result === "unpaid" || check.result === "unanswered") return check;
  try {
    if (check.result === "refused") throw new PaymentRefused(check.reason);
    const paymentID = transaction.mips.reference;
    const order = await settlePaidTransaction({
      finalize,
      paid: { ...check.paid, id: paymentID },
      req,
      shippingAddress: transaction.mips.shippingAddress,
      transaction: await reopenForLatePayment(req, transaction, paymentID),
    });
    return { result: "settled", order };
  } catch (error) {
    if (!(error instanceof PaymentRefused)) throw error;
    await record(req, transaction, error.message, "error");
    return { result: "refused", reason: error.message };
  }
};

const reply = (body: "success" | "fail", status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain" } });

const settleNotified = async (
  api: MipsAPI,
  req: PayloadRequest,
  transaction: MipsTransaction,
  notification: MipsNotification,
) => {
  if (
    notification.payment_method &&
    notification.payment_method !== transaction.mips.paymentMethod
  ) {
    await writeGatewayFields(req, transaction, name, {
      paymentMethod: notification.payment_method,
    });
  }

  const check = await lookUp(api, req, transaction);
  const outcome = await resolve(req, transaction, check, settleOnServer(req));
  if (outcome.result === "settled") return reply("success");
  if (outcome.result === "refused") return reply("fail");
  if (outcome.result === "unanswered") {
    await record(req, transaction, outcome.problem, "warn");
    return reply("fail", 500);
  }
  if (outcome.status === "waiting") return reply("fail", 500);
  await record(
    req,
    transaction,
    outcome.problem ??
      `mIPS notified a payment, but reports order ${transaction.mips.reference} as ${outcome.status}.`,
    "warn",
  );
  return reply("fail");
};

/**
 * mIPS's Instant Merchant Notification, which it sends after a successful payment. The message
 * carries no signature, and a captured one replays cleanly, so it only prompts a lookup of the
 * order. The answer waits for the settlement, so `success` means the transaction is settled.
 */
const notificationEndpoint = (api: MipsAPI, rateLimit: MipsAdapterArgs["rateLimit"]): Endpoint => ({
  path: "/imn",
  method: "post",
  handler: async (req) => {
    try {
      const limiter = rateLimit();
      const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
      if (!(await limiter.limit({ key: ip })).success) return reply("fail", 429);
      if (Number(req.headers.get("content-length")) > maxNotificationBytes) {
        return reply("fail", 413);
      }
      if (!req.text) throw new Error("Payload passed the notification without its body.");
      const body = await req.text();
      if (new TextEncoder().encode(body).byteLength > maxNotificationBytes) {
        return reply("fail", 413);
      }

      const cryptedCallback = readCryptedCallback(body);
      if (!cryptedCallback) return reply("fail", 400);
      const decrypted = await api.decryptNotification(cryptedCallback);
      if (decrypted.result === "refused") {
        req.payload.logger.warn("mIPS refused to decrypt a payment notification.");
        return reply("fail", 400);
      }
      const { notification } = decrypted;

      const transaction = await findByReference(req, notification.id_order);
      if (!transaction) {
        req.payload.logger.warn(
          `mIPS notified a payment for unknown order ${notification.id_order}.`,
        );
        return reply("fail");
      }
      if (transaction.order !== null && transaction.order !== undefined) return reply("success");

      // If mIPS stops waiting, the Worker still finishes the settlement. On D1, a settlement cut
      // short leaves the transaction in processing for an admin.
      const settlement = settleNotified(api, req, transaction, notification).catch(
        (error: unknown) => {
          req.payload.logger.error({
            err: error,
            msg: `Settling mIPS order ${notification.id_order} failed`,
          });
          return reply("fail", 500);
        },
      );
      await waitUntil(settlement);
      return await settlement;
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
  rateLimit,
  returnURL,
}: MipsAdapterArgs): OffloadPaymentAdapter => {
  const api = mipsAPI({ apiURL, credentials });

  return {
    name,
    label,
    group: gatewayGroup({
      name,
      overrides: groupOverrides,
      fields: [
        { name: "reference", type: "text", unique: true, admin: { readOnly: true } },
        { name: "decimals", type: "number", admin: { readOnly: true } },
        { name: "paymentMethod", type: "text", admin: { readOnly: true } },
      ],
    }),
    endpoints: [notificationEndpoint(api, rateLimit)],

    initiatePayment: async (args) => {
      const currency = mipsCurrency.safeParse(args.data.currency.toUpperCase());
      if (!currency.success) throw new Error(`mIPS does not take ${args.data.currency}.`);
      const decimals = currencyDecimals(args);
      if (decimals > 2) {
        throw new Error(
          `mIPS takes amounts with at most 2 decimals, but ${currency.data} is configured with ${decimals}.`,
        );
      }
      const { subtotal } = args.data.cart;
      if (subtotal !== undefined && subtotal < 10 ** decimals) {
        throw new Error(`mIPS charges at least 1.00 ${currency.data}.`);
      }
      const reference = createReference();
      const redirectURL = new URL(returnURL, args.req.url);
      redirectURL.searchParams.set("reference", reference);

      const transaction = await createPendingTransaction(args, {
        name,
        gateway: { reference, decimals },
      });
      try {
        const paymentZone = await api.loadPaymentZone({
          amount: transaction.amount,
          currency: currency.data,
          decimals,
          redirectURL: redirectURL.href,
          reference,
        });
        return { message: "Payment zone loaded.", reference, paymentZone };
      } catch (error) {
        // The customer never saw a payment zone, so no payment can arrive.
        await expireTransaction(args.req, transaction);
        throw error;
      }
    },

    confirmOrder: async ({ data, finalizeOrder, req }) => {
      const { cartID, reference } = confirmData.parse(data);
      const transaction = await findByReference(req, reference);
      if (!transaction) throw new Error(`No mIPS transaction has reference ${reference}.`);
      if (String(transaction.cart) !== String(cartID)) {
        throw new Error(`Transaction ${transaction.id} belongs to another cart.`);
      }

      const check = await lookUp(api, req, transaction);
      const outcome = await resolve(req, transaction, check, finalizeOrder);
      if (outcome.result === "settled") {
        return orderConfirmation(outcome.order, transaction.id);
      }
      if (outcome.result === "refused") throw new PaymentRefused(outcome.reason);
      throw new Error(
        outcome.result === "unanswered"
          ? outcome.problem
          : `mIPS reports order ${reference} as ${outcome.status}.`,
      );
    },

    reconcile: async ({ req, transactionID }) => {
      const transaction = await findTransaction(
        req,
        { id: { equals: transactionID } },
        mipsTransaction,
      );
      if (!transaction) throw new Error(`Transaction ${transactionID} does not exist.`);
      const { createdAt, mips } = transaction;
      const now = new Date();

      let check = await lookUp(api, req, transaction);
      if (check.result === "unpaid" && expiryStep(check, createdAt, now) === "cancel") {
        const cancel = await api.cancelOrder(orderOf(transaction));
        check = await lookUp(api, req, transaction);
        if (check.result === "unpaid" && expiryStep(check, createdAt, now) === "cancel") {
          await record(
            req,
            transaction,
            `mIPS answered the cancellation of order ${mips.reference} with ${cancel.operation_details ?? cancel.operation_status}, but still reports it as ${check.status}.`,
            "warn",
          );
          return "pending";
        }
      }

      const outcome = await resolve(req, transaction, check, settleOnServer(req));
      if (outcome.result === "settled") return "settled";
      if (outcome.result === "refused") return "pending";
      if (expiryStep(outcome, createdAt, now) === "expire") {
        return (await expireTransaction(req, transaction)) ? "expired" : "pending";
      }
      if (outcome.problem) await record(req, transaction, outcome.problem, "warn");
      return "pending";
    },
  };
};

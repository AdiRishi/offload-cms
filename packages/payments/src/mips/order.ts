import { type OrdersAnswer, paidOrder } from "./api.ts";

/**
 * What a `get_order_all_data` answer means for a transaction.
 *
 * - `paid`: mIPS holds a successful payment for exactly this order, amount and currency. `unit`
 *   says how mIPS wrote the amount: in decimal major units, or in the units the transaction stores.
 * - `unpaid`: mIPS holds no successful payment. `status` is mIPS's `order_status`, or `missing`
 *   when mIPS answered without the order. `problem` explains a status Offload doesn't know.
 * - `unanswered`: mIPS didn't complete the lookup. Nothing is known about the payment.
 * - `refused`: mIPS reports something that contradicts the transaction. Retrying won't help.
 */
export type OrderCheck =
  | { result: "paid"; paid: { amount: number; currency: string }; unit: "decimal" | "minor" }
  | { result: "unpaid"; status: string; problem?: string }
  | { result: "unanswered"; problem: string }
  | { result: "refused"; reason: string };

const knownUnpaid = new Set(["fail", "waiting", "expired", "cancelled"]);

/**
 * Checks mIPS's record of an order against the transaction that expects it. `amount` is in units of
 * `10 ** decimals`, as Payload stores it.
 */
export const checkOrder = (
  answer: OrdersAnswer,
  expected: { amount: number; currency: string; decimals: number; reference: string },
): OrderCheck => {
  const { reference } = expected;
  if (answer.operation_status !== "success") {
    return {
      result: "unanswered",
      problem: `mIPS couldn't look up order ${reference}: ${answer.operation_details ?? answer.operation_status}.`,
    };
  }
  const [order, ...others] = answer.orders ?? [];
  if (!order) return { result: "unpaid", status: "missing" };
  if (others.length > 0 || order.id_order !== reference) {
    const answered = [order, ...others].map((candidate) => candidate.id_order).join(", ");
    return { result: "refused", reason: `mIPS answered for order ${answered}, not ${reference}.` };
  }
  if (order.order_status !== "success") {
    return knownUnpaid.has(order.order_status)
      ? { result: "unpaid", status: order.order_status }
      : {
          result: "unpaid",
          status: order.order_status,
          problem: `mIPS reports order ${reference} with the unknown status "${order.order_status}".`,
        };
  }

  const { amount, currency } = paidOrder.parse(order);
  if (currency.toUpperCase() !== expected.currency.toUpperCase()) {
    return {
      result: "refused",
      reason: `mIPS reports order ${reference} paid in ${currency}, not ${expected.currency}.`,
    };
  }
  const paid = { amount: expected.amount, currency };
  if (Math.round(amount * 10 ** expected.decimals) === expected.amount) {
    return { result: "paid", paid, unit: "decimal" };
  }
  if (amount === expected.amount) return { result: "paid", paid, unit: "minor" };
  return {
    result: "refused",
    reason: `mIPS reports ${amount} ${currency} paid for order ${reference}, which expects ${expected.amount} in units of 10^-${expected.decimals}.`,
  };
};

/** How long reconciliation waits for a payment before it asks mIPS to cancel the order. */
export const unpaidLifetimeMs = 24 * 60 * 60 * 1000;

const closed = new Set(["expired", "cancelled"]);

/**
 * What reconciliation does with a transaction whose order mIPS doesn't report as paid.
 *
 * - `expire`: mIPS says the order is expired or cancelled, so no payment can arrive any more.
 * - `cancel`: the order has been open for `unpaidLifetimeMs`. Ask mIPS to cancel it, then look again.
 * - `wait`: a payment may still arrive, or mIPS didn't answer.
 */
export const expiryStep = (
  check: Extract<OrderCheck, { result: "unpaid" | "unanswered" }>,
  createdAt: string,
  now: Date,
): "expire" | "cancel" | "wait" => {
  if (check.result === "unanswered") return "wait";
  if (closed.has(check.status)) return "expire";
  return now.getTime() - Date.parse(createdAt) >= unpaidLifetimeMs ? "cancel" : "wait";
};

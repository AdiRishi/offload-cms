import type { OrdersAnswer } from "./api.ts";

/**
 * What a `get_order_all_data` answer means for a transaction.
 *
 * - `paid`: mIPS holds a successful payment for exactly this order, amount and currency.
 * - `unpaid`: mIPS holds no successful payment yet. `missing` means mIPS has no record of the order.
 * - `mismatch`: mIPS reports something that contradicts the transaction. Retrying won't help.
 */
export type OrderCheck =
  | { result: "paid"; paid: { amount: number; currency: string } }
  | { result: "unpaid"; status: "fail" | "waiting" | "expired" | "missing" }
  | { result: "mismatch"; reason: string };

/**
 * Checks mIPS's record of an order against the transaction that expects it. `amount` is in minor
 * units, as Payload stores it. mIPS reports decimal major units.
 */
export const checkOrder = (
  answer: OrdersAnswer,
  expected: { amount: number; currency: string; reference: string },
): OrderCheck => {
  const [order, ...others] = answer.orders ?? [];
  if (answer.operation_status !== "success" || !order) {
    return { result: "unpaid", status: "missing" };
  }
  if (others.length > 0 || order.id_order !== expected.reference) {
    const answered = [order, ...others].map((candidate) => candidate.id_order).join(", ");
    return {
      result: "mismatch",
      reason: `mIPS answered for order ${answered}, not ${expected.reference}.`,
    };
  }
  if (order.order_status !== "success") return { result: "unpaid", status: order.order_status };

  const amount = Math.round(order.amount * 100);
  if (amount !== expected.amount) {
    return {
      result: "mismatch",
      reason: `mIPS reports ${order.amount} ${order.currency} paid for order ${expected.reference}, which expects ${expected.amount} minor units.`,
    };
  }
  if (order.currency.toUpperCase() !== expected.currency.toUpperCase()) {
    return {
      result: "mismatch",
      reason: `mIPS reports order ${expected.reference} paid in ${order.currency}, not ${expected.currency}.`,
    };
  }
  return { result: "paid", paid: { amount, currency: order.currency } };
};

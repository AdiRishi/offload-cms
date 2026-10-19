import assert from "node:assert/strict";
import { test } from "node:test";

import type { OrdersAnswer } from "./api.ts";

import { checkOrder } from "./order.ts";

type OrderDetails = NonNullable<OrdersAnswer["orders"]>[number];

const reference = "Ab3dE5gH7jK9mN1pQ3sT";
const expected = { amount: 1999, currency: "MUR", reference };
const order: OrderDetails = {
  id_order: reference,
  amount: 19.99,
  currency: "MUR",
  order_status: "success",
};
const answer = (...orders: OrderDetails[]): OrdersAnswer => ({
  operation_status: "success",
  orders,
});

test("settles a successful order of the transaction's amount and currency", () => {
  assert.deepEqual(checkOrder(answer(order), expected), {
    result: "paid",
    paid: { amount: 1999, currency: "MUR" },
  });
});

test("reads decimal amounts that binary floating point can't hold exactly", () => {
  const check = checkOrder(answer({ ...order, amount: 0.29 }), { ...expected, amount: 29 });
  assert.equal(check.result, "paid");
});

test("refuses a payment of another amount", () => {
  assert.equal(checkOrder(answer({ ...order, amount: 19.98 }), expected).result, "mismatch");
  assert.equal(checkOrder(answer({ ...order, amount: 1999 }), expected).result, "mismatch");
});

test("refuses a payment in another currency", () => {
  assert.equal(checkOrder(answer({ ...order, currency: "USD" }), expected).result, "mismatch");
});

test("refuses an answer about another order", () => {
  const other = { ...order, id_order: "Zz9yX8wV7uT6sR5qP4oN" };
  assert.equal(checkOrder(answer(other), expected).result, "mismatch");
  assert.equal(checkOrder(answer(order, other), expected).result, "mismatch");
});

test("reports an order mIPS has not been paid for", () => {
  const statuses = ["waiting", "fail", "expired"] satisfies OrderDetails["order_status"][];
  for (const status of statuses) {
    assert.deepEqual(checkOrder(answer({ ...order, order_status: status }), expected), {
      result: "unpaid",
      status,
    });
  }
});

test("reports an order mIPS has no record of as missing", () => {
  const missing = { result: "unpaid", status: "missing" };
  assert.deepEqual(checkOrder({ operation_status: "success", orders: [] }, expected), missing);
  assert.deepEqual(
    checkOrder({ operation_status: "fail", operation_details: "Order not found" }, expected),
    missing,
  );
});

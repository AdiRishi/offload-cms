import assert from "node:assert/strict";
import { test } from "node:test";

import type { OrdersAnswer } from "./api.ts";

import { checkOrder, expiryStep, type OrderCheck } from "./order.ts";

type OrderDetails = NonNullable<OrdersAnswer["orders"]>[number];
type Unsettled = Extract<OrderCheck, { result: "unpaid" | "unanswered" }>;

const reference = "Ab3dE5gH7jK9mN1pQ3sT";
const expected = { amount: 1999, currency: "MUR", decimals: 2, reference };
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
    unit: "decimal",
  });
});

test("reads decimal amounts that binary floating point can't hold exactly", () => {
  const check = checkOrder(answer({ ...order, amount: 0.29 }), { ...expected, amount: 29 });
  assert.equal(check.result, "paid");
});

test("accepts an amount written in minor units, as the notification model describes", () => {
  assert.deepEqual(checkOrder(answer({ ...order, amount: 1999 }), expected), {
    result: "paid",
    paid: { amount: 1999, currency: "MUR" },
    unit: "minor",
  });
});

test("reads amounts of a currency configured without decimals", () => {
  const whole = { ...expected, amount: 1999, decimals: 0 };
  assert.deepEqual(checkOrder(answer({ ...order, amount: 1999 }), whole), {
    result: "paid",
    paid: { amount: 1999, currency: "MUR" },
    unit: "decimal",
  });
  assert.equal(checkOrder(answer({ ...order, amount: 19.99 }), whole).result, "refused");
});

test("refuses a payment of another amount", () => {
  assert.equal(checkOrder(answer({ ...order, amount: 19.98 }), expected).result, "refused");
  assert.equal(checkOrder(answer({ ...order, amount: 199.9 }), expected).result, "refused");
});

test("refuses a payment in another currency", () => {
  assert.equal(checkOrder(answer({ ...order, currency: "USD" }), expected).result, "refused");
});

test("refuses an answer about another order", () => {
  const other = { ...order, id_order: "Zz9yX8wV7uT6sR5qP4oN" };
  assert.equal(checkOrder(answer(other), expected).result, "refused");
  assert.equal(checkOrder(answer(order, other), expected).result, "refused");
});

test("rejects a successful order without a numeric amount", () => {
  assert.throws(() => checkOrder(answer({ ...order, amount: "19.99" }), expected));
  const withoutAmount = { id_order: reference, currency: "MUR", order_status: "success" };
  assert.throws(() => checkOrder(answer(withoutAmount), expected));
});

test("reports an order mIPS has not been paid for, whatever its amount", () => {
  for (const status of ["waiting", "fail", "expired", "cancelled"]) {
    const unpaid = { id_order: reference, order_status: status };
    assert.deepEqual(checkOrder(answer(unpaid), expected), { result: "unpaid", status });
  }
});

test("counts an unknown order status as unpaid, and names it", () => {
  const check = checkOrder(answer({ ...order, order_status: "pending_3ds" }), expected);
  assert.equal(check.result, "unpaid");
  assert.ok(check.result === "unpaid" && check.problem?.includes('"pending_3ds"'));
});

test("reports a lookup mIPS didn't complete as unanswered, with its details", () => {
  const check = checkOrder({ operation_status: "fail", operation_details: "Timeout" }, expected);
  assert.equal(check.result, "unanswered");
  assert.ok(check.result === "unanswered" && check.problem.includes("Timeout"));
});

test("reports an order missing from a completed lookup", () => {
  assert.deepEqual(checkOrder(answer(), expected), { result: "unpaid", status: "missing" });
});

const createdAt = "2026-10-01T10:00:00.000Z";
const hoursLater = (hours: number) => new Date(Date.parse(createdAt) + hours * 60 * 60 * 1000);

test("expires a transaction whose order mIPS reports as expired or cancelled", () => {
  for (const status of ["expired", "cancelled"]) {
    assert.equal(expiryStep({ result: "unpaid", status }, createdAt, hoursLater(1)), "expire");
  }
});

test("asks mIPS to cancel an order that stays unpaid for 24 hours", () => {
  const waiting: Unsettled = { result: "unpaid", status: "waiting" };
  assert.equal(
    expiryStep(waiting, createdAt, new Date(Date.parse(createdAt) + 86_399_999)),
    "wait",
  );
  assert.equal(expiryStep(waiting, createdAt, hoursLater(24)), "cancel");
  for (const status of ["fail", "missing", "pending_3ds"]) {
    assert.equal(expiryStep({ result: "unpaid", status }, createdAt, hoursLater(30)), "cancel");
  }
});

test("never expires a transaction while mIPS doesn't answer", () => {
  const unanswered: Unsettled = {
    result: "unanswered",
    problem: "mIPS couldn't look up the order.",
  };
  assert.equal(expiryStep(unanswered, createdAt, hoursLater(24 * 30)), "wait");
});

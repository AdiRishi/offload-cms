import assert from "node:assert/strict";
import { test } from "node:test";

import { orderPaymentsSchema, paymentToSettle, paymentWindowEnd } from "./api.ts";
import { parseWebhookEvent } from "./events.ts";

// Payment entities as Razorpay's webhook and API samples show them. `notes` is `[]` when empty.
const payment = (fields: Record<string, unknown>) => ({
  id: "pay_DESlfW9H8K9uqM",
  entity: "payment",
  amount: 129900,
  currency: "INR",
  status: "captured",
  order_id: "order_DESlLckIVRkHWj",
  invoice_id: null,
  international: false,
  method: "netbanking",
  amount_refunded: 0,
  refund_status: null,
  captured: true,
  notes: [],
  fee: null,
  tax: null,
  error_code: null,
  error_description: null,
  error_source: null,
  error_step: null,
  error_reason: null,
  created_at: 1567674599,
  ...fields,
});

const event = (name: string, payload: Record<string, unknown>) =>
  JSON.stringify({
    entity: "event",
    account_id: "acc_BFQ7uQEaa7j2z7",
    event: name,
    contains: Object.keys(payload),
    payload,
    created_at: 1567674606,
  });

test("a captured, authorized or paid event asks to settle the payment's order", () => {
  for (const name of ["payment.captured", "payment.authorized"]) {
    assert.deepEqual(parseWebhookEvent(event(name, { payment: { entity: payment({}) } })), {
      kind: "paid",
      orderID: "order_DESlLckIVRkHWj",
    });
  }
  const order = {
    id: "order_DESlLckIVRkHWj",
    entity: "order",
    amount: 129900,
    amount_paid: 129900,
    amount_due: 0,
    currency: "INR",
    receipt: "42",
    status: "paid",
    notes: { transactionID: "42" },
  };
  assert.deepEqual(
    parseWebhookEvent(
      event("order.paid", { payment: { entity: payment({}) }, order: { entity: order } }),
    ),
    { kind: "paid", orderID: "order_DESlLckIVRkHWj" },
  );
});

test("a failed payment asks to record Razorpay's reason, not to settle", () => {
  const failed = payment({
    id: "pay_DEAU825sJlCbGa",
    status: "failed",
    captured: false,
    error_code: "BAD_REQUEST_ERROR",
    error_description: "Payment failed",
  });
  assert.deepEqual(parseWebhookEvent(event("payment.failed", { payment: { entity: failed } })), {
    kind: "failed",
    orderID: "order_DESlLckIVRkHWj",
    paymentID: "pay_DEAU825sJlCbGa",
    error: "Payment pay_DEAU825sJlCbGa failed: Payment failed",
  });
});

test("ignores other events, and payments made without an order", () => {
  const refund = {
    id: "rfnd_FP8QHiV938haTz",
    entity: "refund",
    amount: 129900,
    payment_id: "pay_DESlfW9H8K9uqM",
    status: "processed",
  };
  assert.deepEqual(
    parseWebhookEvent(
      event("refund.processed", { refund: { entity: refund }, payment: { entity: payment({}) } }),
    ),
    { kind: "ignored" },
  );
  assert.deepEqual(
    parseWebhookEvent(
      event("payment.captured", { payment: { entity: payment({ order_id: null }) } }),
    ),
    { kind: "ignored" },
  );
});

test("refuses a body that is not a Razorpay event", () => {
  assert.equal(parseWebhookEvent("event=payment.captured"), undefined);
  assert.equal(parseWebhookEvent(JSON.stringify({ event: "payment.captured" })), undefined);
});

// The two payments are Razorpay's sample for GET /v1/orders/:id/payments: a failed UPI attempt,
// then a captured one.
const orderPayments = {
  entity: "collection",
  count: 2,
  items: [
    payment({
      id: "pay_N8FUmetkCE2hZP",
      order_id: "order_N8FRN5zTm5S3wx",
      amount: 100,
      status: "failed",
      captured: false,
      notes: { notes_key_1: "Tea, Earl Grey, Hot" },
      error_code: "BAD_REQUEST_ERROR",
    }),
    payment({ id: "pay_N8FVRD1DzYzBh1", order_id: "order_N8FRN5zTm5S3wx", amount: 100 }),
  ],
};
const itemsOf = (body: unknown) => orderPaymentsSchema.parse(body).items;

test("settles an order with its captured payment, after earlier failed attempts", () => {
  assert.equal(
    paymentToSettle(itemsOf(orderPayments), "order_N8FRN5zTm5S3wx")?.id,
    "pay_N8FVRD1DzYzBh1",
  );
});

test("prefers a captured payment, and otherwise takes an authorized one to capture", () => {
  const lateAuthorised = payment({
    id: "pay_N8FUmetkCE2hZP",
    order_id: "order_N8FRN5zTm5S3wx",
    status: "authorized",
    captured: false,
  });
  const captured = payment({ id: "pay_N8FVRD1DzYzBh1", order_id: "order_N8FRN5zTm5S3wx" });
  assert.equal(
    paymentToSettle(itemsOf({ items: [lateAuthorised, captured] }), "order_N8FRN5zTm5S3wx")?.id,
    "pay_N8FVRD1DzYzBh1",
  );
  assert.equal(
    paymentToSettle(itemsOf({ items: [lateAuthorised] }), "order_N8FRN5zTm5S3wx")?.id,
    "pay_N8FUmetkCE2hZP",
  );
});

test("finds nothing to settle in failed, pending or refunded payments, or another order's", () => {
  const unpaid = ["created", "failed", "refunded"].map((status, index) =>
    payment({ id: `pay_N8FUmetkCE2hZ${index}`, order_id: "order_N8FRN5zTm5S3wx", status }),
  );
  assert.equal(paymentToSettle(itemsOf({ items: unpaid }), "order_N8FRN5zTm5S3wx"), undefined);
  assert.equal(paymentToSettle(itemsOf(orderPayments), "order_DESlLckIVRkHWj"), undefined);
});

test("keeps an unpaid order open for 3 days and an hour after its last payment attempt", () => {
  const initiatedAt = Date.UTC(2026, 9, 1, 12, 0);
  assert.equal(paymentWindowEnd([], initiatedAt), Date.UTC(2026, 9, 4, 13, 0));

  const timedOut = payment({
    status: "failed",
    captured: false,
    created_at: Date.UTC(2026, 9, 1, 14, 30) / 1000,
  });
  assert.equal(
    paymentWindowEnd(itemsOf({ items: [timedOut] }), initiatedAt),
    Date.UTC(2026, 9, 4, 15, 30),
  );
});

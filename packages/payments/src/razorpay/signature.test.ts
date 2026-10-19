import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyPaymentSignature, verifyWebhookSignature } from "./signature.ts";

// printf '%s' 'order_N8FRN5zTm5S3wx|pay_N8FVRD1DzYzBh1' | openssl dgst -sha256 -hmac 'w8nKq3tYdL0pXv2Rz6Hc'
const checkout = {
  keySecret: "w8nKq3tYdL0pXv2Rz6Hc",
  orderID: "order_N8FRN5zTm5S3wx",
  paymentID: "pay_N8FVRD1DzYzBh1",
  signature: "37b59a34ac135d3d0625176c6988b67c1a2624bea41b30cb8c8a9df2e0d6a396",
};

// The body is one line with no trailing newline, and its notes hold a multi-byte character.
// printf '%s' "$body" | openssl dgst -sha256 -hmac 'whsec_Qm4Tz9Lr2Vx7Kp1N'
const webhook = {
  webhookSecret: "whsec_Qm4Tz9Lr2Vx7Kp1N",
  body: '{"entity":"event","account_id":"acc_BFQ7uQEaa7j2z7","event":"payment.captured","contains":["payment"],"payload":{"payment":{"entity":{"id":"pay_N8FVRD1DzYzBh1","entity":"payment","amount":129900,"currency":"INR","status":"captured","order_id":"order_N8FRN5zTm5S3wx","method":"upi","captured":true,"notes":{"transactionID":"42","note":"Tea, Earl Grey… decaf."},"error_code":null,"error_description":null,"created_at":1701688721}}},"created_at":1701688722}',
  signature: "cb140285292e6142c41231d0ef90c35b64887097d85c3db0b2d5b4693f519b0a",
};

test("accepts Checkout's signature over the stored order ID and the payment ID", async () => {
  assert.equal(await verifyPaymentSignature(checkout), true);
  assert.equal(
    await verifyPaymentSignature({ ...checkout, signature: checkout.signature.toUpperCase() }),
    true,
  );
});

test("rejects a payment signature for another order, payment or key secret", async () => {
  assert.equal(
    await verifyPaymentSignature({ ...checkout, orderID: "order_N8FRN5zTm5S3wy" }),
    false,
  );
  assert.equal(
    await verifyPaymentSignature({ ...checkout, paymentID: "pay_N8FUmetkCE2hZP" }),
    false,
  );
  assert.equal(await verifyPaymentSignature({ ...checkout, keySecret: "another-secret" }), false);
});

test("rejects a payment signature that is tampered with or not a SHA-256 hex digest", async () => {
  const flipped = `${checkout.signature.slice(0, -1)}7`;
  assert.equal(await verifyPaymentSignature({ ...checkout, signature: flipped }), false);
  assert.equal(await verifyPaymentSignature({ ...checkout, signature: "" }), false);
  assert.equal(
    await verifyPaymentSignature({ ...checkout, signature: checkout.signature.slice(0, 62) }),
    false,
  );
  assert.equal(
    await verifyPaymentSignature({ ...checkout, signature: `${checkout.signature}00` }),
    false,
  );
  assert.equal(
    await verifyPaymentSignature({ ...checkout, signature: `zz${checkout.signature.slice(2)}` }),
    false,
  );
});

test("accepts a webhook signed over its raw body", async () => {
  assert.equal(await verifyWebhookSignature(webhook), true);
});

test("rejects a webhook whose body or signature was changed", async () => {
  assert.equal(
    await verifyWebhookSignature({ ...webhook, body: webhook.body.replace("129900", "100") }),
    false,
  );
  assert.equal(
    await verifyWebhookSignature({
      ...webhook,
      body: JSON.stringify(JSON.parse(webhook.body), null, 2),
    }),
    false,
  );
  assert.equal(await verifyWebhookSignature({ ...webhook, body: `${webhook.body}\n` }), false);
  assert.equal(await verifyWebhookSignature({ ...webhook, signature: checkout.signature }), false);
  assert.equal(
    await verifyWebhookSignature({ ...webhook, webhookSecret: checkout.keySecret }),
    false,
  );
});

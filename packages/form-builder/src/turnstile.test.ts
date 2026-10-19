import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyTurnstile } from "./turnstile.ts";

const check = { token: "token", secret: "secret", hostname: "example.mu" };
const siteverify =
  (body: object, status = 200): typeof fetch =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

test("passes a token Cloudflare accepted for this host", async () => {
  const fetcher = siteverify({ success: true, hostname: "example.mu", "error-codes": [] });
  assert.equal(await verifyTurnstile(check, fetcher), true);
});

test("rejects a token Cloudflare rejected, or accepted for another host", async () => {
  const rejected = siteverify({ success: false, "error-codes": ["timeout-or-duplicate"] });
  assert.equal(await verifyTurnstile(check, rejected), false);
  const elsewhere = siteverify({ success: true, hostname: "attacker.example", "error-codes": [] });
  assert.equal(await verifyTurnstile(check, elsewhere), false);
});

test("treats a Siteverify outage as unverified", async () => {
  assert.equal(await verifyTurnstile(check, siteverify({}, 500)), false);
});

test("accepts the testing keys' results, which always name example.com", async () => {
  const testing = siteverify({
    success: true,
    hostname: "example.com",
    "error-codes": [],
    metadata: { result_with_testing_key: true },
  });
  assert.equal(await verifyTurnstile(check, testing), true);
});

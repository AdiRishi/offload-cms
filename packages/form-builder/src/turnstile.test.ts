import assert from "node:assert/strict";
import { test } from "node:test";

import { verifyTurnstile } from "./turnstile.ts";

const check = { token: "token", secret: "secret", hostname: "example.mu", action: "form" };
const siteverify =
  (body: object, status = 200): typeof fetch =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

test("passes a token Cloudflare accepted for this host and action", async () => {
  const fetcher = siteverify({
    success: true,
    hostname: "example.mu",
    action: "form",
    "error-codes": [],
  });
  assert.equal(await verifyTurnstile(check, fetcher), true);
});

test("rejects a token Cloudflare rejected, or accepted for another host", async () => {
  const rejected = siteverify({ success: false, "error-codes": ["timeout-or-duplicate"] });
  assert.equal(await verifyTurnstile(check, rejected), false);
  const elsewhere = siteverify({
    success: true,
    hostname: "attacker.example",
    action: "form",
    "error-codes": [],
  });
  assert.equal(await verifyTurnstile(check, elsewhere), false);
});

test("rejects a token issued for another action on this host", async () => {
  const login = siteverify({
    success: true,
    hostname: "example.mu",
    action: "login",
    "error-codes": [],
  });
  assert.equal(await verifyTurnstile(check, login), false);
});

test("treats a Siteverify outage as unverified", async () => {
  assert.equal(await verifyTurnstile(check, siteverify({}, 500)), false);
});

test("accepts the testing keys' results, which always name example.com and no action", async () => {
  const testing = siteverify({
    success: true,
    hostname: "example.com",
    action: "",
    "error-codes": [],
    metadata: { result_with_testing_key: true },
  });
  assert.equal(await verifyTurnstile(check, testing), true);
});

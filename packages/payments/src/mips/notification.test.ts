import assert from "node:assert/strict";
import { test } from "node:test";

import { readCryptedCallback } from "./notification.ts";

test("reads the ciphertext from a form-encoded notification", () => {
  const body = "crypted_callback=aGVsbG8%2Bd29y%2FbGQ%3D&id_order=Ab3dE5gH7jK9mN1pQ3sT";
  assert.equal(readCryptedCallback(body), "aGVsbG8+d29y/bGQ=");
});

test("reads the ciphertext from a JSON notification", () => {
  assert.equal(
    readCryptedCallback(' {"crypted_callback":"aGVsbG8+d29y/bGQ="}'),
    "aGVsbG8+d29y/bGQ=",
  );
});

test("finds no ciphertext in a body without one", () => {
  for (const body of [
    "",
    "id_order=Ab3dE5gH7jK9mN1pQ3sT",
    "crypted_callback=",
    "{}",
    '{"crypted_callback":42}',
    '{"crypted_callback":',
  ]) {
    assert.equal(readCryptedCallback(body), undefined, body);
  }
});

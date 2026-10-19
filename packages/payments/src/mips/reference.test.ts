import assert from "node:assert/strict";
import { test } from "node:test";

import { createReference, referenceSchema } from "./reference.ts";

const references = Array.from({ length: 2000 }, createReference);

test("makes 20-character alphanumeric references that mIPS accepts as an id_order", () => {
  for (const reference of references) {
    assert.match(reference, /^[A-Za-z0-9]{20}$/);
    assert.ok(referenceSchema.safeParse(reference).success);
  }
});

test("draws references from all 62 letters and digits without repeating", () => {
  assert.equal(new Set(references).size, references.length);
  assert.equal(new Set(references.join("")).size, 62);
});

test("accepts only the reference format from a browser", () => {
  for (const reference of [
    "Ab3dE5gH7jK9mN1pQ3s",
    "Ab3dE5gH7jK9mN1pQ3sT1",
    "Ab3dE5gH7jK9mN1pQ3s-",
  ]) {
    assert.equal(referenceSchema.safeParse(reference).success, false, reference);
  }
});

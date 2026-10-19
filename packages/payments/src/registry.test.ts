import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

type Registry = { items: { files: { path: string; target: string }[] }[] };

const packageDir = path.resolve(import.meta.dirname, "..");
const registry: Registry = JSON.parse(readFileSync(path.join(packageDir, "registry.json"), "utf8"));
const e2eComponents = path.resolve(packageDir, "../../e2e/src/components");

// The e2e site installs the registry with the shadcn CLI and keeps the files, as a site does.
// Its suite tests those copies, so they must be the files the registry serves.
test("the e2e site's copies of the registry components match the registry", () => {
  for (const file of registry.items.flatMap((item) => item.files)) {
    const installed = path.join(e2eComponents, file.target.replace(/^@components\//, ""));
    assert.equal(
      readFileSync(installed, "utf8"),
      readFileSync(path.join(packageDir, file.path), "utf8"),
      `${path.relative(packageDir, installed)} differs from ${file.path}. Reinstall it with the shadcn CLI.`,
    );
  }
});

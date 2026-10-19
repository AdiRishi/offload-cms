import assert from "node:assert/strict";
// Node builds this namespace now, before Wrangler loads node:domain, as it does in Vite dev.
import * as events from "node:events";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, test } from "node:test";

/** A site whose `wrangler`, like the real one, loads node:domain. */
const site = () => {
  const root = mkdtempSync(path.join(tmpdir(), "offload-site-"));
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "site" }));
  const wrangler = path.join(root, "node_modules", "wrangler");
  mkdirSync(wrangler, { recursive: true });
  writeFileSync(path.join(wrangler, "package.json"), JSON.stringify({ name: "wrangler" }));
  writeFileSync(
    path.join(wrangler, "index.js"),
    `require("node:domain");
exports.getPlatformProxy = async ({ environment }) => ({ env: { environment }, dispose: async () => {} });`,
  );
  return root;
};

before(() => {
  process.chdir(site());
});

test("CommonJS packages still get EventEmitter from node:events after Wrangler loads", async () => {
  const { getBindings } = await import("./index.ts");
  await getBindings();

  const exports: Record<string, unknown> = createRequire(import.meta.url)("node:events");
  const stale = Object.keys(events).filter(
    (key) => key !== "default" && Reflect.get(events, key) !== exports[key],
  );
  assert.deepEqual(stale, []);
});

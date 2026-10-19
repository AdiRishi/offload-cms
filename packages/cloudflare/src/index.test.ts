import assert from "node:assert/strict";
// Node builds this namespace now, before Wrangler loads node:domain, as it does in Vite dev.
import * as events from "node:events";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, test } from "node:test";

/**
 * A site whose `wrangler` records each platform proxy it starts and, like the
 * real one, loads node:domain.
 */
const site = () => {
  const root = mkdtempSync(path.join(tmpdir(), "offload-site-"));
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "site" }));
  const wrangler = path.join(root, "node_modules", "wrangler");
  mkdirSync(wrangler, { recursive: true });
  writeFileSync(path.join(wrangler, "package.json"), JSON.stringify({ name: "wrangler" }));
  writeFileSync(
    path.join(wrangler, "index.js"),
    `require("node:domain");
exports.started = [];
exports.getPlatformProxy = async ({ environment }) => {
  const env = { environment };
  exports.started.push(env);
  return { env, dispose: async () => {} };
};`,
  );
  return root;
};

const startedProxies = (): unknown[] =>
  createRequire(path.join(process.cwd(), "package.json"))("wrangler").started;

before(() => {
  process.chdir(site());
  delete process.env.CLOUDFLARE_ENV;
});

test("one platform proxy serves every call in the process, including from a reloaded module", async () => {
  const { getBindings } = await import("./index.ts");
  // A query string evaluates the module again, as a Vite dev config reload does.
  const reloaded: typeof import("./index.ts") = await import(
    new URL("index.ts?reload", import.meta.url).href
  );

  const [first, concurrent] = await Promise.all([getBindings(), getBindings()]);
  const afterReload = await reloaded.getBindings();

  assert.equal(concurrent, first);
  assert.equal(afterReload, first);
  assert.deepEqual(startedProxies(), [{ environment: undefined }]);
});

test("another Wrangler environment gets its own platform proxy", async () => {
  const { getBindings } = await import("./index.ts");

  const defaultBindings = await getBindings();
  process.env.CLOUDFLARE_ENV = "postgres";
  const postgresBindings = await getBindings();
  delete process.env.CLOUDFLARE_ENV;

  assert.deepEqual(postgresBindings, { environment: "postgres" });
  assert.equal(await getBindings(), defaultBindings);
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

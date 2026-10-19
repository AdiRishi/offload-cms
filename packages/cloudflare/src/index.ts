import type { PoolConfig } from "pg";

import { createRequire, syncBuiltinESMExports } from "node:module";
import path from "node:path";

type Wrangler = Pick<typeof import("wrangler"), "getPlatformProxy">;

const isWorkerd = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

const isWrangler = (value: unknown): value is Wrangler =>
  typeof value === "object" &&
  value !== null &&
  "getPlatformProxy" in value &&
  typeof value.getPlatformProxy === "function";

/**
 * Returns the Worker's bindings. Inside workerd they come from the runtime.
 * In Node (Vite dev and the Payload CLI) they come from Wrangler's platform
 * proxy, which serves the same local D1 and R2 state as `vite preview`.
 *
 * Call it with top-level await in `payload.config.ts`.
 */
export const getBindings = async (): Promise<Cloudflare.Env> => {
  if (isWorkerd) return (await import("cloudflare:workers")).env;

  // Required from the app's directory so Vite never adds Wrangler to the module graph.
  const wrangler: unknown = createRequire(path.join(process.cwd(), "package.json"))("wrangler");
  if (!isWrangler(wrangler))
    throw new Error("Install wrangler to use Cloudflare bindings outside workerd.");
  // Wrangler loads node:domain, which replaces properties of the node:events exports. Vite's
  // module runner hands CommonJS packages such as undici the ESM namespace of node:events
  // whenever it differs from those exports, so their `class extends EventEmitter` would fail.
  syncBuiltinESMExports();

  const proxy = await wrangler.getPlatformProxy<Cloudflare.Env>({
    environment: process.env.CLOUDFLARE_ENV,
  });
  return proxy.env;
};

/**
 * Pool options for `postgresAdapter` behind Hyperdrive. Workers only allow
 * reading the Hyperdrive binding inside a request, and Payload opens its pool
 * there, so the connection string is read lazily. `maxUses: 1` gives every
 * query a fresh connection; Hyperdrive does the pooling.
 *
 * The pool has no size limit, so a request never waits for another request's
 * connection. pg-pool opens a waiting request's connection when another
 * request releases one, inside the releasing request, and workerd cancels a
 * request that uses I/O another request opened.
 */
export const hyperdrivePoolConfig = (
  hyperdrive: Hyperdrive,
  options: PoolConfig = {},
): PoolConfig => ({
  max: Infinity,
  maxUses: 1,
  ...options,
  get connectionString() {
    return hyperdrive.connectionString;
  },
});

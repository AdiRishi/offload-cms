# @arishi/offload-cloudflare

Runs Offload (Payload v4 with TanStack Start) on Cloudflare Workers.

| Export                                                           | What it does                                                                                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@arishi/offload-cloudflare/vite` → `offloadVite()`              | The Vite config. `vite build` and `vite preview` target workerd; `vite dev` runs in Node.                                                                                  |
| `@arishi/offload-cloudflare` → `getBindings()`                   | The Worker's bindings: from workerd at runtime, and from Wrangler's platform proxy in Node (dev and the Payload CLI). Call it with top-level await in `payload.config.ts`. |
| `@arishi/offload-cloudflare` → `hyperdrivePoolConfig()`          | Pool options for `postgresAdapter` behind Hyperdrive                                                                                                                       |
| `@arishi/offload-cloudflare/worker` → `createPayloadWorker()`    | The Worker entry: TanStack Start serves requests, and each Cron Trigger runs Payload's jobs, including scheduled publishing                                                |
| `@arishi/offload-cloudflare/routes` → `payloadGraphQLHandlers()` | Handlers for a `/_payload/api/graphql` route                                                                                                                               |

## What `offloadVite()` fixes

Payload's TanStack Start adapter is built for a Node server. On a workerd build, `offloadVite()`:

- drops the adapter's Node externals, because a Worker has no `node_modules`
- removes the `browser` resolve condition for server code, which otherwise loads Payload's client-only entry
- replaces `import.meta.url`, which is undefined in a Worker bundle, with a placeholder
- makes the adapter's hidden GraphQL imports literal, so they bundle
- resolves every `graphql` import to one build; two copies break every query with arguments
- resolves `pg-pool` to its CommonJS build for Postgres
- imports `@cloudflare/vite-plugin` only for build and preview, because loading it breaks Node-mode dev

Each fix has a comment in `src/vite.ts`. [`apps/e2e`](../../apps/e2e) is the working example and the test bed.

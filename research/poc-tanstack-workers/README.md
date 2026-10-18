# PoC: Payload v4 on TanStack Start and Cloudflare Workers

Payload `4.0.0-beta.2` from npm, TanStack Start with the admin panel, D1 for the database, R2 for uploads, and a Cron Trigger that runs Payload jobs. The production build runs in workerd. Findings are in [`../payload-v4-assessment.md`](../payload-v4-assessment.md).

## Run it

```bash
pnpm install
pnpm cf-typegen
pnpm payload migrate
pnpm build
pnpm preview
```

`pnpm preview` serves the Worker bundle in local workerd on <http://localhost:4173>. Open `/admin` to create the first user, then publish a page with the slug `hello` and open `/hello`.

`pnpm dev` runs Vite in Node, not workerd. It reaches the same local D1 and R2 state through Wrangler's platform proxy (`src/cloudflare.ts`).

## Where the Workers fixes live

| File | What it does |
| --- | --- |
| `vite.config.ts` | Five small Vite plugins and an externals reset that make the `@payloadcms/tanstack-start` build run in workerd. Each one has a comment that explains it. |
| `src/cloudflare.ts` | Reads bindings from `cloudflare:workers` in workerd and from `getPlatformProxy` in Node, so the Payload CLI and Vite dev use the same local state. |
| `src/server.ts` | Custom Worker entry: TanStack Start's `fetch` plus a `scheduled` handler that queues and runs a Payload job. |
| `src/app/_payload/api.graphql.ts` | GraphQL route. The upstream template only routes REST. |

On production Workers, password hashing fails until Payload caps PBKDF2 iterations. Local workerd does not enforce that limit. The fix is the patch in [`upstream/patches`](../../upstream/patches).

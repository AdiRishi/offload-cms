---
name: offload
description: Use when working in a Payload site that installs Offload (`@adirishi/offload-*` packages, `offloadVite`, `createPayloadWorker`), or when running Payload with TanStack Start on Cloudflare Workers.
---

# Offload

Offload is Payload v4 with a few patches, built to run a TanStack Start site as one Cloudflare Worker. A site installs each Payload package under its upstream name as an npm alias of the Offload build:

```json
"payload": "npm:@adirishi/offload-payload@<version>"
```

So the code, the config, and every API are Payload's. For collections, fields, hooks, access control, queries, jobs, plugins, and any other Payload task, read Payload's skill at `node_modules/payload/skills/payload/SKILL.md`. That skill assumes Next.js on Node. Where it conflicts with the rules below, follow the rules below.

## What differs from Payload's skill

**TanStack Start replaces Next.js.** Routes live in `src/app`. Payload's routes are in `src/app/_payload/`, and the admin is always at `/admin`. Next.js APIs (`next/headers`, `revalidatePath`, `next.config`, `@payloadcms/next`) don't exist here. To read content for a page, call the Local API in a server function and import Payload inside the handler:

```ts
const getPosts = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getPayload }, { default: config }] = await Promise.all([
    import("payload"),
    import("@payload-config"),
  ]);
  const payload = await getPayload({ config });
  return (await payload.find({ collection: "posts" })).docs;
});
```

**Two runtimes.** `vite dev` runs in Node. `vite build` and `vite preview` run the Worker bundle in workerd, which is what production runs. Check runtime behaviour with `vite build && vite preview`. `vite.config.ts` uses `offloadVite()` from `@adirishi/offload-cloudflare/vite`.

**Bindings replace environment variables.** `payload.config.ts` gets D1, R2, Hyperdrive, and secrets from `await getBindings()` (from `@adirishi/offload-cloudflare`). Declare bindings in `wrangler.jsonc`. Put local secrets such as `PAYLOAD_SECRET` in `.dev.vars` and deployed ones in `wrangler secret put`. `CLOUDFLARE_ENV` selects the Wrangler environment for the Payload CLI and the build.

**Database and storage adapters take bindings:**

- D1: `sqliteD1Adapter({ binding: env.D1, push: false, migrationDir })`
- Postgres: `postgresAdapter({ pool: hyperdrivePoolConfig(env.HYPERDRIVE), push: false, migrationDir })`
- R2: `r2Storage({ bucket: env.R2, collections: { media: true } })`

**Cron Triggers run jobs.** The Worker entry is `createPayloadWorker({ config, handler })` from `@adirishi/offload-cloudflare/worker`. Each Cron Trigger in `wrangler.jsonc` queues scheduled jobs and runs the due ones. Scheduled publishing depends on it.

**GraphQL needs a route.** `src/app/_payload/api.graphql.ts` serves it with `payloadGraphQLHandlers()` from `@adirishi/offload-cloudflare/routes`.

**Workers runtime limits:**

- Create users through the Worker, with the admin or the API. A user created in Node, through the Payload CLI or a seed script, gets a password hash that a deployed Worker can't verify.
- `sharp` can't run, so uploads keep the original image and `imageSizes` and crops aren't generated.
- Nodemailer can't open sockets. Send email through an adapter that uses `fetch`, such as `@payloadcms/email-resend`.

**Every Payload package must be an Offload build.** That covers `payload` and every `@payloadcms/*` package, including plugins and adapters you add later. Install each one under its upstream name, for example `"@payloadcms/plugin-seo": "npm:@adirishi/offload-plugin-seo@<version>"`, at the same version as the rest. An upstream `@payloadcms/*` version breaks the site in two ways:

- Payload's dev server throws when its packages' versions differ.
- The upstream package installs its own upstream copies of other Payload packages, such as `@payloadcms/ui`, without Offload's patches.

`offloadVite()` enforces this. `vite dev` and `vite build` stop when a Payload dependency of the site is Payload's own build or a different Offload release, and `vite build` fails when any bundled module comes from Payload's own build. Each error gives the line to install. If a third-party dependency installs a Payload package, add that line to your package manager's overrides.

Third-party plugins that list `payload` as a peer dependency install normally. Change every `@adirishi/offload-*` version together when you update.

The Offload docs at https://adirishi.github.io/offload-cms list each patch to Payload and the known limits on Workers.

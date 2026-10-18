# Databases: D1 or Postgres through Hyperdrive

Offload supports two databases on Workers. The e2e suite runs against both. Pick per site.

## D1

D1 is the default. Use it for content sites.

D1 has no transactions you can open and commit, so Payload runs without them. That is Payload's documented behaviour for databases without transactions, and it is also its default for all SQLite. Each statement commits on its own. Validation and `beforeChange` hooks run before any write, so the common failures leave the database untouched. A Worker that dies partway through a save can leave a document half-written; restore it from its versions. An `afterChange` hook that throws doesn't undo the save.

This is a property of D1, and it is accepted.

```ts
sqliteD1Adapter({ binding: env.D1, migrationDir: "...", push: false });
```

## Postgres through Hyperdrive

Use Postgres for sites that need real transactions, such as anything that takes payments. Bind Hyperdrive in `wrangler.jsonc` and use the helper from `@adirishi/offload-cloudflare`:

```ts
import { hyperdrivePoolConfig } from "@adirishi/offload-cloudflare";

postgresAdapter({ pool: hyperdrivePoolConfig(env.HYPERDRIVE), migrationDir: "...", push: false });
```

`hyperdrivePoolConfig` handles two Workers rules:

- Workers only allow reading `env.HYPERDRIVE.connectionString` inside a request. The helper reads it lazily, when Payload opens its pool during the first request.
- It sets `maxUses: 1`, so every query gets a fresh connection and Hyperdrive does the pooling.

The Vite preset also resolves `pg-pool` to its CommonJS build. Without that, the Worker fails at startup with `Class extends value #<Object> is not a constructor`.

Known risk: Payload keeps one pool per isolate. Upstream issue [17335](https://github.com/payloadcms/payload/issues/17335) reports that a query which hangs until Workers cancels its request can leave that pool unusable for the rest of the isolate's life. The reported fix is a pool scoped to each request. It isn't in Offload yet, because it can't be reproduced locally. Add it if production shows the symptom: requests failing in about a millisecond, reported as a hang.

## Migrations

Migrations own the schema on both databases (`push: false`), so local runs and production can't drift. Each database keeps its own migration history, because the generated SQL differs. After a schema change, generate both:

```bash
pnpm payload migrate:create
```

Then again for Postgres:

```bash
CLOUDFLARE_ENV=postgres pnpm payload migrate:create
```

## Sessions and concurrent logins

Payload v4 stores sessions on the user document. Two logins for the same user at the same moment can overwrite each other's session, which signs out the first one. Postgres shows this more readily than D1, because its writes interleave. It matters for scripts and tests that log in in parallel; the e2e suite logs in once and shares the session.

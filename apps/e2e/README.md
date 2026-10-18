# Offload end-to-end tests

A Payload site on Cloudflare Workers that exists to be tested. It installs Offload from the registry the way a real site does, runs as a real Worker bundle in local workerd, and is driven by Playwright.

The suite tests what Offload changes or depends on, plus the main flows that prove Payload works on top of it. It doesn't re-test Payload's own features; Payload's test suite does that.

## Run it

From the repository root, with the local registry running (`pnpm registry`) and a release published (`pnpm release`):

```bash
pnpm test:e2e
```

To run against Postgres through Hyperdrive instead of D1 (needs Docker):

```bash
pnpm test:e2e:postgres
```

Each run starts from an empty database. `scripts/prepare.ts` resets local D1 and R2 state, or the Postgres schema. It then applies the migrations and builds the Worker for the selected database. Playwright serves the build with `vite preview`, and a setup step creates the first admin through the admin panel.

To read the Worker's logs, start the server yourself and let the suite reuse it:

```bash
node scripts/prepare.ts && pnpm preview
```

Then, in another terminal:

```bash
E2E_REUSE_SERVER=1 pnpm exec playwright test
```

## What the suite covers

| File                     | Covers                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/auth.setup.ts`    | Creating the first user through the admin, which hashes the password inside the Worker                                                                     |
| `tests/admin.spec.ts`    | The admin's rendering, server functions and saves: drafting, publishing and translating a page, uploading to R2, and a document that uses every field type |
| `tests/api.spec.ts`      | REST, GraphQL with arguments (which needs Offload's single-graphql fix), and access control                                                                |
| `tests/workers.spec.ts`  | R2 byte ranges, hooks and endpoints in the Worker, Cron-driven jobs and scheduled publishing, and the search and form-builder plugins                      |
| `tests/frontend.spec.ts` | TanStack Start routes rendering Payload content through the Local API                                                                                      |

## How the app is set up

| File                                           | Purpose                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler.jsonc`                               | D1 and R2 by default. The `postgres` environment binds Hyperdrive to the Docker Postgres in `docker-compose.yml`.                       |
| `src/payload.config.ts`                        | Picks the database adapter from whichever binding exists                                                                                |
| `src/migrations/d1`, `src/migrations/postgres` | One migration history per database. After a schema change, run `pnpm payload migrate:create`, and again with `CLOUDFLARE_ENV=postgres`. |
| `src/jobs.ts`                                  | A job task and workflow, and two endpoints that queue work for the Cron Trigger                                                         |
| `src/collections/FieldTypes.ts`                | Every field type that works on both SQLite and Postgres                                                                                 |

The `/api/e2e/*` endpoints exist only for the suite. Payload closes its jobs collection to REST, and real sites should keep it that way.

## Staging on Cloudflare

Some behaviour only shows up on a real deployment, such as the Workers limit on password hashing that patch 0001 works around. The `staging` environment in `wrangler.jsonc` deploys this app to the "Adishwar Rishi (Personal)" account as `offload-e2e-staging`, with its own D1 database and R2 bucket.

```bash
pnpm deploy:staging
```

This applies migrations to the remote D1 database, builds for staging, and deploys. The staging admin's credentials are in `.staging-admin.json`, which is gitignored. `PAYLOAD_SECRET` is a Wrangler secret on the Worker.

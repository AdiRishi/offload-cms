# Offload site template

A TanStack Start site with the Payload admin, running on Cloudflare Workers with D1 and R2. It installs Offload from the registry, the way a site in its own repository would. Copy this folder to start a new site.

## First run

Start the registry from the repo root (`pnpm registry`) and publish a release (`pnpm release`). Then:

```bash
cp .dev.vars.example .dev.vars
pnpm install
pnpm cf-typegen
pnpm payload migrate
pnpm build
pnpm preview
```

`pnpm preview` runs the Worker bundle in local workerd at <http://localhost:4173>. Open `/admin` to create the first user. A published page with slug `about` renders at `/about`.

## Development

`pnpm dev` runs Vite in Node on port 3000. Payload's CommonJS dependencies don't load in workerd's dev module runner. `getBindings()` from `@arishi/offload-cloudflare` reaches the same local D1 and R2 state that `pnpm preview` uses, through Wrangler's platform proxy. Check behaviour in `pnpm preview` before deploying.

After changing collections, run `pnpm payload migrate:create` and commit the migration.

## Smoke test

With `pnpm preview` running:

```bash
pnpm test:smoke
```

To test a deployed Worker, set `SMOKE_BASE_URL`, plus `SMOKE_EMAIL` and `SMOKE_PASSWORD` for an existing admin. The suite logs in, uploads to R2, publishes a page, checks it on the frontend and through GraphQL, fires the Cron Trigger (local only), and deletes what it created.

## Deploying

1. Create the D1 database and R2 bucket, and put their names and the database ID in `wrangler.jsonc`.
2. Set the secret with `pnpm wrangler secret put PAYLOAD_SECRET`.
3. Run `pnpm payload migrate` against the remote database: set `CLOUDFLARE_ENV` and mark the D1 binding `"remote": true`.
4. Run `pnpm deploy`.

Create the first user through the deployed site, not the Node CLI. On Workers, Offload hashes passwords with 100,000 PBKDF2 iterations, so Workers can't verify a hash the CLI creates at 600,000.

## Files

| File                    | Purpose                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`        | `offloadVite()` builds for workerd and runs dev in Node                                                         |
| `src/payload.config.ts` | Payload config. Bindings come from `getBindings()`.                                                             |
| `src/server.ts`         | Worker entry: TanStack Start for requests, Payload jobs on each Cron Trigger, which drives scheduled publishing |
| `src/app/_payload/`     | Admin, REST and GraphQL routes                                                                                  |
| `src/app/_frontend/`    | The website                                                                                                     |
| `tests/smoke.test.ts`   | The smoke suite                                                                                                 |

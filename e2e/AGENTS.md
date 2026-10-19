# e2e

`e2e` is a Payload site on Cloudflare Workers that Playwright drives. It is a separate pnpm project with its own pinned versions, because it installs Offload from a registry the way a site in its own repository does.

- `pnpm release e2e` from the repository root publishes the working tree and installs it here. After that, `pnpm test` in this directory reruns the suite against the installed release, and `CLOUDFLARE_ENV=postgres pnpm test` runs it on Postgres.
- The suite covers what Offload changes or depends on, plus the main editor flows. Payload's own test suite covers Payload's features.
- After a schema change, run `pnpm payload migrate:create` and `CLOUDFLARE_ENV=postgres pnpm payload migrate:create`. Each database keeps its own migrations.
- The `/api/e2e/*` endpoints exist only for the suite.

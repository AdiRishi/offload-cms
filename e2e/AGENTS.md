# e2e

`e2e` is a Payload site on Cloudflare Workers that Playwright drives. It is a separate pnpm project with its own pinned versions, because it installs Offload from a registry the way a site in its own repository does.

- For Payload work in this site, read `node_modules/@adirishi/offload-cloudflare/skills/offload/SKILL.md` first.
- `pnpm release e2e` from the repository root publishes the working tree and installs it here. After that, `pnpm test` in this directory reruns the suite against the installed release, and `CLOUDFLARE_ENV=postgres pnpm test` runs it on Postgres.
- The suite covers what Offload changes or depends on, plus the main editor flows. Payload's own test suite covers Payload's features.
- After a schema change, run `pnpm payload migrate:create` and `CLOUDFLARE_ENV=postgres pnpm payload migrate:create`. Each database keeps its own migrations.
- The `/api/e2e/*` endpoints exist only for the suite.
- `src/components/form-builder/` comes from Offload's shadcn registry, and `src/components/ui/` from shadcn's. After a change to `packages/form-builder/registry`, reinstall the copies the way a site does: run `pnpm --filter @repo/docs registry` from the repository root, serve it with `python3 -m http.server 4891 -d ../docs/public`, then run `pnpm exec shadcn add @offload/form-builder-form @offload/newsletter-signup --overwrite` here. A test in `packages/form-builder` fails while the copies differ from the registry.

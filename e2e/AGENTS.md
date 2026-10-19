# e2e

`e2e` is a Payload site on Cloudflare Workers that Playwright drives. It is a separate pnpm project with its own pinned versions, because it installs Offload from a registry the way a site in its own repository does.

- For Payload work in this site, read `node_modules/@adirishi/offload-cloudflare/skills/offload/SKILL.md` first.
- `pnpm release e2e` from the repository root publishes the working tree and installs it here. After that, `pnpm test` in this directory reruns the suite against the installed release, and `CLOUDFLARE_ENV=postgres pnpm test` runs it on Postgres.
- The root `pnpm check` skips this directory's lint and type checks, because they need the installed release. `pnpm release e2e` runs `pnpm typecheck` and `pnpm lint` here, and you can run them yourself after an install. `.oxlintrc.json` extends the root config.
- The suite covers what Offload changes or depends on, plus the main editor flows. Payload's own test suite covers Payload's features.
- Each database has exactly one migration, `src/migrations/{d1,postgres}/*_initial`, because every local run starts from an empty database. A schema change rewrites that migration in place and adds no migration files. Payload skips a migration whose name a database has already recorded, so `pnpm deploy:staging` drops every table in the staging D1 database with `migrate:fresh` before it deploys. Staging holds only test data. For each database, from this directory:
  1. Move every file in `src/migrations/<database>` to a temporary directory.
  2. Run `pnpm payload migrate:create initial`, with `CLOUDFLARE_ENV=postgres` for Postgres. drizzle-kit generates the whole schema, because no earlier snapshot exists.
  3. Copy the generated `.ts` and `.json` over the `_initial` files in the temporary directory, keeping their names. Delete the generated files, including the new `index.ts`, and move the files back.
  4. Check that `pnpm payload migrate:create --skip-empty` prints `Cancelled.` and that `git status` shows no new file in `src/migrations`.
- The `/api/e2e/*` endpoints exist only for the suite.
- To send a server function input that the site's components never send, call it with `callServerFn()` from `tests/fixtures.ts`. It posts to `/_serverFn/<id>` as TanStack Start's client does. In a production build, the ID is the SHA-256 of `<file>--<name>_createServerFn_handler`, with `<file>` relative to this directory. The input and the result are Seroval JSON, and the `sec-fetch-site: same-origin` header passes TanStack Start's CSRF check. `vite dev` uses other IDs, so the helper works only in the main suite.
- `src/components/form-builder/` comes from Offload's shadcn registry, and `src/components/ui/` from shadcn's. After a change to `packages/form-builder/registry`, reinstall the copies the way a site does: run `pnpm --filter @repo/docs registry` from the repository root, serve it with `python3 -m http.server 4891 -d ../docs/public`, then run `pnpm exec shadcn add @offload/form-builder-form @offload/newsletter-signup --overwrite` here. A test in `packages/form-builder` fails while the copies differ from the registry.

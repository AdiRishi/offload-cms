# e2e

`e2e` is a Payload site on Cloudflare Workers that Playwright drives. It is a separate pnpm project with its own pinned versions, because it installs Offload from a registry the way a site in its own repository does.

- For Payload work in this site, read `node_modules/@adirishi/offload-cloudflare/skills/offload/SKILL.md` first.
- `pnpm release e2e` from the repository root publishes the working tree and installs it here. After that, `pnpm test` in this directory reruns the suite against the installed release, and `CLOUDFLARE_ENV=postgres pnpm test` runs it on Postgres.
- The suite covers what Offload changes or depends on, plus the main editor flows. Payload's own test suite covers Payload's features.
- Each database has exactly one migration, `src/migrations/{d1,postgres}/*_initial`, because every run rebuilds an empty database. A schema change rewrites that migration in place and adds no migration files. For each database, from this directory:
  1. Move every file in `src/migrations/<database>` to a temporary directory.
  2. Run `pnpm payload migrate:create initial`, with `CLOUDFLARE_ENV=postgres` for Postgres. drizzle-kit generates the whole schema, because no earlier snapshot exists.
  3. Copy the generated `.ts` and `.json` over the `_initial` files in the temporary directory, keeping their names. Delete the generated files, including the new `index.ts`, and move the files back.
  4. Check that `pnpm payload migrate:create --skip-empty` prints `Cancelled.` and that `git status` shows no new file in `src/migrations`.
- The `/api/e2e/*` endpoints exist only for the suite.

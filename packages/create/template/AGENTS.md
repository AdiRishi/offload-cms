# AGENTS.md

A TanStack Start site and the Payload CMS admin, served by one Cloudflare Worker through Offload (`@adirishi/offload-*`), with content in D1, uploads in R2, and image variants from Cloudflare Images.

For Payload work in this site, read `node_modules/@adirishi/offload-cloudflare/skills/offload/SKILL.md` first.

## Commands

```bash
pnpm dev                    # vite dev in Node
pnpm build && pnpm preview  # the Worker bundle in local workerd
pnpm typecheck
pnpm cf-typegen             # after changing wrangler.jsonc or .dev.vars
pnpm generate:types         # after a schema change
pnpm generate:importmap     # after adding admin components
pnpm migrate:regenerate     # before the first deploy, after a schema change
pnpm db:reset               # empties local D1 and migrates it
pnpm admin:dev              # creates the local admin from .dev.vars
pnpm deploy                 # migrates, builds and deploys the production environment
```

Every command the project runs is a script in `package.json`. Add new ones there.

## Rules

- Until the first deploy, change the schema with `pnpm migrate:regenerate`, which rewrites the one `initial` migration. After it, add a migration with `pnpm payload migrate:create <name>` and commit it with its `.json` snapshot.
- Stop `pnpm dev` and `pnpm preview` before a `payload` command that writes, such as `migrate` or `admin:dev`. Two processes on one local D1 database break each other's writes.
- List a new secret in `secrets.required` in `wrangler.jsonc`, at the top level and in each environment that needs it, as well as in `.dev.vars` and `.dev.vars.example`. Wrangler loads only the listed secrets.
- The Payload CLI in the production environment reads its secrets from `.dev.vars.production`, which git ignores. The Worker's own secrets are set with `pnpm wrangler secret put <NAME> --env production`.
- Install each Payload package as an npm alias of its Offload build, and change every `@adirishi/offload-*` version together.

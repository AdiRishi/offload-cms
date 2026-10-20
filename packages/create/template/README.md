# {{name}}

A Payload site on Cloudflare Workers, made with [Offload](https://adirishi.github.io/offload-cms/).

## Set up

```bash
cp .dev.vars.example .dev.vars
pnpm install
pnpm cf-typegen
pnpm migrate:regenerate
pnpm admin:dev
pnpm dev
```

Then open `/admin` and log in with `DEV_ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD` from `.dev.vars`.

[Deploy to Cloudflare](https://adirishi.github.io/offload-cms/deploy) sets up the `production` environment in `wrangler.jsonc`.

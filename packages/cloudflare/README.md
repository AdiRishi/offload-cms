# @adirishi/offload-cloudflare

Runs a Payload v4 site built with TanStack Start as one Cloudflare Worker. This package is part of [Offload](https://adirishi.github.io/offload-cms/), and it works with the Offload builds of Payload.

It exports six functions:

| Function                                                              | Use it for                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `offloadVite()` from `@adirishi/offload-cloudflare/vite`              | The site's Vite config. `vite build` and `vite preview` target workerd. `vite dev` runs in Node. |
| `getBindings()` from `@adirishi/offload-cloudflare`                   | The Worker's bindings in `payload.config.ts`, in workerd and in Node.                            |
| `hyperdrivePoolConfig()` from `@adirishi/offload-cloudflare`          | Pool options for `postgresAdapter` behind Hyperdrive.                                            |
| `createPayloadWorker()` from `@adirishi/offload-cloudflare/worker`    | The Worker entry. TanStack Start serves requests, and each Cron Trigger runs Payload's jobs.     |
| `payloadApiHandlers()` from `@adirishi/offload-cloudflare/routes`     | The REST route, in place of the template's, so the Worker bundles one copy of Payload.           |
| `payloadGraphQLHandlers()` from `@adirishi/offload-cloudflare/routes` | A route for Payload's GraphQL API, which the TanStack Start template doesn't include.            |

## Install

The package is on GitHub Packages, which needs a token with the `read:packages` scope:

```ini
# .npmrc
@adirishi:registry=https://npm.pkg.github.com
```

pnpm 11.5.3 and later ignore `${...}` in a project `.npmrc`'s credentials, so give pnpm the token outside the repository, for example with `pnpm config set "//npm.pkg.github.com/:_authToken" <token>`. [Getting started](https://adirishi.github.io/offload-cms/getting-started) shows the other ways, including GitHub Actions.

```bash
pnpm add --save-exact @adirishi/offload-cloudflare
```

## Use it

```ts
// vite.config.ts
import { offloadVite } from "@adirishi/offload-cloudflare/vite";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig(
  offloadVite({ payloadConfigPath: path.resolve(import.meta.dirname, "src/payload.config.ts") }),
);
```

```ts
// src/payload.config.ts
import { getBindings } from "@adirishi/offload-cloudflare";
import { sqliteD1Adapter } from "@payloadcms/db-d1-sqlite";
import { buildConfig } from "payload";

const env = await getBindings();

export default buildConfig({
  db: sqliteD1Adapter({ binding: env.D1, push: false }),
  secret: env.PAYLOAD_SECRET,
  // collections, editor, plugins
});
```

```ts
// src/server.ts, the `main` file in wrangler.jsonc
import { createPayloadWorker } from "@adirishi/offload-cloudflare/worker";
import handler from "@tanstack/react-start/server-entry";

export default createPayloadWorker({ handler });
```

## Coding agents

The package ships an agent skill at `skills/offload/SKILL.md`. It covers what differs from stock Payload and points to Payload's own skill for the rest. Add this line to the site's `AGENTS.md`:

```md
For Payload work in this site, read `node_modules/@adirishi/offload-cloudflare/skills/offload/SKILL.md` first.
```

[Getting started](https://adirishi.github.io/offload-cms/getting-started) walks through a complete site. The [package reference](https://adirishi.github.io/offload-cms/cloudflare) lists every option and what `offloadVite()` changes in the build.

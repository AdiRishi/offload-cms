<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/public/brand/offload-logo-white.png">
    <img src="docs/public/brand/offload-logo.png" alt="Offload" width="320">
  </picture>
</p>

<p align="center"><strong>Payload CMS on Cloudflare Workers.</strong></p>

Offload runs a whole [Payload](https://payloadcms.com) site as one Cloudflare Worker. The TanStack Start frontend, the admin panel, the REST and GraphQL APIs, and scheduled jobs deploy together, on D1 and R2 or on Postgres through Hyperdrive.

Payload v4 can run on TanStack Start instead of Next.js, which makes Workers a realistic host. Upstream Payload doesn't build for Workers yet. A deployed Worker rejects its password hashing, GraphQL queries with arguments fail, and its Vite setup expects a Node server with `node_modules`. Offload fixes each of these and publishes the result to GitHub Packages as `@adirishi/offload-*`.

Your code doesn't change. A site installs Offload under the upstream package names, so `import { buildConfig } from "payload"` still works and Payload's own documentation still applies.

## What you get

- **Upstream Payload with a short patch list.** Offload is a pinned Payload release plus a few patches. Each patch says what breaks without it and when it can be dropped, so the list shrinks as upstream merges fixes. [See the patches](https://adirishi.github.io/offload-cms/patches).
- **One package for the Workers setup.** `@adirishi/offload-cloudflare` has the Vite preset, the bindings helper, and the Worker entry that runs Payload's jobs on a Cron Trigger.
- **A real site under test.** Every push publishes the packages to a throwaway registry, installs them in a Payload site, and runs a Playwright suite against its Worker build, once on D1 and once on Postgres.
- **Signed packages.** Every published tarball has a build provenance attestation that `gh attestation verify` checks.

## Quick start

These steps add Offload to an existing TanStack Start site. [Getting started](https://adirishi.github.io/offload-cms/getting-started) covers the whole setup, including routes, Wrangler, and the first run.

1. GitHub Packages needs a token, even for public packages. Create a token with the `read:packages` scope, export it as `GITHUB_TOKEN`, and add this `.npmrc` to the site:

   ```ini
   @adirishi:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```

2. Install Offload under the upstream names. Every Payload package in the site must be an Offload build at the same version, so add plugins the same way, such as `@payloadcms/plugin-seo@npm:@adirishi/offload-plugin-seo`:

   ```bash
   pnpm add --save-exact @adirishi/offload-cloudflare payload@npm:@adirishi/offload-payload @payloadcms/ui@npm:@adirishi/offload-ui @payloadcms/tanstack-start@npm:@adirishi/offload-tanstack-start @payloadcms/db-d1-sqlite@npm:@adirishi/offload-db-d1-sqlite
   ```

3. Build with the Offload Vite preset:

   ```ts
   // vite.config.ts
   import { offloadVite } from "@adirishi/offload-cloudflare/vite";
   import path from "node:path";
   import { defineConfig } from "vite";

   export default defineConfig(
     offloadVite({ payloadConfigPath: path.resolve(import.meta.dirname, "src/payload.config.ts") }),
   );
   ```

4. Export the Worker:

   ```ts
   // src/server.ts
   import { createPayloadWorker } from "@adirishi/offload-cloudflare/worker";
   import config from "@payload-config";
   import handler from "@tanstack/react-start/server-entry";

   export default createPayloadWorker({ config, handler });
   ```

Coding agents get a skill with the package. Add this line to the site's `AGENTS.md`:

```md
For Payload work in this site, read `node_modules/@adirishi/offload-cloudflare/skills/offload/SKILL.md` first.
```

## Status

Offload follows the Payload v4 betas. [`upstream/payload.json`](upstream/payload.json) names the release the current packages are built on. [Known limits](https://adirishi.github.io/offload-cms/limits) lists what works differently on Workers.

## Contributing

[Develop Offload](https://adirishi.github.io/offload-cms/contributing) covers setup, the repository layout, and how to change Payload.

Payload is MIT-licensed by Payload CMS, LLC. Offload is not affiliated with Payload.

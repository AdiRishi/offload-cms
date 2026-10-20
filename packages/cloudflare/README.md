# @adirishi/offload-cloudflare

Runs a Payload v4 site built with TanStack Start as one Cloudflare Worker: a Vite preset that builds Payload for workerd, the Worker entry that runs Payload's jobs on a Cron Trigger, API routes that bundle one copy of Payload, and helpers for bindings, Hyperdrive, and Turnstile. This package is part of [Offload](https://adirishi.github.io/offload-cms/) and works with the Offload builds of Payload.

## Install

The package is on GitHub Packages. [Getting started](https://adirishi.github.io/offload-cms/getting-started) sets up the registry and its token.

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
// src/server.ts, the `main` file in wrangler.jsonc
import { createPayloadWorker } from "@adirishi/offload-cloudflare/worker";
import handler from "@tanstack/react-start/server-entry";

export default createPayloadWorker({ handler });
```

In `payload.config.ts`, read D1, R2, and secrets with `await getBindings()`, which also works in `vite dev` and the Payload CLI.

The package ships an agent skill. Add this line to the site's `AGENTS.md`:

```md
For Payload work in this site, read `node_modules/@adirishi/offload-cloudflare/skills/offload/SKILL.md` first.
```

The [package reference](https://adirishi.github.io/offload-cms/cloudflare) explains what `offloadVite()` changes in the build and where Payload runs in the Worker.

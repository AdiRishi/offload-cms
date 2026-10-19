# @adirishi/offload-email-cloudflare

A Payload v4 email adapter that sends through Cloudflare Email Service, with a Worker's `send_email` binding and no API key. This package is part of [Offload](https://adirishi.github.io/offload-cms/), and it works with the Offload builds of Payload.

## Install

The package is on GitHub Packages, which needs a token with the `read:packages` scope:

```ini
# .npmrc
@adirishi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
pnpm add --save-exact @adirishi/offload-email-cloudflare
```

## Use it

Onboard the sending domain with `pnpm wrangler email sending enable example.com`, then bind Email Service:

```jsonc
// wrangler.jsonc
"send_email": [{ "name": "EMAIL" }]
```

```ts
// src/payload.config.ts
import { getBindings } from "@adirishi/offload-cloudflare";
import { cloudflareEmailAdapter } from "@adirishi/offload-email-cloudflare";
import { buildConfig } from "payload";

const env = await getBindings();

export default buildConfig({
  email: cloudflareEmailAdapter({
    binding: env.EMAIL,
    defaultFromAddress: "noreply@example.com",
    defaultFromName: "Example",
  }),
  // collections, db, editor
});
```

[Send email with Cloudflare Email Service](https://adirishi.github.io/offload-cms/email) covers local development and which Nodemailer options the adapter accepts.

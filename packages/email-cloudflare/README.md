# @adirishi/offload-email-cloudflare

A Payload v4 email adapter that sends through Cloudflare Email Service with a Worker's `send_email` binding, so the site needs no API key. This package is part of [Offload](https://adirishi.github.io/offload-cms/) and works with the Offload builds of Payload.

## Install

The package is on GitHub Packages. [Getting started](https://adirishi.github.io/offload-cms/getting-started) sets up the registry and its token.

```bash
pnpm add --save-exact @adirishi/offload-email-cloudflare
```

## Use it

Onboard the sending domain with `pnpm wrangler email sending enable example.com`, and bind Email Service in `wrangler.jsonc` with `"send_email": [{ "name": "EMAIL" }]`.

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

[Send email with Cloudflare Email Service](https://adirishi.github.io/offload-cms/email) covers local development and the Nodemailer options the adapter can't send.

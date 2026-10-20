# @adirishi/offload-payments

Razorpay and mIPS payment adapters for Payload's ecommerce plugin. Each charges the cart's stored subtotal and settles an order only after the gateway's API confirms the amount, currency, and status. A customer who pays and closes the tab still gets the order, because Razorpay's webhooks, the mIPS payment notification, and a reconciliation job on the Cron Trigger settle it on the server. This package is part of [Offload](https://adirishi.github.io/offload-cms/) and needs the Offload build of `@payloadcms/plugin-ecommerce`, whose patches add server-side settlement.

The checkout UI isn't in the package. Offload's shadcn registry installs editable components into the site.

## Install

The package is on GitHub Packages. [Getting started](https://adirishi.github.io/offload-cms/getting-started) sets up the registry and its token. Install both at the version of the site's other Offload packages.

```bash
pnpm add --save-exact @adirishi/offload-payments @payloadcms/plugin-ecommerce@npm:@adirishi/offload-plugin-ecommerce
```

## Use it

```ts
// src/payload.config.ts
import { getBindings } from "@adirishi/offload-cloudflare";
import { MUR, reconcilePaymentsTask } from "@adirishi/offload-payments";
import { razorpayAdapter } from "@adirishi/offload-payments/razorpay";
import { ecommercePlugin } from "@payloadcms/plugin-ecommerce";
import { buildConfig } from "payload";

const env = await getBindings();

const razorpay = razorpayAdapter({
  keyID: env.RAZORPAY_KEY_ID,
  keySecret: env.RAZORPAY_KEY_SECRET,
  webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
});

export default buildConfig({
  jobs: { tasks: [reconcilePaymentsTask({ adapters: [razorpay] })] },
  plugins: [
    ecommercePlugin({
      currencies: { defaultCurrency: "MUR", supportedCurrencies: [MUR] },
      payments: { paymentMethods: [razorpay] },
      // access, customers, carts
    }),
  ],
});
```

[Take payments at checkout](https://adirishi.github.io/offload-cms/checkout) covers the secrets, the webhook and notification URLs, `mipsAdapter()`, the registry components, and Content-Security-Policy.

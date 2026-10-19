# @adirishi/offload-payments

Razorpay and mIPS payment adapters for Payload's ecommerce plugin, for sites on Cloudflare Workers. Each adapter starts a payment from the cart's stored subtotal, and settles an order only after the gateway's API confirms the amount, the currency and the status. A customer who pays and closes the tab still gets the order: Razorpay's webhooks, the mIPS payment notification and a reconciliation job on the Cron Trigger settle it on the server. This package is part of [Offload](https://adirishi.github.io/offload-cms/), and it works with the Offload builds of Payload.

| Entry point                           | Exports                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `@adirishi/offload-payments`          | `MUR`, `INR`, `reconcilePaymentsTask()`, and the `OffloadPaymentAdapter` type |
| `@adirishi/offload-payments/razorpay` | `razorpayAdapter()`                                                           |
| `@adirishi/offload-payments/mips`     | `mipsAdapter()`                                                               |
| `@adirishi/offload-payments/client`   | `razorpayAdapterClient()`, `mipsAdapterClient()`                              |

The checkout UI is not in this package. Offload's shadcn registry installs editable components into the site: a Razorpay checkout button, the mIPS payment zone, and the mIPS return page.

## Install

The package is on GitHub Packages, which needs a token with the `read:packages` scope:

```ini
# .npmrc
@adirishi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Install it at the exact version of the site's other Offload packages, with the Offload build of the ecommerce plugin. Replace `VERSION` with that version, such as `4.0.0-beta.2-offload.9`:

```bash
pnpm add --save-exact @adirishi/offload-payments@VERSION \
  @payloadcms/plugin-ecommerce@npm:@adirishi/offload-plugin-ecommerce@VERSION
```

The adapters need Offload's build of `@payloadcms/plugin-ecommerce`, which exports the server-side settlement they use.

## Use it

```ts
// src/payload.config.ts
import { getBindings } from "@adirishi/offload-cloudflare";
import { INR, MUR, reconcilePaymentsTask } from "@adirishi/offload-payments";
import { mipsAdapter } from "@adirishi/offload-payments/mips";
import { razorpayAdapter } from "@adirishi/offload-payments/razorpay";
import { ecommercePlugin } from "@payloadcms/plugin-ecommerce";

const env = await getBindings();

const razorpay = razorpayAdapter({
  keyID: env.RAZORPAY_KEY_ID,
  keySecret: env.RAZORPAY_KEY_SECRET,
  webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
});
const mips = mipsAdapter({
  credentials: {
    username: env.MIPS_USERNAME,
    password: env.MIPS_PASSWORD,
    merchantID: env.MIPS_MERCHANT_ID,
    entityID: env.MIPS_ENTITY_ID,
    operatorID: env.MIPS_OPERATOR_ID,
    operatorPassword: env.MIPS_OPERATOR_PASSWORD,
    salt: env.MIPS_SALT,
    cipherKey: env.MIPS_CIPHER_KEY,
  },
  returnURL: "/checkout/mips",
});

export default buildConfig({
  jobs: { tasks: [reconcilePaymentsTask({ adapters: [razorpay, mips] })] },
  plugins: [
    ecommercePlugin({
      currencies: { defaultCurrency: "MUR", supportedCurrencies: [MUR, INR] },
      payments: { paymentMethods: [razorpay, mips] },
      // access, customers, carts
    }),
  ],
});
```

[Take payments at checkout](https://adirishi.github.io/offload-cms/checkout) covers the secrets, the webhook and notification URLs, the registry components, and Content-Security-Policy. The [package reference](https://adirishi.github.io/offload-cms/payments) lists every option and what each endpoint checks.

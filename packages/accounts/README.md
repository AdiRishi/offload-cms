# @adirishi/offload-accounts

Lets the visitors of a Payload site on TanStack Start sign up, log in, reset a forgotten password, and confirm their email, through an auth collection of their own next to the admin's users. It sets up the collection for site visitors, limits logins and password reset requests with a Workers rate limit, checks Cloudflare Turnstile at sign-up, and links account emails to the site's own pages. This package is part of [Offload](https://adirishi.github.io/offload-cms/), and it works with the Offload builds of Payload.

| Entry point                         | Exports                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@adirishi/offload-accounts`        | The Zod input schemas for the account forms, such as `logInInput` and `signUpInput`, and the result types |
| `@adirishi/offload-accounts/config` | `accountCollection()`, and the access helpers `isAdminUser` and `adminOrOwner()`                          |
| `@adirishi/offload-accounts/server` | `createAccountHelpers()`, for the site's server functions                                                 |

The forms are not in this package. Offload's shadcn registry installs editable components into the site: login, sign-up, forgot password, reset password, the email verification result, and an account menu.

Accounts need the Workers Paid plan, because each password hash costs about 10 ms of CPU. Payload v4 has no social login or magic links, and this package doesn't add them.

## Install

The package is on GitHub Packages, which needs a token with the `read:packages` scope:

```ini
# .npmrc
@adirishi:registry=https://npm.pkg.github.com
```

Give pnpm the token outside the repository, for example with `pnpm config set "//npm.pkg.github.com/:_authToken" <token>`. [Getting started](https://adirishi.github.io/offload-cms/getting-started) shows the other ways.

Install the package at the exact version of the site's other Offload packages. Replace `VERSION` with that version, such as `4.0.0-beta.2-offload.6`. The forms come from the `@offload` registry, which `components.json` needs:

```json
"rsc": true,
"registries": { "@offload": "https://adirishi.github.io/offload-cms/r/{name}.json" }
```

```bash
pnpm add --save-exact @adirishi/offload-accounts@VERSION
pnpm dlx shadcn@latest add @offload/login-form @offload/sign-up-form @offload/account-menu
```

## Use it

```ts
// src/collections/Customers.ts
import { accountCollection } from "@adirishi/offload-accounts/config";
import { getBindings } from "@adirishi/offload-cloudflare";

const env = await getBindings();

export const Customers = accountCollection(
  { slug: "customers", fields: [{ name: "name", type: "text" }] },
  { siteURL: env.SITE_URL, rateLimit: () => env.ACCOUNTS },
);
```

```ts
// src/server/account.functions.ts
import { logInInput } from "@adirishi/offload-accounts";
import { createAccountHelpers } from "@adirishi/offload-accounts/server";
import { hideServerErrors } from "@adirishi/offload-tanstack";
import { createServerFn } from "@tanstack/react-start";

import { getVisitorPayload } from "@/lib/payload.server";

const accounts = createAccountHelpers({ getPayload: getVisitorPayload, collection: "customers" });

export const logIn = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(logInInput)
  .handler(({ data }) => accounts.logIn(data));
```

`ACCOUNTS` is a Rate Limiting binding, and `SITE_URL` is a variable in `wrangler.jsonc`. Name the admin's collection in `admin.user`, and check `req.user.collection` in access rules, because a customer is a logged-in user too.

[Add customer accounts](https://adirishi.github.io/offload-cms/customer-accounts) covers the bindings, every server function, the registry, and the route files. The [package reference](https://adirishi.github.io/offload-cms/accounts) lists every option and result.

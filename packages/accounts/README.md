# @adirishi/offload-accounts

Lets a site's visitors sign up, log in, reset a forgotten password, and confirm their email, through an auth collection of their own next to the admin's users. It rate-limits logins and reset requests, checks Turnstile at sign-up, links account emails to the site's pages, and keeps a stolen session from changing an account's email or password. This package is part of [Offload](https://adirishi.github.io/offload-cms/) and works with the Offload builds of Payload.

The forms aren't in the package. Offload's shadcn registry installs editable components into the site.

## Install

The package is on GitHub Packages. [Getting started](https://adirishi.github.io/offload-cms/getting-started) sets up the registry and its token. Install it at the version of the site's other Offload packages.

```bash
pnpm add --save-exact @adirishi/offload-accounts
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
import { createServerFn } from "@tanstack/react-start";

import { getVisitorPayload } from "@/lib/payload.server";

const accounts = createAccountHelpers({ getPayload: getVisitorPayload, collection: "customers" });

export const logIn = createServerFn({ method: "POST" })
  .validator(logInInput)
  .handler(({ data }) => accounts.logIn(data));
```

Once a second auth collection exists, `req.user` can be a customer, so check `req.user.collection` in access rules. [Add customer accounts](https://adirishi.github.io/offload-cms/customer-accounts) covers the bindings, every server function, and the route files.

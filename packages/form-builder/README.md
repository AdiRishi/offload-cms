# @adirishi/offload-form-builder

Takes submissions to Payload form-builder forms from a public TanStack Start site. It derives one Zod schema from a form's fields for the browser and the server, verifies Cloudflare Turnstile tokens, applies a Workers rate limit, and saves the submission only after those checks pass. This package is part of [Offload](https://adirishi.github.io/offload-cms/), and it works with the Offload builds of Payload.

| Entry point                             | Exports                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `@adirishi/offload-form-builder`        | `formSchema()`, `defaultValues()`, `submissionData()`, `isInputField()`, `submissionInput`, `countries`, and their types |
| `@adirishi/offload-form-builder/server` | `saveFormSubmission()`, `verifyTurnstile()`                                                                              |

The form's UI is not in this package. Offload's shadcn registry installs editable components into the site: the form renderer, its fields, the Turnstile widget, and a newsletter sign-up.

## Install

The package is on GitHub Packages, which needs a token with the `read:packages` scope:

```ini
# .npmrc
@adirishi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Install the package at the same version as the site's other Offload packages. The registry items depend on `@offload/turnstile`, so add the `@offload` registry to `components.json`. Set `rsc` to `true` too, or the CLI removes `"use client"` from the components.

```json
"rsc": true,
"registries": { "@offload": "https://adirishi.github.io/offload-cms/r/{name}.json" }
```

```bash
pnpm add --save-exact @adirishi/offload-form-builder
pnpm dlx shadcn@latest add @offload/form-builder-form
```

## Use it

```ts
// src/server/forms.functions.ts
import { getBindings } from "@adirishi/offload-cloudflare";
import { submissionInput } from "@adirishi/offload-form-builder";
import { saveFormSubmission } from "@adirishi/offload-form-builder/server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const submitForm = createServerFn({ method: "POST" })
  .validator(submissionInput)
  .handler(async ({ data }) => {
    const [{ getPayload }, { default: config }, env] = await Promise.all([
      import("payload"),
      import("@payload-config"),
      getBindings(),
    ]);
    return saveFormSubmission({
      submission: data,
      payload: await getPayload({ config }),
      request: getRequest(),
      turnstileSecret: env.TURNSTILE_SECRET_KEY,
      rateLimit: env.SUBMISSIONS,
    });
  });
```

[Take form submissions](https://adirishi.github.io/offload-cms/forms) covers the bindings, the registry, and the rule that decides which forms a page offers. The [package reference](https://adirishi.github.io/offload-cms/form-builder) lists every option.

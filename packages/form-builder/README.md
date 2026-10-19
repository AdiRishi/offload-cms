# @adirishi/offload-form-builder

Takes submissions to Payload form-builder forms from a public TanStack Start site. It derives one Zod schema from a form's fields for the browser and the server, checks a Cloudflare Turnstile token, applies a Workers rate limit, and saves the submission only after those checks pass. This package is part of [Offload](https://adirishi.github.io/offload-cms/), and it works with the Offload builds of Payload.

| Entry point                             | Exports                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `@adirishi/offload-form-builder`        | `formSchema()`, `defaultValues()`, `submissionData()`, `isInputField()`, `submissionInput`, `countries`, and their types |
| `@adirishi/offload-form-builder/server` | `saveFormSubmission()`                                                                                                   |

The Turnstile check uses `verifyTurnstile()` from `@adirishi/offload-cloudflare`, a peer dependency that every Offload site already has.

The form's UI is not in this package. Offload's shadcn registry installs editable components into the site: the form renderer, its fields, the Turnstile widget, and a newsletter sign-up.

## Install

The package is on GitHub Packages, which needs a token with the `read:packages` scope:

```ini
# .npmrc
@adirishi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Install the package at the exact version of the site's other Offload packages. Replace `VERSION` below with that version, such as `4.0.0-beta.2-offload.6`. The registry items depend on `@offload/turnstile`, so add the `@offload` registry to `components.json`. Set `rsc` to `true` too, or the CLI removes `"use client"` from the components.

```json
"rsc": true,
"registries": { "@offload": "https://adirishi.github.io/offload-cms/r/{name}.json" }
```

```bash
pnpm add --save-exact @adirishi/offload-form-builder@VERSION
pnpm dlx shadcn@latest add @offload/form-builder-form
```

The registry serves the items built for the latest Offload release, and each item names that release of `@adirishi/offload-form-builder` in its `meta`, which `shadcn view` shows. Keep the package at that version, and when you update it, add the items again with `--overwrite`.

## Use it

```ts
// src/server/forms.functions.ts
import { getBindings } from "@adirishi/offload-cloudflare";
import { submissionInput } from "@adirishi/offload-form-builder";
import { saveFormSubmission } from "@adirishi/offload-form-builder/server";
import { hideServerErrors } from "@adirishi/offload-tanstack";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const submitForm = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(submissionInput)
  .handler(async ({ data }) => {
    const [{ getPayload }, { default: config }, env] = await Promise.all([
      import("payload"),
      import("@payload-config"),
      getBindings(),
    ]);
    const payload = await getPayload({ config });
    return saveFormSubmission({
      submission: data,
      payload,
      request: getRequest(),
      turnstileSecret: env.TURNSTILE_SECRET_KEY,
      rateLimit: env.SUBMISSIONS,
      // Accept only forms that a published page shows.
      isOffered: async (form) => {
        const { totalDocs } = await payload.count({
          collection: "pages",
          where: { "layout.form": { equals: form.id } },
          overrideAccess: false,
        });
        return totalDocs > 0;
      },
    });
  });
```

`isOffered` is required, because every form is publicly readable, including drafts and forms that no page shows. It receives the stored form. Pass `() => true` to accept every form.

[Take form submissions](https://adirishi.github.io/offload-cms/forms) covers the bindings, the registry, and the rule that decides which forms a page offers. The [package reference](https://adirishi.github.io/offload-cms/form-builder) lists every option.

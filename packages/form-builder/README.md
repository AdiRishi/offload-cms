# @adirishi/offload-form-builder

Takes submissions to Payload form-builder forms from a public TanStack Start site. One Zod schema, derived from the form's fields, validates the answers in the browser and again on the server. The server checks a Cloudflare Turnstile token and a Workers rate limit before it saves anything. This package is part of [Offload](https://adirishi.github.io/offload-cms/) and works with the Offload builds of Payload.

The form UI isn't in the package. Offload's shadcn registry installs editable components into the site.

## Install

The package is on GitHub Packages. [Getting started](https://adirishi.github.io/offload-cms/getting-started) sets up the registry and its token. Install it at the version of the site's other Offload packages.

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
    const payload = await getPayload({ config });
    return saveFormSubmission({
      submission: data,
      payload,
      request: getRequest(),
      turnstileSecret: env.TURNSTILE_SECRET_KEY,
      rateLimit: env.SUBMISSIONS,
      isOffered: async (form) =>
        (
          await payload.count({
            collection: "pages",
            where: { "layout.form": { equals: form.id } },
          })
        ).totalDocs > 0,
    });
  });
```

Every form is publicly readable, drafts included, so `isOffered` decides which forms take submissions. [Take form submissions](https://adirishi.github.io/offload-cms/forms) covers the bindings, the registry, and that rule.

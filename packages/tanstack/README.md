# @adirishi/offload-tanstack

Reads Payload content in a TanStack Start site the way a public site needs it: per request, with drafts for logged-in editors, Live Preview, redirects, and server errors kept out of the browser. This package is part of [Offload](https://adirishi.github.io/offload-cms/), and it works with the Offload builds of Payload.

| Export                                                            | Use it for                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `createPayloadHelpers()` from `@adirishi/offload-tanstack/server` | Payload for a request or a visitor, and the redirect lookup for a path with no page          |
| `hideServerErrors` from `@adirishi/offload-tanstack`              | Server function middleware that logs errors instead of sending their messages to the browser |
| `LivePreviewListener` from `@adirishi/offload-tanstack`           | Refreshing a page when an editor saves in the admin's Live Preview                           |

## Install

The package is on GitHub Packages, which needs a token with the `read:packages` scope:

```ini
# .npmrc
@adirishi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
pnpm add --save-exact @adirishi/offload-tanstack
```

Install it at the same version as the site's other Offload packages.

## Use it

```ts
// src/lib/payload.server.ts
import { createPayloadHelpers } from "@adirishi/offload-tanstack/server";

export const { getPayloadForRequest, getRequestPayload, getVisitorPayload, redirectOrNotFound } =
  createPayloadHelpers({
    getConfig: async () => (await import("@payload-config")).default,
    documentPath: ({ relationTo, value }) =>
      relationTo === "posts" ? `/posts/${value.slug}` : `/${value.slug}`,
  });
```

```ts
// A server function that serves drafts to editors
export const getPage = createServerFn({ method: "GET" })
  .middleware([hideServerErrors])
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const { payload, draft, user } = await getPayloadForRequest();
    const { docs } = await payload.find({
      collection: "pages",
      where: { slug: { equals: slug } },
      draft,
      user,
      overrideAccess: false,
    });
    if (!docs[0]) return redirectOrNotFound(`/${slug}`);
    return { draft, title: docs[0].title };
  });
```

Render `{draft && <LivePreviewListener />}` in the page's component. The [package reference](https://adirishi.github.io/offload-cms/tanstack) lists every option, and [Preview drafts and Live Preview](https://adirishi.github.io/offload-cms/live-preview) sets up the admin side.

# @adirishi/offload-tanstack

Reads Payload content in a TanStack Start site per request: drafts for logged-in editors, Live Preview, the redirects plugin's redirects, and server errors kept out of the browser. This package is part of [Offload](https://adirishi.github.io/offload-cms/) and works with the Offload builds of Payload.

## Install

The package is on GitHub Packages. [Getting started](https://adirishi.github.io/offload-cms/getting-started) sets up the registry and its token. Install it at the version of the site's other Offload packages.

```bash
pnpm add --save-exact @adirishi/offload-tanstack
```

## Use it

```ts
// src/start.ts
import { hideServerErrors } from "@adirishi/offload-tanstack";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  // A start instance replaces TanStack Start's default CSRF check, so keep it here.
  requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })],
  functionMiddleware: [hideServerErrors],
}));
```

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

In a server function, pass `draft` and `user` from `getPayloadForRequest()` to each query, with `overrideAccess: false`, and render `{draft && <LivePreviewListener />}` in the page. [Preview drafts and Live Preview](https://adirishi.github.io/offload-cms/live-preview) walks through a page.

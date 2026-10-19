---
name: offload
description: Use when working in a Payload site that installs Offload (`@adirishi/offload-*` packages, `offloadVite`, `createPayloadWorker`), or when running Payload with TanStack Start on Cloudflare Workers.
---

# Offload

Offload is Payload v4 with a few patches, built to run a TanStack Start site as one Cloudflare Worker. A site installs each Payload package under its upstream name as an npm alias of the Offload build:

```json
"payload": "npm:@adirishi/offload-payload@<version>"
```

So the code, the config, and every API are Payload's. For collections, fields, hooks, access control, queries, jobs, plugins, and any other Payload task, read Payload's skill at `node_modules/payload/skills/payload/SKILL.md`. That skill assumes Next.js on Node. Where it conflicts with the rules below, follow the rules below.

## What differs from Payload's skill

**TanStack Start replaces Next.js.** Routes live in `src/app`. Payload's routes are in `src/app/_payload/`, and the admin is always at `/admin`. Next.js APIs (`next/headers`, `revalidatePath`, `next.config`, `@payloadcms/next`) don't exist here. To read content for a page, call the Local API in a server function and import Payload inside the handler:

```ts
const getPosts = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getPayload }, { default: config }] = await Promise.all([
    import("payload"),
    import("@payload-config"),
  ]);
  const payload = await getPayload({ config });
  return (await payload.find({ collection: "posts" })).docs;
});
```

**Two runtimes.** `vite dev` runs in Node. `vite build` and `vite preview` run the Worker bundle in workerd, which is what production runs. Check runtime behaviour with `vite build && vite preview`. `vite.config.ts` uses `offloadVite()` from `@adirishi/offload-cloudflare/vite`.

**Bindings replace environment variables.** `payload.config.ts` gets D1, R2, Hyperdrive, and secrets from `await getBindings()` (from `@adirishi/offload-cloudflare`). Declare bindings in `wrangler.jsonc`. Put local secrets such as `PAYLOAD_SECRET` in `.dev.vars` and deployed ones in `wrangler secret put`. `CLOUDFLARE_ENV` selects the Wrangler environment for the Payload CLI and the build.

**Adapters take bindings:**

- D1: `sqliteD1Adapter({ binding: env.D1, push: false, migrationDir })`
- Postgres: `postgresAdapter({ pool: hyperdrivePoolConfig(env.HYPERDRIVE), push: false, migrationDir })`
- R2: `r2Storage({ bucket: env.R2, collections: { media: true } })`
- Email Service: `email: cloudflareEmailAdapter({ binding: env.EMAIL, defaultFromAddress, defaultFromName })` from `@adirishi/offload-email-cloudflare`, with `"send_email": [{ "name": "EMAIL" }]`. The `from` domain must be onboarded to Email Sending.
- Cloudflare Images: `upload: { transformers: [cloudflareTransformer({ transport: { mode: "binding", binding: () => env.IMAGES }, collections })] }` from `@payloadcms/transformer-cloudflare`, with `"images": { "binding": "IMAGES" }`. Pass the binding as a function, because Cloudflare's upload check loads the config without bindings and the transformer throws on an undefined one. `collections` sets upload `variants`, `crop`, and `focalPoint`, and `dynamic` enables `?width=` resizing.

**Cron Triggers run jobs.** The Worker entry is `createPayloadWorker({ config, handler })` from `@adirishi/offload-cloudflare/worker`. Each Cron Trigger in `wrangler.jsonc` queues scheduled jobs and runs the due ones. Scheduled publishing depends on it.

**GraphQL needs a route.** `src/app/_payload/api.graphql.ts` serves it with `payloadGraphQLHandlers()` from `@adirishi/offload-cloudflare/routes`.

**Workers runtime limits:**

- Create users through the Worker, with the admin or the API. A user created in Node, through the Payload CLI or a seed script, gets a password hash that a deployed Worker can't verify.
- Process images with the Cloudflare Images transformer above. `sharp` can't run, so `@payloadcms/transformer-sharp` fails on Workers.
- Send email with the Email Service adapter above, or another adapter that uses `fetch`, such as `@payloadcms/email-resend`. Nodemailer can't open sockets.

**Every Payload package must be an Offload build.** That covers `payload` and every `@payloadcms/*` package, including plugins and adapters you add later. Install each one under its upstream name, for example `"@payloadcms/plugin-seo": "npm:@adirishi/offload-plugin-seo@<version>"`, at the same version as the rest. An upstream `@payloadcms/*` version breaks the site in two ways:

- Payload's dev server throws when its packages' versions differ.
- The upstream package installs its own upstream copies of other Payload packages, such as `@payloadcms/ui`, without Offload's patches.

`offloadVite()` enforces this. `vite dev` and `vite build` stop when a Payload dependency of the site is Payload's own build or a different Offload release, and `vite build` fails when any bundled module comes from Payload's own build. Each error gives the line to install. If a third-party dependency installs a Payload package, add that line to your package manager's overrides.

Third-party plugins that list `payload` as a peer dependency install normally. Change every `@adirishi/offload-*` version together when you update.

## Site pages and forms

**Read page content through `@adirishi/offload-tanstack`**, instead of the `getPayload()` call above. Create the helpers once, in `src/lib/payload.server.ts`, with `createPayloadHelpers({ getConfig: async () => (await import("@payload-config")).default, documentPath })` from `@adirishi/offload-tanstack/server`:

- `getPayloadForRequest()` in server functions. Pass its `draft` and `user` to every query, with `overrideAccess: false`, so the collection's read access decides what the request sees. A logged-in editor then sees drafts on the page's normal URL.
- `getRequestPayload()` in async server components, so one render makes one auth lookup.
- `getVisitorPayload()`, with `overrideAccess: false`, for output that is the same for everyone and may be cached, such as a sitemap.
- `return redirectOrNotFound(pathname)` when a route finds no document. It follows the redirects plugin's redirects, and otherwise throws `notFound()`.

**Add `.middleware([hideServerErrors])` to every site server function.** `hideServerErrors` comes from `@adirishi/offload-tanstack`. TanStack Start sends a thrown error's message to the browser, and a failed Payload query's message contains its SQL.

**Live Preview** needs a path in `admin.livePreview.url`, such as `` ({ data }) => `/${data.slug}` ``, and `{draft && <LivePreviewListener />}` from `@adirishi/offload-tanstack` in the page's component. The admin and the site share one origin.

**Return rich text from a server function as a rendered element.** TanStack Start rejects Lexical JSON as not serializable. Render it with `renderServerComponent(<RichText data={doc.content} />)` from `@tanstack/react-start/rsc`, and return the result.

**Server functions import bindings from the config.** `payload.config.ts` exports `export const env = await getBindings()`, and a server function reads `const { env } = await import("@payload-config")`.

**Public forms use `@adirishi/offload-form-builder`** and the form UI from Offload's shadcn registry:

- Install the components with `pnpm dlx shadcn@latest add @offload/form-builder-form @offload/newsletter-signup`. `components.json` needs `"rsc": true` and the `@offload` registry.
- Write `submitForm` in `src/server/forms.functions.ts`. It wraps `saveFormSubmission()` from `@adirishi/offload-form-builder/server`, with `.validator(submissionInput)`, a `ratelimits` binding, `TURNSTILE_SECRET_KEY`, and an `isOffered` rule.
- Render `FormBuilderForm` with `renderServerComponent()` in the page's server function.
- Add `import "@/server/forms.functions";` to every route that renders a form. TanStack Start's build registers a server function only when a route imports its module. Without the import, each submission fails on a production build with "Server function info not found", while `vite dev` works. Check forms with `vite build && vite preview`.

The [forms guide](https://adirishi.github.io/offload-cms/forms) and the [Live Preview guide](https://adirishi.github.io/offload-cms/live-preview) have the full setup.

The Offload docs at https://adirishi.github.io/offload-cms list each patch to Payload and the known limits on Workers.

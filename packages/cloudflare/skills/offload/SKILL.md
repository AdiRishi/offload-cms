---
name: offload
description: Use when working in a Payload site that installs Offload (`@adirishi/offload-*` packages, `offloadVite`, `createPayloadWorker`), or when running Payload with TanStack Start on Cloudflare Workers.
---

# Offload

Offload is Payload v4 with a series of patches, built to run a TanStack Start site as one Cloudflare Worker. A site installs each Payload package under its upstream name as an npm alias of the Offload build:

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

Never return rich text from a server function as JSON. TanStack Start checks that a server function's result is serializable, and Lexical's node types fail that check. Render the rich text inside the handler with `renderServerComponent` from `@tanstack/react-start/rsc`, and put the result in the page. Payload's TanStack Start adapter already enables React Server Components, and the Lexical converters stay out of the client bundle:

```tsx
import { RichText } from "@payloadcms/richtext-lexical/react";
import { renderServerComponent } from "@tanstack/react-start/rsc";

const getPost = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    // getPayload and config as above
    const post = (await payload.find({ collection: "posts", where: { slug: { equals: slug } } }))
      .docs[0];
    if (!post) return null;
    return {
      title: post.title,
      Content: post.content ? await renderServerComponent(<RichText data={post.content} />) : null,
    };
  });
// In the route component: {post.Content}
```

`convertLexicalToHTML` from `@payloadcms/richtext-lexical/html` also works when the page needs an HTML string.

**Two runtimes.** `vite dev` runs in Node. `vite build` and `vite preview` run the Worker bundle in workerd, which is what production runs. Check runtime behaviour with `vite build && vite preview`. `vite preview` and `wrangler deploy` run the last build, whichever Wrangler environment `CLOUDFLARE_ENV` selected for it, and the build holds a copy of `.dev.vars`, so build again after you change a secret or switch environments. `vite.config.ts` uses `offloadVite()` from `@adirishi/offload-cloudflare/vite`. Add the site's Vite plugins in `offloadVite({ vite })`, which run after Offload's. A plugin that must see the source first goes in `pluginsBefore`, such as `pluginsBefore: [devtools()]` with `devtools()` from `@tanstack/devtools-vite`. Pass `devtools()`'s result as it is: it returns several plugins that already set their own `enforce`. A plugin of your own in `pluginsBefore` also needs `enforce: "pre"`, because Vite orders plugins by `enforce` before array order and Offload's transforms use `enforce: "pre"`.

**`vite dev` can warn that a client component dependency is inconsistently optimized.** The warning names a `'use client'` module of a library that a server component renders. In dev, the browser loads that module apart from the library's pre-bundled copy, so client components and server-rendered parts of the library don't share its React context. Builds have one copy. If the library's parts share state, such as compound components, add it to `optimizeDeps.exclude` in the `vite` option of `offloadVite()`. For an icon library such as `lucide-react`, the split matters only if a context provider sets icon defaults, and excluding it makes the browser load every icon module in dev.

**Bindings replace environment variables.** `payload.config.ts` gets D1, R2, Hyperdrive, and secrets from `await getBindings()` (from `@adirishi/offload-cloudflare`). Declare bindings in `wrangler.jsonc`. Put local secrets such as `PAYLOAD_SECRET` in `.dev.vars` and deployed ones in `wrangler secret put`. `CLOUDFLARE_ENV` selects the Wrangler environment for the Payload CLI and the build. A server function that needs a binding or secret at request time calls `getBindings()` too. In Node it reuses one Wrangler platform proxy per process, so restart `vite dev` after you change `wrangler.jsonc` or `.dev.vars`. For tests, use a separate Wrangler environment with its own D1 `database_id` and R2 bucket, so a test run never touches development data: https://adirishi.github.io/offload-cms/test

**Adapters take bindings:**

- D1: `sqliteD1Adapter({ binding: env.D1, push: false, migrationDir })`
- Postgres: `postgresAdapter({ pool: hyperdrivePoolConfig(env.HYPERDRIVE), push: false, migrationDir })`
- R2: `r2Storage({ bucket: env.R2, collections: { media: true } })`. Renaming a stored file and restoring an upload version copy objects, which the binding can't do. They need `copyFile: createS3CopyFile({ accessKeyId, accountId, bucket, secretAccessKey })` from `@payloadcms/storage-r2/copy-file`, which adds the AWS SDK (about 200 KiB compressed) to the Worker.
- Email Service: `email: cloudflareEmailAdapter({ binding: env.EMAIL, defaultFromAddress, defaultFromName })` from `@adirishi/offload-email-cloudflare`, with `"send_email": [{ "name": "EMAIL" }]`. The `from` domain must be onboarded to Email Sending.
- Cloudflare Images: `upload: { transformers: [cloudflareTransformer({ transport: { mode: "binding", binding: () => env.IMAGES }, collections })] }` from `@payloadcms/transformer-cloudflare`, with `"images": { "binding": "IMAGES" }`. Pass the binding as a function, because Cloudflare's upload check loads the config without bindings and the transformer throws on an undefined one. `collections` sets upload `variants`, `crop`, and `focalPoint`, and `dynamic` enables `?width=` resizing.

**Keep one migration until the first deploy.** Before a site deploys, regenerate a single `initial` migration per database after each schema change: delete every file in the migrations directory, including `index.ts`, run `pnpm payload migrate:create initial`, and reset the local database. After the first deploy, stop regenerating `initial`, because Payload skips a migration whose name the deployed database has recorded. Add a migration for each schema change with `pnpm payload migrate:create <name>`, which diffs the schema against the newest `.json` snapshot in the migrations directory, so commit the snapshots. Apply each one with `CLOUDFLARE_ENV=production pnpm payload migrate` before you deploy the build that needs it.

**Seed with `payload run`.** `pnpm payload run src/seed.ts` runs a script in Node against the Wrangler environment that `CLOUDFLARE_ENV` selects, through `getBindings()`. Pass `overrideAccess: true` to the Local API, and stop any dev server or preview on the same environment first. To seed a deployed environment, give it `"remote": true` on D1, R2, and the Images binding.

**Cron Triggers run jobs.** The Worker entry is `createPayloadWorker({ handler })` from `@adirishi/offload-cloudflare/worker`. Each Cron Trigger in `wrangler.jsonc` queues scheduled jobs and runs the due ones. Scheduled publishing depends on it.

**API routes come from Offload.** `src/app/_payload/api.$.ts` serves REST with `payloadApiHandlers()` and `src/app/_payload/api.graphql.ts` serves GraphQL with `payloadGraphQLHandlers()`, both from `@adirishi/offload-cloudflare/routes`. Don't use `payloadApiHandlers` from `@payloadcms/tanstack-start/server`.

**Read Payload in server functions, not server routes.** Server functions run in the RSC environment, which holds the Worker's copy of Payload. Server routes and `src/server.ts` run in the SSR environment, and importing `payload` or `@payload-config` there bundles a second copy, about 1.1 MB compressed. A server route can call a server function instead.

**Take payments with `@adirishi/offload-payments`.** Payload's ecommerce plugin ships only a Stripe adapter. For Razorpay or mIPS, use `razorpayAdapter()` from `@adirishi/offload-payments/razorpay` or `mipsAdapter()` from `@adirishi/offload-payments/mips` in `payments.paymentMethods`, and add `reconcilePaymentsTask({ adapters })` to `jobs.tasks` so the Cron Trigger settles payments that the browser and the gateway's webhook missed. The checkout components come from Offload's shadcn registry. Never settle an order from a client-supplied amount or a gateway redirect: the adapters settle only after the gateway's API confirms the payment. https://adirishi.github.io/offload-cms/checkout

**Workers runtime limits:**

- Each password hash costs about 10 ms of CPU, the Workers Free plan's whole per-request limit. A site with logins needs the Workers Paid plan.
- Process images with the Cloudflare Images transformer above. `sharp` can't run, so `@payloadcms/transformer-sharp` fails on Workers.
- Send email with the Email Service adapter above, or another adapter that uses `fetch`, such as `@payloadcms/email-resend`. Nodemailer can't open sockets.

**Every Payload package must be an Offload build.** That covers `payload` and every `@payloadcms/*` package, including plugins and adapters you add later. Install each one under its upstream name, for example `"@payloadcms/plugin-seo": "npm:@adirishi/offload-plugin-seo@<version>"`, at the same version as the rest. An upstream `@payloadcms/*` version breaks the site in two ways:

- Payload's dev server throws when its packages' versions differ.
- The upstream package installs its own upstream copies of other Payload packages, such as `@payloadcms/ui`, without Offload's patches.

`offloadVite()` enforces this. `vite dev` and `vite build` stop when a Payload dependency of the site is Payload's own build or a different Offload release, and `vite build` fails when any bundled module comes from Payload's own build. Each error gives the line to install. If a third-party dependency installs a Payload package, add that line to your package manager's overrides.

Third-party plugins that list `payload` as a peer dependency install normally. Change every `@adirishi/offload-*` version together when you update.

## Site pages, forms, and accounts

**Read page content through `@adirishi/offload-tanstack`**, instead of the `getPayload()` call above. Create the helpers once, in `src/lib/payload.server.ts`, with `createPayloadHelpers({ getConfig: async () => (await import("@payload-config")).default, documentPath })` from `@adirishi/offload-tanstack/server`:

- `getPayloadForRequest()` in server functions. Pass its `draft` and `user` to every query, with `overrideAccess: false`, so the collection's read access decides what the request sees. A logged-in editor then sees drafts on the page's normal URL.
- `getRequestPayload()` in async server components, so one render makes one auth lookup.
- `getVisitorPayload()`, with `overrideAccess: false`, for output that is the same for everyone and may be cached, such as a sitemap.
- `return redirectOrNotFound(pathname)` when a route finds no document. It follows the redirects plugin's redirects, and otherwise throws `notFound()`.

**Register `hideServerErrors` in `src/start.ts`.** TanStack Start sends a thrown error's message to the browser, and a failed Payload query's message contains its SQL. `createStart(() => ({ requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })], functionMiddleware: [hideServerErrors] }))`, exported as `startInstance`, covers every server function, Payload's admin included. Keep the CSRF middleware: a start instance replaces TanStack Start's default request middleware, which is its CSRF check, and production builds don't warn when it's missing. `hideServerErrors` passes redirects, `notFound()`, and Payload's public `APIError`s through.

**Live Preview** needs a path in `admin.livePreview.url`, such as `` ({ data }) => `/${data.slug}` ``, and `{draft && <LivePreviewListener />}` from `@adirishi/offload-tanstack` in the page's component. The admin and the site share one origin.

**Public forms use `@adirishi/offload-form-builder`** and the form UI from Offload's shadcn registry:

- Install the components with `pnpm dlx shadcn@latest add @offload/form-builder-form @offload/newsletter-signup`. `components.json` needs `"rsc": true` and the `@offload` registry.
- Write `submitForm` in `src/server/forms.functions.ts`. It wraps `saveFormSubmission()` from `@adirishi/offload-form-builder/server`, with `.validator(submissionInput)`, a required `isOffered` rule that receives the stored form (every form is publicly readable, so the rule keeps drafts and retired forms closed), and a `ratelimits` binding and `TURNSTILE_SECRET_KEY` from `getBindings()`.
- Render `FormBuilderForm` with `renderServerComponent()` in the page's server function.
- Add `import "@/server/forms.functions";` once, to the `_frontend` layout route. TanStack Start's build registers a server function only when a route reaches its module, and the form components render only inside server components. An import in a server component doesn't register it. Without the layout import, each submission fails on a production build with "Server function info not found", while `vite dev` works. Check forms with `vite build && vite preview`.

**Site accounts use `@adirishi/offload-accounts`**, with a separate auth collection for visitors, such as `customers`, next to the admin's `users`:

- Make the collection with `accountCollection({ slug: "customers", fields }, { siteURL: env.SITE_URL, rateLimit: () => env.ACCOUNTS })` from `@adirishi/offload-accounts/config`. `ACCOUNTS` is a `ratelimits` binding, and it limits logins and password reset requests, REST included. The collection has 14-day sessions that `getAccount()` extends, email verification, emails that link to the site's own pages, and no lockout. Set `admin.user` to the admin's collection, or Payload makes the first auth collection the admin's.
- Once a second auth collection exists, `req.user` can be a customer. Check editors with `isAdminUser` or `req.user?.collection === "users"`, never `Boolean(req.user)`. Give an account its own documents with `adminOrOwner("customers", "<relationship field>")`.
- Write `src/server/account.functions.ts`: `getAccount`, `logIn`, `logOut`, `signUp`, `requestPasswordReset`, `resetPassword`, `verifyEmail`, and `changePassword`. Each is a `createServerFn` with an input schema from `@adirishi/offload-accounts`, and calls the helper of the same name from `createAccountHelpers({ getPayload: getVisitorPayload, collection: "customers" })` in `@adirishi/offload-accounts/server`. `getAccount` returns only the fields the pages show, because the account document holds its sessions.
- Install the forms with `pnpm dlx shadcn@latest add @offload/login-form @offload/sign-up-form @offload/forgot-password-form @offload/reset-password-form @offload/change-password-form @offload/verify-email-form @offload/account-menu`. They import those server functions.
- Load the account in the `_frontend` layout's `beforeLoad`. Put account pages under a pathless `_account` route that redirects to `/login` with `returnTo`, and call `requireAccount()` again in each server function that reads private data, passing the account as `user` with `overrideAccess: false`.
- An account can't change its own `email` or `password` through REST, because a stolen session could keep the account. Change a password with `changePassword()`, which checks the current one. Only the admin's users change an email.
- A browser holds one Payload session, because every auth collection uses the same cookie name. A customer login on the site ends an editor's admin session in that browser.
- Payload v4 has no social login or magic links.

`verifyTurnstile()` is in `@adirishi/offload-cloudflare`. Forms use the Turnstile action `form`, and the account forms use `sign-up` and `forgot-password`.

The [forms guide](https://adirishi.github.io/offload-cms/forms), the [accounts guide](https://adirishi.github.io/offload-cms/customer-accounts), and the [Live Preview guide](https://adirishi.github.io/offload-cms/live-preview) have the full setup.

The Offload docs at https://adirishi.github.io/offload-cms list each patch to Payload and the known limits on Workers.

---
title: Assessment
description: The research that led to Offload, Payload v4 on TanStack Start and Cloudflare, written before the repository existed.
---

The research that led to Offload, written before the repository existed. Paths and plans below describe the state at the time; the rest of these docs describe the repository as it is.

Assessment date: 2026-10-18. Upstream state: Payload `main` at `d5b01b40d`, latest release `v4.0.0-beta.2` (2026-10-16).

## Verdict

The direction is sound, and the PoC shows it works today. A TanStack Start site with the full Payload admin ran as one Cloudflare Worker on D1 and R2, using Payload's published v4 beta. Admin login, editing, blocks, rich text, versions, uploads, REST, GraphQL, a server-rendered frontend route, and a Cron-driven Payload job all worked. A patched and renamed build of all 43 Payload packages also built, published, installed and ran in the same app.

Three parts of your plan should change:

1. **Keep the patches in git, not in `patch-package`.** Store them as a `git format-patch` series applied with `git am -3` onto a pinned upstream tag. `patch-package` and `pnpm patch` edit compiled `dist` files inside one consumer's `node_modules`, which doesn't fit a fork you rebuild and republish.
2. **Rebrand the distribution and the UI, not the source.** Publish `@offload/*` packages and have sites install them as npm aliases (`"payload": "npm:@offload/payload@…"`). Every `payload` and `@payloadcms/*` import in upstream code, every import-map string and every peer check then keeps working. Renaming the source would touch about 2,900 import lines and 117 import-map strings, and every upgrade would conflict.
3. **Most of the Cloudflare work is not a fork.** The PoC needed ten fixes. One must be a core patch (password hashing). Two more belong in core but can wait. The rest fit in an Offload-owned Vite preset and Worker runtime package.

The real risks are not Next.js coupling or a missing Cloudflare primitive:

- D1 has no transactions, and Payload relies on them for multi-step writes.
- Upstream does not test Cloudflare. The v4 Cloudflare template still pins Payload 3.82.1, no CI job runs Payload inside workerd, and about ten Cloudflare bugs and PRs are open upstream.
- The TanStack admin runs on a young React Server Components stack that is still changing.

None of these blocks the direction. All three need ongoing engineering.

## What was tested

Everything below ran in local workerd through `vite build && vite preview`, the same bundle `wrangler deploy` uploads. Nothing was deployed to Cloudflare. That needs your choice of account.

| Capability                                                                     | Result                             | Notes                                                                                                                                                               |
| ------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend SSR route reading content through the Local API                       | Works                              | `src/app/_frontend/$slug.tsx`, a TanStack server function calling `payload.find` on D1                                                                              |
| Admin: login, dashboard, create, edit, publish, blocks, Lexical, versions view | Works                              | Checked in a browser. The admin renders through TanStack Start RSC inside workerd.                                                                                  |
| REST API, access control, first user, login, wrong password                    | Works locally                      | Production Workers rejects Payload's password hashing. See the PBKDF2 row in the fix table.                                                                         |
| Uploads to R2 and serving them back                                            | Works                              | Byte-identical round trip. Width and height are read without sharp.                                                                                                 |
| GraphQL                                                                        | Works after a fix                  | Reproduces upstream issue [#17771](https://github.com/payloadcms/payload/issues/17771). The root cause is different from the issue's diagnosis (see the fix table). |
| Cron Trigger running Payload jobs                                              | Works                              | `src/server.ts` exports TanStack's `fetch` and a `scheduled` handler that runs `payload.jobs.run()`                                                                 |
| D1 migrations                                                                  | Works                              | Generated and applied by the Payload CLI in Node through Wrangler's platform proxy                                                                                  |
| Worker size                                                                    | 18.2 MB raw, 4.0 MB gzipped        | Fits the paid plan's 10 MB compressed limit. Exceeds the free plan's 3 MB.                                                                                          |
| Latency (local, M-series Mac)                                                  | About 130 ms cold, 5 to 17 ms warm | Expect a slower cold start on Workers hardware.                                                                                                                     |
| `vite dev` inside workerd                                                      | Does not work                      | The RSC module runner can't load Payload's CommonJS dependencies in workerd.                                                                                        |
| `vite dev` in Node against local D1 and R2                                     | Works                              | The PoC uses this mode. Dev therefore runs on a different runtime from production.                                                                                  |
| Patched fork build, rename and publish                                         | Works                              | Install 76 s, build of all 46 workspace packages 88 s, pack 39 s, publish of 43 packages 33 s. The PoC then installed the aliases and ran the patched code.         |

The PoC grew into [`e2e`](https://github.com/AdiRishi/offload-cms/tree/main/e2e) and [`packages/cloudflare`](https://github.com/AdiRishi/offload-cms/tree/main/packages/cloudflare); the original is in git history. The patch now lives in [`upstream/patches`](https://github.com/AdiRishi/offload-cms/tree/main/upstream/patches), and the release transform became [`release`](https://github.com/AdiRishi/offload-cms/tree/main/release).

## Framework independence: TanStack Start

Payload v4 has a real framework adapter, and TanStack Start is a first-class target in v4.

- `@payloadcms/ui`, `payload`, Lexical and the plugins no longer import `next` at runtime. Router hooks, `Link`, cookies, redirects and server functions go through adapter contracts in `packages/payload/src/admin/adapters/` (`ServerAdapter`, `RouterAdapter`, `AdminViewAdapter`).
- `@payloadcms/tanstack-start` is about 3,800 lines. It renders the admin with real React Flight through `@vitejs/plugin-rsc`, not as a client-only SPA.
- Since 2026-08-07 the full e2e matrix (85 suites) has been a required CI gate for TanStack. Only about six individual tests and the `admin-root` suite are skipped.
- The docs present TanStack Start as a peer of Next.js and don't label it experimental.

Gaps that remain, in rough order of impact:

| Gap                                                                                                                                                            | Impact                 | Fix                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------- |
| The admin mount is fixed at `/admin`. `routes.admin` is unsupported on TanStack.                                                                               | Low for your use       | Live with it, or patch the adapter      |
| The GraphQL handler exists but the generated template doesn't route it                                                                                         | Low                    | One route file (in the PoC)             |
| `/api/og` (dynamic OG image) is Next-only, but default admin metadata points at it                                                                             | Low                    | Set `defaultOGImageType` to static      |
| `forbidden()` and `unauthorized()` throw plain errors, which likely become 500s                                                                                | Low                    | Small adapter patch                     |
| No request-scoped cache for the admin context. Each loader and server function re-runs auth and i18n.                                                          | Medium (admin latency) | Adapter patch, upstreamable             |
| `plugin-search` has a runtime dependency on `@payloadcms/next`, which pulls a `next` peer                                                                      | Low                    | One-line manifest patch                 |
| Next-named env vars in shared code (`NEXT_BASE_PATH`, `NEXT_PHASE`, `isNextBuild`)                                                                             | Low                    | Avoid base paths for now                |
| The admin requires RSC. On TanStack that means TanStack Start RSC and `@vitejs/plugin-rsc` 0.5 (pre-1.0), plus six Vite workaround plugins inside the adapter. | Medium (churn)         | Pin versions and let upstream absorb it |

The last row is the real cost. The adapter is 3.5 months old and has had 60 commits. A breaking change that moves RSC responses to React Flight is open (PR [#18787](https://github.com/payloadcms/payload/pull/18787)). Expect adapter-level breakage across betas. Your sites won't need changes for it, but the Offload Workers preset may.

## Cloudflare: what the PoC needed

Each fix is listed with the place it should live long term. The PoC applies all of them from `vite.config.ts` and app code, with no source changes to Payload except the PBKDF2 patch.

| #   | Problem                                                                                                                                                                                                                    | PoC fix                                                                                                             | Proper home                                                                                              | Effort  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| 1   | `withPayload` externalizes Payload packages for Node's `node_modules`. The Cloudflare plugin rejects externals, and Workers have no `node_modules`.                                                                        | Delete the externals for server environments                                                                        | A `target: 'cloudflare'` option in the adapter, or the Offload preset                                    | Small   |
| 2   | Cloudflare resolves with the `browser` condition, which maps `payload` to its client-safe `shared.js`                                                                                                                      | Drop `browser` from server-environment conditions                                                                   | Add `workerd` export conditions to `payload` and `@payloadcms/tanstack-start` (core patch, upstreamable) | Small   |
| 3   | `payload/dist/index.js` calls `fileURLToPath(import.meta.url)` at module scope, and that is `undefined` in the Worker bundle                                                                                               | Build-time fallback                                                                                                 | Compute `dirname` lazily in core (patch, upstreamable)                                                   | Small   |
| 4   | The adapter loads `@payloadcms/graphql` through `import(/* @vite-ignore */ variable)` so Node resolves it at runtime                                                                                                       | Rewrite to literal imports                                                                                          | Adapter option for bundled targets                                                                       | Small   |
| 5   | GraphQL queries with arguments fail with "Unexpected input type". Both the CommonJS and ESM builds of `graphql` end up in the bundle, so `instanceof` checks fail.                                                         | Resolve every server `graphql` import to the `.mjs` build                                                           | Offload preset                                                                                           | Small   |
| 6   | Importing `@cloudflare/vite-plugin` into the Vite process breaks Node-mode dev for Payload's CommonJS dependencies                                                                                                         | Import it lazily, only for build and preview                                                                        | Offload preset                                                                                           | Trivial |
| 7   | `vite dev` inside workerd fails on CommonJS dependencies in the RSC module runner                                                                                                                                          | Run dev in Node with `getPlatformProxy` bindings                                                                    | Offload preset and template                                                                              | Done    |
| 8   | Payload hashes passwords with 600,000 PBKDF2 iterations. Production Workers rejects more than 100,000 ([#18274](https://github.com/payloadcms/payload/issues/18274)). Local workerd does not, so only a deploy catches it. | Core patch from upstream PR [#18276](https://github.com/payloadcms/payload/pull/18276), verified working in the PoC | Core patch until upstream merges it                                                                      | Small   |
| 9   | The GraphQL route is not wired in the TanStack template                                                                                                                                                                    | Route file                                                                                                          | Offload template                                                                                         | Trivial |
| 10  | No Worker entry for Cron Triggers                                                                                                                                                                                          | Custom `src/server.ts`                                                                                              | Offload runtime package                                                                                  | Small   |

Row 8 has a security trade-off. On Workers, new hashes use 100,000 iterations, below the current OWASP guidance of 600,000 for PBKDF2-SHA256. The patch embeds the iteration count in the hash, so verification still works for hashes created on either runtime. A hash created at 600,000 iterations still can't be verified on Workers, though, so don't seed users from the Node CLI. If that trade-off is unacceptable, the alternative is a custom auth strategy with its own hash function. That is a larger change, because hashing isn't an extension point today.

### Infrastructure choices

Use the Cloudflare products that fit Payload, not all of them.

| Product                  | Use it?                     | Reason                                                                                                                                                                                                           |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers                  | Yes                         | One Worker per site serves the site, admin, API and cron                                                                                                                                                         |
| D1                       | Yes, with the caveats below | Official adapter, works with migrations and read replicas                                                                                                                                                        |
| R2                       | Yes                         | Official adapter using the binding, with range requests and multipart client uploads                                                                                                                             |
| Cron Triggers            | Yes                         | Runs Payload jobs and scheduled publishing                                                                                                                                                                       |
| Images                   | Yes, soon                   | Workers can't run sharp. An upstream PR adds a Cloudflare Images transformer ([#18647](https://github.com/payloadcms/payload/pull/18647), +2,690 lines, open). Carry it as an Offload package, not a core patch. |
| Email Service, or Resend | Yes                         | Nodemailer needs TCP and won't work. Resend's adapter uses `fetch`. A Cloudflare email adapter is about 50 lines.                                                                                                |
| KV                       | Not yet                     | Payload's KV store defaults to the database and nothing in core needs Workers KV. An upstream PR exists ([#14715](https://github.com/payloadcms/payload/pull/14715)).                                            |
| Durable Objects          | Not yet                     | The only strong case is transactional SQLite (see D1 below)                                                                                                                                                      |
| Queues                   | Not yet                     | Cron plus `payload.jobs.run()` covers content sites                                                                                                                                                              |
| Stream                   | Not for Payload itself      | Add it later as an Offload upload field or plugin if a site needs video                                                                                                                                          |
| Hyperdrive and Postgres  | For commerce sites          | Gives you real transactions, at the cost of a non-Cloudflare database                                                                                                                                            |

### D1 atomicity

This is the main data-integrity risk, and the one item that needs real design work.

- The D1 adapter's `beginTransaction` is a no-op (`packages/db-d1-sqlite/src/index.ts:154`), because D1 has no interactive transactions. Every statement commits on its own.
- Payload writes a document as several statements: the main row, array and block rows (delete, then insert), relationship rows, and a version row.
- If a write fails partway, the document is left half-written. Upstream has open reports:
  - array data lost when an error lands between the delete and the insert ([#15219](https://github.com/payloadcms/payload/issues/15219))
  - duplicate `latest` version rows under autosave ([#17216](https://github.com/payloadcms/payload/issues/17216))
  - bulk publish failing above about 100 documents ([#17493](https://github.com/payloadcms/payload/issues/17493))
- The ecommerce plugin claims payment transactions with a single conditional `UPDATE`, which is atomic on D1. The steps after it (create order, mark cart, decrement inventory, mark transaction) are not. A Worker that dies midway leaves a transaction stuck in `processing`.

For content sites edited by a few people, this is an acceptable risk if you keep versions enabled and add a reconciliation job. For commerce, there are three options:

1. **Patch `@payloadcms/drizzle`** to send each document write as one D1 `batch()`, which is atomic. This works for the array delete-and-insert path. It doesn't work where Payload reads generated IDs between writes. Meaningful but contained work, as a core patch.
2. **Write a Durable Object SQLite adapter.** DO SQLite has real transactions. Payload would have to run inside the Durable Object, or every query becomes an RPC call. This is a large project and changes how a site is deployed.
3. **Use Postgres through Hyperdrive** for commerce sites. Payload's Postgres adapter is its best-tested path, but it adds a non-Cloudflare database. Upstream has open Workers bugs for it too ([#17335](https://github.com/payloadcms/payload/issues/17335)).

My recommendation: D1 for content sites now, option 1 as the first significant core patch, and Hyperdrive with Postgres for the first commerce site unless option 1 lands first.

## The fork

### Is a fork necessary?

Not for the runtime. You could ship sites today on upstream npm packages, the Offload Vite preset, and one `pnpm patch` for PBKDF2.

A fork earns its keep for three reasons:

- You want to rebrand and republish, and every site should get the same patched build.
- Upstream is slow to merge Cloudflare fixes. The PBKDF2 PR has been open since 2026-09-23, the Images transformer since 2026-10-09, and the KV adapter since 2025-11-23.
- D1 atomicity needs patches in `@payloadcms/drizzle`.

Treat the fork as a thin patch series that tracks upstream PRs and shrinks when they merge. It should not become a place to develop features.

### Where each change belongs

Pick the first layer that can hold the change:

1. **Site code.** Collections, blocks, hooks, endpoints, custom admin components and views. The Payload config and plugin API cover most of what a site needs.
2. **Offload packages.** Anything new, built against Payload's extension points, never patched into core:
   - `@offload/cloudflare`: the Vite preset, bindings helper, Worker entry with `scheduled`, and a console logger
   - the Images transformer
   - the Razorpay payment adapter
   - a Cloudflare email adapter
   - an admin branding plugin
3. **Patches to existing upstream packages.** Only for behaviour with no extension point. Today that means:
   - password hashing
   - export conditions
   - module-scope `import.meta.url`
   - the D1 write path
   - adapter fixes for bundled targets

   Each patch should be small, carry its intent and a drop condition, and go upstream as a PR when it's general.

Razorpay shows how this works. `plugin-ecommerce` has a clean `PaymentAdapter` interface (`initiatePayment`, `confirmOrder`, `endpoints` for webhooks), and its non-Stripe code is provider-neutral. A Razorpay adapter is an Offload package with no core changes. Two notes:

- You'll reimplement two small helpers (`validateSettlement`, `normalizeEmail`) that the plugin doesn't export.
- Call Razorpay's REST API with `fetch` instead of its Node SDK. Upstream has a matching bug where Stripe's Node client hangs on Workers ([#17201](https://github.com/payloadcms/payload/issues/17201)).

INR works through a custom currency entry. Prices are already stored in minor units, which matches Razorpay's paise.

Other things a plugin can't do without core changes: add new field types (the `Field` union is closed), replace the reset-password and verify views, change login, JWT or hashing internals, or change database adapter internals.

### Rebranding without renaming the source

The release transform ([`release/src/publish.ts`](https://github.com/AdiRishi/offload-cms/blob/main/release/src/publish.ts)) does the following:

1. Takes the tarballs from Payload's own `pnpm pack`.
2. Renames `payload` to `@offload/payload` and `@payloadcms/x` to `@offload/x`.
3. Gives every package one version, `<upstream>-offload.<n>`. Payload's dev dependency checker requires all versions to match.
4. Rewrites internal dependencies to aliases (`"@payloadcms/ui": "npm:@offload/ui@…"`) and keeps peer dependency names unchanged.
5. Records the upstream version in each manifest.

A site then declares:

```json
{
  "dependencies": {
    "payload": "npm:@offload/payload@4.0.0-beta.2-offload.0",
    "@payloadcms/ui": "npm:@offload/ui@4.0.0-beta.2-offload.0",
    "@payloadcms/tanstack-start": "npm:@offload/tanstack-start@4.0.0-beta.2-offload.0"
  }
}
```

In the test install, all peer checks passed, no upstream `@payloadcms` copy came in transitively, and one `payload` instance resolved. The app ran the patched code. Sites keep importing from `payload`. Your scaffolder (a `create-offload-app` or a template) writes the aliases, so nobody types them.

Visible branding (logo, icon, title suffix, colours) goes through `admin.components.graphics`, `admin.meta` and CSS variables, all of which a plugin can set. That needs no core patch.

You'll need these decisions or tasks:

- Confirm the `@offload` npm scope is available. No packages exist under it today.
- Choose a public or private registry.
- Change the 18 manifests that hard-code `publishConfig.registry` to npmjs. The transform already deletes `publishConfig`.

### Repository layout

Keep the vendored Payload checkout as its own pnpm workspace. Upstream depends on its own catalogs, overrides, a TypeScript 7 alias and a pinned pnpm (11.9). Merging it into this workspace would turn every upgrade into a manifest merge.

```text
offload-cms/
  upstream/
    payload.json             # { repo, tag, sha } for the pinned release
    patches/                 # git format-patch series: the only record of core changes
    PATCHES.md               # one entry per patch: intent, upstream PR, drop condition, tests
  vendor/payload/            # gitignored; created by `pnpm upstream:checkout`
  packages/
    cloudflare/              # @offload/cloudflare: Vite preset, bindings, Worker entry, logger
    brand/                   # admin branding plugin
    payments-razorpay/
    transformer-cloudflare-images/
    email-cloudflare/
  templates/site/            # TanStack Start + Workers starter (the PoC, cleaned up)
  tools/release/             # checkout, build, pack, rename, publish
  .claude/skills/upgrade-payload/SKILL.md
```

`pnpm upstream:checkout` clones the pinned SHA into `vendor/payload` and runs `git am -3 upstream/patches/*.patch`. To change a patch, you commit inside `vendor/payload`, then `pnpm upstream:export` regenerates `upstream/patches/` with `git format-patch <tag>..HEAD`. Electron maintains its Chromium patches the same way.

Use patch files rather than a long-lived fork branch for three reasons:

- Changes to them show up in this repo's PRs.
- Each patch's commit message carries machine-readable trailers (`Offload-Patch`, `Upstream`, `Drop-When`). An agent can read those and re-derive a patch from its intent when it no longer applies.
- History never needs a force-push.

Two details from the prototype:

- Upstream's pre-commit hook lints the whole repo, and it rejected the community PR's test file. Patch tooling must commit with `--no-verify`.
- Enable `git rerere` so conflict resolutions carry over between attempts.

### Upgrade workflow

This is the procedure an agent follows, written as the `upgrade-payload` skill:

1. **Survey.** Read the release notes, `docs/migration-guide/v4.mdx` changes, and `git diff --stat <old>..<new>` for every file the patch series touches.
2. **Prune.** For each patch, check its `Drop-When` condition. If the upstream PR merged or the tag contains an equivalent fix, drop the patch.
3. **Replay.** Run `git am -3` onto the new tag. On conflict, resolve using the patch's intent from `PATCHES.md`. If the surrounding code changed shape, rewrite the patch from its intent.
4. **Verify upstream behaviour.** Run Payload's own unit and integration tests for the patched packages (for example `packages/payload` auth specs for the PBKDF2 patch), then build all packages.
5. **Verify Offload behaviour.** Build the site template with the new tarballs from a local registry. Run a Workers smoke suite against `vite preview`: first user, login, create and publish, upload and serve, GraphQL with arguments, cron job, frontend route. This is the PoC checklist as Playwright tests.
6. **Verify production-only behaviour.** Deploy to a staging Worker and run the smoke suite against it. The PBKDF2 limit only shows up there, so this step is required.
7. **Publish.** Publish `-offload.N`, then open version-bump PRs on each site.

Measured cost of the mechanical part: about four minutes from clean checkout to published packages on a laptop. Upstream churn is moderate. Beta-to-beta diffs were 49 to 75 files, and `main` gets about 225 commits a month. In the trial, the PBKDF2 patch replayed onto `main` (15 commits past beta.2) with no conflicts.

## Problems by size

**Straightforward (days):**

- the Offload Vite preset and Worker runtime package (fixes 1 to 7, 9, 10)
- carrying the PBKDF2 patch
- the GraphQL route
- the release transform and a local registry
- the Resend or Cloudflare email adapter
- the admin branding plugin
- removing the `@payloadcms/next` dependency from plugin-search

**Meaningful investment (weeks):**

- D1 atomicity, option 1
- the Images transformer, starting from the upstream PR
- the Razorpay adapter with webhooks and reconciliation
- the Workers smoke suite and staging deploy in CI
- the upgrade skill and patch ledger
- `create-offload-app` and the site template
- keeping the Offload preset working as the TanStack adapter changes

**Architectural limits to accept:**

- Dev runs in Node and production in workerd.
- The paid Workers plan is required, for bundle size and CPU time.
- The admin depends on a pre-1.0 RSC toolchain on TanStack.
- The admin URL is fixed at `/admin`.
- D1 has no interactive transactions.
- Upstream doesn't test Workers, so you will find Cloudflare bugs before upstream does.

None of these makes the direction unattractive. The D1 limit is the one that could change a decision per site. Commerce sites with real money may be better on Postgres through Hyperdrive.

## Things I would not do

- **Rename imports to `offload` in the source.** It turns every upgrade into a large conflict for no runtime benefit.
- **Develop features inside the fork.** Anything new goes in an Offload package against Payload's extension points.
- **Run `vite dev` inside workerd today.** It costs time for little gain. Use Node for dev and catch runtime differences in staging.
- **Adopt every Cloudflare product.** D1, R2, Workers, Cron and Images cover a content site. Add more when a site needs them.

## Suggested next steps

1. Decide on the npm scope and registry, and on a Cloudflare account for a staging Worker.
2. Deploy the PoC to that staging Worker to confirm production behaviour: PBKDF2 with and without the patch, cold start, CPU time per admin request.
3. Set up `upstream/`, `PATCHES.md`, `tools/release`, and the PBKDF2 patch as patch 0001.
4. Extract `@offload/cloudflare` from the PoC's `vite.config.ts`, `src/cloudflare.ts` and `src/server.ts`.
5. Turn the PoC checklist into the Workers smoke suite.
6. Start the D1 batch-write patch and the Images transformer.

## Not verified

- No production deploy. The PBKDF2 limit comes from upstream reports. Production latency and CPU are unmeasured.
- Live preview, localization at scale, multi-tenant, and the form-builder, SEO, search and import-export plugins on Workers.
- `plugin-ecommerce` with any payment provider on Workers.
- Upload size limits on Workers (request body limits per plan) and multipart upload over R2 at size.
- Admin performance with large collections on D1, and D1 read replicas.

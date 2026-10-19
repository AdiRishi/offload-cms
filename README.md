# Offload CMS

Offload is [Payload CMS](https://github.com/payloadcms/payload) v4 for websites built with TanStack Start and hosted on Cloudflare Workers, on D1 or on Postgres through Hyperdrive. It consists of a pinned upstream Payload release, a small series of patches on top of it, and packages that run it on Workers. Everything is published under `@adirishi/offload-*`. Payload is MIT-licensed, and Offload keeps upstream's code, names and license.

Sites keep importing `payload` and `@payloadcms/*`. They install the Offload builds under those names through npm aliases:

```json
"payload": "npm:@adirishi/offload-payload@4.0.0-beta.2-offload.2",
"@payloadcms/ui": "npm:@adirishi/offload-ui@4.0.0-beta.2-offload.2"
```

## Getting started

You need the current Node 24 LTS, Krypton (see `.node-version`), and pnpm through Corepack.

```bash
pnpm install
pnpm upstream:checkout
pnpm check
```

`pnpm upstream:checkout` clones Payload at the pinned commit into `upstream/payload` and applies the patches. `pnpm check` runs the linter, the format check, the type checks and the tests.

To run the end-to-end suite:

```bash
pnpm test:e2e
```

It builds Payload and `packages/`, publishes them to a throwaway registry, installs `e2e/` from it, type-checks `e2e/`, and runs the Playwright suite. `pnpm test:e2e:postgres` runs the same suite on Postgres through Hyperdrive, using Docker.

## Layout

| Path                  | Contents                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/cloudflare` | `@adirishi/offload-cloudflare`: the Vite preset, Cloudflare bindings, Worker entry and GraphQL route that run Payload on Workers                                            |
| `packages/tsconfig`   | `@repo/tsconfig`: shared TypeScript configuration for every workspace package                                                                                               |
| `upstream`            | `@repo/upstream`: the pinned Payload release (`payload.json`), the patch series (`patches/`, `PATCHES.md`), and the `upstream` CLI that checks out, exports and upgrades it |
| `upstream/payload`    | Payload at the pin with the patches applied, created by `pnpm upstream:checkout`. Gitignored.                                                                               |
| `release`             | `@repo/release`: the `release` CLI that publishes packages, points sites at a release, and runs the e2e suite against a throwaway registry                                  |
| `e2e`                 | A Payload site on Workers that the Playwright suite drives, on D1 or Postgres. It installs Offload from a registry, like a real site.                                       |
| `docs`                | Design notes, the original assessment, and brand assets                                                                                                                     |

The workspace contains `packages/*`, `upstream` and `release`. Node runs the two CLIs straight from TypeScript. `e2e` is a separate pnpm project, because it has to install Offload the way a site in its own repository does.

## Commands

| Command                                     | What it does                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm check`                                | Lint, format check, type checks and tests, through Turborepo                                     |
| `pnpm lint` / `pnpm lint:fix`               | oxlint with type-aware rules                                                                     |
| `pnpm format` / `pnpm format:fix`           | oxfmt check, or write                                                                            |
| `pnpm check-types`                          | `tsc` in every workspace package                                                                 |
| `pnpm test`                                 | The tests in every workspace package                                                             |
| `pnpm build`                                | Build Payload in `upstream/payload` and the packages in `packages/`                              |
| `pnpm upstream:checkout [--force]`          | Create `upstream/payload` from the pin and the patches                                           |
| `pnpm upstream:export`                      | Write the commits in `upstream/payload` back to `upstream/patches` and `PATCHES.md`              |
| `pnpm upstream:status [--against <tag>]`    | Show each patch's upstream PR state, and whether `<tag>` already contains it                     |
| `pnpm upstream:upgrade <tag> [--drop <id>]` | Move the patch series to a newer Payload release                                                 |
| `pnpm release`                              | Build everything, then publish every package at the pinned version to `OFFLOAD_REGISTRY`         |
| `pnpm use-version <site-dir> [version]`     | Point a site's Offload dependencies at a release                                                 |
| `pnpm test:e2e` / `pnpm test:e2e:postgres`  | Release the working tree to a throwaway registry and run the Playwright suite, on D1 or Postgres |

## Where a change goes

1. **Site code** when Payload's config or plugin API can express it: collections, hooks, endpoints, admin components.
2. **A package in `packages/`** when it's new and reusable: adapters, plugins, the Cloudflare preset.
3. **A patch to Payload** only for behaviour with no extension point. Keep each patch small, and propose it upstream when it's general.

## Changing Payload

Edit `upstream/payload` and commit there. The commit message documents the patch: an intent paragraph explaining what breaks without it and how the patch fixes it, then these trailers.

```text
Offload-Patch: short-stable-id
Upstream: https://github.com/payloadcms/payload/pull/<n>
Drop-When: <the condition under which upstream makes this patch unnecessary>
Tests: <commands that prove the patch works>
```

Run `pnpm upstream:export`, then bump `revision` in `upstream/payload.json` before you release. Commits in `upstream/payload` skip upstream's git hooks and aren't signed, because the patch files keep only the diff and the message.

## Releasing

`pnpm release` runs the `publish` task through Turborepo. The task depends on every build, so Turborepo first builds `upstream/payload` and `packages/`. The Payload build refuses to run if `upstream/payload` doesn't match the pin and the patches. `publish` then packs every package with pnpm, renames each Payload package to `@adirishi/offload-<name>` at `<tag>-offload.<revision>`, rewrites internal dependencies to aliases, and publishes them. If that version is already in the registry, it does nothing.

Offload's own packages are the public workspace packages that `release/package.json` depends on. Add a new package in `packages/` there too, so Turborepo builds it before `publish` and `publish` includes it.

Releases go to [GitHub Packages](https://github.com/AdiRishi?tab=packages&repo_name=offload-cms). To publish one, bump `revision` in `upstream/payload.json` and push to `main`: the Publish workflow releases it once CI passes.

`pnpm release` publishes to `OFFLOAD_REGISTRY`, with `OFFLOAD_REGISTRY_TOKEN` when the registry needs one. To test a change before pushing it, run `pnpm test:e2e`. It publishes to a registry that exists only for that run, so you never need to bump `revision` to try a change.

Never publish a version number twice to a real registry.

## Using Offload in a site

GitHub Packages needs a token even for public packages. Create a GitHub token with the `read:packages` scope and add an `.npmrc` to the site:

```ini
@adirishi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install Offload under the upstream names, as in the `dependencies` of [`e2e/package.json`](e2e/package.json), and set up the site like [`e2e`](e2e): `offloadVite()` in `vite.config.ts`, `getBindings()` in `payload.config.ts`, and `createPayloadWorker()` as the Worker entry. `pnpm use-version <site-dir>` moves a site to a new release.

## Continuous integration

Every push runs two GitHub Actions jobs:

- `pnpm check`
- the e2e suite on D1 and on Postgres, against a release of that commit to a throwaway registry inside the runner

After CI passes on `main`, the Publish workflow releases to GitHub Packages.

## Upgrading Payload

Ask an agent to upgrade Payload to a tag. The `upgrade-payload` skill in `.claude/skills` takes it through survey, replay, upstream tests, the e2e suite on both databases, and a report.

## Editor

Install the recommended oxc extension. `.vscode/settings.json` formats on save, applies lint fixes, and turns on type-aware lint rules.

## Further reading

- [`docs/assessment.md`](docs/assessment.md): why Payload v4, TanStack Start and Workers, and what the proof of concept found
- [`docs/databases.md`](docs/databases.md): choosing D1 or Postgres through Hyperdrive, and what to know about each
- [`upstream/PATCHES.md`](upstream/PATCHES.md): what Offload changes in Payload, and why

# Offload CMS

Offload is [Payload CMS](https://github.com/payloadcms/payload) v4, built to run websites on TanStack Start and Cloudflare Workers. It's a small, version-pinned set of patches on an upstream Payload release, plus packages for Cloudflare. Everything is published under `@arishi/offload-*`. Payload is MIT-licensed, and Offload keeps upstream's code, names and license.

Sites keep importing `payload` and `@payloadcms/*`. They install the Offload builds under those names with npm aliases:

```json
"payload": "npm:@arishi/offload-payload@4.0.0-beta.2-offload.0",
"@payloadcms/ui": "npm:@arishi/offload-ui@4.0.0-beta.2-offload.0"
```

## Layout

| Path | What it is |
| --- | --- |
| `upstream/payload.json` | The pinned Payload release, plus the Offload revision on top of it |
| `upstream/patches/` | The patch series, one `git format-patch` file per change to Payload |
| `upstream/PATCHES.md` | Ledger of the patches, generated from their commit messages |
| `vendor/payload/` | Payload checked out at the pin with the patches applied. Generated and gitignored. |
| `packages/cloudflare/` | `@arishi/offload-cloudflare`: Vite preset, bindings, Worker entry, GraphQL route |
| `templates/site/` | A TanStack Start site on Workers with D1 and R2, installed from the registry like a real site |
| `tools/` | Scripts behind the root `package.json` commands |
| `docs/` | Design notes |
| `research/` | The assessment that led here, and the original proof of concept |

## Where a change goes

1. **Site code**, if the Payload config or plugin API can express it: collections, hooks, endpoints, admin components.
2. **A package in `packages/`**, if it's new and reusable: adapters, plugins, transformers, the Cloudflare preset.
3. **A patch to Payload**, only for behaviour that has no extension point. Keep it small, and propose it upstream when it's general.

## Changing Payload

```bash
pnpm upstream:checkout
```

This clones Payload at the pinned commit into `vendor/payload` and applies `upstream/patches` on the `offload` branch.

Make the change in `vendor/payload` and commit it there. The commit message is the patch's documentation: an intent paragraph, then these trailers.

```text
Offload-Patch: short-stable-id
Upstream: https://github.com/payloadcms/payload/pull/<n>
Drop-When: <when upstream makes this patch unnecessary>
Tests: <command that proves it works>
```

Then write the commits back to the repo:

```bash
pnpm upstream:export
```

This regenerates `upstream/patches` and `upstream/PATCHES.md`. Bump `revision` in `upstream/payload.json` before releasing the change.

`pnpm upstream:status --against <tag>` shows each patch's upstream PR state and whether `<tag>` already contains it.

## Releasing

Releases go to a local registry until a real one is chosen. Start it and leave it running:

```bash
pnpm registry:start
```

Then, in another terminal:

```bash
pnpm release
```

`pnpm release` builds `vendor/payload` and `packages/`. It then publishes every package as `@arishi/offload-<name>@<tag>-offload.<revision>`, with internal dependencies rewritten to aliases. A clean run takes about four minutes. Set `OFFLOAD_REGISTRY` and `OFFLOAD_REGISTRY_TOKEN` to publish somewhere else.

To point a site at a release:

```bash
pnpm use-version <site-dir> [version]
```

## Upgrading Payload

Ask an agent to upgrade Payload to a tag. The `upgrade-payload` skill in `.claude/skills` takes it through survey, replay, upstream tests, the template smoke suite and the report. The mechanical step is `pnpm upstream:upgrade <tag> [--drop <id>]`.

## Running the site template

See [`templates/site/README.md`](templates/site/README.md).

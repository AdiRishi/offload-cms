---
name: upgrade-payload
description: Move Offload to a newer upstream Payload release, carrying the patch series in upstream/patches across it. Use when asked to upgrade, bump or rebase Payload or Offload onto a new tag.
---

# Upgrade Payload

Offload is upstream Payload at the commit in `upstream/payload.json`, plus the patch series in `upstream/patches`. Each patch is one commit whose message holds its **intent**, an `Upstream` link, a `Drop-When` condition and a `Tests` command. The intent is the source of truth when a patch no longer applies: rewrite the change to satisfy the intent instead of forcing the old diff onto new code.

Work on a branch named `chore/payload-<tag>`.

## 1. Survey

1. Run `pnpm upstream checkout --force`, then `pnpm upstream status --against <tag>`.
2. Read `gh release view <tag> --repo payloadcms/payload` and the diff of `docs/migration-guide/` between the pinned tag and `<tag>`.
3. For the files each patch touches, read `git -C upstream/payload diff <pinned-tag> <tag> -- <files>`.

Done when every patch has a verdict:

- **drop**: its `Drop-When` holds, for example the upstream PR is in `<tag>`.
- **keep**: the files it touches did not change upstream.
- **rework**: upstream changed the code it touches.

Also done when every breaking change in the release notes is classified as affecting sites, affecting `packages/`, or neither.

## 2. Replay

Run `pnpm upstream upgrade <tag> --drop <id> ...` with the **drop** verdicts.

On a conflict, the script prints the patch's intent. Resolve the conflict so the patch still meets that intent. If the surrounding code changed shape, rewrite the patch. Then run `git -C upstream/payload cherry-pick --continue` and `pnpm upstream upgrade --continue`. If a patch's intent changed, reword the commit message too, since the patch pages in `docs/content/patches` are generated from it.

`pnpm-lock.yaml` hunks never resolve by hand. Take the new tag's lockfile, run `pnpm install --no-frozen-lockfile` in `upstream/payload`, and amend the regenerated lockfile into the patch.

Done when the script reports the upgrade, `upstream/payload.json` names `<tag>`, and the diff of every remaining file in `upstream/patches` still expresses its intent.

## 3. Verify upstream behaviour

In `upstream/payload`, run `pnpm install`, then `pnpm build:all`, then each remaining patch's `Tests` command. Run the commands that need a deployed Worker in step 5.

Done when the build and every `Tests` command pass.

## 4. Verify Offload end to end

1. Apply the site-facing breaking changes from step 1 to `packages/` and `e2e`.
2. Run `pnpm release e2e`. It installs the new release into `e2e`; schema changes can fail it until step 3.
3. In `e2e`, run `pnpm payload migrate:create` and `CLOUDFLARE_ENV=postgres pnpm payload migrate:create`. Each generates a migration only when the schema changed.
4. Run `pnpm release e2e` and `pnpm release e2e --postgres` from the root.

Done when both suites pass.

## 5. Verify on Cloudflare

Some behaviour exists only on deployed Workers; password hashing limits are the known case. The suite runs only locally. If a staging Worker is configured, deploy `e2e` to it, then log in to its admin and publish a page.

Done when that works on staging, or when the report says staging is not configured.

## 6. Report

Commit the patch series and its docs pages, the pin, and the changes to `packages/` and `e2e` as separate commits. Then report:

- each patch's verdict and what changed in reworked patches
- the breaking changes that affect sites, and what a site must change
- the test results from steps 3 to 5

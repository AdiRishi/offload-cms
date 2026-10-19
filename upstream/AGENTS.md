# upstream

`@repo/upstream` pins the Payload release that Offload builds on, holds the patches applied to it, and has the `upstream` CLI that manages both.

`payload/` is a separate git repository: Payload at the pinned commit, with the patches applied as commits on branch `offload`. `pnpm upstream checkout` creates it. It has its own pnpm workspace and Turborepo config.

## Change Payload

1. Commit the change in `payload/`. The commit message is the only record of the patch's intent, so write it in the format that `docs/content/contributing/making-changes.mdx` describes.
2. Run `pnpm upstream export`. It rewrites `patches/` and the patch pages in `docs/content/patches/` from the commits, so change those through a commit and an export.

`pnpm build` refuses a checkout that differs from the pin plus the patches. Export your commits first, or reset the checkout with `pnpm upstream checkout --force`.

To move to a newer Payload release, follow `.agents/skills/upgrade-payload/SKILL.md`.

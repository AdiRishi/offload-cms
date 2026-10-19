# upstream

`@repo/upstream` is Offload's fork of Payload: the pinned release, the patches on top of it, and the `upstream` CLI that manages both.

- `payload.json` pins the Payload repository, tag and commit, and the Offload `revision` on top of that tag. A release is `<tag>-offload.<revision>`. Bump `revision` for every change that should publish, and reset it to 0 on a new tag; `pnpm upstream:upgrade` does that.
- `patches/` holds one `git format-patch` file per change to Payload. They are output of `pnpm upstream:export`, so never edit them by hand.
- `payload/` is the checkout: Payload at the pinned commit with the patches applied on branch `offload`. `pnpm upstream:checkout` creates it, and it is gitignored. It has its own git repository, pnpm workspace and Turborepo config.
- `src/` is the CLI. `pin.ts` is the package's public entry, which `release` and `docs` import for the version and package names.

To change Payload, commit in `payload/` with the message format in `docs/content/contributing/changing-payload.mdx`, then run `pnpm upstream:export`. It rewrites `patches/` and the patch pages in `docs/content/patches/` from the commit messages, so the commit message is the only place a patch's intent, upstream link, drop condition and tests are written.

`pnpm build` runs `upstream build`, which refuses to build a checkout that isn't the pin plus the patches. Export your commits, or reset the checkout with `pnpm upstream:checkout --force`.

# Offload

Offload republishes Payload CMS v4 as `@adirishi/offload-*`, with a short patch series and packages that run Payload sites on Cloudflare Workers.

- This is a pnpm workspace. Each external dependency names `catalog:`, and its version lives in `pnpm-workspace.yaml`. Peer ranges keep their own versions.
- Put new behaviour in a package in `packages/` when Payload's config or plugin API can express it. Patch Payload only when no extension point exists. `upstream/AGENTS.md` explains how a patch is made.
- Test a change to `packages/` or to a patch with `pnpm release e2e` and `pnpm release e2e --postgres`. Both publish the working tree to a throwaway registry and run the suite in `e2e/`.
- Releases need no version edit. Once CI passes on `main`, a commit that changes what the packages ship publishes as the next `-offload.<n>` release, with a git tag.
- The e2e site has one `initial` migration per database. A schema change rewrites it in place with `pnpm migrations:regenerate` in `e2e` and never adds a migration, so `pnpm deploy:staging` empties the staging D1 database before it migrates. `pnpm release e2e` fails when a migration doesn't match the schema. `e2e/AGENTS.md` has the details.
- Finish with `pnpm check`. `pnpm format:fix` and `pnpm lint:fix` fix most of what it reports. `pnpm check` skips the lint and type checks in `e2e`, whose dependencies exist only after `pnpm release e2e` installs them, so `pnpm release e2e` runs those checks.
- The contributor docs in `docs/content/contributing/` cover the layout, testing, and releases.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

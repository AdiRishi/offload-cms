# Offload

Offload is upstream Payload v4 plus the patch series in `upstream/patches`, published as `@adirishi/offload-*`. The documentation site in `docs/` has the layout and commands, in `docs/content/contributing/`.

- `upstream/AGENTS.md` explains the Payload fork. Change Payload by committing in `upstream/payload`, then run `pnpm upstream export`. `upstream/patches` and `docs/content/patches/[0-9]*.md` are export output.
- Put new behaviour in site code, or in a package in `packages/`, whenever Payload's config or plugin API can express it. A patch is for behaviour with no extension point.
- `upstream/` and `release/` are workspace packages whose CLIs Node runs straight from TypeScript. Every TypeScript workspace package extends a config from `@repo/tsconfig`. A new published package in `packages/` must also be a dependency of `release/package.json`.
- Every dependency of a root workspace package names `catalog:`, with its version in `pnpm-workspace.yaml`. Peer ranges and `e2e/` keep their own versions.
- `docs/` is a Blume site; write pages as Markdown or MDX in `docs/content`. Read the Blume skill bundled at `docs/node_modules/blume/skills/blume/SKILL.md` before changing it. `pnpm docs:dev` serves it locally.
- `e2e` installs Offload from a registry. Test a change to `packages/` or to a patch with `pnpm release e2e` and `pnpm release e2e --postgres`, which publish the working tree to a throwaway registry first. The suite covers what Offload changes and the main editor flows, not Payload's own features.
- Finish with `pnpm check`, plus `pnpm format:fix` and `pnpm lint:fix` when it reports problems. CI runs `pnpm check` and the e2e suite on every push. Bumping `revision` in `upstream/payload.json` publishes a release to GitHub Packages once CI passes on `main`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

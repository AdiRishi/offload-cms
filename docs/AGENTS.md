# docs

The documentation site, built with Blume and deployed to GitHub Pages from `main`. Read the Blume skill at `node_modules/blume/skills/blume/SKILL.md` before you change the config, navigation, or components.

- Each page has one job: a tutorial, a how-to guide, reference, or an explanation. Put new material on the page whose job it fits, and link to other pages for the rest.
- `content/patches/[0-9]*.md` is output of `pnpm upstream export`. Change a patch page through its commit message in `upstream/payload`.
- `{{version}}` renders the current Offload release.
- `pnpm docs:dev` serves the site, and `pnpm check` validates its links.

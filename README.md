<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/public/brand/offload-logo-white.png">
    <img src="docs/public/brand/offload-logo.png" alt="Offload" width="320">
  </picture>
</p>

Offload is [Payload CMS](https://github.com/payloadcms/payload) v4 for websites built with TanStack Start and hosted on Cloudflare Workers, on D1 or on Postgres through Hyperdrive. It is a pinned upstream Payload release, a small series of patches on top of it, and packages that run it on Workers, all published to GitHub Packages under `@adirishi/offload-*`. Payload is MIT-licensed, and Offload keeps upstream's code, names and license.

**[Read the documentation](https://adirishi.github.io/offload-cms/)** to install Offload in a site, choose a database, see what each patch changes, or contribute.

## Develop

You need Node 24 (see `.node-version`) and pnpm through Corepack.

```bash
pnpm install
pnpm upstream checkout
pnpm check
```

`pnpm release e2e` runs the end-to-end suite against the working tree, and `pnpm docs:dev` runs the documentation site locally. [Develop Offload](https://adirishi.github.io/offload-cms/contributing) covers the layout and every command.

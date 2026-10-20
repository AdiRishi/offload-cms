# @adirishi/create-offload

Creates a Payload site on Cloudflare Workers: Payload's `blank-tanstack` template with [Offload](https://adirishi.github.io/offload-cms/), D1, R2, Cloudflare Images, a production Wrangler environment, and CI that installs from GitHub Packages. The site's Offload packages take this package's version.

## Use it

The package is on GitHub Packages. [Getting started](https://adirishi.github.io/offload-cms/getting-started) sets up the token.

```bash
pnpm --config.@adirishi:registry=https://npm.pkg.github.com create @adirishi/offload my-site
```

The directory's name becomes the Worker's name and the name of its D1 database and R2 bucket. The command prints the steps that start the site.

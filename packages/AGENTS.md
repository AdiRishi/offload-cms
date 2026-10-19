# packages

Each public package here publishes alongside the Payload packages, at the same version. A package publishes only when `release/package.json` lists it as a `workspace:*` dependency, which also puts it in the release build.

`cloudflare/skills/offload/SKILL.md` ships in the package and is what agents in Offload sites read. Keep it in step with the package's exports, and keep it to what differs from stock Payload, since Payload's own skill covers the rest.

A package's README is its page on GitHub Packages. Keep it to what the package does, how to install it, and a short example, with links to the docs site for the rest.

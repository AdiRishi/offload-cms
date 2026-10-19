import { latestRelease, offloadVersion } from "@repo/upstream";
import { defineConfig } from "blume";

export default defineConfig({
  title: "Offload",
  description:
    "Payload CMS v4 for TanStack Start sites on Cloudflare Workers, on D1 or on Postgres through Hyperdrive.",
  logo: {
    image: {
      light: "/brand/offload-logo.png",
      dark: "/brand/offload-logo-white.png",
      alt: "Offload",
    },
    text: "",
  },
  content: { root: "content" },
  // Before the first release on a new Payload tag, the docs show the version that release gets.
  variables: { version: latestRelease()?.version ?? offloadVersion(0) },
  github: { owner: "AdiRishi", repo: "offload-cms", dir: "docs" },
  deployment: { site: "https://adirishi.github.io", base: "/offload-cms" },
});

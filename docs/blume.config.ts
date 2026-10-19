import { offloadVersion } from "@repo/upstream";
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
  variables: { version: offloadVersion },
  github: { owner: "AdiRishi", repo: "offload-cms", dir: "docs" },
  deployment: { site: "https://adirishi.github.io", base: "/offload-cms" },
});

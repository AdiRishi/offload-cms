import { offloadVite } from "@adirishi/offload-cloudflare/vite";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig(
  offloadVite({
    payloadConfigPath: path.resolve(import.meta.dirname, "src/payload.config.ts"),
  }),
);

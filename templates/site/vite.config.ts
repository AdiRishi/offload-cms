import { offloadVite } from "@arishi/offload-cloudflare/vite";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig(
  offloadVite({
    payloadConfigPath: path.resolve(import.meta.dirname, "src/payload.config.ts"),
    vite: () => ({
      resolve: { alias: { "@/": `${path.resolve(import.meta.dirname, "src")}/` } },
      server: { port: 3000 },
    }),
  }),
);

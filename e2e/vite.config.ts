import { offloadVite } from "@adirishi/offload-cloudflare/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig(
  offloadVite({
    payloadConfigPath: path.resolve(import.meta.dirname, "src/payload.config.ts"),
    vite: () => ({
      plugins: [tailwindcss()],
      resolve: { alias: { "@/": `${path.resolve(import.meta.dirname, "src")}/` } },
      server: { port: 3000 },
    }),
  }),
);

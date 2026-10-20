import { getBindings } from "@adirishi/offload-cloudflare";
import { sqliteD1Adapter } from "@payloadcms/db-d1-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { r2Storage } from "@payloadcms/storage-r2";
import { cloudflareTransformer } from "@payloadcms/transformer-cloudflare";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";

import { Media } from "./collections/Media";
import { Users } from "./collections/Users";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const env = await getBindings();

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: dirname },
  },
  collections: [Users, Media],
  db: sqliteD1Adapter({
    binding: env.D1,
    migrationDir: path.resolve(dirname, "migrations"),
    push: false,
  }),
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  storage: [r2Storage({ bucket: env.R2, collections: { media: true } })],
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  upload: {
    transformers: [
      cloudflareTransformer({
        // Cloudflare's upload check loads this config without bindings, and the transformer
        // throws on an undefined binding.
        transport: { mode: "binding", binding: () => env.IMAGES },
        collections: {
          media: {
            variants: [
              { name: "thumbnail", width: 400 },
              { name: "medium", width: 900 },
              { name: "large", width: 1600 },
              { name: "og", width: 1200, height: 630 },
            ],
          },
        },
      }),
    ],
  },
});

import { getBindings } from "@arishi/offload-cloudflare";
import { sqliteD1Adapter } from "@payloadcms/db-d1-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { r2Storage } from "@payloadcms/storage-r2";
import path from "path";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";

import { Folders } from "./collections/Folders";
import { Media } from "./collections/Media";
import { Pages } from "./collections/Pages";
import { Tags } from "./collections/Tags";
import { Users } from "./collections/Users";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const env = await getBindings();

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, Media, Folders, Tags, Pages],
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  telemetry: false,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  // Migrations own the schema everywhere, so dev and production cannot drift.
  db: sqliteD1Adapter({ binding: env.D1, push: false }),
  storage: [r2Storage({ bucket: env.R2, collections: { media: true } })],
});

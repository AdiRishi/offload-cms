import { getBindings, hyperdrivePoolConfig } from "@adirishi/offload-cloudflare";
import { sqliteD1Adapter } from "@payloadcms/db-d1-sqlite";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder";
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs";
import { redirectsPlugin } from "@payloadcms/plugin-redirects";
import { searchPlugin } from "@payloadcms/plugin-search";
import { seoPlugin } from "@payloadcms/plugin-seo";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { r2Storage } from "@payloadcms/storage-r2";
import path from "path";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";

import { AuditLogs } from "./collections/AuditLogs";
import { Categories } from "./collections/Categories";
import { FieldTypes } from "./collections/FieldTypes";
import { Folders } from "./collections/Folders";
import { Media } from "./collections/Media";
import { Pages } from "./collections/Pages";
import { Posts } from "./collections/Posts";
import { Tags } from "./collections/Tags";
import { Users } from "./collections/Users";
import { Header, SiteSettings } from "./globals";
import { jobs, queueJobEndpoint, schedulePublishEndpoint } from "./jobs";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const env = await getBindings();

// The default Wrangler environment binds D1. CLOUDFLARE_ENV=postgres binds Hyperdrive instead.
// Cloudflare's upload validation runs this module without bindings, so nothing here may
// require one: the adapters only use them once the first request connects.
// Migrations own the schema on both, so dev and production cannot drift.
const databaseAdapter = () =>
  env.HYPERDRIVE
    ? postgresAdapter({
        migrationDir: path.resolve(dirname, "migrations/postgres"),
        pool: hyperdrivePoolConfig(env.HYPERDRIVE),
        push: false,
      })
    : sqliteD1Adapter({
        binding: env.D1,
        migrationDir: path.resolve(dirname, "migrations/d1"),
        push: false,
      });

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, Pages, Posts, Categories, Media, FieldTypes, Folders, Tags, AuditLogs],
  db: databaseAdapter(),
  editor: lexicalEditor(),
  endpoints: [queueJobEndpoint, schedulePublishEndpoint],
  globals: [SiteSettings, Header],
  jobs,
  localization: {
    defaultLocale: "en",
    fallback: true,
    locales: [
      { code: "en", label: "English" },
      { code: "fr", label: "Français" },
    ],
  },
  plugins: [
    seoPlugin({
      collections: ["pages", "posts"],
      generateTitle: ({ doc }) => `${String(doc.title)} | Offload`,
      uploadsCollection: "media",
    }),
    nestedDocsPlugin({
      collections: ["pages"],
      generateLabel: (_, doc) => String(doc.title),
      generateURL: (docs) => docs.reduce((url, doc) => `${url}/${String(doc.slug)}`, ""),
    }),
    redirectsPlugin({ collections: ["pages", "posts"] }),
    searchPlugin({ collections: ["posts"], defaultPriorities: { posts: 10 } }),
    formBuilderPlugin({ fields: { payment: false } }),
  ],
  secret: env.PAYLOAD_SECRET,
  storage: [r2Storage({ bucket: env.R2, collections: { media: true } })],
  telemetry: false,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
});

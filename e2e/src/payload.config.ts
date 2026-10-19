import { getBindings, hyperdrivePoolConfig } from "@adirishi/offload-cloudflare";
import { cloudflareEmailAdapter } from "@adirishi/offload-email-cloudflare";
import { sqliteD1Adapter } from "@payloadcms/db-d1-sqlite";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { formBuilderPlugin } from "@payloadcms/plugin-form-builder";
import { nestedDocsPlugin } from "@payloadcms/plugin-nested-docs";
import { redirectsPlugin } from "@payloadcms/plugin-redirects";
import { searchPlugin } from "@payloadcms/plugin-search";
import { seoPlugin } from "@payloadcms/plugin-seo";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { r2Storage } from "@payloadcms/storage-r2";
import { cloudflareTransformer } from "@payloadcms/transformer-cloudflare";
import path from "path";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";

import { isStaff } from "./access";
import { PullQuote } from "./blocks";
import { AuditLogs } from "./collections/AuditLogs";
import { Bookings } from "./collections/Bookings";
import { Categories } from "./collections/Categories";
import { Customers } from "./collections/Customers";
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
  blocks: [PullQuote],
  collections: [
    Users,
    Customers,
    Pages,
    Posts,
    Categories,
    Media,
    FieldTypes,
    Folders,
    Tags,
    AuditLogs,
    Bookings,
  ],
  db: databaseAdapter(),
  editor: lexicalEditor(),
  email: cloudflareEmailAdapter({
    binding: env.EMAIL,
    defaultFromAddress: "noreply@example.com",
    defaultFromName: "Offload e2e",
  }),
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
    formBuilderPlugin({
      fields: { payment: false },
      // Visitors submit through saveFormSubmission(), after the rate limit and Turnstile.
      formSubmissionOverrides: { access: { create: isStaff } },
    }),
  ],
  secret: env.PAYLOAD_SECRET,
  storage: [r2Storage({ bucket: env.R2, collections: { media: true } })],
  telemetry: false,
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
  upload: {
    transformers: [
      cloudflareTransformer({
        // A function: cloudflareTransformer() throws on an undefined binding, as in upload validation.
        transport: { mode: "binding", binding: () => env.IMAGES },
        // Seven variants make media's main table 80 columns wide, near D1's limits of
        // 100 columns per table and 100 bound parameters per statement.
        collections: {
          media: {
            variants: [
              { name: "thumbnail", width: 160, height: 120 },
              { name: "square", width: 256, height: 256 },
              { name: "small", width: 320 },
              { name: "card", width: 480, height: 320 },
              { name: "medium", width: 640 },
              { name: "large", width: 1024 },
              { name: "og", width: 1200, height: 630 },
            ],
          },
        },
      }),
    ],
  },
});

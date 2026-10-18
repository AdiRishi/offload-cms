import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { cloudflareEnv } from './cloudflare'
import { Folders } from './collections/Folders'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, Media, Folders, Tags, Pages],
  editor: lexicalEditor(),
  secret: cloudflareEnv.PAYLOAD_SECRET,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  jobs: {
    tasks: [
      {
        slug: 'stampPage',
        inputSchema: [{ name: 'slug', type: 'text', required: true }],
        handler: async ({ input, req }) => {
          const { docs } = await req.payload.find({
            collection: 'pages',
            where: { slug: { equals: input.slug } },
            limit: 1,
            overrideAccess: true,
          })
          const page = docs[0]
          if (page) {
            await req.payload.update({
              collection: 'pages',
              id: page.id,
              data: { title: `${page.title.replace(/ \(cron .*\)$/, '')} (cron ${new Date().toISOString()})` },
              overrideAccess: true,
            })
          }
          return { output: {} }
        },
      },
    ],
  },
  db: sqliteD1Adapter({ binding: cloudflareEnv.D1 }),
  storage: [r2Storage({ bucket: cloudflareEnv.R2, collections: { media: true } })],
})

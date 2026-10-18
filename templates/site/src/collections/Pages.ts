import type { CollectionConfig } from 'payload'

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: { read: () => true },
  admin: { useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'hero', type: 'upload', relationTo: 'media' },
    { name: 'body', type: 'richText' },
    {
      name: 'blocks',
      type: 'blocks',
      blocks: [
        { slug: 'cta', fields: [{ name: 'label', type: 'text' }, { name: 'href', type: 'text' }] },
        { slug: 'quote', fields: [{ name: 'text', type: 'textarea' }, { name: 'author', type: 'text' }] },
      ],
    },
  ],
  versions: { drafts: { schedulePublish: true } },
}

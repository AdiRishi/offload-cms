import type { CollectionConfig } from "payload";

import { isStaff, publishedOrStaff } from "../access";

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    defaultColumns: ["title", "slug", "_status"],
    livePreview: { url: ({ data }) => `/${String(data.slug ?? "")}` },
    useAsTitle: "title",
  },
  access: { create: isStaff, delete: isStaff, read: publishedOrStaff, update: isStaff },
  fields: [
    { name: "title", type: "text", localized: true, required: true },
    { name: "slug", type: "text", index: true, required: true, unique: true },
    { name: "hero", type: "upload", relationTo: "media" },
    {
      name: "layout",
      type: "blocks",
      blocks: [
        {
          slug: "quote",
          fields: [
            { name: "text", type: "textarea", localized: true, required: true },
            { name: "author", type: "text" },
          ],
        },
        {
          slug: "cta",
          fields: [
            { name: "label", type: "text", required: true },
            { name: "href", type: "text", required: true },
          ],
        },
        { slug: "content", fields: [{ name: "body", type: "richText" }] },
        "pullQuote",
        {
          slug: "form",
          interfaceName: "FormBlock",
          fields: [{ name: "form", type: "relationship", relationTo: "forms", required: true }],
        },
        {
          slug: "newsletter",
          interfaceName: "NewsletterBlock",
          fields: [
            { name: "signupForm", type: "relationship", relationTo: "forms", required: true },
          ],
        },
      ],
    },
  ],
  versions: { drafts: { schedulePublish: true }, maxPerDoc: 20 },
};

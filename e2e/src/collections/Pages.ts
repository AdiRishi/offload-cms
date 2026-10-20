import type { CollectionConfig } from "payload";

import { blockDescription, link } from "@adirishi/offload-tanstack/fields";

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
            blockDescription("A quotation, shown large, with its author."),
            { name: "text", type: "textarea", localized: true, required: true },
            { name: "author", type: "text" },
          ],
        },
        {
          slug: "cta",
          fields: [link({ relationTo: ["pages", "posts"] })],
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

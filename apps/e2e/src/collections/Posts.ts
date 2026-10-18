import type { CollectionConfig } from "payload";

import { BlocksFeature, lexicalEditor } from "@payloadcms/richtext-lexical";
import { createFolderField, createTagField } from "payload";

import { isStaff, publishedOrStaff } from "../access";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const Posts: CollectionConfig = {
  slug: "posts",
  admin: { defaultColumns: ["title", "slug", "_status", "updatedAt"], useAsTitle: "title" },
  access: { create: isStaff, delete: isStaff, read: publishedOrStaff, update: isStaff },
  endpoints: [
    {
      path: "/:id/word-count",
      method: "get",
      handler: async (req) => {
        const id = req.routeParams?.id;
        if (typeof id !== "string" && typeof id !== "number") {
          return Response.json({ error: "Missing id" }, { status: 400 });
        }
        const post = await req.payload.findByID({ id, collection: "posts", req });
        return Response.json({ id: post.id, words: post.wordCount ?? 0 });
      },
    },
  ],
  fields: [
    { name: "title", type: "text", localized: true, required: true },
    { name: "slug", type: "text", index: true, unique: true },
    { name: "excerpt", type: "textarea" },
    { name: "author", type: "relationship", relationTo: "users" },
    { name: "categories", type: "relationship", hasMany: true, relationTo: "categories" },
    { name: "heroImage", type: "upload", relationTo: "media" },
    {
      name: "content",
      type: "richText",
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          BlocksFeature({
            blocks: [
              {
                slug: "callout",
                fields: [
                  {
                    name: "tone",
                    type: "select",
                    defaultValue: "info",
                    options: ["info", "warning"],
                  },
                  { name: "message", type: "text", required: true },
                ],
              },
            ],
          }),
        ],
      }),
    },
    { name: "publishedAt", type: "date", admin: { position: "sidebar" } },
    {
      name: "wordCount",
      type: "number",
      admin: { readOnly: true },
      virtual: true,
      hooks: {
        afterRead: [
          ({ data }) =>
            typeof data?.excerpt === "string"
              ? data.excerpt.split(/\s+/).filter(Boolean).length
              : 0,
        ],
      },
    },
    createFolderField({ relationTo: "folders" }),
    createTagField({ relationTo: "tags" }),
  ],
  hooks: {
    beforeChange: [
      ({ data }) =>
        typeof data.title === "string" && !data.slug
          ? { ...data, slug: slugify(data.title) }
          : data,
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        await req.payload.create({
          collection: "audit-logs",
          data: {
            action: operation,
            collection: "posts",
            documentID: String(doc.id),
            summary: doc.title,
          },
          overrideAccess: true,
          req,
        });
      },
    ],
  },
  trash: true,
  versions: { drafts: { autosave: { interval: 400 } }, maxPerDoc: 20 },
};

import type { CollectionConfig } from "payload";

import { isStaff } from "../access";

/**
 * One document type that uses every field type Payload supports on both SQLite and
 * Postgres. `point` is left out: SQLite has no geometry type.
 */
export const FieldTypes: CollectionConfig = {
  slug: "field-types",
  admin: { useAsTitle: "text" },
  access: { create: isStaff, delete: isStaff, read: isStaff, update: isStaff },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Scalars",
          fields: [
            { name: "text", type: "text", required: true, minLength: 2 },
            { name: "localizedText", type: "text", localized: true },
            { name: "textMany", type: "text", hasMany: true },
            { name: "textarea", type: "textarea" },
            { name: "number", type: "number", min: 0, max: 1000 },
            { name: "numberMany", type: "number", hasMany: true },
            { name: "email", type: "email" },
            { name: "date", type: "date", admin: { date: { pickerAppearance: "dayAndTime" } } },
            { name: "checkbox", type: "checkbox" },
            { name: "code", type: "code", admin: { language: "typescript" } },
            { name: "json", type: "json" },
          ],
        },
        {
          label: "Choices",
          fields: [
            { name: "select", type: "select", options: ["small", "medium", "large"] },
            {
              name: "selectMany",
              type: "select",
              hasMany: true,
              options: ["red", "green", "blue"],
            },
            { name: "radio", type: "radio", options: ["yes", "no"] },
          ],
        },
        {
          name: "relations",
          label: "Relations",
          fields: [
            { name: "relationship", type: "relationship", relationTo: "categories" },
            {
              name: "relationshipMany",
              type: "relationship",
              hasMany: true,
              relationTo: "categories",
            },
            { name: "polymorphic", type: "relationship", relationTo: ["pages", "posts"] },
            { name: "upload", type: "upload", relationTo: "media" },
          ],
        },
        {
          label: "Structure",
          fields: [
            {
              name: "group",
              type: "group",
              fields: [
                { name: "title", type: "text" },
                {
                  type: "row",
                  fields: [
                    { name: "left", type: "text" },
                    { name: "right", type: "text" },
                  ],
                },
              ],
            },
            {
              type: "collapsible",
              label: "Collapsible",
              fields: [{ name: "insideCollapsible", type: "text" }],
            },
            {
              name: "array",
              type: "array",
              fields: [
                { name: "label", type: "text", required: true },
                { name: "children", type: "array", fields: [{ name: "value", type: "text" }] },
              ],
            },
            {
              name: "localizedArray",
              type: "array",
              localized: true,
              fields: [{ name: "label", type: "text" }],
            },
            {
              name: "blocks",
              type: "blocks",
              blocks: [
                { slug: "textBlock", fields: [{ name: "text", type: "text" }] },
                {
                  slug: "listBlock",
                  fields: [
                    { name: "items", type: "array", fields: [{ name: "item", type: "text" }] },
                  ],
                },
              ],
            },
            { name: "richText", type: "richText" },
          ],
        },
      ],
    },
  ],
  versions: false,
};

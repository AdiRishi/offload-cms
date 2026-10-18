import type { CollectionConfig } from "payload";

import { createFolderField, createTagField } from "payload";

import { isStaff } from "../access";

export const Media: CollectionConfig = {
  slug: "media",
  access: { create: isStaff, delete: isStaff, read: () => true, update: isStaff },
  fields: [
    { name: "alt", type: "text", required: true },
    { name: "caption", type: "textarea", localized: true },
    createFolderField({ relationTo: "folders" }),
    createTagField({ relationTo: "tags" }),
  ],
  upload: { crop: true, focalPoint: true, mimeTypes: ["image/*"] },
};

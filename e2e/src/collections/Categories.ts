import type { CollectionConfig } from "payload";

import { isStaff } from "../access";

export const Categories: CollectionConfig = {
  slug: "categories",
  admin: { useAsTitle: "name" },
  access: { create: isStaff, delete: isStaff, read: () => true, update: isStaff },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", index: true, required: true, unique: true },
    { name: "posts", type: "join", collection: "posts", on: "categories" },
  ],
  versions: false,
};

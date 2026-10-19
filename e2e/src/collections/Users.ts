import type { CollectionConfig } from "payload";

import { isStaff } from "../access";

export const Users: CollectionConfig = {
  slug: "users",
  admin: { useAsTitle: "email" },
  auth: true,
  access: { admin: isStaff, create: isStaff, delete: isStaff, read: isStaff, update: isStaff },
  fields: [
    { name: "name", type: "text" },
    {
      name: "role",
      type: "select",
      defaultValue: "admin",
      options: ["admin", "customer"],
      required: true,
    },
  ],
  versions: false,
};

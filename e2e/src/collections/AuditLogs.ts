import type { CollectionConfig } from "payload";

import { isStaff } from "../access";

/** Written by hooks and jobs. The e2e suite reads it to observe side effects. */
export const AuditLogs: CollectionConfig = {
  slug: "audit-logs",
  admin: {
    defaultColumns: ["action", "collection", "summary", "createdAt"],
    useAsTitle: "summary",
  },
  access: { create: () => false, delete: () => false, read: isStaff, update: () => false },
  fields: [
    { name: "action", type: "text", required: true },
    { name: "collection", type: "text" },
    { name: "documentID", type: "text" },
    { name: "summary", type: "text" },
  ],
  versions: false,
};

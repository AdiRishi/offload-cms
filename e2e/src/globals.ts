import type { GlobalConfig } from "payload";

import { rowLabel } from "@adirishi/offload-tanstack/fields";

import { isStaff } from "./access";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  access: { read: () => true, update: isStaff },
  fields: [
    { name: "siteName", type: "text", localized: true, required: true, defaultValue: "Offload" },
    { name: "maintenanceMode", type: "checkbox" },
    {
      name: "footerLinks",
      type: "array",
      admin: { components: { RowLabel: rowLabel("label", "Link") } },
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true },
      ],
    },
  ],
};

export const Header: GlobalConfig = {
  slug: "header",
  access: { read: () => true, update: isStaff },
  fields: [
    {
      name: "navigation",
      type: "array",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "page", type: "relationship", relationTo: "pages" },
      ],
    },
  ],
  versions: { drafts: true },
};

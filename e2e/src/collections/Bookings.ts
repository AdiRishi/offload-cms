import type { CollectionConfig } from "payload";

import { adminOrOwner, isAdminUser } from "@adirishi/offload-accounts/config";

/** Documents that belong to one customer, who reads only their own. */
export const Bookings: CollectionConfig = {
  slug: "bookings",
  admin: { useAsTitle: "title" },
  access: {
    create: isAdminUser,
    read: adminOrOwner("customers", "customer"),
    update: isAdminUser,
    delete: isAdminUser,
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "customer", type: "relationship", relationTo: "customers", required: true },
  ],
};

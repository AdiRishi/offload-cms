import { createAccountHelpers } from "@adirishi/offload-accounts/server";

import { getVisitorPayload } from "@/lib/payload.server";

export const accounts = createAccountHelpers({
  getPayload: getVisitorPayload,
  collection: "customers",
});

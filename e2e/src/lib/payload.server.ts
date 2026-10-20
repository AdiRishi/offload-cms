import { createPayloadHelpers } from "@adirishi/offload-tanstack/server";

import { documentPath } from "@/seo";

export const { getPayloadForRequest, getRequestPayload, getVisitorPayload, redirectOrNotFound } =
  createPayloadHelpers({
    getConfig: async () => (await import("@payload-config")).default,
    documentPath: ({ relationTo, value }) => documentPath(relationTo, value.slug),
  });

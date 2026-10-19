import { createPayloadHelpers } from "@adirishi/offload-tanstack/server";

export const { getPayloadForRequest, getRequestPayload, getVisitorPayload, redirectOrNotFound } =
  createPayloadHelpers({
    getConfig: async () => (await import("@payload-config")).default,
    documentPath: ({ relationTo, value }) =>
      relationTo === "posts" ? `/posts/${value.slug}` : `/${value.slug}`,
  });

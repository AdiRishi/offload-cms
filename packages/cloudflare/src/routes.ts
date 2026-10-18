import type { SanitizedConfig } from "payload";

import { handleGraphQL } from "@payloadcms/tanstack-start/server";

/**
 * Server handlers for a `/_payload/api/graphql` route. The TanStack Start
 * template only routes REST, through `payloadApiHandlers`.
 */
export const payloadGraphQLHandlers = ({
  getConfig,
}: {
  getConfig: () => Promise<SanitizedConfig>;
}) => ({
  POST: async ({ request }: { request: Request }) =>
    handleGraphQL({ config: getConfig(), request }),
});

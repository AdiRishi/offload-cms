import { loadRscPayload } from "./rsc-payload.ts";

type RouteHandler = (ctx: { request: Request }) => Promise<Response>;

const restHandler: RouteHandler = async ({ request }) =>
  (await loadRscPayload()).handleRESTRequest(request);

/**
 * Server handlers for the `/_payload/api/$` route. Use them in place of
 * `payloadApiHandlers` from `@payloadcms/tanstack-start/server`, which imports
 * Payload into the SSR environment.
 */
export const payloadApiHandlers = (): Record<
  "DELETE" | "GET" | "OPTIONS" | "PATCH" | "POST" | "PUT",
  RouteHandler
> => ({
  DELETE: restHandler,
  GET: restHandler,
  OPTIONS: restHandler,
  PATCH: restHandler,
  POST: restHandler,
  PUT: restHandler,
});

/**
 * Server handlers for a `/_payload/api/graphql` route. The TanStack Start
 * template only routes REST.
 */
export const payloadGraphQLHandlers = (): { POST: RouteHandler } => ({
  POST: async ({ request }) => (await loadRscPayload()).handleGraphQLRequest(request),
});

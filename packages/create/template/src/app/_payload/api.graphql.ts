import { payloadGraphQLHandlers } from "@adirishi/offload-cloudflare/routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_payload/api/graphql")({
  server: {
    handlers: payloadGraphQLHandlers(),
  },
});

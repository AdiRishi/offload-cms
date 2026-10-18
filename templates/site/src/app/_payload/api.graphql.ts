import { payloadGraphQLHandlers } from '@arishi/offload-cloudflare/routes'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_payload/api/graphql')({
  server: {
    handlers: payloadGraphQLHandlers({
      getConfig: async () => (await import('@payload-config')).default,
    }),
  },
})

import { handleGraphQL } from '@payloadcms/tanstack-start/server'
import { createFileRoute } from '@tanstack/react-router'

const config = async () => (await import('@payload-config')).default

export const Route = createFileRoute('/_payload/api/graphql')({
  server: {
    handlers: {
      POST: async ({ request }) => handleGraphQL({ config: await config(), request }),
    },
  },
})

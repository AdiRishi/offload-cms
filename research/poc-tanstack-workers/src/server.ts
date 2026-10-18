import handler from '@tanstack/react-start/server-entry'

export default {
  fetch: handler.fetch,
  async scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
    ])
    const payload = await getPayload({ config })
    await payload.jobs.queue({ task: 'stampPage', input: { slug: 'hello' }, overrideAccess: true })
    ctx.waitUntil(payload.jobs.run({ overrideAccess: true }))
  },
} satisfies ExportedHandler

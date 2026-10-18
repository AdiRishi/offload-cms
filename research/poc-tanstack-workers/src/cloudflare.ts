import type { GetPlatformProxyOptions } from 'wrangler'

import { createRequire } from 'node:module'

type Bindings = {
  D1: D1Database
  PAYLOAD_SECRET: string
  R2: R2Bucket
}

const isWorkerd = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'

// Inside workerd the bindings come from the runtime. In Node (Vite dev and the
// Payload CLI) Wrangler's platform proxy serves the same local D1/R2 state.
// `createRequire` keeps Wrangler out of Vite's module graph.
async function nodeBindings(): Promise<Bindings> {
  const { getPlatformProxy } = createRequire(import.meta.url)('wrangler') as typeof import('wrangler')
  const proxy = await getPlatformProxy<Bindings>({
    environment: process.env.CLOUDFLARE_ENV,
  } satisfies GetPlatformProxyOptions)
  return proxy.env
}

export const cloudflareEnv: Bindings = isWorkerd
  ? ((await import(/* @vite-ignore */ 'cloudflare:workers')).env as Bindings)
  : await nodeBindings()

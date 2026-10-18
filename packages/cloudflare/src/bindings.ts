import { createRequire } from 'node:module'
import path from 'node:path'

type Wrangler = Pick<typeof import('wrangler'), 'getPlatformProxy'>

const isWorkerd = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'

const isWrangler = (value: unknown): value is Wrangler =>
  typeof value === 'object' &&
  value !== null &&
  'getPlatformProxy' in value &&
  typeof value.getPlatformProxy === 'function'

/**
 * Returns the Worker's bindings. Inside workerd they come from the runtime.
 * In Node (Vite dev and the Payload CLI) they come from Wrangler's platform
 * proxy, which serves the same local D1 and R2 state as `vite preview`.
 *
 * Call it with top-level await in `payload.config.ts`.
 */
export const getBindings = async (): Promise<Cloudflare.Env> => {
  if (isWorkerd) return (await import('cloudflare:workers')).env

  // Required from the app's directory so Vite never adds Wrangler to the module graph.
  const wrangler: unknown = createRequire(path.join(process.cwd(), 'package.json'))('wrangler')
  if (!isWrangler(wrangler)) throw new Error('Install wrangler to use Cloudflare bindings outside workerd.')

  const proxy = await wrangler.getPlatformProxy<Cloudflare.Env>({
    environment: process.env.CLOUDFLARE_ENV,
  })
  return proxy.env
}

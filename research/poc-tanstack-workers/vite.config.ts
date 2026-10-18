import type { UserConfig } from 'vite'

import { withPayload } from '@payloadcms/tanstack-start'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin, type PluginOption } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// workerd resolves with the `browser` condition, which maps `payload` and
// `@payloadcms/tanstack-start/rsc` to their client-safe entries. Server
// environments need the server entries, including in the dependency optimizer.
function workerdServerConditions(): Plugin {
  return {
    name: 'offload:workerd-server-conditions',
    enforce: 'post',
    configEnvironment(name, config) {
      if (name === 'client') return
      const withoutBrowser = (conditions?: string[]) =>
        conditions?.filter((condition) => condition !== 'browser')
      if (config.resolve?.conditions) {
        config.resolve.conditions = withoutBrowser(config.resolve.conditions)
      }
    },
  }
}

// workerd leaves `import.meta.url` undefined in bundled modules, and Payload
// derives `dirname` from it at module scope. Nothing on the request path reads
// from that directory, so a stable placeholder is enough.
function workerdImportMetaUrl(): Plugin {
  return {
    name: 'offload:workerd-import-meta-url',
    applyToEnvironment: (environment) => environment.name !== 'client',
    transform(code, id) {
      if (!code.includes('import.meta.url')) return
      return code.replaceAll('import.meta.url', '(import.meta.url ?? "file:///worker/index.js")')
    },
  }
}

// The adapter hides these imports from the bundler so Node resolves them from
// node_modules at runtime. A Worker has no node_modules, so make them literal.
function workerdLiteralImports(): Plugin {
  const hidden: Record<string, string> = {
    graphqlPackage: '@payloadcms/graphql',
    graphqlHttpHandlerPath: 'graphql-http/lib/use/fetch',
  }
  return {
    name: 'offload:workerd-literal-imports',
    enforce: 'pre',
    applyToEnvironment: (environment) => environment.name !== 'client',
    transform(code, id) {
      if (!id.includes('routes/graphql/handler.server')) return
      return code.replace(
        /import\(\s*\/\*\s*@vite-ignore\s*\*\/\s*(\w+)\s*\)/g,
        (match, name: string) => (hidden[name] ? `import('${hidden[name]}')` : match),
      )
    },
  }
}

// graphql ships CommonJS and ESM builds. Bundling both breaks its `instanceof`
// checks ("Unexpected input type"), so every server import gets the ESM build.
function singleGraphqlBuild(): Plugin {
  return {
    name: 'offload:single-graphql-build',
    enforce: 'pre',
    applyToEnvironment: (environment) => environment.name !== 'client',
    async resolveId(id, importer, options) {
      if (id !== 'graphql' && !id.startsWith('graphql/')) return
      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true })
      if (!resolved || !/[\\/]graphql[\\/].*\.js$/.test(resolved.id)) return resolved
      const esm = resolved.id.replace(/\.js$/, '.mjs')
      return existsSync(esm) ? { ...resolved, id: esm } : resolved
    },
  }
}

const workerdPlugins = async (): Promise<PluginOption[]> => {
  const { cloudflare } = await import('@cloudflare/vite-plugin')
  return [
    workerdServerConditions(),
    workerdImportMetaUrl(),
    workerdLiteralImports(),
    singleGraphqlBuild(),
    cloudflare({ viteEnvironment: { name: 'ssr', childEnvironments: ['rsc'] } }),
  ]
}

const payloadVite = (extraPlugins: PluginOption[]) =>
  withPayload(
    ({ pluginOptions }) => ({
      plugins: [
        ...extraPlugins,
        rsc(pluginOptions.rsc),
        tanstackStart(pluginOptions.tanstackStart),
        viteReact(pluginOptions.react),
      ],
      resolve: {
        alias: { '@/': `${path.resolve(__dirname, 'src')}/` },
      },
      server: { port: 3000 },
    }),
    {
      // CommonJS deps reached only on the dev schema-push path.
      devServerExternalPackages: ['prompts'],
      payloadConfigPath: path.resolve(__dirname, 'src', 'payload.config.ts'),
    },
  )

// Workers have no node_modules at runtime, so the Node-oriented externals that
// withPayload sets for the ssr/rsc environments must go.
function bundleEverything(config: UserConfig): UserConfig {
  delete config.ssr?.external
  for (const name of ['ssr', 'rsc']) {
    const environment = config.environments?.[name]
    delete environment?.resolve?.external
    delete environment?.build?.rollupOptions?.external
  }
  return config
}

// Dev runs in Node and reaches D1 and R2 through Wrangler's platform proxy: inside
// workerd the RSC module runner cannot load Payload's CommonJS dependencies. The
// Cloudflare plugin is imported lazily because loading it into the Vite process
// breaks Node-side CommonJS interop for those same dependencies.
export default defineConfig(async (env) => {
  if (env.command === 'serve' && !env.isPreview) return payloadVite([])(env)
  return bundleEverything(await payloadVite(await workerdPlugins())(env))
})

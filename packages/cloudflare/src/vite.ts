import type { cloudflare } from "@cloudflare/vite-plugin";

import { withPayload } from "@payloadcms/tanstack-start";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import {
  type ConfigEnv,
  mergeConfig,
  type Plugin,
  type PluginOption,
  type UserConfig,
  type UserConfigFnPromise,
} from "vite";

type CloudflarePluginConfig = NonNullable<Parameters<typeof cloudflare>[0]>;

export type OffloadViteOptions = {
  /** Options for `@cloudflare/vite-plugin`. Offload sets `viteEnvironment`. */
  cloudflare?: Omit<CloudflarePluginConfig, "viteEnvironment">;
  /** CommonJS packages that Vite dev must leave to Node, on top of Offload's own. */
  devServerExternalPackages?: string[];
  /** Path to `payload.config.ts`. */
  payloadConfigPath: string;
  /** The app's own Vite config, merged over Offload's. */
  vite?: (env: ConfigEnv) => UserConfig;
};

const isServerEnvironment = (environment: { name: string }) => environment.name !== "client";

/**
 * workerd resolves with the `browser` condition, which maps `payload` and
 * `@payloadcms/tanstack-start/rsc` to their client-safe entries. Server
 * environments need the server entries, including in the dependency optimizer.
 */
const serverConditions = (): Plugin => ({
  name: "offload:workerd-server-conditions",
  enforce: "post",
  configEnvironment(name, config) {
    if (name === "client" || !config.resolve?.conditions) return;
    config.resolve.conditions = config.resolve.conditions.filter(
      (condition) => condition !== "browser",
    );
  },
});

/**
 * workerd leaves `import.meta.url` undefined in bundled modules, and Payload
 * derives `dirname` from it at module scope. Nothing on the request path reads
 * that directory, so a placeholder is enough.
 */
const importMetaUrlFallback = (): Plugin => ({
  name: "offload:workerd-import-meta-url",
  applyToEnvironment: isServerEnvironment,
  transform(code) {
    if (!code.includes("import.meta.url")) return null;
    return code.replaceAll("import.meta.url", '(import.meta.url ?? "file:///worker/index.js")');
  },
});

/**
 * The adapter hides the GraphQL imports from the bundler so Node resolves them
 * from node_modules at runtime. A Worker has no node_modules.
 */
const literalGraphQLImports = (): Plugin => {
  const hidden = new Map([
    ["graphqlPackage", "@payloadcms/graphql"],
    ["graphqlHttpHandlerPath", "graphql-http/lib/use/fetch"],
  ]);
  return {
    name: "offload:workerd-literal-imports",
    enforce: "pre",
    applyToEnvironment: isServerEnvironment,
    transform(code, id) {
      if (!id.includes("routes/graphql/handler.server")) return null;
      return code.replace(
        /import\(\s*\/\*\s*@vite-ignore\s*\*\/\s*(\w+)\s*\)/g,
        (match, name: string) => {
          const specifier = hidden.get(name);
          return specifier === undefined ? match : `import('${specifier}')`;
        },
      );
    },
  };
};

/**
 * graphql ships CommonJS and ESM builds. Bundling both breaks its `instanceof`
 * checks ("Unexpected input type"), so every server import gets the ESM build.
 */
const singleGraphQLBuild = (): Plugin => ({
  name: "offload:single-graphql-build",
  enforce: "pre",
  applyToEnvironment: isServerEnvironment,
  async resolveId(id, importer, options) {
    if (id !== "graphql" && !id.startsWith("graphql/")) return null;
    const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
    if (!resolved || !/[\\/]graphql[\\/].*\.js$/.test(resolved.id)) return resolved;
    const esm = resolved.id.replace(/\.js$/, ".mjs");
    return existsSync(esm) ? { ...resolved, id: esm } : resolved;
  },
});

/**
 * `pg` loads `pg-pool` with `require()`, but the worker resolve conditions pick
 * pg-pool's ESM wrapper, whose default export then fails `class extends Pool`.
 */
const pgPoolCommonJs = (): Plugin => ({
  name: "offload:pg-pool-commonjs",
  enforce: "pre",
  applyToEnvironment: isServerEnvironment,
  resolveId(id, importer) {
    if (id !== "pg-pool" || importer === undefined) return null;
    return createRequire(importer).resolve("pg-pool");
  },
});

/** Workers have no node_modules, so the Node externals `withPayload` sets must go. */
const bundleEverything = (config: UserConfig): UserConfig => {
  delete config.ssr?.external;
  for (const name of ["ssr", "rsc"]) {
    const environment = config.environments?.[name];
    delete environment?.resolve?.external;
    delete environment?.build?.rollupOptions?.external;
  }
  return config;
};

/**
 * Vite config for an Offload site on Cloudflare Workers.
 *
 * `vite build` and `vite preview` target workerd through the Cloudflare
 * plugin. `vite dev` runs in Node, because the RSC module runner cannot load
 * Payload's CommonJS dependencies inside workerd; use `getBindings()` to reach
 * the same local D1 and R2 state from Node.
 */
export const offloadVite =
  ({
    cloudflare: cloudflareOptions,
    devServerExternalPackages = [],
    payloadConfigPath,
    vite,
  }: OffloadViteOptions): UserConfigFnPromise =>
  async (env) => {
    const targetsWorkerd = env.command === "build" || env.isPreview === true;

    // Loading the Cloudflare plugin into the Vite process breaks Node-side
    // CommonJS interop for Payload's dependencies, so dev never imports it.
    const workerdPlugins: PluginOption[] = targetsWorkerd
      ? [
          serverConditions(),
          importMetaUrlFallback(),
          literalGraphQLImports(),
          singleGraphQLBuild(),
          pgPoolCommonJs(),
          (await import("@cloudflare/vite-plugin")).cloudflare({
            ...cloudflareOptions,
            viteEnvironment: { name: "ssr", childEnvironments: ["rsc"] },
          }),
        ]
      : [];

    const config = withPayload(
      ({ pluginOptions }) =>
        mergeConfig(
          {
            plugins: [
              ...workerdPlugins,
              rsc(pluginOptions.rsc),
              tanstackStart(pluginOptions.tanstackStart),
              viteReact(pluginOptions.react),
            ],
          },
          vite?.(env) ?? {},
        ),
      {
        // Reached only on the D1 adapter's dev schema-push path.
        devServerExternalPackages: ["prompts", ...devServerExternalPackages],
        payloadConfigPath,
      },
    )(env);

    return targetsWorkerd ? bundleEverything(config) : config;
  };

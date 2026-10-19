import type { Plugin } from "vite";

import { MagicString } from "magic-string";

export const isServerEnvironment = (environment: { name: string }) => environment.name !== "client";

const withSourcemap = (code: MagicString, id: string) => ({
  code: code.toString(),
  map: code.generateMap({ hires: "boundary", source: id }),
});

/**
 * workerd leaves `import.meta.url` undefined in bundled modules, and Payload
 * derives `dirname` from it at module scope. Nothing on the request path reads
 * that directory, so a placeholder is enough.
 */
export const importMetaUrlFallback = (): Plugin => ({
  name: "offload:workerd-import-meta-url",
  applyToEnvironment: isServerEnvironment,
  transform(code, id) {
    if (!code.includes("import.meta.url")) return null;
    return withSourcemap(
      new MagicString(code).replaceAll(
        "import.meta.url",
        '(import.meta.url ?? "file:///worker/index.js")',
      ),
      id,
    );
  },
});

/**
 * The adapter hides the GraphQL imports from the bundler so Node resolves them
 * from node_modules at runtime. A Worker has no node_modules.
 */
export const literalGraphQLImports = (): Plugin => {
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
      return withSourcemap(
        new MagicString(code).replaceAll(
          /import\(\s*\/\*\s*@vite-ignore\s*\*\/\s*(\w+)\s*\)/g,
          (match, name: string) => {
            const specifier = hidden.get(name);
            return specifier === undefined ? match : `import('${specifier}')`;
          },
        ),
        id,
      );
    },
  };
};

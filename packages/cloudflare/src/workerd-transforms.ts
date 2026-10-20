import type { Plugin } from "vite";

import { MagicString } from "magic-string";

export const isServerEnvironment = (environment: { name: string }) => environment.name !== "client";

/**
 * workerd leaves `import.meta.url` undefined in bundled modules. Payload, and site
 * configs that follow its templates, derive `dirname` from it at module scope.
 * Nothing on the request path reads that directory, so a placeholder is enough.
 */
export const importMetaUrlFallback = (): Plugin => ({
  name: "offload:workerd-import-meta-url",
  applyToEnvironment: isServerEnvironment,
  transform(code, id) {
    if (!code.includes("import.meta.url")) return null;
    const rewritten = new MagicString(code).replaceAll(
      "import.meta.url",
      '(import.meta.url ?? "file:///worker/index.js")',
    );
    return {
      code: rewritten.toString(),
      map: rewritten.generateMap({ hires: "boundary", source: id }),
    };
  },
});

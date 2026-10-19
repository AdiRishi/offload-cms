/// <reference types="@vitejs/plugin-rsc/types" />

/**
 * Loads Payload's request handlers from the RSC environment, where TanStack
 * Start runs server functions. Code in the SSR environment that imported
 * `@payload-config` itself would bundle a second copy of Payload.
 *
 * The build rewrites the call to an expression with `await`, so the function
 * must be async.
 */
export const loadRscPayload = async () =>
  import.meta.viteRsc.import<typeof import("./rsc-entry.ts")>("./rsc-entry.js", {
    environment: "rsc",
  });

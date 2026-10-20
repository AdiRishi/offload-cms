import { hideServerErrors } from "@adirishi/offload-tanstack";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

// A start instance replaces TanStack Start's default request middleware, which is its CSRF check
// for server functions, so the check must be listed here.
export const startInstance = createStart(() => ({
  requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })],
  functionMiddleware: [hideServerErrors],
}));

import { hideServerErrors } from "@adirishi/offload-tanstack";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

// A start instance replaces TanStack Start's default CSRF check for server functions, so it is
// listed here.
export const startInstance = createStart(() => ({
  requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" })],
  functionMiddleware: [hideServerErrors],
}));

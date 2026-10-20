import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";

/** Payload's `APIError` marks a message that a user may see as public, such as a 403's. */
const isPublicError = (error: unknown) =>
  error instanceof Error && "isPublic" in error && error.isPublic === true;

/**
 * Server function middleware that keeps server errors out of the browser. TanStack Start sends a
 * thrown error's message to the client, and a failed Payload query's message includes its SQL and
 * parameters. The middleware logs the error on the server and throws a generic one instead.
 * Redirects, not-found, and Payload's public errors pass through, as Payload's REST API sends them.
 *
 * Register it for every server function, the admin's included, in `src/start.ts` with
 * `createStart`'s `functionMiddleware`. A start instance replaces TanStack Start's default CSRF
 * check, so list `createCsrfMiddleware()` in its `requestMiddleware` too.
 */
export const hideServerErrors = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isRedirect(error) || isNotFound(error) || isPublicError(error)) throw error;
    console.error(error);
    // oxlint-disable-next-line eslint/preserve-caught-error -- TanStack Start would send the cause to the browser.
    throw new Error("The server could not complete the request.");
  }
});

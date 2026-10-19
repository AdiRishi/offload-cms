import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";

/**
 * Server function middleware that keeps server errors out of the browser. TanStack Start sends a
 * thrown error's message to the client, and a failed Payload query's message includes its SQL and
 * parameters. The middleware logs the error on the server and throws a generic one instead.
 * Redirects and not-found pass through.
 */
export const hideServerErrors = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isRedirect(error) || isNotFound(error)) throw error;
    console.error(error);
    // oxlint-disable-next-line eslint/preserve-caught-error -- TanStack Start would send the cause to the browser.
    throw new Error("The server could not complete the request.");
  }
});

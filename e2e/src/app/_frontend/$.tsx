import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { redirectOrNotFound } from "@/lib/payload.server";

/** Follows a redirect for a path that no other route serves, or throws `notFound()`. */
const resolveUnknownPath = createServerFn({ method: "GET" })
  .validator((path: string) => path)
  .handler(({ data: path }) => redirectOrNotFound(path));

// redirectOrNotFound() runs only where a route matched, so this route catches every other path.
export const Route = createFileRoute("/_frontend/$")({
  loader: ({ location }) => resolveUnknownPath({ data: location.pathname }),
});

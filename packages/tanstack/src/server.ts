import type { DataFromCollectionSlug, SanitizedConfig } from "payload";

import { notFound, redirect } from "@tanstack/react-router";
import { getRequestHeaders, getRequestUrl } from "@tanstack/react-start/server";
import { cache } from "react";

import type { Populated } from "./populated.ts";

type RedirectReference = NonNullable<
  NonNullable<DataFromCollectionSlug<"redirects">["to"]>["reference"]
>;

/** A redirect's target document, populated. */
export type RedirectDocument = Populated<RedirectReference>;

export type PayloadHelpersOptions = {
  /** Loads the site's config, usually `async () => (await import("@payload-config")).default`. */
  getConfig: () => Promise<SanitizedConfig>;
  /**
   * The public path of a document that a redirect points to. `redirectOrNotFound` needs it for
   * redirects to a document, as opposed to a custom URL.
   */
  documentPath?: (document: RedirectDocument) => string;
};

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

const withoutTrailingSlash = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Payload's Local API for TanStack Start server functions and server components, plus the
 * redirect lookup for a path with no page. A server route that calls these bundles a second copy
 * of Payload, because server routes run in the SSR environment.
 */
export const createPayloadHelpers = ({ getConfig, documentPath }: PayloadHelpersOptions) => {
  /**
   * Payload without a user. The Local API applies access control unless a read passes
   * `overrideAccess: true`, so a read without a user sees what any visitor sees, and the result is
   * safe to cache publicly.
   */
  const getVisitorPayload = async () => {
    const { getPayload } = await import("payload");
    return getPayload({ config: await getConfig() });
  };

  /**
   * Payload for the current request, with the user its cookies or headers authenticate. `draft`
   * is true only for a user who can open the admin, as the admin's auth collection and its
   * `access.admin` decide, so a site's other logged-in users, such as customers, see published
   * content. Pass `draft`, `user`, and `overrideAccess: false` to queries, so the collection's
   * read access decides what the request sees.
   */
  const getPayloadForRequest = async () => {
    const payload = await getVisitorPayload();
    const { user, permissions } = await payload.auth({ headers: getRequestHeaders() });
    return { payload, user, draft: permissions.canAccessAdmin === true };
  };

  /**
   * `getPayloadForRequest`, memoised for one server component render, so the server components
   * of a page share one auth lookup.
   */
  const getRequestPayload = cache(getPayloadForRequest);

  /**
   * For a path with no page. Redirects when the redirects plugin's collection lists the path,
   * with or without its trailing slash, and keeps the query string. Otherwise throws
   * `notFound()`. The lookup runs as a visitor, because redirects are the same for everyone.
   */
  const redirectOrNotFound = async (pathname: string): Promise<never> => {
    const payload = await getVisitorPayload();
    const bare = withoutTrailingSlash(pathname);
    const {
      docs: [match],
    } = await payload.find({
      collection: "redirects",
      where: { from: { in: [bare, `${bare}/`] } },
      depth: 1,
      limit: 1,
      pagination: false,
      overrideAccess: false,
    });
    const to: unknown = match?.to;
    if (!isRecord(to)) throw notFound();

    let href: string | undefined;
    if (to.type === "custom" && typeof to.url === "string") href = to.url;
    // A reference the visitor can't read stays an ID, so a populated value is a readable document.
    const { relationTo, value } = isRecord(to.reference) ? to.reference : {};
    if (to.type === "reference" && typeof relationTo === "string" && isRecord(value)) {
      if (!documentPath) {
        throw new Error(
          "Pass documentPath to createPayloadHelpers to follow redirects to documents.",
        );
      }
      href = documentPath({ relationTo, value });
    }
    if (href === undefined || href === pathname) throw notFound();

    // A page load requests the path itself. A client-side navigation calls the server function at
    // its own address, whose query string is the function's input, not the visitor's. A relative
    // URL resolves against the requested path, as it would on the page.
    const url = getRequestUrl();
    const page = new URL(pathname, url);
    const target = new URL(href, page);
    const requested = withoutTrailingSlash(page.pathname);
    if (withoutTrailingSlash(url.pathname) === requested) {
      for (const [name, entry] of url.searchParams) target.searchParams.append(name, entry);
    }
    const type = Number(match?.type);
    throw redirect({
      href:
        target.origin === url.origin
          ? `${target.pathname}${target.search}${target.hash}`
          : target.href,
      statusCode: redirectStatuses.has(type) ? type : 301,
    });
  };

  return { getVisitorPayload, getPayloadForRequest, getRequestPayload, redirectOrNotFound };
};

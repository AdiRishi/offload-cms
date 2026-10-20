import type { ComponentProps } from "react";

import { Link } from "@tanstack/react-router";

import type { Populated } from "./populated.ts";

/** The data of a `link()` field. */
export type LinkData<TReference> = {
  type?: "custom" | "reference" | null;
  reference?: TReference | null;
  url?: string | null;
  label?: string | null;
  newTab?: boolean | null;
};

export type ResolvedLink = { href: string; label: string; newTab: boolean };

const isPopulated = <TReference extends { value: unknown }>(
  reference: TReference,
): reference is TReference & Populated<TReference> =>
  typeof reference.value === "object" && reference.value !== null;

/**
 * A `link()` field's address, text and target, or `undefined` when it has no text or no address.
 * A reference has an address only when the query populated it, so a link to a document that the
 * request can't read has none. `documentPath` is the public path of a document, as in
 * `createPayloadHelpers()`.
 */
export const resolveLink = <TReference extends { relationTo: string; value: unknown }>(
  link: LinkData<TReference> | null | undefined,
  documentPath: (document: Populated<TReference>) => string,
): ResolvedLink | undefined => {
  if (!link?.label) return undefined;
  const reference = link.reference;
  const href =
    link.type === "custom"
      ? link.url
      : reference && isPopulated(reference)
        ? documentPath(reference)
        : undefined;
  return href ? { href, label: link.label, newTab: link.newTab ?? false } : undefined;
};

export type CMSLinkProps = Omit<ComponentProps<"a">, "href"> & { href: string; newTab?: boolean };

/**
 * A link that TanStack Router follows for a path on the site, preloading the route on intent,
 * and a plain anchor for any other address. `newTab` opens the address in a new tab, without
 * the router.
 */
export const CMSLink = ({ href, newTab = false, ...props }: CMSLinkProps) => {
  if (href.startsWith("/") && !href.startsWith("//") && !newTab) {
    const url = new URL(href, "https://site.invalid");
    return (
      <Link
        to={url.pathname}
        search={Object.fromEntries(url.searchParams)}
        hash={url.hash.slice(1) || undefined}
        preload="intent"
        {...props}
      />
    );
  }
  return (
    <a href={href} {...(newTab && { target: "_blank", rel: "noopener noreferrer" })} {...props} />
  );
};

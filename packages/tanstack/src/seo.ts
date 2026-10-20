import type { UploadDocument } from "./media.tsx";

/** An upload field's value, populated or as an ID. */
export type UploadValue =
  | number
  | string
  | (UploadDocument & { id?: number | string })
  | null
  | undefined;

/** A document with the SEO plugin's fields, in its `meta` group. */
export type SeoDocument = {
  meta?: { title?: string | null; description?: string | null; image?: UploadValue } | null;
};

/**
 * What a document's SEO fields fall back to when an editor leaves them empty. Pass the same
 * defaults to `seoGenerators()`, so the plugin's Auto-generate buttons fill in what the page
 * would show anyway.
 */
export type SeoDefaults<TDoc> = {
  title: (doc: TDoc, siteName: string) => string;
  description?: (doc: TDoc) => string | null | undefined;
  /** An upload, populated or as an ID. The plugin's generator receives unpopulated form data. */
  image?: (doc: TDoc) => UploadValue;
};

/** A page's title, description, URL and sharing image. It is plain data. */
export type SeoMeta = {
  title: string;
  description: string;
  siteName: string;
  /** The page's absolute URL. */
  url: string;
  image?: { url: string; width?: number; height?: number; alt: string };
};

const shareImage = (upload: UploadDocument, siteUrl: string, variant: string) => {
  const sized = upload.variants?.[variant];
  const image = sized?.url ? sized : upload;
  if (!image.url) return undefined;
  return {
    url: new URL(image.url, siteUrl).href,
    width: image.width ?? undefined,
    height: image.height ?? undefined,
    alt: upload.alt ?? "",
  };
};

/**
 * A document's SEO metadata: each of the SEO plugin's fields, or its default when the field is
 * empty. The image is the first populated upload of the document's own, the default, and
 * `fallbackImage`, at its `imageVariant` when that variant exists.
 */
export const seoMeta = <TDoc extends SeoDocument>({
  doc,
  defaults,
  path,
  siteName,
  siteUrl,
  fallbackImage,
  imageVariant = "og",
}: {
  doc: TDoc;
  defaults: SeoDefaults<TDoc>;
  /** The page's path on the site, such as `/about`. */
  path: string;
  siteName: string;
  /** The site's origin, such as `https://example.com`. */
  siteUrl: string;
  /** The site's sharing image, such as one from a settings global. */
  fallbackImage?: UploadValue;
  /** The upload variant sized for sharing. */
  imageVariant?: string;
}): SeoMeta => {
  const image = [doc.meta?.image, defaults.image?.(doc), fallbackImage].find(
    (upload): upload is UploadDocument => typeof upload === "object" && upload !== null,
  );
  return {
    title: doc.meta?.title || defaults.title(doc, siteName),
    description: doc.meta?.description || defaults.description?.(doc) || "",
    siteName,
    url: new URL(path, siteUrl).href,
    image: image && shareImage(image, siteUrl, imageVariant),
  };
};

/**
 * The `head()` of a route for `seoMeta()`'s result: the title, the description, Open Graph and
 * Twitter tags, and the canonical link.
 */
export const seoHead = ({ title, description, siteName, url, image }: SeoMeta) => ({
  meta: [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: siteName },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    ...(image
      ? [
          { property: "og:image", content: image.url },
          { property: "og:image:alt", content: image.alt },
          ...(image.width ? [{ property: "og:image:width", content: String(image.width) }] : []),
          ...(image.height ? [{ property: "og:image:height", content: String(image.height) }] : []),
        ]
      : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...(image
      ? [
          { name: "twitter:image", content: image.url },
          { name: "twitter:image:alt", content: image.alt },
        ]
      : []),
  ],
  links: [{ rel: "canonical", href: url }],
});

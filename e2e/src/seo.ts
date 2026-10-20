import type { SeoDefaults } from "@adirishi/offload-tanstack";

import type { Page, Post } from "./payload-types";

type SeoDoc = Page | Post;

/** The SEO fields' defaults, for the plugin's generators and for the pages' `head()`. */
export const seoDefaults: SeoDefaults<SeoDoc> = {
  title: (doc, siteName) => `${doc.title} | ${siteName}`,
  description: (doc) => {
    if (!("layout" in doc)) return undefined;
    return doc.layout?.find((block) => block.blockType === "quote")?.text;
  },
  image: (doc) => ("hero" in doc ? doc.hero : undefined),
};

export const documentPath = (collection: string, slug: string | null | undefined) =>
  collection === "posts" ? `/posts/${slug ?? ""}` : `/${slug ?? ""}`;

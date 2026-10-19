import type { JSXConvertersFunction } from "@payloadcms/richtext-lexical/react";

import { RichText } from "@payloadcms/richtext-lexical/react";

import type { Post } from "./payload-types";

const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  blocks: {
    callout: ({ node }) => {
      const { fields } = node;
      const message =
        "message" in fields && typeof fields.message === "string" ? fields.message : "";
      const tone = "tone" in fields && fields.tone === "warning" ? "warning" : "info";
      return <aside data-tone={tone}>{message}</aside>;
    },
  },
});

/** A post's rich text, rendered on the server by Payload's Lexical converters. */
export function PostContent({ content }: { content: NonNullable<Post["content"]> }) {
  return <RichText converters={converters} data={content} />;
}

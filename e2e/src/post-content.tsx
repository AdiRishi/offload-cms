import type { DefaultNodeTypes } from "@payloadcms/richtext-lexical";
import type { JSXConvertersFunction } from "@payloadcms/richtext-lexical/react";

import { RichText } from "@payloadcms/richtext-lexical/react";

import type { Post } from "./payload-types";

type PostContent = NonNullable<Post["content"]>;
type PostBlockNode = Extract<PostContent["root"]["children"][number], { type: "block" }>;

const converters: JSXConvertersFunction<DefaultNodeTypes | PostBlockNode> = ({
  defaultConverters,
}) => ({
  ...defaultConverters,
  blocks: {
    callout: ({ node }) => (
      <aside data-tone={node.fields.tone === "warning" ? "warning" : "info"}>
        {node.fields.message}
      </aside>
    ),
    pullQuote: ({ node }) => (
      <figure>
        <p>{node.fields.quote}</p>
        {node.fields.attribution ? <figcaption>{node.fields.attribution}</figcaption> : null}
      </figure>
    ),
  },
});

/** A post's rich text, rendered on the server by Payload's Lexical converters. */
export function PostContent({ content }: { content: PostContent }) {
  return <RichText converters={converters} data={content} />;
}

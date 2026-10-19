import type { HTMLConvertersFunction } from "@payloadcms/richtext-lexical/html";

import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const htmlConverters: HTMLConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  blocks: {
    callout: ({ node }) => {
      const { fields } = node;
      const message =
        "message" in fields && typeof fields.message === "string" ? fields.message : "";
      const tone = "tone" in fields && fields.tone === "warning" ? "warning" : "info";
      return `<aside data-tone="${tone}">${message}</aside>`;
    },
  },
  // The posts editor has no inline blocks. Replacing the default map also keeps it
  // assignable: its `| undefined` values don't fit the converters type.
  inlineBlocks: {},
});

const getPost = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const [{ getPayload }, { default: config }, { convertLexicalToHTML }] = await Promise.all([
      import("payload"),
      import("@payload-config"),
      import("@payloadcms/richtext-lexical/html"),
    ]);
    const payload = await getPayload({ config });
    const { docs } = await payload.find({
      collection: "posts",
      depth: 1,
      limit: 1,
      where: { slug: { equals: slug } },
    });
    const post = docs[0];
    if (!post) return null;
    const html = post.content
      ? convertLexicalToHTML({ converters: htmlConverters, data: post.content })
      : "";
    const categories = (post.categories ?? []).map((category) =>
      typeof category === "object" ? category.name : String(category),
    );
    return { categories, html, title: post.title, wordCount: post.wordCount ?? 0 };
  });

export const Route = createFileRoute("/_frontend/posts/$slug")({
  loader: async ({ params }) => {
    const post = await getPost({ data: params.slug });
    if (!post) throw notFound();
    return post;
  },
  component: PostView,
});

function PostView() {
  const post = Route.useLoaderData();
  return (
    <article style={{ fontFamily: "system-ui", margin: "4rem auto", maxWidth: 640 }}>
      <h1>{post.title}</h1>
      <p data-testid="categories">{post.categories.join(", ")}</p>
      <p data-testid="word-count">{post.wordCount} words</p>
      {/* oxlint-disable-next-line react/no-danger -- server-rendered from Lexical by Payload's converter */}
      <div dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  );
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { renderServerComponent } from "@tanstack/react-start/rsc";

import { PostContent } from "../../post-content";

// Lexical's JSON doesn't pass the server function's serializability check, so
// the rich text comes back as a rendered React Server Component instead.
const getPost = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const [{ getPayload }, { default: config }] = await Promise.all([
      import("payload"),
      import("@payload-config"),
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
    const categories = (post.categories ?? []).map((category) =>
      typeof category === "object" ? category.name : String(category),
    );
    return {
      categories,
      Content: post.content
        ? await renderServerComponent(<PostContent content={post.content} />)
        : null,
      title: post.title,
      wordCount: post.wordCount ?? 0,
    };
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
      {post.Content}
    </article>
  );
}

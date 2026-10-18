// REST and GraphQL served from the Worker. GraphQL needs Offload's single-build fix:
// with two copies of graphql bundled, every query with arguments fails.

import { expect, test, unique } from "./fixtures";

test("REST: drafts stay private, relationships populate, locales stay separate", async ({
  anonymous,
  api,
}) => {
  const category = await api.create("categories", { name: "REST", slug: unique("rest") });
  const slug = unique("rest-post");
  const post = await api.create(
    "posts",
    { _status: "draft", categories: [category.id], slug, title: "Draft" },
    "?draft=true",
  );
  expect((await anonymous.find("posts", `?where[slug][equals]=${slug}`)).totalDocs).toBe(0);

  await api.update("posts", post.id, { _status: "published", title: "Published" });
  const published = await anonymous.find("posts", `?where[slug][equals]=${slug}&depth=1`);
  expect(published.docs[0]).toMatchObject({
    categories: [expect.objectContaining({ name: "REST" })],
    title: "Published",
  });

  await api.update("posts", post.id, { _status: "published", title: "Publié" }, "?locale=fr");
  expect((await api.findByID("posts", post.id, "?locale=all")).title).toEqual({
    en: "Published",
    fr: "Publié",
  });
});

test("GraphQL: queries with arguments, and mutations", async ({ api }) => {
  const slug = unique("graphql");
  const created = await api.graphql(
    `mutation ($slug: String!) { createCategory(data: { name: "GraphQL", slug: $slug }) { name } }`,
    { slug },
  );
  expect(created).toEqual({ data: { createCategory: { name: "GraphQL" } } });

  const found = await api.graphql(
    `query ($slug: String) { Categories(where: { slug: { equals: $slug } }, limit: 1) { totalDocs docs { name } } }`,
    { slug },
  );
  expect(found).toEqual({ data: { Categories: { docs: [{ name: "GraphQL" }], totalDocs: 1 } } });
});

test("access control applies to REST and GraphQL", async ({ anonymous }) => {
  const rest = await anonymous.request.get("/api/users");
  expect(rest.status()).toBe(403);

  const graphql = await anonymous.graphql(`{ Users { totalDocs } }`);
  expect(JSON.stringify(graphql)).toContain("You are not allowed to perform this action");
});

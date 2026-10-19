// Database behaviour that must match across D1 and Postgres.

import { expect, test, unique } from "./fixtures";

const uniqueSlugError = {
  errors: [
    {
      data: { errors: [{ message: "Value must be unique", path: "slug" }] },
      name: "ValidationError",
    },
  ],
};

test("a duplicate unique value is a validation error on create and update", async ({ api }) => {
  const slug = unique("unique-slug");
  await api.create("posts", { slug, title: "First" });

  const duplicate = await api.request.post("/api/posts", {
    data: { slug, title: "Second" },
    headers: { Authorization: `JWT ${api.token}` },
  });
  expect(duplicate.status()).toBe(400);
  expect(await duplicate.json()).toMatchObject(uniqueSlugError);

  const other = await api.create("posts", { slug: unique("other-slug"), title: "Other" });
  const renamed = await api.request.patch(`/api/posts/${other.id}`, {
    data: { slug },
    headers: { Authorization: `JWT ${api.token}` },
  });
  expect(renamed.status()).toBe(400);
  expect(await renamed.json()).toMatchObject(uniqueSlugError);
});

// The website itself: TanStack Start routes rendering Payload content through the
// Local API inside the same Worker.

import { lexical } from "./data";
import { expect, test, unique } from "./fixtures";

test("a page renders its blocks", async ({ api, page }) => {
  const slug = unique("frontend-page");
  await api.create("pages", {
    _status: "published",
    layout: [
      { blockType: "quote", text: "Content belongs to its editors." },
      { blockType: "cta", href: "/contact", label: "Get in touch" },
    ],
    slug,
    title: "Front page",
  });

  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Front page");
  await expect(page.locator("blockquote")).toHaveText("Content belongs to its editors.");
  await expect(page.getByRole("link", { name: "Get in touch" })).toHaveAttribute(
    "href",
    "/contact",
  );
});

test("a post renders rich text, blocks and relationships", async ({ api, page }) => {
  const category = await api.create("categories", { name: "Engineering", slug: unique("eng") });
  const slug = unique("frontend-post");
  await api.create("posts", {
    _status: "published",
    categories: [category.id],
    content: lexical(["Rich text from Lexical."], { message: "Watch out", tone: "warning" }),
    slug,
    title: "Rendered post",
  });

  await page.goto(`/posts/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rendered post");
  await expect(page.getByText("Rich text from Lexical.")).toBeVisible();
  await expect(page.locator('aside[data-tone="warning"]')).toHaveText("Watch out");
  await expect(page.getByTestId("categories")).toHaveText("Engineering");
});

test("an unknown path returns 404", async ({ page }) => {
  const response = await page.goto(`/${unique("missing")}`);
  expect(response?.status()).toBe(404);
});

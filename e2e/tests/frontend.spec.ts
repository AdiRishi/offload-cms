// The website itself: TanStack Start routes rendering Payload content through the
// Local API inside the same Worker.

import { lexical, png } from "./data";
import { expect, test, unique } from "./fixtures";

test("a page renders its blocks", async ({ api, page }) => {
  const slug = unique("frontend-page");
  await api.create("pages", {
    _status: "published",
    layout: [
      { blockType: "quote", text: "Content belongs to its editors." },
      { blockType: "cta", link: { label: "Get in touch", type: "custom", url: "/contact" } },
      { attribution: "An editor", blockType: "pullQuote", quote: "Defined once, used anywhere." },
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
  await expect(page.locator("figure p")).toHaveText("Defined once, used anywhere.");
  await expect(page.locator("figcaption")).toHaveText("An editor");
});

test("a post renders rich text, blocks and relationships", async ({ api, page }) => {
  const category = await api.create("categories", { name: "Engineering", slug: unique("eng") });
  const slug = unique("frontend-post");
  await api.create("posts", {
    _status: "published",
    categories: [category.id],
    content: lexical(["Rich text from Lexical."], {
      blockType: "callout",
      message: "Watch out",
      tone: "warning",
    }),
    slug,
    title: "Rendered post",
  });

  await page.goto(`/posts/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rendered post");
  await expect(page.getByText("Rich text from Lexical.")).toBeVisible();
  await expect(page.locator('aside[data-tone="warning"]')).toHaveText("Watch out");
  await expect(page.getByTestId("categories")).toHaveText("Engineering");
});

test("a post renders a config-level pull quote block", async ({ api, page }) => {
  const slug = unique("frontend-pull-quote");
  await api.create("posts", {
    _status: "published",
    content: lexical(["Before the quote."], {
      attribution: "A writer",
      blockType: "pullQuote",
      quote: "Blocks work in rich text too.",
    }),
    slug,
    title: "Quoted post",
  });

  await page.goto(`/posts/${slug}`);
  await expect(page.locator("figure p")).toHaveText("Blocks work in rich text too.");
  await expect(page.locator("figcaption")).toHaveText("A writer");
});

test("a link to a document opens its path, and a link to a document a visitor can't read is hidden", async ({
  api,
  baseURL,
  browser,
}) => {
  const targetSlug = unique("link-target");
  const target = await api.create("pages", {
    _status: "published",
    slug: targetSlug,
    title: "Linked page",
  });
  const draft = await api.create("pages", { slug: unique("link-draft"), title: "Unpublished" });
  const slug = unique("links");
  await api.create("pages", {
    _status: "published",
    layout: [
      {
        blockType: "cta",
        link: {
          label: "Read the linked page",
          reference: { relationTo: "pages", value: target.id },
          type: "reference",
        },
      },
      {
        blockType: "cta",
        link: {
          label: "Read the draft",
          reference: { relationTo: "pages", value: draft.id },
          type: "reference",
        },
      },
    ],
    slug,
    title: "Links",
  });

  const visitor = await browser.newPage({ baseURL, storageState: { cookies: [], origins: [] } });
  await visitor.goto(`/${slug}`);
  await expect(visitor.getByRole("link", { name: "Read the linked page" })).toHaveAttribute(
    "href",
    `/${targetSlug}`,
  );
  await expect(visitor.getByRole("link", { name: "Read the draft" })).toHaveCount(0);
  await visitor.close();
});

test("a page's head has its SEO fields, or their defaults", async ({ api, baseURL, page }) => {
  const hero = await api.upload(
    "media",
    {
      buffer: png({ height: 900, width: 1600 }),
      mimeType: "image/png",
      name: `${unique("seo")}.png`,
    },
    { alt: "A wide hero" },
  );
  const slug = unique("seo-defaults");
  await api.create("pages", {
    _status: "published",
    hero: hero.id,
    layout: [{ blockType: "quote", text: "The first quote describes the page." }],
    slug,
    title: "Search friendly",
  });

  await page.goto(`/${slug}`);
  await expect(page).toHaveTitle("Search friendly | Offload");
  const meta = (name: string) => page.locator(`meta[name="${name}"], meta[property="${name}"]`);
  await expect(meta("description")).toHaveAttribute(
    "content",
    "The first quote describes the page.",
  );
  await expect(meta("og:image")).toHaveAttribute(
    "content",
    /^http:\/\/localhost:4173\/api\/media\/file\/.+-1200x630\.png$/,
  );
  await expect(meta("og:image:width")).toHaveAttribute("content", "1200");
  await expect(meta("twitter:card")).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `http://localhost:4173/${slug}`,
  );

  const custom = unique("seo-custom");
  await api.create("pages", {
    _status: "published",
    meta: { description: "Written for search engines.", title: "A title of its own" },
    slug: custom,
    title: "Search friendly",
  });
  await page.goto(`${baseURL}/${custom}`);
  await expect(page).toHaveTitle("A title of its own");
  await expect(meta("description")).toHaveAttribute("content", "Written for search engines.");
  await expect(meta("twitter:card")).toHaveAttribute("content", "summary");
});

test("a hero's srcset lists its variants of the same shape, and a small image has only the original", async ({
  api,
  page,
}) => {
  const wide = await api.upload(
    "media",
    {
      buffer: png({ height: 900, width: 1600 }),
      mimeType: "image/png",
      name: `${unique("wide")}.png`,
    },
    { alt: "Wide" },
  );
  const slug = unique("hero-wide");
  await api.create("pages", { _status: "published", hero: wide.id, slug, title: "Wide hero" });
  await page.goto(`/${slug}`);
  const image = page.getByRole("img", { name: "Wide" });
  const srcset = await image.getAttribute("srcset");
  // small, medium and large keep the 16:9 shape. thumbnail, square, card and og are crops.
  expect(srcset?.split(", ").map((candidate) => candidate.split(" ")[1])).toEqual([
    "320w",
    "640w",
    "1024w",
    "1600w",
  ]);
  await expect(image).toHaveAttribute("src", String(wide.url));
  await expect(image).toHaveCSS("object-position", "50% 50%");

  const small = await api.upload(
    "media",
    {
      buffer: png({ height: 50, width: 100 }),
      mimeType: "image/png",
      name: `${unique("small")}.png`,
    },
    { alt: "Small" },
  );
  const smallSlug = unique("hero-small");
  await api.create("pages", {
    _status: "published",
    hero: small.id,
    slug: smallSlug,
    title: "Small hero",
  });
  await page.goto(`/${smallSlug}`);
  const original = page.getByRole("img", { name: "Small" });
  await expect(original).toHaveAttribute("src", String(small.url));
  await expect(original).not.toHaveAttribute("srcset");
});

test("an unknown path returns 404", async ({ page }) => {
  const response = await page.goto(`/${unique("missing")}`);
  expect(response?.status()).toBe(404);
});

test("a path with several segments follows a redirect, or returns 404", async ({ api, page }) => {
  const slug = unique("nested-target");
  const target = await api.create("pages", { _status: "published", slug, title: "Nested target" });
  const from = `/${unique("old")}/section/${unique("page")}`;
  await api.create("redirects", {
    from,
    to: { reference: { relationTo: "pages", value: target.id }, type: "reference" },
  });

  await page.goto(from);
  await expect(page).toHaveURL(`/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nested target");

  const response = await page.goto(`/${unique("missing")}/nested/path`);
  expect(response?.status()).toBe(404);
});

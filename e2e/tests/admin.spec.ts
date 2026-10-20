// The admin panel on Workers: TanStack Start's RSC rendering, server functions and the
// database adapter, driven the way an editor uses them.

import type { Page } from "@playwright/test";

import { lexical, png } from "./data";
import { expect, submitAdminForm, test, unique, waitForAdminForm } from "./fixtures";

const save = (page: Page, button: string, method: "PATCH" | "POST", collection: string) =>
  submitAdminForm(page, page.locator(button), method, `/api/${collection}`);

test("an editor drafts, publishes and translates a page", async ({ anonymous, page }) => {
  const slug = unique("admin-page");
  await page.goto("/admin/collections/pages/create");
  await page.locator("#field-title").fill("Hello from the admin");
  await page.locator("#field-slug").fill(slug);
  await save(page, "#action-save-draft", "POST", "pages");
  await expect(page).toHaveURL(/\/admin\/collections\/pages\/\d+/);
  const editURL = page.url();
  expect((await anonymous.find("pages", `?where[slug][equals]=${slug}`)).totalDocs).toBe(0);

  // Saving a new draft redirects to its edit view; reopen it so the publish click isn't lost mid-render.
  await page.goto(editURL);
  await save(page, "#action-save", "PATCH", "pages");
  expect((await anonymous.find("pages", `?where[slug][equals]=${slug}`)).totalDocs).toBe(1);

  await page.goto(`${editURL}?locale=fr`);
  await expect(page.getByRole("button", { name: /Locale: Français/ })).toBeVisible();
  await page.locator("#field-title").fill("Bonjour depuis l'admin");
  await save(page, "#action-save", "PATCH", "pages");

  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hello from the admin");
  await page.goto(`/${slug}?locale=fr`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour depuis l'admin");
});

test("an editor uploads an image to R2", async ({ api, page }) => {
  const alt = unique("Admin upload");
  const image = png({ height: 30, width: 40 });
  await page.goto("/admin/collections/media/create");
  // Unlike fill and click, setInputFiles doesn't wait for the admin to hydrate. A file set on the
  // server-rendered input never reaches the form, which then saves without it.
  await waitForAdminForm(page);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ buffer: image, mimeType: "image/png", name: `${alt}.png` });
  await page.locator("#field-alt").fill(alt);
  await save(page, "#action-save", "POST", "media");

  const media = (await api.find("media", `?where[alt][equals]=${encodeURIComponent(alt)}`)).docs[0];
  expect(media).toMatchObject({ height: 30, mimeType: "image/png", width: 40 });
  const file = await page.request.get(String(media?.url));
  expect(Buffer.from(await file.body()).equals(image)).toBe(true);
});

test("a document with every field type opens and saves unchanged", async ({ api, page }) => {
  const category = await api.create("categories", { name: "Fields", slug: unique("fields") });
  const media = await api.upload(
    "media",
    { buffer: png({ height: 8, width: 8 }), mimeType: "image/png", name: `${unique("field")}.png` },
    { alt: "Field image" },
  );
  const post = await api.create("posts", { _status: "published", title: unique("Polymorphic") });
  const doc = await api.create("field-types", {
    array: [{ children: [{ value: "nested" }], label: "Row" }],
    blocks: [
      { blockType: "textBlock", text: "Text block" },
      { blockType: "listBlock", items: [{ item: "one" }, { item: "two" }] },
    ],
    checkbox: true,
    code: "export const answer = 42;",
    date: "2026-10-18T10:30:00.000Z",
    email: "all@offload.test",
    group: { left: "L", right: "R", title: "Group" },
    insideCollapsible: "Collapsed",
    json: { nested: { list: [1, 2, 3] } },
    localizedArray: [{ label: "English row" }],
    localizedText: "English",
    number: 7,
    numberMany: [1, 2, 3],
    radio: "no",
    relations: {
      polymorphic: { relationTo: "posts", value: post.id },
      relationship: category.id,
      relationshipMany: [category.id],
      upload: media.id,
    },
    richText: lexical(["Rich text field"]),
    select: "large",
    selectMany: ["red", "blue"],
    text: unique("Every field"),
    textMany: ["a", "b"],
    textarea: "Textarea",
  });
  const before = await api.findByID("field-types", doc.id, "?depth=0");

  await page.goto(`/admin/collections/field-types/${doc.id}`);
  await page.getByRole("tab", { name: "Choices" }).click();
  await page.getByRole("tab", { name: "Relations" }).click();
  await page.getByRole("tab", { name: "Structure" }).click();
  await page.getByRole("tab", { name: "Scalars" }).click();
  await page.locator("#field-number").fill("8");
  await save(page, "#action-save", "PATCH", "field-types");

  const {
    number: afterNumber,
    updatedAt: _afterUpdated,
    ...after
  } = await api.findByID("field-types", doc.id, "?depth=0");
  const { number: _beforeNumber, updatedAt: _beforeUpdated, ...unchanged } = before;
  expect(afterNumber).toBe(8);
  expect(after).toEqual(unchanged);
});

test("the dashboard's quick actions open their views", async ({ api, page }) => {
  const widget = page.locator("section", { hasText: "Welcome to the e2e admin" });
  const editAbout = widget.getByRole("link", { name: "Edit the about page" });
  await page.goto("/admin");
  await expect(widget.getByRole("link", { name: "Write a post" })).toHaveAttribute(
    "href",
    "/admin/collections/posts/create",
  );
  await expect(widget.getByRole("link", { name: "Change the site settings" })).toHaveAttribute(
    "href",
    "/admin/globals/site-settings",
  );
  await expect(widget.getByRole("link", { name: "View the site" })).toHaveAttribute("href", "/");
  // Without a matching document, the action opens the list.
  await expect(editAbout).toHaveAttribute("href", "/admin/collections/pages");

  const about = await api.create("pages", { slug: "about", title: "About" });
  await page.goto("/admin");
  await expect(editAbout).toHaveAttribute("href", `/admin/collections/pages/${about.id}`);
});

test("the edit view shows a block's description, array row labels and a slug field's own description", async ({
  api,
  page,
}) => {
  const pageDoc = await api.create("pages", {
    layout: [{ blockType: "quote", text: "Described" }],
    slug: unique("described"),
    title: "Described block",
  });
  await page.goto(`/admin/collections/pages/${pageDoc.id}`);
  await expect(page.getByText("A quotation, shown large, with its author.")).toBeVisible();

  const settings = await api.request.post("/api/globals/site-settings", {
    data: { footerLinks: [{ label: "Privacy", url: "/privacy" }] },
    headers: { Authorization: `JWT ${api.token}` },
  });
  expect(settings.status()).toBe(200);
  await page.goto("/admin/globals/site-settings");
  await waitForAdminForm(page);
  await expect(page.locator(".array-field").getByText("Privacy", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Footer Link" }).click();
  await expect(page.locator(".array-field").getByText("Link 2", { exact: true })).toBeVisible();

  const slug = unique("described");
  const doc = await api.create("field-types", { slug, text: "Described" });
  await page.goto(`/admin/collections/field-types/${doc.id}`);
  await expect(page.getByTestId("slug-address")).toHaveText(`Address: /field-types/${slug}`);
});

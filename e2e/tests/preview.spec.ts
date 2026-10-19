// Drafts, Live Preview and redirects on the site, through @adirishi/offload-tanstack.

import { expect, login, test, unique } from "./fixtures";

test("a logged-in editor sees a page's draft, and a visitor sees the published page", async ({
  api,
  baseURL,
  browser,
  page,
}) => {
  const slug = unique("draft-page");
  const doc = await api.create("pages", { _status: "published", slug, title: "Published title" });
  await api.update("pages", doc.id, { title: "Draft title" }, "?draft=true");

  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Draft title");

  const visitor = await browser.newPage({ baseURL, storageState: { cookies: [], origins: [] } });
  await visitor.goto(`/${slug}`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Published title");
  await visitor.close();
});

test("a logged-in customer, who can't open the admin, sees the published page", async ({
  api,
  baseURL,
  browser,
}) => {
  const slug = unique("customer-page");
  const doc = await api.create("pages", { _status: "published", slug, title: "Published title" });
  await api.update("pages", doc.id, { title: "Draft title" }, "?draft=true");
  const email = `${unique("customer")}@offload.test`;
  const password = unique("password");
  await api.create("users", { email, password, role: "customer" });

  const customer = await browser.newPage({ baseURL, storageState: { cookies: [], origins: [] } });
  await login(customer.request, "users", email, password);
  await customer.goto(`/${slug}`);
  await expect(customer.getByRole("heading", { level: 1 })).toHaveText("Published title");
  await customer.close();
});

test("Live Preview shows a saved draft without a reload", async ({ api, page }) => {
  const slug = unique("live-page");
  const doc = await api.create("pages", { _status: "published", slug, title: "Before the edit" });

  // The admin keeps each user's last locale, and another test switches it to French.
  await page.goto(`/admin/collections/pages/${doc.id}?locale=en`);
  await page.getByRole("button", { name: "Live Preview" }).click();
  const preview = page.frameLocator("iframe");
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Before the edit");

  await page.locator("#field-title").fill("After the edit");
  await page.locator("#action-save-draft").click();

  await expect(preview.getByRole("heading", { level: 1 })).toHaveText("After the edit");
});

test("a path listed in Redirects sends visitors to the page, keeping the query string", async ({
  api,
  baseURL,
  browser,
}) => {
  const slug = unique("redirect-target");
  const target = await api.create("pages", { _status: "published", slug, title: "Moved here" });
  const from = `/${unique("old-address")}`;
  await api.create("redirects", {
    from,
    to: { reference: { relationTo: "pages", value: target.id }, type: "reference" },
  });

  const visitor = await browser.newPage({ baseURL, storageState: { cookies: [], origins: [] } });
  await visitor.goto(`${from}?campaign=autumn`);
  await expect(visitor).toHaveURL(`/${slug}?campaign=autumn`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Moved here");
  await visitor.close();
});

test("a client-side link to a redirected path follows a relative custom URL", async ({
  api,
  baseURL,
  browser,
}) => {
  const slug = unique("relative-target");
  await api.create("pages", { _status: "published", slug, title: "Relative target" });
  const from = `/${unique("relative-old")}`;
  await api.create("redirects", { from, to: { type: "custom", url: slug } });
  const start = unique("relative-start");
  await api.create("pages", {
    _status: "published",
    layout: [{ blockType: "cta", href: from, label: "Old address" }],
    slug: start,
    title: "Start here",
  });

  const visitor = await browser.newPage({ baseURL, storageState: { cookies: [], origins: [] } });
  await visitor.goto(`/${start}`);
  await expect(visitor.locator("main[data-hydrated]")).toBeVisible();
  // The router loads the page through its server function, not with a page load of the old path.
  await Promise.all([
    visitor.waitForRequest((request) => new URL(request.url()).pathname.startsWith("/_serverFn/")),
    visitor.getByRole("link", { name: "Old address" }).click(),
  ]);
  await expect(visitor).toHaveURL(`/${slug}`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Relative target");
  await visitor.close();
});

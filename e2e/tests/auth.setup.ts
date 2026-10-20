import { expect, test as setup } from "@playwright/test";

import { admin, adminStorageState } from "./credentials";
import { submitAdminForm, waitForAdminForm } from "./fixtures";

setup("create the first admin through the admin panel", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/create-first-user/);
  await waitForAdminForm(page);

  // Payload validates a changed field in an effect throttled to 150 ms, and this form's confirm
  // password starts out invalid, so a submit right after typing is refused with only a toast.
  // Submitting the empty form first shows each field's validation error, as Payload's own tests
  // do, and the errors clear once validation has seen the typed values.
  const create = page.getByRole("button", { name: "Create" });
  await create.click();
  await expect(page.locator(".field-error").first()).toBeVisible();
  await page.locator("#field-email").fill(admin.email);
  await page.locator("#field-password").fill(admin.password);
  await page.locator("#field-confirm-password").fill(admin.password);
  await expect(page.locator(".field-error")).toHaveCount(0);
  await submitAdminForm(page, create, "POST", "/api/users/first-register");

  await expect(page).not.toHaveURL(/\/admin\/create-first-user/);
  // The dashboard can render before the session cookie from the register request lands.
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) => cookie.name === "payload-token"),
    )
    .toBe(true);
  await page.context().storageState({ path: adminStorageState });
});

// It runs here, before any test creates a customer, because Payload's first-register endpoint
// only works on an empty collection.
setup(
  "an empty customers collection refuses a first account through REST",
  async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const credentials = {
      email: "first-customer@offload.test",
      password: "offload-first-customer",
    };

    const registered = await request.post("/api/customers/first-register", { data: credentials });
    expect(registered.status(), await registered.text()).toBe(403);
    expect((await request.post("/api/customers/login", { data: credentials })).status()).toBe(401);
    await request.dispose();
  },
);

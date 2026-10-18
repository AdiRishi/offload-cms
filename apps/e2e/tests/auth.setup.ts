import { expect, test as setup } from "@playwright/test";

import { admin, adminStorageState } from "./credentials";

setup("create the first admin through the admin panel", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/create-first-user/);

  await page.locator("#field-email").fill(admin.email);
  await page.locator("#field-password").fill(admin.password);
  await page.locator("#field-confirm-password").fill(admin.password);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  // The dashboard can render before the session cookie from the register request lands.
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) => cookie.name === "payload-token"),
    )
    .toBe(true);
  await page.context().storageState({ path: adminStorageState });
});

// A guest's checkout on the site: the ecommerce plugin's cart and payment endpoints, the
// checkout components from Offload's shadcn registry, and @adirishi/offload-payments against the
// gateway stubs in stubs/.

import type { Page } from "@playwright/test";

import { z } from "zod";

import { type Doc, expect, test, unique } from "./fixtures";
import {
  guestCart,
  guestEmail,
  initiate,
  inventoryOf,
  mips,
  ordersOf,
  prices,
  razorpay,
  routeCheckoutToStub,
  seedProduct,
  stock,
  transactionsOf,
} from "./payments";

/** Adds a variant to the cart on its product's page, goes to checkout and enters an email. */
const checkOut = async (page: Page, product: Doc, variant: Doc) => {
  await page.goto(`/products/${product.id}`);
  await expect(page.locator("main[data-hydrated]")).toBeVisible();
  await page.getByLabel("Size").selectOption(String(variant.id));
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("1 item in your cart")).toBeVisible();
  await page.getByRole("link", { name: "Go to checkout" }).click();
  await expect(page.getByRole("list", { name: "Cart" })).toContainText("Large");
  const email = guestEmail();
  await page.getByLabel("Email").fill(email);
  return email;
};

const razorpayGroup = z.object({ razorpay: z.object({ orderID: z.string() }) });
const mipsGroup = z.object({ mips: z.object({ reference: z.string() }) });

test.describe("a guest", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pays with Razorpay Checkout and gets one order", async ({ api, page }) => {
    const { product, variants } = await seedProduct(api);
    await routeCheckoutToStub(page);
    const email = await checkOut(page, product, variants.Large);

    await page.getByRole("button", { name: "Pay with Razorpay" }).click();
    const checkout = page.getByRole("dialog", { name: "Razorpay Checkout" });
    await checkout.getByLabel("Deliver webhooks").uncheck();
    await checkout.getByRole("button", { name: "Pay", exact: true }).click();
    await expect(page.getByText(/^Order \S+ is confirmed\.$/)).toBeVisible();

    const orders = await ordersOf(api, email);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ amount: prices.Large, currency: "MUR" });
    expect(await inventoryOf(api, variants.Large)).toBe(stock - 1);
    const [transaction] = await transactionsOf(api, email);
    expect(transaction).toMatchObject({ status: "succeeded" });
    // Checkout sent no webhook, so the browser's confirmation made the order.
    const { orderID } = razorpayGroup.parse(transaction).razorpay;
    const { deliveries } = await razorpay.order(page.request, orderID);
    expect(deliveries.map((sent) => sent.response)).toEqual([null, null, null]);
  });

  test("pays in the mIPS payment zone and gets one order on the return page", async ({
    api,
    page,
  }) => {
    const { product, variants } = await seedProduct(api);
    const email = await checkOut(page, product, variants.Large);

    await page.getByRole("button", { name: "Pay by card with mIPS" }).click();
    const zone = page.frameLocator('iframe[title="mIPS payment"]');
    await zone.getByLabel("Send IMN").uncheck();
    await zone.getByRole("button", { name: "Pay" }).click();
    // The payment zone's script sends the customer back. It runs only if the page ran it.
    await expect(page).toHaveURL(/\/checkout\/mips-return\?reference=\w+$/);
    await expect(page.getByText(/^Order \S+ is confirmed\.$/)).toBeVisible();

    const orders = await ordersOf(api, email);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ amount: prices.Large, currency: "MUR" });
    expect(await inventoryOf(api, variants.Large)).toBe(stock - 1);
    const [transaction] = await transactionsOf(api, email);
    expect(transaction).toMatchObject({ status: "succeeded" });
    const { reference } = mipsGroup.parse(transaction).mips;
    const deliveries = await mips.deliveries(page.request, reference);
    expect(deliveries.map((sent) => sent.response)).toEqual([null]);
  });

  test("who closes the tab after paying with Razorpay gets the order from the webhook", async ({
    api,
    page,
  }) => {
    const { product, variants } = await seedProduct(api);
    await routeCheckoutToStub(page);
    await page.route("**/api/payments/razorpay/confirm-order", (route) => route.abort());
    const email = await checkOut(page, product, variants.Large);

    await page.getByRole("button", { name: "Pay with Razorpay" }).click();
    const confirmation = page.waitForRequest("**/api/payments/razorpay/confirm-order");
    await page
      .getByRole("dialog", { name: "Razorpay Checkout" })
      .getByRole("button", { name: "Pay", exact: true })
      .click();
    await confirmation;
    await page.close();

    await expect.poll(async () => (await ordersOf(api, email)).length).toBe(1);
    expect(await inventoryOf(api, variants.Large)).toBe(stock - 1);
    const [transaction] = await transactionsOf(api, email);
    const { orderID } = razorpayGroup.parse(transaction).razorpay;
    const { deliveries } = await razorpay.order(api.request, orderID);
    expect(deliveries.map((sent) => [sent.event, sent.response?.status])).toEqual([
      ["payment.authorized", 200],
      ["payment.captured", 200],
      ["order.paid", 200],
    ]);
  });

  test("who closes the tab after paying with mIPS gets the order from the IMN", async ({
    api,
    page,
  }) => {
    const { product, variants } = await seedProduct(api);
    await page.route("**/api/payments/mips/confirm-order", (route) => route.abort());
    const email = await checkOut(page, product, variants.Large);

    await page.getByRole("button", { name: "Pay by card with mIPS" }).click();
    const confirmation = page.waitForRequest("**/api/payments/mips/confirm-order");
    await page
      .frameLocator('iframe[title="mIPS payment"]')
      .getByRole("button", { name: "Pay" })
      .click();
    await confirmation;
    await page.close();

    await expect.poll(async () => (await ordersOf(api, email)).length).toBe(1);
    expect(await inventoryOf(api, variants.Large)).toBe(stock - 1);
    const [transaction] = await transactionsOf(api, email);
    const { reference } = mipsGroup.parse(transaction).mips;
    const deliveries = await mips.deliveries(api.request, reference);
    expect(deliveries.map((sent) => sent.response)).toEqual([{ status: 200, body: "success" }]);
  });

  test("can't pay for a product at the price of another product's variant", async ({
    anonymous,
    api,
  }) => {
    const shirt = await seedProduct(api);
    const sock = await seedProduct(api, { Small: 500, Large: 700 });
    const cart = await guestCart(anonymous.request, [
      { product: shirt.product.id, variant: sock.variants.Small.id, quantity: 1 },
    ]);

    const responses = await Promise.all([
      initiate(anonymous.request, "razorpay", cart),
      initiate(anonymous.request, "mips", cart),
    ]);
    expect(responses.map((response) => response.status())).toEqual([400, 400]);
    expect(await transactionsOf(api, cart.customerEmail)).toEqual([]);
  });

  test("can't buy a product with variants without choosing one", async ({ anonymous, api }) => {
    const shirt = await seedProduct(api);
    const cart = await guestCart(anonymous.request, [{ product: shirt.product.id, quantity: 1 }]);

    const responses = await Promise.all([
      initiate(anonymous.request, "razorpay", cart),
      initiate(anonymous.request, "mips", cart),
    ]);
    expect(responses.map((response) => response.status())).toEqual([400, 400]);
    expect(await transactionsOf(api, cart.customerEmail)).toEqual([]);
  });
});

test("the admin's price inputs show and save prices in the currency's minor unit", async ({
  anonymous,
  api,
  page,
}) => {
  const product = await api.create("products", {
    _status: "published",
    priceInMUR: 125050,
    priceInMUREnabled: true,
    title: unique("Price input"),
  });

  await page.goto(`/admin/collections/products/${product.id}`);
  await expect(page.locator('form[data-form-ready="true"]')).toBeVisible();
  const mur = page.getByLabel("Price (MUR)");
  await expect(mur).toHaveValue("1250.50");
  await expect(page.getByLabel("Price (INR)")).toBeHidden();
  await page.getByLabel("Enable INR price").check();
  await expect(page.getByLabel("Price (INR)")).toBeVisible();

  await mur.fill("1999.9");
  await mur.blur();
  await expect(mur).toHaveValue("1999.90");
  const published = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === `/api/products/${product.id}` &&
      !new URL(response.url()).searchParams.has("autosave"),
  );
  await page.locator("#action-save").click();
  expect((await published).ok()).toBe(true);
  expect(await anonymous.findByID("products", product.id)).toMatchObject({ priceInMUR: 199990 });
});

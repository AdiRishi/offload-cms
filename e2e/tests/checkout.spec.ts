// A guest's checkout on the site: the ecommerce plugin's cart and payment endpoints, the
// checkout components from Offload's shadcn registry, and @adirishi/offload-payments against the
// gateway stubs in stubs/.

import type { APIRequestContext, Page } from "@playwright/test";

import { z } from "zod";

import { createCustomer, restToken, visitorHeaders } from "./accounts";
import { admin } from "./credentials";
import {
  type Doc,
  expect,
  type PayloadApi,
  submitAdminForm,
  test,
  unique,
  waitForAdminForm,
} from "./fixtures";
import {
  type Cart,
  confirmOrder,
  guestCart,
  guestEmail,
  initiate,
  initiateRazorpay,
  inventoryOf,
  mips,
  ordersOf,
  prices,
  razorpay,
  routeCheckoutToStub,
  seedProduct,
  stock,
  transactionsOf,
  userCart,
} from "./payments";

/** Adds a variant to the cart on its product's page, goes to checkout and enters an email. */
const checkOut = async (page: Page, product: Doc, variant: Doc) => {
  await page.goto(`/products/${product.id}`);
  await expect(page.locator("main[data-hydrated]")).toBeVisible();
  await page
    .getByRole("listitem")
    .filter({ hasText: String(variant.title) })
    .getByRole("button", { name: "Add to cart" })
    .click();
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
    // Razorpay sends the webhooks while Checkout reports the payment, and each in turn.
    await expect
      .poll(async () =>
        (await razorpay.order(api.request, orderID)).deliveries.map((sent) => [
          sent.event,
          sent.response?.status,
        ]),
      )
      .toEqual([
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
    await expect
      .poll(async () =>
        (await mips.deliveries(api.request, reference)).map((sent) => sent.response),
      )
      .toEqual([{ status: 200, body: "success" }]);
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

  test("can't start paying for a cart that was bought", async ({ anonymous, api }) => {
    const { product, variants } = await seedProduct(api);
    const cart = await guestCart(anonymous.request, [
      { product: product.id, variant: variants.Large.id, quantity: 1 },
    ]);
    const { orderID } = await initiateRazorpay(anonymous.request, cart);
    await razorpay.pay(anonymous.request, orderID, { outcome: "captured" });
    await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);

    expect((await initiate(anonymous.request, "razorpay", cart)).status()).toBe(400);
    expect(await transactionsOf(api, cart.customerEmail)).toHaveLength(1);
  });

  test("can't buy part of an item", async ({ anonymous, api }) => {
    const { product, variants } = await seedProduct(api);
    const cart = await guestCart(anonymous.request, [
      { product: product.id, variant: variants.Small.id, quantity: 1.5 },
    ]);

    expect((await initiate(anonymous.request, "mips", cart)).status()).toBe(400);
    expect(await transactionsOf(api, cart.customerEmail)).toEqual([]);
  });

  test("is told to review the cart when a price changed after it was saved", async ({
    anonymous,
    api,
  }) => {
    const { product, variants } = await seedProduct(api);
    const cart = await guestCart(anonymous.request, [
      { product: product.id, variant: variants.Large.id, quantity: 1 },
    ]);
    const newPrice = prices.Large + 10000;
    await api.update("variants", variants.Large.id, { _status: "published", priceInMUR: newPrice });

    const refused = await initiate(anonymous.request, "razorpay", cart);
    expect(refused.status(), await refused.text()).toBe(409);
    expect(await transactionsOf(api, cart.customerEmail)).toEqual([]);
    const saved = await anonymous.request.get(`/api/carts/${cart.id}?secret=${cart.secret}`);
    expect(await saved.json()).toMatchObject({ subtotal: newPrice });
    expect((await initiateRazorpay(anonymous.request, cart)).amount).toBe(newPrice);
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
  await waitForAdminForm(page);
  const mur = page.getByLabel("Price (MUR)");
  await expect(mur).toHaveValue("1250.50");
  await expect(page.getByLabel("Price (INR)")).toBeHidden();
  await page.getByLabel("Enable INR price").check();
  await expect(page.getByLabel("Price (INR)")).toBeVisible();

  await mur.fill("1999.9");
  await mur.blur();
  await expect(mur).toHaveValue("1999.90");
  await submitAdminForm(page, page.locator("#action-save"), "PATCH", `/api/products/${product.id}`);
  expect(await anonymous.findByID("products", product.id)).toMatchObject({ priceInMUR: 199990 });
});

const settled = z.object({ order: z.union([z.number(), z.string()]) });

/** Pays for a cart with Razorpay through the plugin's endpoints, as Checkout and the button do. */
const payWithRazorpay = async (api: PayloadApi, request: APIRequestContext, cart: Cart) => {
  const razorpayOrder = await initiateRazorpay(request, cart);
  const { checkout } = await razorpay.pay(request, razorpayOrder.orderID, {
    outcome: "captured",
    deliver: false,
  });
  const confirmed = await confirmOrder(request, "razorpay", cart, { ...checkout });
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  const { docs } = await api.find(
    "transactions",
    `?where[razorpay.orderID][equals]=${razorpayOrder.orderID}&depth=0`,
  );
  expect(docs).toHaveLength(1);
  const [transaction] = docs;
  if (!transaction) throw new Error(`No transaction for ${razorpayOrder.orderID}`);
  const { order } = settled.parse(transaction);
  return { order: await api.findByID("orders", order, "?depth=0"), transaction };
};

test("a product that was never published can't be bought", async ({ api }) => {
  const draft = await api.create("products", {
    _status: "draft",
    priceInMUR: 125050,
    priceInMUREnabled: true,
    title: unique("Draft"),
  });
  const cart = await userCart(api.request, api.token, [{ product: draft.id, quantity: 1 }]);

  expect((await initiate(api.request, "razorpay", cart)).status()).toBe(404);
});

test("a logged-in customer owns the transaction and the order of their checkout", async ({
  api,
  baseURL,
  playwright,
}) => {
  const request = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: visitorHeaders(),
    storageState: { cookies: [], origins: [] },
  });
  const [ada, grace] = [`${unique("ada")}@offload.test`, `${unique("grace")}@offload.test`];
  const [customer] = await Promise.all([createCustomer(api, ada), createCustomer(api, grace)]);
  const { product, variants } = await seedProduct(api);
  const token = await restToken(request, ada);
  const cart = await userCart(
    request,
    token,
    [{ product: product.id, variant: variants.Large.id, quantity: 1 }],
    customer.id,
  );

  const { order, transaction } = await payWithRazorpay(api, request, cart);
  expect(transaction).toMatchObject({ customer: customer.id, status: "succeeded" });
  expect(transaction.customerEmail ?? null).toBeNull();
  expect(order).toMatchObject({ customer: customer.id });

  const read = await request.get(`/api/orders/${order.id}`, { headers: cart.headers });
  expect(read.status(), await read.text()).toBe(200);
  const other = await request.get(`/api/orders/${order.id}`, {
    headers: { Authorization: `JWT ${await restToken(request, grace)}` },
  });
  expect(other.status()).toBe(404);
  await request.dispose();
});

test("an admin user who checks out is never attached as the customer", async ({ api }) => {
  const { product, variants } = await seedProduct(api);
  const cart = await userCart(api.request, api.token, [
    { product: product.id, variant: variants.Large.id, quantity: 1 },
  ]);

  const { order, transaction } = await payWithRazorpay(api, api.request, cart);
  expect(transaction).toMatchObject({ customerEmail: admin.email, status: "succeeded" });
  expect(transaction.customer ?? null).toBeNull();
  expect(order).toMatchObject({ customerEmail: admin.email });
  expect(order.customer ?? null).toBeNull();
});

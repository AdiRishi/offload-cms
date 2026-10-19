// Settlement outside the browser: Razorpay webhooks, the mIPS IMN and reconciliation on the Cron
// Trigger, driven through the gateway stubs' test-only controls. Each test leaves a payment that
// reconciliation would settle, so they run one at a time in this file, and only this file queues
// reconciliation.

import type { APIRequestContext } from "@playwright/test";

import { expect, type PayloadApi, test } from "./fixtures";
import {
  confirmOrder,
  type Delivery,
  guestCart,
  initiateMips,
  initiateRazorpay,
  inventoryOf,
  mips,
  ordersOf,
  prices,
  razorpay,
  replay,
  seedProduct,
  stock,
  transactionsOf,
} from "./payments";

test.use({ storageState: { cookies: [], origins: [] } });

/** A guest's cart with the large shirt in it. */
const shirtInCart = async (api: PayloadApi, request: APIRequestContext) => {
  const { product, variants } = await seedProduct(api);
  const cart = await guestCart(request, [
    { product: product.id, variant: variants.Large.id, quantity: 1 },
  ]);
  return { cart, variant: variants.Large };
};

/** A valid hex digest that isn't the given one. */
const forge = (hex: string) => `${hex.slice(0, -1)}${hex.endsWith("0") ? "1" : "0"}`;

const sent = (delivery: Delivery | null | undefined) => {
  if (!delivery) throw new Error("The stub recorded no delivery.");
  return delivery;
};

test("replaying a Razorpay webhook byte for byte changes nothing", async ({ anonymous, api }) => {
  const { cart, variant } = await shirtInCart(api, anonymous.request);
  const { orderID } = await initiateRazorpay(anonymous.request, cart);

  const { deliveries } = await razorpay.pay(anonymous.request, orderID, { outcome: "captured" });
  expect(deliveries.map((delivery) => [delivery.event, delivery.response?.status])).toEqual([
    ["payment.authorized", 200],
    ["payment.captured", 200],
    ["order.paid", 200],
  ]);
  await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);

  const replayed = await Promise.all(
    deliveries.map((delivery) => replay(anonymous.request, delivery)),
  );
  expect(replayed.map((response) => response.status())).toEqual([200, 200, 200]);
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
  expect(await inventoryOf(api, variant)).toBe(stock - 1);
});

test("replaying an mIPS IMN byte for byte changes nothing", async ({ anonymous, api }) => {
  const { cart, variant } = await shirtInCart(api, anonymous.request);
  const { reference } = await initiateMips(anonymous.request, cart);

  const imn = sent((await mips.pay(anonymous.request, reference, { outcome: "success" })).delivery);
  expect(imn.response).toEqual({ status: 200, body: "success" });
  await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);

  const again = await replay(anonymous.request, imn);
  expect([again.status(), await again.text()]).toEqual([200, "success"]);
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
  expect(await inventoryOf(api, variant)).toBe(stock - 1);
});

test("a Razorpay payment for another amount or currency makes no order", async ({
  anonymous,
  api,
}) => {
  const changes = [{ amount: prices.Large - 100 }, { currency: "INR" }];
  await Promise.all(
    changes.map(async (change) => {
      const { cart } = await shirtInCart(api, anonymous.request);
      const { orderID } = await initiateRazorpay(anonymous.request, cart);

      const { checkout, deliveries } = await razorpay.pay(anonymous.request, orderID, {
        outcome: "captured",
        ...change,
      });
      // A retry can't fix a mismatch, so the webhook is answered and not retried.
      expect(deliveries.map((delivery) => delivery.response?.status)).toEqual([200, 200, 200]);
      const confirmed = await confirmOrder(anonymous.request, "razorpay", cart, { ...checkout });
      expect(confirmed.ok()).toBe(false);

      expect(await ordersOf(api, cart.customerEmail)).toEqual([]);
      expect(await transactionsOf(api, cart.customerEmail)).toMatchObject([{ status: "pending" }]);
    }),
  );
});

test("an mIPS payment for another amount or currency makes no order", async ({
  anonymous,
  api,
}) => {
  const changes = [{ amount: prices.Large / 100 - 1 }, { currency: "EUR" }];
  await Promise.all(
    changes.map(async (change) => {
      const { cart } = await shirtInCart(api, anonymous.request);
      const { reference } = await initiateMips(anonymous.request, cart);

      const imn = sent(
        (await mips.pay(anonymous.request, reference, { outcome: "success", ...change })).delivery,
      );
      expect(imn.response).toEqual({ status: 200, body: "fail" });
      const confirmed = await confirmOrder(anonymous.request, "mips", cart, { reference });
      expect(confirmed.ok()).toBe(false);

      expect(await ordersOf(api, cart.customerEmail)).toEqual([]);
      expect(await transactionsOf(api, cart.customerEmail)).toMatchObject([{ status: "pending" }]);
    }),
  );
});

test("an IMN that mIPS can't decrypt is refused", async ({ anonymous, api }) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const { reference } = await initiateMips(anonymous.request, cart);
  const imn = sent(
    (await mips.pay(anonymous.request, reference, { outcome: "success", deliver: false })).delivery,
  );
  const form = new URLSearchParams(imn.body);
  const crypted = form.get("crypted_callback") ?? "";
  form.set(
    "crypted_callback",
    `${crypted.slice(0, 20)}${crypted[20] === "A" ? "B" : "A"}${crypted.slice(21)}`,
  );

  const refused = await replay(anonymous.request, imn, { body: form.toString() });
  expect([refused.status(), await refused.text()]).toEqual([400, "fail"]);
  expect(await ordersOf(api, cart.customerEmail)).toEqual([]);

  // The IMN as mIPS sent it settles the payment.
  const accepted = await replay(anonymous.request, imn);
  expect([accepted.status(), await accepted.text()]).toEqual([200, "success"]);
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
});

test("a Razorpay webhook with a bad signature is refused", async ({ anonymous, api }) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const { orderID } = await initiateRazorpay(anonymous.request, cart);
  const { deliveries } = await razorpay.pay(anonymous.request, orderID, {
    outcome: "captured",
    deliver: false,
  });
  const captured = sent(deliveries.find((delivery) => delivery.event === "payment.captured"));
  const { "x-razorpay-signature": signature = "", ...unsigned } = captured.headers;

  const forgeries = [
    { headers: { ...unsigned, "x-razorpay-signature": forge(signature) } },
    { body: `${captured.body}\n` },
    { headers: unsigned },
  ];
  const refused = await Promise.all(
    forgeries.map((forgery) => replay(anonymous.request, captured, forgery)),
  );
  expect(refused.map((response) => response.status())).toEqual([400, 400, 400]);
  expect(await ordersOf(api, cart.customerEmail)).toEqual([]);

  // The same webhook, signed, settles the payment.
  expect((await replay(anonymous.request, captured)).status()).toBe(200);
  await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);
});

test("confirm-order refuses a Checkout signature that isn't for the cart's payment", async ({
  anonymous,
  api,
}) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const { orderID } = await initiateRazorpay(anonymous.request, cart);
  const { checkout } = await razorpay.pay(anonymous.request, orderID, {
    outcome: "captured",
    deliver: false,
  });
  if (!checkout) throw new Error("Checkout returned no payment.");
  // A genuine payment and signature, for another customer's order.
  const other = await shirtInCart(api, anonymous.request);
  const otherOrder = await initiateRazorpay(anonymous.request, other.cart);
  const otherPayment = await razorpay.pay(anonymous.request, otherOrder.orderID, {
    outcome: "captured",
    deliver: false,
  });

  const refused = await Promise.all(
    [
      { ...checkout, razorpay_signature: forge(checkout.razorpay_signature) },
      { ...otherPayment.checkout },
    ].map((forged) => confirmOrder(anonymous.request, "razorpay", cart, forged)),
  );
  expect(refused.map((response) => response.ok())).toEqual([false, false]);
  expect(await ordersOf(api, cart.customerEmail)).toEqual([]);

  const confirmed = await confirmOrder(anonymous.request, "razorpay", cart, checkout);
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
});

test("a Razorpay payment that fails and is then captured makes one order", async ({
  anonymous,
  api,
}) => {
  const { cart, variant } = await shirtInCart(api, anonymous.request);
  const { orderID } = await initiateRazorpay(anonymous.request, cart);

  const failed = await razorpay.pay(anonymous.request, orderID, { outcome: "failed" });
  const failure = sent(failed.deliveries[0]);
  expect([failure.event, failure.response?.status]).toEqual(["payment.failed", 200]);
  // The payment can still be authorised late, so the transaction stays pending.
  expect(await transactionsOf(api, cart.customerEmail)).toMatchObject([
    { status: "pending", razorpay: { lastError: expect.any(String) } },
  ]);
  expect(await ordersOf(api, cart.customerEmail)).toEqual([]);

  const captured = await razorpay.setStatus(anonymous.request, failed.payment.id, {
    status: "captured",
  });
  expect(captured.deliveries.map((delivery) => delivery.response?.status)).toEqual([200, 200, 200]);
  await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);

  // The failure arriving again, late, undoes nothing.
  expect((await replay(anonymous.request, failure)).status()).toBe(200);
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
  expect(await transactionsOf(api, cart.customerEmail)).toMatchObject([{ status: "succeeded" }]);
  expect(await inventoryOf(api, variant)).toBe(stock - 1);
});

test("reconciliation settles payments that no webhook, IMN or browser confirmed", async ({
  anonymous,
  api,
}) => {
  const captured = await shirtInCart(api, anonymous.request);
  const capturedOrder = await initiateRazorpay(anonymous.request, captured.cart);
  await razorpay.pay(anonymous.request, capturedOrder.orderID, {
    outcome: "captured",
    deliver: false,
  });
  const authorized = await shirtInCart(api, anonymous.request);
  const authorizedOrder = await initiateRazorpay(anonymous.request, authorized.cart);
  await razorpay.pay(anonymous.request, authorizedOrder.orderID, {
    outcome: "authorized",
    deliver: false,
  });
  const card = await shirtInCart(api, anonymous.request);
  const { reference } = await initiateMips(anonymous.request, card.cart);
  await mips.pay(anonymous.request, reference, { outcome: "success", deliver: false });

  const carts = [captured.cart, authorized.cart, card.cart];
  const orderCounts = async () =>
    Promise.all(carts.map(async (cart) => (await ordersOf(api, cart.customerEmail)).length));
  expect(await orderCounts()).toEqual([0, 0, 0]);

  const queued = await api.request.post("/api/e2e/queue", {
    data: { task: "reconcilePayments" },
    headers: { Authorization: `JWT ${api.token}` },
  });
  expect(queued.status(), await queued.text()).toBe(200);
  await api.runCron();

  await expect.poll(orderCounts).toEqual([1, 1, 1]);
  // Reconciliation captured the authorised payment before it settled it.
  const { payments } = await razorpay.order(anonymous.request, authorizedOrder.orderID);
  expect(payments.map(({ status }) => status)).toEqual(["captured"]);
});

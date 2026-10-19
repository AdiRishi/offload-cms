// Settlement outside the browser: Razorpay webhooks, the mIPS IMN and reconciliation on the Cron
// Trigger, driven through the gateway stubs' test-only controls. Each test leaves a payment that
// reconciliation would settle, so they run one at a time in this file, and only this file queues
// reconciliation.

import type { APIRequestContext } from "@playwright/test";

import { z } from "zod";

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
  mipsTransactionOf,
  razorpay,
  razorpayTransactionOf,
  replay,
  seedProduct,
  signedWebhook,
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

/** Queues reconciliation to run now and fires the Cron Trigger, which runs it. */
const reconcile = async (api: PayloadApi) => {
  const queued = await api.request.post("/api/e2e/queue", {
    data: { task: "reconcilePayments" },
    headers: { Authorization: `JWT ${api.token}` },
  });
  expect(queued.status(), await queued.text()).toBe(200);
  await api.runCron();
};

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
  const changes = [
    { change: { amount: prices.Large - 100 }, reports: `reports ${prices.Large - 100}, but` },
    { change: { currency: "INR" }, reports: "reports INR, but" },
  ];
  await Promise.all(
    changes.map(async ({ change, reports }) => {
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

      // The site handles a webhook after answering it.
      await expect
        .poll(async () => (await razorpayTransactionOf(api, orderID)).razorpay.lastError)
        .toContain(reports);
      expect((await razorpayTransactionOf(api, orderID)).status).toBe("pending");
      expect(await ordersOf(api, cart.customerEmail)).toEqual([]);
    }),
  );
});

test("an mIPS payment for another amount or currency makes no order", async ({
  anonymous,
  api,
}) => {
  const changes = [
    {
      change: { amount: prices.Large / 100 - 1 },
      reports: `reports ${prices.Large / 100 - 1} MUR paid`,
    },
    { change: { currency: "EUR" }, reports: "paid in EUR, not MUR" },
  ];
  await Promise.all(
    changes.map(async ({ change, reports }) => {
      const { cart } = await shirtInCart(api, anonymous.request);
      const { reference } = await initiateMips(anonymous.request, cart);

      const imn = sent(
        (await mips.pay(anonymous.request, reference, { outcome: "success", ...change })).delivery,
      );
      expect(imn.response).toEqual({ status: 200, body: "fail" });
      const confirmed = await confirmOrder(anonymous.request, "mips", cart, { reference });
      expect(confirmed.ok()).toBe(false);

      expect(await ordersOf(api, cart.customerEmail)).toEqual([]);
      const transaction = await mipsTransactionOf(api, reference);
      expect(transaction.status).toBe("pending");
      expect(transaction.mips.lastError).toContain(reports);
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

  if (!otherPayment.checkout) throw new Error("Checkout returned no payment.");
  const refused = await Promise.all(
    [
      { ...checkout, razorpay_signature: forge(checkout.razorpay_signature) },
      otherPayment.checkout,
      // This cart's order, with the other order's payment and its genuine signature.
      { ...otherPayment.checkout, razorpay_order_id: checkout.razorpay_order_id },
    ].map((forged) => confirmOrder(anonymous.request, "razorpay", cart, forged)),
  );
  expect(refused.map((response) => response.ok())).toEqual([false, false, false]);
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
  await expect
    .poll(async () => transactionsOf(api, cart.customerEmail))
    .toMatchObject([{ status: "pending", razorpay: { lastError: expect.any(String) } }]);
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

test("a failed payment's late webhook doesn't make the payment that settled look refundable", async ({
  anonymous,
  api,
}) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const { orderID } = await initiateRazorpay(anonymous.request, cart);

  // The customer's first attempt fails and the second succeeds. The browser confirms the second
  // while the first one's failure webhook arrives, so the webhook may read the transaction while
  // it is still pending.
  const failed = await razorpay.pay(anonymous.request, orderID, {
    outcome: "failed",
    deliver: false,
  });
  const paid = await razorpay.pay(anonymous.request, orderID, {
    outcome: "captured",
    deliver: false,
  });
  const failure = sent(failed.deliveries.find((delivery) => delivery.event === "payment.failed"));
  const capture = sent(paid.deliveries.find((delivery) => delivery.event === "payment.captured"));
  const [confirmed, failureAnswer] = await Promise.all([
    confirmOrder(anonymous.request, "razorpay", cart, { ...paid.checkout }),
    razorpay.send(anonymous.request, failure.id),
  ]);
  expect(confirmed.status(), await confirmed.text()).toBe(200);
  expect(failureAnswer.response?.status).toBe(200);
  expect((await razorpayTransactionOf(api, orderID)).razorpay).toMatchObject({
    paymentID: paid.payment.id,
  });
  // The capture of the payment that settled the transaction needs nothing.
  expect((await razorpay.send(anonymous.request, capture.id)).response?.status).toBe(200);

  const transaction = await razorpayTransactionOf(api, orderID);
  expect(transaction.status).toBe("succeeded");
  expect(transaction.razorpay.paymentID).toBe(paid.payment.id);
  expect(transaction.razorpay.lastError ?? "").not.toMatch(/Refund/);
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
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

  await reconcile(api);

  await expect.poll(orderCounts).toEqual([1, 1, 1]);
  // Reconciliation captured the authorised payment before it settled it.
  const { payments } = await razorpay.order(anonymous.request, authorizedOrder.orderID);
  expect(payments.map(({ status }) => status)).toEqual(["captured"]);
});

test("a Razorpay webhook racing the browser's confirmation makes one order", async ({
  anonymous,
  api,
}) => {
  const { cart, variant } = await shirtInCart(api, anonymous.request);
  const { orderID } = await initiateRazorpay(anonymous.request, cart);
  const { checkout } = await razorpay.pay(anonymous.request, orderID, {
    outcome: "captured",
    wait: false,
  });

  // The webhooks are in flight. Confirm as the button does, again while another request settles.
  const statuses: number[] = [];
  await expect
    .poll(
      async () => {
        const response = await confirmOrder(anonymous.request, "razorpay", cart, { ...checkout });
        statuses.push(response.status());
        return response.status();
      },
      { intervals: [250] },
    )
    .toBe(200);
  expect(statuses.filter((status) => status !== 200 && status !== 409)).toEqual([]);
  await expect
    .poll(async () =>
      (await razorpay.order(anonymous.request, orderID)).deliveries.map(
        (delivery) => delivery.response?.status,
      ),
    )
    .toEqual([200, 200, 200]);
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
  expect(await inventoryOf(api, variant)).toBe(stock - 1);
});

test("a second payment for a bought cart is neither settled nor captured", async ({
  anonymous,
  api,
}) => {
  const { cart, variant } = await shirtInCart(api, anonymous.request);
  // Three checkouts started for one cart, before any of them was paid.
  const first = await initiateRazorpay(anonymous.request, cart);
  const second = await initiateRazorpay(anonymous.request, cart);
  const third = await initiateRazorpay(anonymous.request, cart);
  await razorpay.pay(anonymous.request, first.orderID, { outcome: "captured" });
  await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);

  const paidTwice = await razorpay.pay(anonymous.request, second.orderID, { outcome: "captured" });
  const authorizedTwice = await razorpay.pay(anonymous.request, third.orderID, {
    outcome: "authorized",
  });

  await expect
    .poll(async () => (await razorpayTransactionOf(api, second.orderID)).razorpay.lastError)
    .toMatch(new RegExp(`${paidTwice.payment.id}.*Refund`));
  await expect
    .poll(async () => (await razorpayTransactionOf(api, third.orderID)).razorpay.lastError)
    .toMatch(new RegExp(`${authorizedTwice.payment.id}.*Refund`));
  expect(
    await Promise.all(
      [second, third].map(
        async ({ orderID }) => (await razorpayTransactionOf(api, orderID)).status,
      ),
    ),
  ).toEqual(["pending", "pending"]);
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
  expect(await inventoryOf(api, variant)).toBe(stock - 1);
  // Razorpay refunds an authorisation that nobody captures.
  const { payments } = await razorpay.order(anonymous.request, third.orderID);
  expect(payments.map(({ status }) => status)).toEqual(["authorized"]);
});

test("two payments for one cart settling at the same moment make one order", async ({
  anonymous,
  api,
}) => {
  const { cart, variant } = await shirtInCart(api, anonymous.request);
  const checkouts = [
    await initiateRazorpay(anonymous.request, cart),
    await initiateRazorpay(anonymous.request, cart),
  ];
  const paid = await Promise.all(
    checkouts.map(({ orderID }) =>
      razorpay.pay(anonymous.request, orderID, { outcome: "captured", deliver: false }),
    ),
  );
  const captured = paid.map(({ deliveries }) =>
    sent(deliveries.find((delivery) => delivery.event === "payment.captured")),
  );

  // Both webhooks arrive together, and each settles after answering.
  const answers = await Promise.all(
    captured.map((delivery) => razorpay.send(anonymous.request, delivery.id)),
  );
  expect(answers.map((delivery) => delivery.response?.status)).toEqual([200, 200]);

  await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);
  const transactions = async () =>
    Promise.all(checkouts.map(({ orderID }) => razorpayTransactionOf(api, orderID)));
  await expect
    .poll(async () => (await transactions()).map(({ status }) => status).sort())
    .toEqual(["pending", "succeeded"]);
  const loser = (await transactions()).findIndex(({ status }) => status === "pending");
  await expect
    .poll(async () => (await transactions())[loser]?.razorpay.lastError)
    .toMatch(new RegExp(`${paid[loser]?.payment.id}.*Refund`));
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
  expect(await inventoryOf(api, variant)).toBe(stock - 1);
});

test("Razorpay's webhook captures a payment left authorized, then settles it", async ({
  anonymous,
  api,
}) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const { orderID } = await initiateRazorpay(anonymous.request, cart);

  const { deliveries } = await razorpay.pay(anonymous.request, orderID, { outcome: "authorized" });
  expect(deliveries.map((delivery) => [delivery.event, delivery.response?.status])).toEqual([
    ["payment.authorized", 200],
  ]);
  await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);
  const { payments } = await razorpay.order(anonymous.request, orderID);
  expect(payments.map(({ status }) => status)).toEqual(["captured"]);
});

test("a Razorpay event delivered again after it was handled changes nothing", async ({
  anonymous,
  api,
}) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const { orderID } = await initiateRazorpay(anonymous.request, cart);
  const failure = sent(
    (await razorpay.pay(anonymous.request, orderID, { outcome: "failed" })).deliveries[0],
  );
  await expect
    .poll(async () => (await razorpayTransactionOf(api, orderID)).razorpay.lastEventID)
    .toBe(failure.headers["x-razorpay-event-id"]);
  const handled = await razorpayTransactionOf(api, orderID);

  const again = await razorpay.send(anonymous.request, failure.id);
  expect(again.response?.status).toBe(200);
  expect(await razorpayTransactionOf(api, orderID)).toEqual(handled);
});

test("a signed Razorpay webhook the site can't read is answered 200", async ({ anonymous }) => {
  const body = JSON.stringify({
    entity: "event",
    event: "payment.captured",
    payload: { payment: {} },
  });
  const response = await anonymous.request.post("/api/payments/razorpay/webhooks", {
    data: body,
    headers: signedWebhook(body),
  });
  // A retry would carry the same body, so the site doesn't ask for one.
  expect(response.status(), await response.text()).toBe(200);
});

test("a payment after its transaction expired settles it while nobody else bought the cart", async ({
  anonymous,
  api,
}) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const { orderID } = await initiateRazorpay(anonymous.request, cart);
  await api.update("transactions", (await razorpayTransactionOf(api, orderID)).id, {
    status: "expired",
  });

  await razorpay.pay(anonymous.request, orderID, { outcome: "captured" });
  await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);
  expect((await razorpayTransactionOf(api, orderID)).status).toBe("succeeded");
});

test("a payment after its transaction expired and its cart was bought makes no order", async ({
  anonymous,
  api,
}) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const bought = await initiateRazorpay(anonymous.request, cart);
  const late = await initiateRazorpay(anonymous.request, cart);
  await api.update("transactions", (await razorpayTransactionOf(api, late.orderID)).id, {
    status: "expired",
  });
  await razorpay.pay(anonymous.request, bought.orderID, { outcome: "captured" });
  await expect.poll(async () => (await ordersOf(api, cart.customerEmail)).length).toBe(1);

  const { payment } = await razorpay.pay(anonymous.request, late.orderID, { outcome: "captured" });
  await expect
    .poll(async () => (await razorpayTransactionOf(api, late.orderID)).razorpay.lastError)
    .toMatch(new RegExp(`${payment.id}.*Refund`));
  expect((await razorpayTransactionOf(api, late.orderID)).status).toBe("expired");
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
});

test("mIPS confirm-order refuses a reference from another cart", async ({ anonymous, api }) => {
  const paid = await shirtInCart(api, anonymous.request);
  const other = await shirtInCart(api, anonymous.request);
  const { reference } = await initiateMips(anonymous.request, paid.cart);
  await mips.pay(anonymous.request, reference, { outcome: "success", deliver: false });

  const refused = await confirmOrder(anonymous.request, "mips", other.cart, { reference });
  expect(refused.ok()).toBe(false);
  expect(await ordersOf(api, paid.cart.customerEmail)).toEqual([]);
  expect(await ordersOf(api, other.cart.customerEmail)).toEqual([]);
});

test("an IMN for an order that mIPS reports as waiting settles nothing", async ({
  anonymous,
  api,
}) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const { reference } = await initiateMips(anonymous.request, cart);
  const imn = sent(
    (await mips.pay(anonymous.request, reference, { outcome: "success", deliver: false })).delivery,
  );
  await mips.setStatus(anonymous.request, reference, "waiting");

  const response = await replay(anonymous.request, imn);
  // mIPS sends the IMN again later, when the order may have been paid.
  expect([response.status(), await response.text()]).toEqual([500, "fail"]);
  expect(await ordersOf(api, cart.customerEmail)).toEqual([]);
});

test("an mIPS order whose amount mIPS reports in cents settles", async ({ anonymous, api }) => {
  const { cart } = await shirtInCart(api, anonymous.request);
  const { reference } = await initiateMips(anonymous.request, cart);

  const imn = sent(
    (await mips.pay(anonymous.request, reference, { outcome: "success", amountUnits: "cents" }))
      .delivery,
  );
  expect(imn.response).toEqual({ status: 200, body: "success" });
  expect(await ordersOf(api, cart.customerEmail)).toHaveLength(1);
});

test("reconciliation expires mIPS orders that expired or were cancelled", async ({
  anonymous,
  api,
}) => {
  const expired = await shirtInCart(api, anonymous.request);
  const cancelled = await shirtInCart(api, anonymous.request);
  const expiredOrder = await initiateMips(anonymous.request, expired.cart);
  const cancelledOrder = await initiateMips(anonymous.request, cancelled.cart);
  await mips.setStatus(anonymous.request, expiredOrder.reference, "expired");
  await mips.cancel(anonymous.request, cancelledOrder.reference);
  const payment = await anonymous.request.post(
    `http://localhost:4891/__stub/orders/${cancelledOrder.reference}/pay`,
    { data: { outcome: "success" } },
  );
  expect(payment.status()).toBe(400);

  await reconcile(api);
  await expect
    .poll(async () =>
      Promise.all(
        [expiredOrder, cancelledOrder].map(
          async ({ reference }) => (await mipsTransactionOf(api, reference)).status,
        ),
      ),
    )
    .toEqual(["expired", "expired"]);
});

test("the Cron Trigger queues reconciliation on its schedule", async ({ api }) => {
  const listed = z.object({
    jobs: z.array(
      z.object({
        meta: z.object({ scheduled: z.boolean() }).nullish(),
        waitUntil: z.string().nullish(),
      }),
    ),
  });
  // Payload queues at most one scheduled job per task, so a job queued by another test may delay it.
  await expect
    .poll(async () => {
      await api.runCron();
      const response = await api.request.get("/api/e2e/jobs?task=reconcilePayments", {
        headers: { Authorization: `JWT ${api.token}` },
      });
      const { jobs } = listed.parse(await response.json());
      // The schedule's next run is next New Year, so the job waits.
      return jobs.some(
        ({ meta, waitUntil }) =>
          meta?.scheduled === true && Date.parse(waitUntil ?? "") > Date.now(),
      );
    })
    .toBe(true);
});

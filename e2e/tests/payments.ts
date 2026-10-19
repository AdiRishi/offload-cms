// Shared steps for the payments suites: a catalog seeded through REST, guest carts, the plugin's
// payment endpoints, and the control routes of the gateway stubs in stubs/.

import type { APIRequestContext, Page } from "@playwright/test";

import { createHmac } from "node:crypto";
import { z } from "zod";

import { type Doc, expect, type PayloadApi, unique } from "./fixtures";

const razorpayStub = "http://localhost:4890";
const mipsStub = "http://localhost:4891";

/** Variant prices in MUR cents. The product's own price is lower than any variant's. */
export const prices = { Small: 125050, Large: 150000 };
export const productPrice = 99900;
export const stock = 10;

/**
 * A published product sold in sizes, each a published variant with its own MUR price and stock.
 * The product has a cheaper price of its own, which a cart without a variant would pay.
 */
export const seedProduct = async (api: PayloadApi, variantPrices = prices) => {
  const size = await api.create("variantTypes", { label: "Size", name: unique("size") });
  const product = await api.create("products", {
    _status: "published",
    enableVariants: true,
    priceInMUR: productPrice,
    priceInMUREnabled: true,
    title: unique("Shirt"),
    variantTypes: [size.id],
  });
  const variant = async (label: keyof typeof variantPrices) => {
    const option = await api.create("variantOptions", {
      label,
      value: label.toLowerCase(),
      variantType: size.id,
    });
    return api.create("variants", {
      _status: "published",
      inventory: stock,
      options: [option.id],
      priceInMUR: variantPrices[label],
      priceInMUREnabled: true,
      product: product.id,
    });
  };
  const variants = { Small: await variant("Small"), Large: await variant("Large") };
  return { product, variants };
};

export const inventoryOf = async (api: PayloadApi, variant: Doc) =>
  (await api.findByID("variants", variant.id, "?depth=0")).inventory;

const createdCart = z.object({
  doc: z.object({ id: z.union([z.number(), z.string()]), secret: z.string().optional() }),
});

type Items = { product: Doc["id"]; variant?: Doc["id"]; quantity: number }[];

/**
 * A cart and how its owner proves access to it: a guest by the cart's secret and an email, a
 * logged-in user by their token.
 */
export type Cart = z.infer<typeof createdCart>["doc"] & {
  customerEmail?: string;
  headers?: Record<string, string>;
};

export type GuestCart = Cart & { customerEmail: string };

export const guestEmail = () => `${unique("guest")}@offload.test`;

const createCart = async (
  request: APIRequestContext,
  data: Record<string, unknown>,
  headers?: Record<string, string>,
) => {
  const response = await request.post("/api/carts", {
    data: { currency: "MUR", ...data },
    headers,
  });
  expect(response.status(), await response.text()).toBe(201);
  return createdCart.parse(await response.json()).doc;
};

/** A guest's cart in MUR, created through REST as the plugin's React provider does. */
export const guestCart = async (request: APIRequestContext, items: Items): Promise<GuestCart> => ({
  ...(await createCart(request, { items })),
  customerEmail: guestEmail(),
});

/**
 * A logged-in user's cart in MUR. The React provider names the user as the cart's customer only
 * when the user is a customer.
 */
export const userCart = async (
  request: APIRequestContext,
  token: string,
  items: Items,
  customer?: Doc["id"],
): Promise<Cart> => {
  const headers = { Authorization: `JWT ${token}` };
  return { ...(await createCart(request, { customer, items }, headers)), headers };
};

type Gateway = "razorpay" | "mips";

/** Calls the plugin's initiate endpoint for a cart, as the checkout components do. */
export const initiate = (request: APIRequestContext, gateway: Gateway, cart: Cart) =>
  request.post(`/api/payments/${gateway}/initiate`, {
    data: {
      cartID: cart.id,
      currency: "MUR",
      customerEmail: cart.customerEmail,
      secret: cart.secret,
    },
    headers: cart.headers,
  });

/** Calls the plugin's confirm-order endpoint for a cart. */
export const confirmOrder = (
  request: APIRequestContext,
  gateway: Gateway,
  cart: Cart,
  data: Record<string, unknown>,
) =>
  request.post(`/api/payments/${gateway}/confirm-order`, {
    data: { ...data, cartID: cart.id, customerEmail: cart.customerEmail, secret: cart.secret },
    headers: cart.headers,
  });

const razorpayOrder = z.object({ orderID: z.string(), amount: z.number(), currency: z.string() });
const mipsOrder = z.object({ reference: z.string(), paymentZone: z.string() });

export const initiateRazorpay = async (request: APIRequestContext, cart: Cart) => {
  const response = await initiate(request, "razorpay", cart);
  expect(response.status(), await response.text()).toBe(200);
  return razorpayOrder.parse(await response.json());
};

export const initiateMips = async (request: APIRequestContext, cart: Cart) => {
  const response = await initiate(request, "mips", cart);
  expect(response.status(), await response.text()).toBe(200);
  return mipsOrder.parse(await response.json());
};

/** A guest's orders, found by the email they checked out with. */
export const ordersOf = async (api: PayloadApi, customerEmail: string) =>
  (await api.find("orders", `?where[customerEmail][equals]=${encodeURIComponent(customerEmail)}`))
    .docs;

/** A guest's transactions, found by the email they checked out with. */
export const transactionsOf = async (api: PayloadApi, customerEmail: string) =>
  (
    await api.find(
      "transactions",
      `?where[customerEmail][equals]=${encodeURIComponent(customerEmail)}`,
    )
  ).docs;

const delivery = z.object({
  id: z.string(),
  event: z.string(),
  url: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
  response: z.object({ status: z.number(), body: z.string() }).nullable(),
});

export type Delivery = z.infer<typeof delivery>;

/** Sends a recorded gateway delivery again, with its exact body and headers unless overridden. */
export const replay = (
  request: APIRequestContext,
  sent: Delivery,
  {
    body = sent.body,
    headers = sent.headers,
  }: { body?: string; headers?: Record<string, string> } = {},
) => request.post(sent.url, { data: body, headers });

const razorpayPayment = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
});

const razorpayPaid = z.object({
  payment: razorpayPayment,
  checkout: z
    .object({
      razorpay_order_id: z.string(),
      razorpay_payment_id: z.string(),
      razorpay_signature: z.string(),
    })
    .nullable(),
  deliveries: z.array(delivery),
});

const stubPost = async (request: APIRequestContext, url: string, data: Record<string, unknown>) => {
  const response = await request.post(url, { data });
  expect(response.status(), await response.text()).toBe(200);
  const body: unknown = await response.json();
  return body;
};

/** The Razorpay stub's test-only controls. */
export const razorpay = {
  /**
   * Pays a Razorpay order, as a customer in Checkout would. `authorized` leaves the payment for the
   * merchant to capture. The webhooks have answered when it returns, unless `wait` is false.
   */
  pay: async (
    request: APIRequestContext,
    orderID: string,
    payment: {
      outcome: "captured" | "authorized" | "failed";
      amount?: number;
      currency?: string;
      deliver?: boolean;
      wait?: boolean;
    },
  ) =>
    razorpayPaid.parse(
      await stubPost(request, `${razorpayStub}/__stub/orders/${orderID}/pay`, {
        wait: true,
        ...payment,
      }),
    ),
  /** Moves a payment to another status, as a late authorisation or capture does. */
  setStatus: async (
    request: APIRequestContext,
    paymentID: string,
    change: { status: "authorized" | "captured" | "failed"; deliver?: boolean },
  ) =>
    razorpayPaid.omit({ checkout: true }).parse(
      await stubPost(request, `${razorpayStub}/__stub/payments/${paymentID}/status`, {
        wait: true,
        ...change,
      }),
    ),
  /** Redelivers a webhook with the same bytes and event ID, as Razorpay's retries do. */
  send: async (request: APIRequestContext, deliveryID: string) =>
    z
      .object({ delivery })
      .parse(await stubPost(request, `${razorpayStub}/__stub/deliveries/${deliveryID}/send`, {}))
      .delivery,
  /** A Razorpay order's payments and webhook deliveries, oldest first. */
  order: async (request: APIRequestContext, orderID: string) => {
    const response = await request.get(`${razorpayStub}/__stub/orders/${orderID}`);
    expect(response.status()).toBe(200);
    return z
      .object({ payments: z.array(razorpayPayment), deliveries: z.array(delivery) })
      .parse(await response.json());
  },
};

const mipsPaid = z.object({ delivery: delivery.nullable() });

/** The mIPS stub's test-only controls. */
export const mips = {
  /**
   * Pays an mIPS order, as a customer in the payment zone would. The IMN has answered when it
   * returns, unless `wait` is false. `amountUnits` is how mIPS reports the order's amount.
   */
  pay: async (
    request: APIRequestContext,
    reference: string,
    payment: {
      outcome: "success" | "fail";
      amount?: number;
      currency?: string;
      deliver?: boolean;
      wait?: boolean;
      amountUnits?: "major" | "cents";
    },
  ) =>
    mipsPaid.parse(
      await stubPost(request, `${mipsStub}/__stub/orders/${reference}/pay`, {
        wait: true,
        ...payment,
      }),
    ),
  /** Sets the status mIPS reports for an order, without a payment. */
  setStatus: async (
    request: APIRequestContext,
    reference: string,
    status: "waiting" | "expired" | "fail" | "success",
  ) => stubPost(request, `${mipsStub}/__stub/orders/${reference}/status`, { order_status: status }),
  /** Cancels an order through mIPS's API, as the merchant can. */
  cancel: async (request: APIRequestContext, reference: string) => {
    const response = await request.post(`${mipsStub}/api/orders_management`, {
      data: {
        authentify: {
          id_entity: process.env.MIPS_ENTITY_ID,
          id_merchant: process.env.MIPS_MERCHANT_ID,
          id_operator: process.env.MIPS_OPERATOR_ID,
          operator_password: process.env.MIPS_OPERATOR_PASSWORD,
        },
        instruction: "cancel_order",
        order: { id_order: reference },
      },
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.MIPS_USERNAME}:${process.env.MIPS_PASSWORD}`).toString("base64")}`,
      },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ operation_status: "success" });
  },
  /** An mIPS order's IMN deliveries, oldest first. */
  deliveries: async (request: APIRequestContext, reference: string) => {
    const response = await request.get(`${mipsStub}/__stub/orders/${reference}`);
    expect(response.status()).toBe(200);
    return z.object({ deliveries: z.array(delivery) }).parse(await response.json()).deliveries;
  },
};

/** A webhook body signed with the site's webhook secret, as Razorpay signs one. */
export const signedWebhook = (body: string) => ({
  "content-type": "application/json",
  "x-razorpay-event-id": unique("evt").replaceAll("-", ""),
  "x-razorpay-signature": createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET ?? "")
    .update(body)
    .digest("hex"),
});

const group = z.object({ lastError: z.string().nullish(), lastEventID: z.string().nullish() });

const razorpayTransaction = z.object({
  id: z.union([z.number(), z.string()]),
  status: z.string(),
  razorpay: group.extend({ orderID: z.string(), paymentID: z.string().nullish() }),
});

/** The transaction that holds a Razorpay order. */
export const razorpayTransactionOf = async (api: PayloadApi, orderID: string) => {
  const { docs } = await api.find(
    "transactions",
    `?where[razorpay.orderID][equals]=${orderID}&depth=0`,
  );
  expect(docs).toHaveLength(1);
  return razorpayTransaction.parse(docs[0]);
};

const mipsTransaction = z.object({
  id: z.union([z.number(), z.string()]),
  status: z.string(),
  mips: group.extend({ reference: z.string() }),
});

/** The transaction that holds an mIPS order. */
export const mipsTransactionOf = async (api: PayloadApi, reference: string) => {
  const { docs } = await api.find(
    "transactions",
    `?where[mips.reference][equals]=${reference}&depth=0`,
  );
  expect(docs).toHaveLength(1);
  return mipsTransaction.parse(docs[0]);
};

/** The site loads Razorpay's Checkout script. The browser gets the stub's instead. */
export const routeCheckoutToStub = (page: Page) =>
  page.route("https://checkout.razorpay.com/v1/checkout.js", async (route) =>
    route.fulfill({ response: await route.fetch({ url: `${razorpayStub}/v1/checkout.js` }) }),
  );

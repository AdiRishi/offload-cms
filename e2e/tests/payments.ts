// Shared steps for the payments suites: a catalog seeded through REST, guest carts, the plugin's
// payment endpoints, and the control routes of the gateway stubs in stubs/.

import type { APIRequestContext, Page } from "@playwright/test";

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
  doc: z.object({ id: z.union([z.number(), z.string()]), secret: z.string() }),
});

export type GuestCart = z.infer<typeof createdCart>["doc"] & { customerEmail: string };

export const guestEmail = () => `${unique("guest")}@offload.test`;

/** A guest's cart in MUR, created through REST as the plugin's React provider does. */
export const guestCart = async (
  request: APIRequestContext,
  items: { product: Doc["id"]; variant?: Doc["id"]; quantity: number }[],
): Promise<GuestCart> => {
  const response = await request.post("/api/carts", { data: { currency: "MUR", items } });
  expect(response.status(), await response.text()).toBe(201);
  const { doc } = createdCart.parse(await response.json());
  return { ...doc, customerEmail: guestEmail() };
};

type Gateway = "razorpay" | "mips";

/** Calls the plugin's initiate endpoint for a guest cart, as the checkout components do. */
export const initiate = (request: APIRequestContext, gateway: Gateway, cart: GuestCart) =>
  request.post(`/api/payments/${gateway}/initiate`, {
    data: {
      cartID: cart.id,
      currency: "MUR",
      customerEmail: cart.customerEmail,
      secret: cart.secret,
    },
  });

/** Calls the plugin's confirm-order endpoint for a guest cart. */
export const confirmOrder = (
  request: APIRequestContext,
  gateway: Gateway,
  cart: GuestCart,
  data: Record<string, unknown>,
) =>
  request.post(`/api/payments/${gateway}/confirm-order`, {
    data: { ...data, cartID: cart.id, customerEmail: cart.customerEmail, secret: cart.secret },
  });

const razorpayOrder = z.object({ orderID: z.string(), amount: z.number(), currency: z.string() });
const mipsOrder = z.object({ reference: z.string(), paymentZone: z.string() });

export const initiateRazorpay = async (request: APIRequestContext, cart: GuestCart) => {
  const response = await initiate(request, "razorpay", cart);
  expect(response.status(), await response.text()).toBe(200);
  return razorpayOrder.parse(await response.json());
};

export const initiateMips = async (request: APIRequestContext, cart: GuestCart) => {
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
  /** Pays a Razorpay order, as a customer in Checkout would. */
  pay: async (
    request: APIRequestContext,
    orderID: string,
    payment: {
      outcome: "captured" | "authorized" | "failed";
      amount?: number;
      currency?: string;
      deliver?: boolean;
    },
  ) =>
    razorpayPaid.parse(
      await stubPost(request, `${razorpayStub}/__stub/orders/${orderID}/pay`, payment),
    ),
  /** Moves a payment to another status, as a late authorisation or capture does. */
  setStatus: async (
    request: APIRequestContext,
    paymentID: string,
    change: { status: "authorized" | "captured" | "failed"; deliver?: boolean },
  ) =>
    razorpayPaid
      .omit({ checkout: true })
      .parse(
        await stubPost(request, `${razorpayStub}/__stub/payments/${paymentID}/status`, change),
      ),
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
  /** Pays an mIPS order, as a customer in the payment zone would. */
  pay: async (
    request: APIRequestContext,
    reference: string,
    payment: {
      outcome: "success" | "fail";
      amount?: number;
      currency?: string;
      deliver?: boolean;
    },
  ) =>
    mipsPaid.parse(await stubPost(request, `${mipsStub}/__stub/orders/${reference}/pay`, payment)),
  /** An mIPS order's IMN deliveries, oldest first. */
  deliveries: async (request: APIRequestContext, reference: string) => {
    const response = await request.get(`${mipsStub}/__stub/orders/${reference}`);
    expect(response.status()).toBe(200);
    return z.object({ deliveries: z.array(delivery) }).parse(await response.json()).deliveries;
  },
};

/** The site loads Razorpay's Checkout script. The browser gets the stub's instead. */
export const routeCheckoutToStub = (page: Page) =>
  page.route("https://checkout.razorpay.com/v1/checkout.js", async (route) =>
    route.fulfill({ response: await route.fetch({ url: `${razorpayStub}/v1/checkout.js` }) }),
  );

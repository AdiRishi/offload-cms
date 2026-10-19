import { createHmac, randomInt } from "node:crypto";
import { createServer } from "node:http";
import { text } from "node:stream/consumers";

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const keyID = env("RAZORPAY_KEY_ID");
const keySecret = env("RAZORPAY_KEY_SECRET");
const webhookSecret = env("RAZORPAY_WEBHOOK_SECRET");
const webhookURL = `${env("SITE_URL").replace(/\/$/, "")}/api/payments/razorpay/webhooks`;
const authorization = `Basic ${Buffer.from(`${keyID}:${keySecret}`).toString("base64")}`;
const origin = "http://localhost:4890";

const alphanumerics = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const randomID = () =>
  Array.from({ length: 14 }, () => alphanumerics.charAt(randomInt(alphanumerics.length))).join("");
const accountID = `acc_${randomID()}`;
const now = () => Math.floor(Date.now() / 1000);
const hmac = (key: string, message: string) =>
  createHmac("sha256", key).update(message).digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNotes = (value: unknown): value is Record<string, string | number> =>
  isRecord(value) &&
  Object.keys(value).length <= 15 &&
  Object.values(value).every(
    (note) => (typeof note === "string" && note.length <= 256) || typeof note === "number",
  );
const isCurrency = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z]{3}$/.test(value);
const isAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

// Razorpay serialises empty notes as a JSON array.
type Notes = Record<string, string | number> | [];

type Order = {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  offer_id: null;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes: Notes;
  created_at: number;
};

type PaymentError = {
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
};

type Payment = PaymentError & {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "failed";
  order_id: string;
  invoice_id: null;
  international: boolean;
  method: "card";
  amount_refunded: number;
  refund_status: null;
  captured: boolean;
  description: null;
  card_id: string;
  bank: null;
  wallet: null;
  vpa: null;
  email: string;
  contact: string;
  notes: Notes;
  fee: number | null;
  tax: number | null;
  acquirer_data: { auth_code: string | null };
  created_at: number;
};

type Delivery = {
  id: string;
  event: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  response: { status: number; body: string } | null;
};

type Entry = { order: Order; payments: Payment[]; deliveries: Delivery[] };
type PaymentRecord = { payment: Payment; entry: Entry; deliver: boolean };

const orders = new Map<string, Entry>();
const payments = new Map<string, PaymentRecord>();

const failure: PaymentError = {
  error_code: "BAD_REQUEST_ERROR",
  error_description: "Payment failed",
  error_source: "customer",
  error_step: "payment_authentication",
  error_reason: "payment_failed",
};
const noFailure: PaymentError = {
  error_code: null,
  error_description: null,
  error_source: null,
  error_step: null,
  error_reason: null,
};

function event(entry: Entry, name: string, payment: Payment, withOrder = false): Delivery {
  const card = {
    id: payment.card_id,
    entity: "card",
    name: "Gaurav Kumar",
    last4: "1111",
    network: "Visa",
    type: "credit",
    issuer: null,
    international: false,
    emi: false,
    sub_type: "consumer",
  };
  const payload = {
    payment: { entity: { ...payment, card } },
    ...(withOrder ? { order: { entity: entry.order } } : {}),
  };
  const body = JSON.stringify({
    entity: "event",
    account_id: accountID,
    event: name,
    contains: Object.keys(payload),
    payload,
    created_at: now(),
  });
  const id = randomID();
  const delivery: Delivery = {
    id,
    event: name,
    url: webhookURL,
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": hmac(webhookSecret, body),
      "x-razorpay-event-id": id,
      "user-agent": "Razorpay-Webhook/v1",
    },
    body,
    response: null,
  };
  entry.deliveries.push(delivery);
  return delivery;
}

function capture({ payment, entry }: PaymentRecord): Delivery[] {
  payment.status = "captured";
  payment.captured = true;
  payment.fee = Math.round(payment.amount * 0.02);
  payment.tax = Math.round(payment.fee * 0.18);
  entry.order.status = "paid";
  entry.order.amount_paid = payment.amount;
  entry.order.amount_due = 0;
  return [event(entry, "payment.captured", payment), event(entry, "order.paid", payment, true)];
}

function transition(record: PaymentRecord, to: "authorized" | "captured" | "failed"): Delivery[] {
  const { payment, entry } = record;
  if (to === "failed") {
    payment.status = "failed";
    Object.assign(payment, failure);
    return [event(entry, "payment.failed", payment)];
  }
  const deliveries: Delivery[] = [];
  if (payment.status !== "authorized") {
    payment.status = "authorized";
    payment.acquirer_data = { auth_code: String(randomInt(100000, 1000000)) };
    Object.assign(payment, noFailure);
    deliveries.push(event(entry, "payment.authorized", payment));
  }
  if (to === "captured") deliveries.push(...capture(record));
  return deliveries;
}

async function post(delivery: Delivery) {
  try {
    const response = await fetch(delivery.url, {
      method: "POST",
      headers: delivery.headers,
      body: delivery.body,
      signal: AbortSignal.timeout(10_000),
    });
    delivery.response = { status: response.status, body: await response.text() };
  } catch (error) {
    delivery.response = { status: 0, body: String(error) };
  }
}

async function postInOrder(deliveries: Delivery[]) {
  // Each event goes out after the site has answered the previous one.
  // oxlint-disable-next-line no-await-in-loop
  for (const delivery of deliveries) await post(delivery);
}

const apiError = (description: string, field?: string) =>
  Response.json(
    {
      error: {
        code: "BAD_REQUEST_ERROR",
        description,
        source: "business",
        step: "payment_initiation",
        reason: "input_validation_failed",
        metadata: {},
        ...(field ? { field } : {}),
      },
    },
    { status: 400 },
  );
const stubError = (status: number, error: string) => Response.json({ error }, { status });

function createOrder(_: string, body: unknown): Response {
  if (!isRecord(body)) return apiError("The amount field is required.", "amount");
  const { amount, currency, receipt, notes } = body;
  if (amount === undefined) return apiError("The amount field is required.", "amount");
  if (typeof amount !== "number" || !Number.isInteger(amount)) {
    return apiError("The amount must be an integer.", "amount");
  }
  if (currency === undefined) return apiError("The currency field is required.", "currency");
  if (!isCurrency(currency)) {
    return apiError("currency: validation_failure: BAD_REQUEST_INVALID_CURRENCY", "currency");
  }
  if (amount < 100) return apiError(`The amount must be at least ${currency} 1.00`, "amount");
  if (receipt !== undefined && (typeof receipt !== "string" || receipt.length > 40)) {
    return apiError("receipt: the length must be no more than 40.", "receipt");
  }
  if (notes !== undefined && !isNotes(notes)) {
    return apiError("notes: at most 15 keys with values of at most 256 characters", "notes");
  }
  const order: Order = {
    id: `order_${randomID()}`,
    entity: "order",
    amount,
    amount_paid: 0,
    amount_due: amount,
    currency,
    receipt: typeof receipt === "string" ? receipt : null,
    offer_id: null,
    status: "created",
    attempts: 0,
    notes: notes && Object.keys(notes).length > 0 ? notes : [],
    created_at: now(),
  };
  orders.set(order.id, { order, payments: [], deliveries: [] });
  return Response.json(order);
}

function fetchOrder(id: string): Response {
  const entry = orders.get(id);
  return entry ? Response.json(entry.order) : apiError("The id provided does not exist");
}

function fetchOrderPayments(id: string): Response {
  const entry = orders.get(id);
  if (!entry) return apiError("The id provided does not exist");
  return Response.json({
    entity: "collection",
    count: entry.payments.length,
    items: entry.payments,
  });
}

function fetchPayment(id: string): Response {
  const record = payments.get(id);
  return record ? Response.json(record.payment) : apiError("The id provided does not exist");
}

function capturePayment(id: string, body: unknown): Response {
  const record = payments.get(id);
  if (!record) return apiError("The id provided does not exist");
  const { payment, entry } = record;
  const { amount, currency }: Record<string, unknown> = isRecord(body) ? body : {};
  if (amount === undefined) {
    return apiError(
      "Could not validate payment capture request due to: amount: required key is missing.",
      "amount",
    );
  }
  if (typeof amount !== "number" || !Number.isInteger(amount)) {
    return apiError("The amount must be an integer.", "amount");
  }
  if (typeof currency !== "string") return apiError("The currency field is required.", "currency");
  if (payment.status === "captured") return apiError("This payment has already been captured");
  if (payment.status !== "authorized") {
    return apiError(
      "Only payments which have been authorized and not yet captured can be captured",
    );
  }
  if (entry.order.status === "paid") return apiError("Payment already done for this order.");
  if (amount !== payment.amount) {
    return apiError("Capture amount must be equal to the amount authorized", "amount");
  }
  if (currency !== payment.currency) {
    return apiError("Capture request currency must be same as payment currency", "currency");
  }
  const deliveries = capture(record);
  // Razorpay sends webhooks after the API answers, so a caller waiting on its own webhook can't deadlock.
  if (record.deliver) void postInOrder(deliveries);
  return Response.json(payment);
}

async function pay(orderID: string, body: unknown): Promise<Response> {
  const entry = orders.get(orderID);
  if (!entry) return stubError(404, `No order ${orderID}`);
  if (!isRecord(body)) return stubError(400, "Expected a JSON object");
  const {
    outcome,
    amount = entry.order.amount,
    currency = entry.order.currency,
    deliver = true,
    key,
  } = body;
  if (key !== undefined && key !== keyID) return stubError(401, "key is not RAZORPAY_KEY_ID");
  if (outcome !== "captured" && outcome !== "authorized" && outcome !== "failed") {
    return stubError(400, "outcome must be captured, authorized or failed");
  }
  if (!isAmount(amount)) return stubError(400, "amount must be a positive integer");
  if (!isCurrency(currency)) return stubError(400, "currency must be 3 capital letters");
  if (typeof deliver !== "boolean") return stubError(400, "deliver must be a boolean");
  if (entry.order.status === "paid") return stubError(400, `${orderID} is already paid`);

  const payment: Payment = {
    id: `pay_${randomID()}`,
    entity: "payment",
    amount,
    currency,
    status: "created",
    order_id: orderID,
    invoice_id: null,
    international: false,
    method: "card",
    amount_refunded: 0,
    refund_status: null,
    captured: false,
    description: null,
    card_id: `card_${randomID()}`,
    bank: null,
    wallet: null,
    vpa: null,
    email: "void@razorpay.com",
    contact: "+919999999999",
    notes: [],
    fee: null,
    tax: null,
    ...noFailure,
    acquirer_data: { auth_code: null },
    created_at: now(),
  };
  const record: PaymentRecord = { payment, entry, deliver };
  entry.payments.push(payment);
  payments.set(payment.id, record);
  entry.order.attempts += 1;
  entry.order.status = "attempted";
  const deliveries = transition(record, outcome);
  if (deliver) await postInOrder(deliveries);
  const checkout =
    outcome === "failed"
      ? null
      : {
          razorpay_payment_id: payment.id,
          razorpay_order_id: orderID,
          razorpay_signature: hmac(keySecret, `${orderID}|${payment.id}`),
        };
  return Response.json({ payment, order: entry.order, checkout, deliveries });
}

async function setPaymentStatus(paymentID: string, body: unknown): Promise<Response> {
  const record = payments.get(paymentID);
  if (!record) return stubError(404, `No payment ${paymentID}`);
  if (!isRecord(body)) return stubError(400, "Expected a JSON object");
  const { status, deliver = true } = body;
  if (status !== "authorized" && status !== "captured" && status !== "failed") {
    return stubError(400, "status must be authorized, captured or failed");
  }
  if (typeof deliver !== "boolean") return stubError(400, "deliver must be a boolean");
  const { payment, entry } = record;
  if (payment.status === "captured" || payment.status === status) {
    return stubError(400, `Cannot move a ${payment.status} payment to ${status}`);
  }
  if (status === "captured" && entry.order.status === "paid") {
    return stubError(400, `${entry.order.id} is already paid`);
  }
  record.deliver = deliver;
  const deliveries = transition(record, status);
  if (deliver) await postInOrder(deliveries);
  return Response.json({ payment, order: entry.order, deliveries });
}

function inspectOrder(orderID: string): Response {
  const entry = orders.get(orderID);
  return entry ? Response.json(entry) : stubError(404, `No order ${orderID}`);
}

const checkoutScript = `(() => {
  const origin = ${JSON.stringify(origin)};
  class Razorpay {
    #options;
    #failed = [];
    constructor(options) {
      this.#options = options;
    }
    on(event, callback) {
      if (event === "payment.failed") this.#failed.push(callback);
    }
    open() {
      const options = this.#options;
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", "Razorpay Checkout");
      dialog.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgb(0 0 0 / 0.5)";
      const panel = document.createElement("div");
      panel.style.cssText = "display:grid;gap:12px;min-width:280px;padding:24px;border-radius:8px;background:#fff;color:#000;font:14px system-ui";
      const line = (content) => {
        const element = document.createElement("p");
        element.style.margin = "0";
        element.textContent = content;
        return element;
      };
      const deliver = document.createElement("input");
      deliver.type = "checkbox";
      deliver.checked = true;
      const label = document.createElement("label");
      label.append(deliver, " Deliver webhooks");
      const error = line("");
      error.setAttribute("role", "alert");
      const button = (name, onClick) => {
        const element = document.createElement("button");
        element.type = "button";
        element.textContent = name;
        element.addEventListener("click", onClick);
        return element;
      };
      const pay = async (outcome) => {
        for (const element of buttons) element.disabled = true;
        error.textContent = "";
        let result;
        try {
          const response = await fetch(origin + "/__stub/orders/" + encodeURIComponent(options.order_id) + "/pay", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key: options.key, outcome, deliver: deliver.checked }),
          });
          result = await response.json();
          if (!response.ok) throw new Error(result.error);
        } catch (cause) {
          error.textContent = cause instanceof Error ? cause.message : String(cause);
          return;
        } finally {
          for (const element of buttons) element.disabled = false;
        }
        if (outcome === "failed") {
          const payment = result.payment;
          const response = {
            error: {
              code: payment.error_code,
              description: payment.error_description,
              source: payment.error_source,
              step: payment.error_step,
              reason: payment.error_reason,
              metadata: { order_id: payment.order_id, payment_id: payment.id },
            },
          };
          for (const callback of this.#failed) callback(response);
          return;
        }
        dialog.remove();
        options.handler?.(result.checkout);
      };
      const buttons = [
        button("Pay", () => pay("captured")),
        button("Authorize only", () => pay("authorized")),
        button("Fail payment", () => pay("failed")),
        button("Close", () => {
          dialog.remove();
          options.modal?.ondismiss?.();
        }),
      ];
      panel.append(
        line("Order " + options.order_id),
        line("Amount " + options.amount),
        line("Currency " + options.currency),
        label,
        ...buttons,
        error,
      );
      dialog.append(panel);
      document.body.append(dialog);
    }
  }
  window.Razorpay = Razorpay;
})();
`;

type Route = [
  method: string,
  pattern: RegExp,
  handler: (id: string, body: unknown) => Response | Promise<Response>,
];

const routes: Route[] = [
  ["POST", /^\/v1\/orders$/, createOrder],
  ["GET", /^\/v1\/orders\/([^/]+)$/, fetchOrder],
  ["GET", /^\/v1\/orders\/([^/]+)\/payments$/, fetchOrderPayments],
  ["GET", /^\/v1\/payments\/([^/]+)$/, fetchPayment],
  ["POST", /^\/v1\/payments\/([^/]+)\/capture$/, capturePayment],
  ["POST", /^\/__stub\/orders\/([^/]+)\/pay$/, pay],
  ["POST", /^\/__stub\/payments\/([^/]+)\/status$/, setPaymentStatus],
  ["GET", /^\/__stub\/orders\/([^/]+)$/, inspectOrder],
];

const parse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

async function route(
  method: string,
  path: string,
  auth: string | undefined,
  raw: string,
): Promise<Response> {
  if (method === "GET" && path === "/__stub/health") return new Response("ok");
  if (method === "GET" && path === "/v1/checkout.js") {
    return new Response(checkoutScript, { headers: { "content-type": "application/javascript" } });
  }
  const api = path.startsWith("/v1/");
  if (api && auth !== authorization) {
    return Response.json(
      {
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Authentication failed",
          source: "NA",
          step: "NA",
          reason: "NA",
          metadata: {},
        },
      },
      { status: 401 },
    );
  }
  for (const [routeMethod, pattern, handler] of routes) {
    const match = pattern.exec(path);
    if (match && routeMethod === method) return handler(match[1] ?? "", parse(raw));
  }
  return api
    ? apiError("The requested URL was not found on the server.")
    : stubError(404, "Not found");
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", origin);
  const method = req.method ?? "GET";
  const cors = pathname.startsWith("/__stub/") || pathname === "/v1/checkout.js";
  const response =
    method === "OPTIONS" && cors
      ? new Response(null, { status: 204 })
      : await route(method, pathname, req.headers.authorization, await text(req)).catch(
          (error: unknown) => stubError(500, String(error)),
        );
  const headers = new Headers(response.headers);
  if (cors) {
    headers.set("access-control-allow-origin", "*");
    headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
  }
  res.writeHead(response.status, Object.fromEntries(headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(4890, () => console.log(`Razorpay stub on ${origin}`));

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import { createServer } from "node:http";
import { text } from "node:stream/consumers";

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const authorization = `Basic ${Buffer.from(`${env("MIPS_USERNAME")}:${env("MIPS_PASSWORD")}`).toString("base64")}`;
const authentify = {
  id_merchant: env("MIPS_MERCHANT_ID"),
  id_entity: env("MIPS_ENTITY_ID"),
  id_operator: env("MIPS_OPERATOR_ID"),
  operator_password: env("MIPS_OPERATOR_PASSWORD"),
};
const salt = env("MIPS_SALT");
const cipherKey = env("MIPS_CIPHER_KEY");
const imnURL = `${env("SITE_URL").replace(/\/$/, "")}/api/payments/mips/imn`;
const origin = "http://localhost:4891";

const alphanumerics = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const randomID = () =>
  Array.from({ length: 14 }, () => alphanumerics.charAt(randomInt(alphanumerics.length))).join("");

type Currency = "EUR" | "MUR" | "ZAR" | "GBP" | "USD";
const currencies: readonly Currency[] = ["EUR", "MUR", "ZAR", "GBP", "USD"];
type OrderStatus = "success" | "fail" | "waiting" | "expired";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isCurrency = (value: unknown): value is Currency =>
  currencies.some((currency) => currency === value);
const isAmount = (value: unknown): value is number =>
  typeof value === "number" && value >= 1 && Math.round(value * 100) / 100 === value;
const isOrderStatus = (value: unknown): value is OrderStatus =>
  value === "success" || value === "fail" || value === "waiting" || value === "expired";
const isAuthentic = ({ authentify: given }: Record<string, unknown>) =>
  isRecord(given) && Object.entries(authentify).every(([key, value]) => given[key] === value);

type OrderDetails = {
  id_order: string;
  amount: number;
  currency: Currency;
  order_status: OrderStatus;
  last_transaction_date: string | null;
  order_link: string;
};

type Delivery = {
  id: string;
  event: "imn";
  url: string;
  headers: Record<string, string>;
  body: string;
  response: { status: number; body: string } | null;
};

type Entry = { order: OrderDetails; redirect: string | null; deliveries: Delivery[] };

const orders = new Map<string, Entry>();
const tokens = new Map<string, Entry>();

const key = createHash("sha256").update(`${salt}:${cipherKey}`).digest();

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

function decrypt(crypted: string): string | null {
  const raw = Buffer.from(crypted, "base64");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12), {
      authTagLength: 16,
    });
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function imn(entry: Entry): Delivery {
  const { order } = entry;
  const fields = {
    amount: String(Math.round(order.amount * 100)),
    currency: order.currency,
    status: "success",
    id_order: order.id_order,
    transaction_id: String(randomInt(100_000_000_000, 1_000_000_000_000)),
    type: "card",
    payment_method: "card",
    additional_param: "",
  };
  const { amount, currency, status, ...rest } = fields;
  const callback = {
    amount,
    currency,
    status,
    checksum: createHash("sha256").update(Object.values(fields).join("")).digest("hex"),
    ...rest,
    card_details: {
      masked_card_number: "411111xxxxxx1111",
      expiry_date: "12/30",
      card_brand: "VISA",
    },
  };
  const delivery: Delivery = {
    id: randomID(),
    event: "imn",
    url: imnURL,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      crypted_callback: encrypt(JSON.stringify(callback)),
      id_order: order.id_order,
    }).toString(),
    response: null,
  };
  entry.deliveries.push(delivery);
  return delivery;
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

const fail = (operation_details: string) =>
  Response.json({ operation_status: "fail", operation_details });
const stubError = (status: number, error: string) => Response.json({ error }, { status });

function loadPaymentZone(_: string, body: unknown, raw: string): Response {
  const refuse = (operation_details: string) =>
    Response.json({
      original_message: raw,
      answer: { operation_status: "fail", operation_details },
    });
  if (!isRecord(body) || !isAuthentic(body)) return refuse("Authentication failed");
  const { order, iframe_behavior: behavior = {}, request_mode, touchpoint } = body;
  if (request_mode !== "simple") {
    return refuse(`The stub supports request_mode simple, not ${String(request_mode)}`);
  }
  if (touchpoint !== "web")
    return refuse(`The stub supports touchpoint web, not ${String(touchpoint)}`);
  if (!isRecord(order)) return refuse("order is required");
  const { id_order, currency, amount } = order;
  if (typeof id_order !== "string" || !/^[A-Za-z0-9]{5,25}$/.test(id_order)) {
    return refuse("id_order must be 5 to 25 letters or digits");
  }
  if (!isCurrency(currency)) return refuse(`currency must be one of ${currencies.join(", ")}`);
  if (!isAmount(amount))
    return refuse("amount must be a number of at least 1 with at most 2 decimals");
  if (!isRecord(behavior)) return refuse("iframe_behavior must be an object");
  const { custom_redirection_url: redirect, language, height = 508, width = 450 } = behavior;
  if (redirect !== undefined && (typeof redirect !== "string" || !/^https?:\/\//.test(redirect))) {
    return refuse("custom_redirection_url must start with http:// or https://");
  }
  if (language !== undefined && language !== "EN" && language !== "FR") {
    return refuse("language must be EN or FR");
  }
  if (typeof height !== "number" || !Number.isInteger(height))
    return refuse("height must be an integer");
  if (typeof width !== "number" || !Number.isInteger(width))
    return refuse("width must be an integer");
  if (orders.has(id_order)) return refuse(`id_order ${id_order} already exists`);

  const token = randomBytes(24).toString("base64url");
  const link = `${origin}/mipsit.php?c=${token}&smid=${authentify.id_merchant}`;
  const entry: Entry = {
    order: {
      id_order,
      amount,
      currency,
      order_status: "waiting",
      last_transaction_date: null,
      order_link: link,
    },
    redirect: typeof redirect === "string" ? redirect : null,
    deliveries: [],
  };
  orders.set(id_order, entry);
  tokens.set(token, entry);
  return Response.json({
    original_message: raw,
    answer: {
      operation_status: "success",
      payment_zone_data:
        `<script type="text/javascript" src="${origin}/gomips.js"></script>` +
        `<iframe title="mIPS payment" style="width:${width}px!important;height:${height}px!important;" width="${width}px" height="${height}px" frameborder="no" scrolling="0" src="${link}"></iframe>`,
    },
  });
}

function decryptIMN(_: string, body: unknown): Response {
  if (!isRecord(body) || !isAuthentic(body)) return fail("Authentication failed");
  const { received_crypted_data: crypted } = body;
  const plain =
    body.salt === salt && body.cipher_key === cipherKey && typeof crypted === "string"
      ? decrypt(crypted)
      : null;
  if (plain === null) return fail("Unable to decrypt the data");
  return new Response(plain, { headers: { "content-type": "application/json" } });
}

function ordersManagement(_: string, body: unknown): Response {
  if (!isRecord(body) || !isAuthentic(body)) return fail("Authentication failed");
  if (body.instruction !== "get_order_all_data") {
    return fail(`The stub does not support instruction ${String(body.instruction)}`);
  }
  const id = isRecord(body.order) ? body.order.id_order : undefined;
  const entry = typeof id === "string" ? orders.get(id) : undefined;
  if (!entry) return fail("Order not found");
  return Response.json({ orders: [entry.order], operation_status: "success" });
}

async function pay(id: string, body: unknown): Promise<Response> {
  const entry = orders.get(id);
  if (!entry) return stubError(404, `No order ${id}`);
  if (!isRecord(body)) return stubError(400, "Expected a JSON object");
  const {
    outcome,
    amount = entry.order.amount,
    currency = entry.order.currency,
    deliver = true,
  } = body;
  if (outcome !== "success" && outcome !== "fail")
    return stubError(400, "outcome must be success or fail");
  if (!isAmount(amount))
    return stubError(400, "amount must be a number of at least 1 with at most 2 decimals");
  if (!isCurrency(currency))
    return stubError(400, `currency must be one of ${currencies.join(", ")}`);
  if (typeof deliver !== "boolean") return stubError(400, "deliver must be a boolean");
  if (entry.order.order_status === "success") return stubError(400, `Order ${id} is already paid`);
  entry.order.amount = amount;
  entry.order.currency = currency;
  entry.order.order_status = outcome;
  entry.order.last_transaction_date = new Date().toISOString().replace("T", " ").slice(0, 19);
  if (outcome === "fail") return Response.json({ order: entry.order, delivery: null });
  const delivery = imn(entry);
  if (deliver) await post(delivery);
  return Response.json({ order: entry.order, delivery });
}

function setOrderStatus(id: string, body: unknown): Response {
  const entry = orders.get(id);
  if (!entry) return stubError(404, `No order ${id}`);
  const status = isRecord(body) ? body.order_status : undefined;
  if (!isOrderStatus(status))
    return stubError(400, "order_status must be waiting, expired, fail or success");
  entry.order.order_status = status;
  return Response.json({ order: entry.order });
}

function inspectOrder(id: string): Response {
  const entry = orders.get(id);
  return entry
    ? Response.json({ order: entry.order, deliveries: entry.deliveries })
    : stubError(404, `No order ${id}`);
}

const gomips = `window.addEventListener("message", (event) => {
  if (event.origin !== ${JSON.stringify(origin)}) return;
  const data = event.data;
  if (data && data.type === "mips:redirect" && typeof data.url === "string") window.location.assign(data.url);
});
`;

function paymentPage(token: string | null): Response {
  const entry = token ? tokens.get(token) : undefined;
  if (!entry) return new Response("Unknown payment zone", { status: 404 });
  const { order, redirect } = entry;
  const config = JSON.stringify({ id: order.id_order, redirect }).replaceAll("<", "\\u003c");
  return new Response(
    `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>mIPS payment</title>
<body style="margin:16px;font:14px system-ui">
<p>Amount ${order.amount.toFixed(2)} ${order.currency}</p>
<p><label><input type="checkbox" checked> Send IMN</label></p>
<p><button type="button" data-outcome="success">Pay</button> <button type="button" data-outcome="fail">Decline</button></p>
<p role="status"></p>
<script type="module">
const { id, redirect } = ${config};
const message = document.querySelector("[role=status]");
const imn = document.querySelector("input");
const buttons = document.querySelectorAll("button");
for (const button of buttons) {
  button.addEventListener("click", async () => {
    const outcome = button.dataset.outcome;
    for (const element of buttons) element.disabled = true;
    message.textContent = "";
    try {
      const response = await fetch("/__stub/orders/" + id + "/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome, deliver: imn.checked }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : String(error);
      for (const element of buttons) element.disabled = false;
      return;
    }
    if (outcome === "fail") {
      message.textContent = "Payment failed. Try again.";
      for (const element of buttons) element.disabled = false;
      return;
    }
    message.textContent = "Payment successful";
    if (redirect) window.parent.postMessage({ type: "mips:redirect", url: redirect }, "*");
  });
}
</script>
`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

type Route = [
  method: string,
  pattern: RegExp,
  handler: (id: string, body: unknown, raw: string) => Response | Promise<Response>,
];

const routes: Route[] = [
  ["POST", /^\/api\/load_payment_zone$/, loadPaymentZone],
  ["POST", /^\/api\/decrypt_imn_data$/, decryptIMN],
  ["POST", /^\/api\/orders_management$/, ordersManagement],
  ["POST", /^\/__stub\/orders\/([^/]+)\/pay$/, pay],
  ["POST", /^\/__stub\/orders\/([^/]+)\/status$/, setOrderStatus],
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
  url: URL,
  auth: string | undefined,
  raw: string,
): Promise<Response> {
  const path = url.pathname;
  if (method === "GET" && path === "/__stub/health") return new Response("ok");
  if (method === "GET" && path === "/gomips.js") {
    return new Response(gomips, { headers: { "content-type": "application/javascript" } });
  }
  if (method === "GET" && path === "/mipsit.php") return paymentPage(url.searchParams.get("c"));
  if (path.startsWith("/api/") && auth !== authorization) {
    return Response.json(
      { operation_status: "fail", operation_details: "Unauthorized" },
      { status: 401, headers: { "www-authenticate": 'Basic realm="MiPS"' } },
    );
  }
  for (const [routeMethod, pattern, handler] of routes) {
    const match = pattern.exec(path);
    if (match && routeMethod === method) return handler(match[1] ?? "", parse(raw), raw);
  }
  return stubError(404, "Not found");
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", origin);
  const method = req.method ?? "GET";
  const cors = url.pathname.startsWith("/__stub/");
  const response =
    method === "OPTIONS" && cors
      ? new Response(null, { status: 204 })
      : await route(method, url, req.headers.authorization, await text(req)).catch(
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
}).listen(4891, () => console.log(`mIPS stub on ${origin}`));

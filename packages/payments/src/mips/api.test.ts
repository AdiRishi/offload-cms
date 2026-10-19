import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";

import { mipsAPI, toMajorUnits } from "./api.ts";

const credentials = {
  username: "mips-user",
  password: "mips-pass",
  merchantID: "q7r79YV13XjisGDnGgRw7pVMGSagfRzx",
  entityID: "Dem1091uOLSIVQPnLYuVTtmkfGppLo0t",
  operatorID: "w8kvu7ShJrbRnVy54CjGpakWGj6H5zJy",
  operatorPassword: "G2JvCxTo2LJpZC3a9zNN9LlCdzjwf9X0",
  salt: "salt-from-mips",
  cipherKey: "cipher-key-from-mips",
};
const authentify = {
  id_merchant: "q7r79YV13XjisGDnGgRw7pVMGSagfRzx",
  id_entity: "Dem1091uOLSIVQPnLYuVTtmkfGppLo0t",
  id_operator: "w8kvu7ShJrbRnVy54CjGpakWGj6H5zJy",
  operator_password: "G2JvCxTo2LJpZC3a9zNN9LlCdzjwf9X0",
};
const reference = "Ab3dE5gH7jK9mN1pQ3sT";

let answer = { status: 200, body: "{}" };
let received = { path: "", authorization: "", body: "" };
const server = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  received = { path: request.url ?? "", authorization: request.headers.authorization ?? "", body };
  response.writeHead(answer.status, { "content-type": "application/json" }).end(answer.body);
});
const respond = (body: object, status = 200) => {
  answer = { status, body: JSON.stringify(body) };
};

let api: ReturnType<typeof mipsAPI>;
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  api = mipsAPI({ apiURL: `http://127.0.0.1:${address.port}/api`, credentials });
});
after(() => server.close());

test("sends amounts in decimal major units of the currency's configured decimals", () => {
  assert.equal(JSON.stringify(toMajorUnits(1999, 2)), "19.99");
  assert.equal(JSON.stringify(toMajorUnits(100, 2)), "1");
  assert.equal(JSON.stringify(toMajorUnits(1, 2)), "0.01");
  assert.equal(JSON.stringify(toMajorUnits(123456789, 2)), "1234567.89");
  assert.equal(JSON.stringify(toMajorUnits(1999, 0)), "1999");
});

test("loads a payment zone with the documented request and returns its HTML", async () => {
  respond({ answer: { operation_status: "success", payment_zone_data: "<iframe></iframe>" } });
  const html = await api.loadPaymentZone({
    amount: 1999,
    currency: "MUR",
    decimals: 2,
    redirectURL: `https://shop.example/checkout/confirm?reference=${reference}`,
    reference,
  });

  assert.equal(html, "<iframe></iframe>");
  assert.equal(received.path, "/api/load_payment_zone");
  assert.equal(received.authorization, "Basic bWlwcy11c2VyOm1pcHMtcGFzcw==");
  assert.deepEqual(JSON.parse(received.body), {
    authentify,
    order: { id_order: reference, currency: "MUR", amount: 19.99 },
    iframe_behavior: {
      custom_redirection_url: `https://shop.example/checkout/confirm?reference=${reference}`,
      language: "EN",
    },
    request_mode: "simple",
    touchpoint: "web",
  });
});

test("sends a whole amount for a currency configured without decimals", async () => {
  respond({ answer: { operation_status: "success", payment_zone_data: "<iframe></iframe>" } });
  await api.loadPaymentZone({
    amount: 1999,
    currency: "MUR",
    decimals: 0,
    redirectURL: "https://shop.example/checkout/confirm",
    reference,
  });
  assert.match(
    received.body,
    /"order":\{"id_order":"Ab3dE5gH7jK9mN1pQ3sT","currency":"MUR","amount":1999\}/,
  );
});

test("fails when mIPS refuses to load a payment zone", async () => {
  respond({ answer: { operation_status: "fail" } });
  await assert.rejects(
    api.loadPaymentZone({
      amount: 1999,
      currency: "MUR",
      decimals: 2,
      redirectURL: "https://x.example",
      reference,
    }),
  );
});

test("asks for an order with get_order_all_data", async () => {
  const order = { id_order: reference, amount: 19.99, currency: "MUR", order_status: "success" };
  respond({ operation_status: "success", orders: [order] });

  const result = await api.getOrder({ amount: 1999, currency: "MUR", decimals: 2, reference });

  assert.deepEqual(result, { operation_status: "success", orders: [order] });
  assert.equal(received.path, "/api/orders_management");
  assert.deepEqual(JSON.parse(received.body), {
    authentify,
    instruction: "get_order_all_data",
    order: { id_order: reference, currency: "MUR", amount: 19.99 },
  });
});

test("reads an answer whose lookup failed, without the order", async () => {
  respond({ operation_status: "fail", operation_details: "Order not found" });
  const result = await api.getOrder({ amount: 1999, currency: "MUR", decimals: 2, reference });
  assert.deepEqual(result, { operation_status: "fail", operation_details: "Order not found" });
});

test("cancels an order with cancel_order", async () => {
  respond({ operation_status: "success" });

  const result = await api.cancelOrder({ amount: 1999, currency: "MUR", decimals: 2, reference });

  assert.deepEqual(result, { operation_status: "success" });
  assert.equal(received.path, "/api/orders_management");
  assert.deepEqual(JSON.parse(received.body), {
    authentify,
    instruction: "cancel_order",
    order: { id_order: reference, currency: "MUR", amount: 19.99 },
  });
});

const decrypted = {
  amount: "1999",
  currency: "MUR",
  status: "success",
  id_order: reference,
  transaction_id: "8812",
  payment_method: "card",
  card_details: { masked_card_number: "512345xxxxxx0008", expiry_date: "06/30" },
};

test("returns the notification mIPS decrypted, without its card details", async () => {
  respond(decrypted);

  const result = await api.decryptNotification("crypted+/data==");

  assert.deepEqual(result, {
    result: "decrypted",
    notification: { id_order: reference, payment_method: "card" },
  });
  assert.equal(received.path, "/api/decrypt_imn_data");
  assert.deepEqual(JSON.parse(received.body), {
    authentify,
    salt: "salt-from-mips",
    cipher_key: "cipher-key-from-mips",
    received_crypted_data: "crypted+/data==",
  });
});

test("reads a decrypted notification wrapped in data", async () => {
  respond({ status: "success", data: decrypted });
  assert.deepEqual(await api.decryptNotification("crypted"), {
    result: "decrypted",
    notification: { id_order: reference, payment_method: "card" },
  });
});

test("treats a notification mIPS says it can't decrypt as refused", async () => {
  respond({ operation_status: "fail", operation_details: "Decryption failed" });
  assert.deepEqual(await api.decryptNotification("forged"), { result: "refused" });
  respond({ status: "fail", message: "Invalid data" });
  assert.deepEqual(await api.decryptNotification("forged"), { result: "refused" });
});

const failsAfter = async (body: object, status: number) => {
  respond(body, status);
  await assert.rejects(api.decryptNotification("crypted"), Error, String(status));
};

test("fails, so that mIPS retries, when decryption errs without refusing", async () => {
  await failsAfter({ status: "fail" }, 400);
  await failsAfter({ status: "fail" }, 401);
  await failsAfter({ status: "fail" }, 429);
  await failsAfter({}, 502);
  await failsAfter({ result: "ok" }, 200);
});

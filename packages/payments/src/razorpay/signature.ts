const encoder = new TextEncoder();

const sha256Hex = /^[0-9a-f]{64}$/i;

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const verifyHmacSha256 = async (secret: string, message: string, signature: string) => {
  if (!sha256Hex.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, hexToBytes(signature), encoder.encode(message));
};

/**
 * Checks the `razorpay_signature` that Checkout returns for a payment: the hex HMAC-SHA256 of
 * `orderID|paymentID`, keyed with the key secret. Pass the order ID the transaction stores, not
 * the one Checkout returns.
 */
export const verifyPaymentSignature = ({
  keySecret,
  orderID,
  paymentID,
  signature,
}: {
  keySecret: string;
  orderID: string;
  paymentID: string;
  signature: string;
}) => verifyHmacSha256(keySecret, `${orderID}|${paymentID}`, signature);

/**
 * Checks a webhook's `X-Razorpay-Signature`: the hex HMAC-SHA256 of the raw request body, keyed
 * with the webhook secret.
 */
export const verifyWebhookSignature = ({
  body,
  signature,
  webhookSecret,
}: {
  body: string;
  signature: string;
  webhookSecret: string;
}) => verifyHmacSha256(webhookSecret, body, signature);

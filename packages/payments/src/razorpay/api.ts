import { z } from "zod";

const paymentSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  order_id: z.string().nullish(),
  created_at: z.number().int(),
});

export type RazorpayPayment = z.infer<typeof paymentSchema>;

/** The body of `GET /v1/orders/:id/payments`. */
export const orderPaymentsSchema = z.object({ items: z.array(paymentSchema) });

const orderSchema = z.object({ id: z.string() });

/**
 * The payment of a Razorpay order to settle: a captured one, otherwise an authorized one, which
 * must be captured first. Payments of other orders don't count.
 */
export const paymentToSettle = (payments: RazorpayPayment[], orderID: string) => {
  const ofOrder = payments.filter((payment) => payment.order_id === orderID);
  return (
    ofOrder.find((payment) => payment.status === "captured") ??
    ofOrder.find((payment) => payment.status === "authorized")
  );
};

const hour = 60 * 60 * 1000;

/** How long Checkout lets the customer start a payment, in seconds. */
export const checkoutTimeoutSeconds = 15 * 60;

/**
 * Whether reconciliation may expire a pending transaction that no payment settled, at `now`, in
 * milliseconds since the epoch. With no payment attempt, Checkout's timeout stops any from
 * starting, so the transaction can expire an hour after it. Razorpay can late-authorise a payment
 * for 3 days after the attempt starts, so with attempts the window runs 3 days and an hour from
 * the last one.
 */
export const mayExpire = ({
  createdAt,
  now,
  payments,
}: {
  createdAt: number;
  now: number;
  payments: RazorpayPayment[];
}) =>
  payments.length === 0
    ? now > createdAt + checkoutTimeoutSeconds * 1000 + hour
    : now >
      Math.max(...payments.map((payment) => payment.created_at * 1000)) + 3 * 24 * hour + hour;

/**
 * Whether Razorpay takes amounts of `currency` in units of `10 ** decimals`. Razorpay takes the
 * smallest unit of the ISO 4217 currency, so the configured decimals must be its exponent.
 */
export const takesDecimals = (currency: string, decimals: number) =>
  new Intl.NumberFormat("en", { currency, style: "currency" }).resolvedOptions()
    .maximumFractionDigits === decimals;

/** Razorpay answered with an error status. */
export class RazorpayAPIError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The Razorpay API calls the adapter makes, authenticated with the key ID and secret. */
export const razorpayAPI = ({
  apiURL,
  keyID,
  keySecret,
}: {
  apiURL: string;
  keyID: string;
  keySecret: string;
}) => {
  const authorization = `Basic ${btoa(`${keyID}:${keySecret}`)}`;

  const request = async <TSchema extends z.ZodType>(
    schema: TSchema,
    path: string,
    body?: object,
  ): Promise<z.infer<TSchema>> => {
    const response = await fetch(`${apiURL}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { authorization, "content-type": "application/json" } : { authorization },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new RazorpayAPIError(
        response.status,
        `Razorpay answered ${path} with ${response.status}: ${await response.text()}`,
      );
    }
    return schema.parse(await response.json());
  };

  return {
    createOrder: (order: {
      amount: number;
      currency: string;
      receipt: string;
      notes: Record<string, string>;
    }) => request(orderSchema, "/v1/orders", order),
    fetchPayment: (paymentID: string) =>
      request(paymentSchema, `/v1/payments/${encodeURIComponent(paymentID)}`),
    fetchOrderPayments: async (orderID: string) =>
      (await request(orderPaymentsSchema, `/v1/orders/${encodeURIComponent(orderID)}/payments`))
        .items,
    capturePayment: (paymentID: string, capture: { amount: number; currency: string }) =>
      request(paymentSchema, `/v1/payments/${encodeURIComponent(paymentID)}/capture`, capture),
  };
};

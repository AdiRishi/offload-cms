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

/**
 * When no payment of an order can still be authorised, in milliseconds since the epoch. Razorpay
 * can late-authorise a payment for 3 days after the payment starts, so the window runs 3 days and
 * an hour from the last attempt, or from `since` when there is none.
 */
export const paymentWindowEnd = (payments: RazorpayPayment[], since: number) =>
  Math.max(since, ...payments.map((payment) => payment.created_at * 1000)) + 3 * 24 * hour + hour;

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
    });
    if (!response.ok) {
      throw new Error(
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

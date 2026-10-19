import { z } from "zod";

const webhookEventSchema = z.object({
  event: z.string(),
  payload: z.object({
    order: z.object({ entity: z.object({ id: z.string() }) }).optional(),
    payment: z
      .object({
        entity: z.object({
          id: z.string(),
          order_id: z.string().nullish(),
          error_code: z.string().nullish(),
          error_description: z.string().nullish(),
        }),
      })
      .optional(),
  }),
});

/**
 * What a verified webhook asks the adapter to do. `paid` asks it to look up the order's payments
 * and settle. `failed` asks it to record the payment's error and leave the transaction pending,
 * because Razorpay can still capture the payment.
 */
export type WebhookEvent =
  | { kind: "paid"; orderID: string }
  | { kind: "failed"; orderID: string; paymentID: string; error: string }
  | { kind: "ignored" };

const paidEvents = new Set(["payment.authorized", "payment.captured", "order.paid"]);

/** Reads a webhook body. Returns `undefined` when the body is not a Razorpay event. */
export const parseWebhookEvent = (body: string): WebhookEvent | undefined => {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return undefined;
  }
  const parsed = webhookEventSchema.safeParse(json);
  if (!parsed.success) return undefined;

  const { event, payload } = parsed.data;
  const orderID = payload.payment?.entity.order_id ?? payload.order?.entity.id;
  if (!orderID) return { kind: "ignored" };
  if (paidEvents.has(event)) return { kind: "paid", orderID };
  if (event === "payment.failed" && payload.payment) {
    const { error_code, error_description, id } = payload.payment.entity;
    const reason = error_description || error_code || "Razorpay gave no reason";
    return { kind: "failed", orderID, paymentID: id, error: `Payment ${id} failed: ${reason}` };
  }
  return { kind: "ignored" };
};

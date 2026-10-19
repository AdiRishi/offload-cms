"use client";

import { useCart, usePayments } from "@payloadcms/plugin-ecommerce/client/react";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type HandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type CheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  /** Seconds after which Checkout stops taking the payment. */
  timeout: number;
  name?: string;
  prefill: { email?: string };
  handler: (response: HandlerResponse) => void;
  modal: { ondismiss: () => void };
};

type Checkout = {
  open: () => void;
  on: (
    event: "payment.failed",
    callback: (response: { error: { description: string } }) => void,
  ) => void;
};

type CheckoutConstructor = new (options: CheckoutOptions) => Checkout;

declare global {
  interface Window {
    Razorpay?: CheckoutConstructor;
  }
}

const initiated = z.object({
  keyID: z.string(),
  orderID: z.string(),
  amount: z.number(),
  currency: z.string(),
  timeout: z.number(),
});

const confirmed = z.object({ orderID: z.union([z.string(), z.number()]) });

export type ConfirmedOrder = z.infer<typeof confirmed>;

const refusal = z.object({ message: z.string() });

/** The plugin's provider throws the endpoint's response text, whose message is for the customer. */
const messageOf = (error: unknown) => {
  try {
    return error instanceof Error ? refusal.parse(JSON.parse(error.message)).message : undefined;
  } catch {
    return undefined;
  }
};

/** The waits before each confirmation attempt: six attempts over about 20 seconds. */
const retryDelays = [0, 1000, 2000, 4000, 6000, 7000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `attempt` after each delay until it succeeds. Resolves undefined if it never does. */
const withRetries = async <T,>(
  attempt: () => Promise<T>,
  delays = retryDelays,
): Promise<T | undefined> => {
  const [delay, ...later] = delays;
  if (delay === undefined) return undefined;
  await sleep(delay);
  try {
    return await attempt();
  } catch {
    return withRetries(attempt, later);
  }
};

let script: Promise<CheckoutConstructor> | undefined;

const loadCheckout = () => {
  script ??= new Promise<CheckoutConstructor>((resolve, reject) => {
    const element = document.createElement("script");
    element.src = "https://checkout.razorpay.com/v1/checkout.js";
    element.addEventListener("load", () =>
      window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Checkout did not load.")),
    );
    element.addEventListener("error", () => {
      element.remove();
      reject(new Error("Checkout did not load."));
    });
    document.head.appendChild(element);
  }).catch((error: unknown) => {
    // Let the next click try again instead of reusing the failure.
    script = undefined;
    throw error;
  });
  return script;
};

type Phase = "idle" | "starting" | "open" | "confirming" | "unconfirmed";

/**
 * Pays for the cart with Razorpay Standard Checkout. The button loads Checkout, creates a
 * Razorpay order for the cart, opens Checkout, and confirms the order with the payment that
 * Checkout returns. Pass `customerEmail` for a guest. A logged-in customer's order uses their
 * account's email.
 *
 * Once Checkout reports a payment, the customer can't pay again. The confirmation retries for
 * about 20 seconds, because the webhook may be settling the same payment. If every attempt fails,
 * the webhook still settles a paid order.
 */
export function RazorpayCheckout({
  customerEmail,
  name,
  disabled,
  onConfirmed,
}: {
  customerEmail?: string;
  name?: string;
  disabled?: boolean;
  onConfirmed: (order: ConfirmedOrder) => void;
}) {
  const { confirmOrder, initiatePayment } = usePayments();
  const { refreshCart } = useCart();
  const [phase, setPhase] = useState<Phase>("idle");
  const [problem, setProblem] = useState<string>();

  const confirm = async (response: HandlerResponse) => {
    setPhase("confirming");
    setProblem(undefined);
    // Confirming is idempotent, so retrying while another request settles the payment is safe.
    const result = await withRetries(() =>
      confirmOrder("razorpay", { additionalData: { ...response, customerEmail } }),
    );
    if (result === undefined) setPhase("unconfirmed");
    else onConfirmed(confirmed.parse(result));
  };

  const pay = async () => {
    setPhase("starting");
    setProblem(undefined);
    try {
      const [Razorpay, order] = await Promise.all([
        loadCheckout(),
        initiatePayment("razorpay", { additionalData: { customerEmail } }).then((result) =>
          initiated.parse(result),
        ),
      ]);
      const checkout = new Razorpay({
        key: order.keyID,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderID,
        timeout: order.timeout,
        name,
        prefill: { email: customerEmail },
        handler: (response) => void confirm(response),
        modal: { ondismiss: () => setPhase((current) => (current === "open" ? "idle" : current)) },
      });
      checkout.on("payment.failed", (response) => setProblem(response.error.description));
      checkout.open();
      setPhase("open");
    } catch (error) {
      // A refused start can mean the prices changed. The cart then holds the new total.
      await refreshCart();
      setProblem(messageOf(error) ?? "We could not start the payment. Please try again.");
      setPhase("idle");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" disabled={disabled || phase !== "idle"} onClick={() => void pay()}>
        {phase === "starting" ? <Spinner /> : null}
        Pay with Razorpay
      </Button>
      {phase === "confirming" ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Spinner />
          Confirming your payment
        </p>
      ) : null}
      {phase === "unconfirmed" ? (
        <p role="status" className="text-sm">
          Your payment was received. We'll confirm your order shortly. Don't pay again.
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

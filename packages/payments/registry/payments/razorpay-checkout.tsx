"use client";

import { usePayments } from "@payloadcms/plugin-ecommerce/client/react";
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
});

const confirmed = z.object({ orderID: z.union([z.string(), z.number()]) });

export type ConfirmedOrder = z.infer<typeof confirmed>;

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

/**
 * Pays for the cart with Razorpay Standard Checkout. The button loads Checkout, creates a
 * Razorpay order for the cart, opens Checkout, and confirms the order with the payment that
 * Checkout returns. Pass `customerEmail` for a guest. A logged-in customer's order uses their
 * account's email.
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
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  const confirm = async (response: HandlerResponse) => {
    try {
      const result = await confirmOrder("razorpay", {
        additionalData: { ...response, customerEmail },
      });
      onConfirmed(confirmed.parse(result));
    } catch {
      setProblem(
        "We could not confirm your payment. If you were charged, we will confirm your order shortly.",
      );
      setBusy(false);
    }
  };

  const pay = async () => {
    setBusy(true);
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
        name,
        prefill: { email: customerEmail },
        handler: (response) => void confirm(response),
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", (response) => setProblem(response.error.description));
      checkout.open();
    } catch {
      setProblem("We could not start the payment. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" disabled={disabled || busy} onClick={() => void pay()}>
        {busy ? <Spinner /> : null}
        Pay with Razorpay
      </Button>
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

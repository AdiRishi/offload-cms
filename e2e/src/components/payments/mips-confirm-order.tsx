"use client";

import { useCart, usePayments } from "@payloadcms/plugin-ecommerce/client/react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { mipsCustomerEmailKey } from "@/components/payments/mips-payment-zone";
import { Spinner } from "@/components/ui/spinner";

const confirmed = z.object({ orderID: z.union([z.string(), z.number()]) });

export type ConfirmedOrder = z.infer<typeof confirmed>;

/** The waits before each confirmation attempt: six attempts over about 20 seconds. */
const retryDelays = [0, 1000, 2000, 4000, 6000, 7000];

/** How long to wait for the cart before leaving the order to mIPS's notification. */
const cartTimeoutMs = 5000;

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

type State = "confirming" | "delayed" | "unknown";

/**
 * Confirms an mIPS payment on the page that mIPS sends the customer back to, with the
 * `reference` from its query string. The order is for the cart this browser holds, so it waits
 * for the cart to load. The confirmation retries for about 20 seconds, because mIPS's payment
 * notification may be settling the same payment. Whatever happens here, the notification still
 * settles a paid order, so the customer is told to wait for the email.
 */
export function MipsConfirmOrder({
  reference,
  onConfirmed,
}: {
  reference: string;
  onConfirmed: (order: ConfirmedOrder) => void;
}) {
  const { cart } = useCart();
  const { confirmOrder } = usePayments();
  const [state, setState] = useState<State>("confirming");
  const started = useRef(false);
  const hasCart = cart !== undefined;

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!started.current) setState("delayed");
    }, cartTimeoutMs);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hasCart || started.current) return;
    started.current = true;
    // A guest's email lives in this tab. Without it, only a logged-in customer can confirm, so
    // a failure means this browser can't, and retrying won't change that.
    const customerEmail = sessionStorage.getItem(mipsCustomerEmailKey(reference)) ?? undefined;
    void withRetries(
      () => confirmOrder("mips", { additionalData: { customerEmail, reference } }),
      customerEmail === undefined ? [0] : undefined,
    ).then((result) => {
      if (result !== undefined) onConfirmed(confirmed.parse(result));
      else setState(customerEmail === undefined ? "unknown" : "delayed");
    });
  }, [hasCart, confirmOrder, onConfirmed, reference]);

  if (state === "delayed") {
    return (
      <p role="status" className="text-sm">
        We're still confirming your payment. If it went through, we'll email you when your order is
        confirmed. Don't pay again.
      </p>
    );
  }
  if (state === "unknown") {
    return (
      <p role="status" className="text-sm">
        This browser doesn't have your checkout details, so we can't confirm the order here. If your
        payment went through, we'll email you when your order is confirmed. Don't pay again.
      </p>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 text-sm">
      <Spinner />
      Confirming your payment
    </p>
  );
}

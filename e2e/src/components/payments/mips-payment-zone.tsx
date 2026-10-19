"use client";

import { usePayments } from "@payloadcms/plugin-ecommerce/client/react";
import { useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const initiated = z.object({ reference: z.string(), paymentZone: z.string() });

/**
 * Where the payment zone keeps a guest's email for the return page, which confirms the order
 * after mIPS sends the customer back. The tab keeps it until it closes.
 */
export const mipsCustomerEmailKey = (reference: string) => `mips:${reference}:customerEmail`;

/**
 * Pays for the cart with mIPS. The button creates an mIPS order for the cart and shows mIPS's
 * payment zone, an iframe and a script that the page must run. After a successful payment,
 * mIPS sends the customer to the adapter's `returnURL`. Pass `customerEmail` for a guest. A
 * logged-in customer's order uses their account's email.
 */
export function MipsPaymentZone({
  customerEmail,
  disabled,
}: {
  customerEmail?: string;
  disabled?: boolean;
}) {
  const { initiatePayment } = usePayments();
  const zone = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "shown">("idle");
  const [problem, setProblem] = useState<string>();

  const start = async () => {
    setState("loading");
    setProblem(undefined);
    try {
      const { reference, paymentZone } = initiated.parse(
        await initiatePayment("mips", { additionalData: { customerEmail } }),
      );
      if (customerEmail) sessionStorage.setItem(mipsCustomerEmailKey(reference), customerEmail);
      if (!zone.current) return;
      // innerHTML never runs scripts. A contextual fragment's scripts run once it is inserted.
      const range = document.createRange();
      range.selectNodeContents(zone.current);
      zone.current.replaceChildren(range.createContextualFragment(paymentZone));
      setState("shown");
    } catch {
      setProblem("We could not start the payment. Please try again.");
      setState("idle");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {state === "shown" ? null : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled || state === "loading"}
          onClick={() => void start()}
        >
          {state === "loading" ? <Spinner /> : null}
          Pay by card with mIPS
        </Button>
      )}
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <div ref={zone} />
    </div>
  );
}

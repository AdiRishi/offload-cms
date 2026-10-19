"use client";

import { useCart, usePayments } from "@payloadcms/plugin-ecommerce/client/react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { mipsCustomerEmailKey } from "@/components/payments/mips-payment-zone";
import { Spinner } from "@/components/ui/spinner";

const confirmed = z.object({ orderID: z.union([z.string(), z.number()]) });

export type ConfirmedOrder = z.infer<typeof confirmed>;

/**
 * Confirms an mIPS payment on the page that mIPS sends the customer back to, with the
 * `reference` from its query string. It waits for the cart to load, because the order is for that
 * cart. If the confirmation fails, mIPS's payment notification still confirms a paid order.
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
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!cart || started.current) return;
    started.current = true;
    const customerEmail = sessionStorage.getItem(mipsCustomerEmailKey(reference)) ?? undefined;
    confirmOrder("mips", { additionalData: { customerEmail, reference } }).then(
      (result) => onConfirmed(confirmed.parse(result)),
      () => setFailed(true),
    );
  }, [cart, confirmOrder, onConfirmed, reference]);

  if (failed) {
    return (
      <p role="alert" className="text-sm text-destructive">
        We could not confirm your payment yet. If you paid, we will confirm your order shortly.
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

import { useCart, useCurrency, useEcommerce } from "@payloadcms/plugin-ecommerce/client/react";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useState } from "react";

import { MipsPaymentZone } from "@/components/payments/mips-payment-zone";
import { type ConfirmedOrder, RazorpayCheckout } from "@/components/payments/razorpay-checkout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const mipsOrigins: string[] = [import.meta.env.VITE_MIPS_ORIGIN];

export const Route = createFileRoute("/_frontend/_shop/checkout/")({
  component: CheckoutPage,
});

const titleOf = (relation: unknown) =>
  typeof relation === "object" && relation !== null && "title" in relation
    ? String(relation.title)
    : "";

function CheckoutPage() {
  const hydrated = useHydrated();
  const { user } = useEcommerce();
  const { cart } = useCart();
  const { formatCurrency } = useCurrency();
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<ConfirmedOrder>();
  const items = cart?.items ?? [];
  // A logged-in customer pays as their account. A guest gives an email for the order.
  const customerEmail = user ? undefined : email;
  const ready = items.length > 0 && (user !== null || /^\S+@\S+\.\S+$/.test(email));

  if (order) {
    return (
      <main className="mx-auto my-16 flex max-w-2xl flex-col gap-6 px-4">
        <h1 className="text-3xl font-semibold">Thank you</h1>
        <p role="status">Order {order.orderID} is confirmed.</p>
      </main>
    );
  }

  return (
    <main
      data-hydrated={hydrated || undefined}
      className="mx-auto my-16 flex max-w-2xl flex-col gap-6 px-4"
    >
      <h1 className="text-3xl font-semibold">Checkout</h1>
      <ul aria-label="Cart" className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            {item.quantity} × {titleOf(item.variant) || titleOf(item.product)}
          </li>
        ))}
      </ul>
      <p>Total {formatCurrency(cart?.subtotal)}</p>
      {user ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      )}
      <RazorpayCheckout
        customerEmail={customerEmail}
        disabled={!ready}
        name="Offload e2e"
        onConfirmed={setOrder}
      />
      <MipsPaymentZone customerEmail={customerEmail} disabled={!ready} origins={mipsOrigins} />
    </main>
  );
}

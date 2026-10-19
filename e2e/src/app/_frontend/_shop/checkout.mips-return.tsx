import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useState } from "react";

import { type ConfirmedOrder, MipsConfirmOrder } from "@/components/payments/mips-confirm-order";

/** Where mIPS sends the customer after a payment, at mipsAdapter()'s `returnURL`. */
export const Route = createFileRoute("/_frontend/_shop/checkout/mips-return")({
  validateSearch: (search: Record<string, unknown>): { reference: string } => ({
    reference: typeof search.reference === "string" ? search.reference : "",
  }),
  component: MipsReturnPage,
});

function MipsReturnPage() {
  const { reference } = Route.useSearch();
  const hydrated = useHydrated();
  const [order, setOrder] = useState<ConfirmedOrder>();

  return (
    <main
      data-hydrated={hydrated || undefined}
      className="mx-auto my-16 flex max-w-2xl flex-col gap-6 px-4"
    >
      <h1 className="text-3xl font-semibold">{order ? "Thank you" : "Checkout"}</h1>
      {order ? (
        <p role="status">Order {order.orderID} is confirmed.</p>
      ) : (
        <MipsConfirmOrder reference={reference} onConfirmed={setOrder} />
      )}
    </main>
  );
}

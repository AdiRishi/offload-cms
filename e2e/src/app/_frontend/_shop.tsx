import {
  INR,
  MUR,
  mipsAdapterClient,
  razorpayAdapterClient,
} from "@adirishi/offload-payments/client";
import { EcommerceProvider } from "@payloadcms/plugin-ecommerce/client/react";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_frontend/_shop")({
  component: ShopLayout,
});

const currenciesConfig = { defaultCurrency: MUR.code, supportedCurrencies: [MUR, INR] };
const paymentMethods = [razorpayAdapterClient(), mipsAdapterClient()];
// The checkout lists each item by its product's or its variant's title.
const api = {
  cartsFetchQuery: { depth: 1, populate: { products: { title: true }, variants: { title: true } } },
};

/** The shop's pages share one cart, which the provider keeps across client navigations. */
function ShopLayout() {
  return (
    <EcommerceProvider
      api={api}
      currenciesConfig={currenciesConfig}
      enableVariants
      paymentMethods={paymentMethods}
    >
      <Outlet />
    </EcommerceProvider>
  );
}

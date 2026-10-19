import { hideServerErrors } from "@adirishi/offload-tanstack";
import { useCart, useCurrency } from "@payloadcms/plugin-ecommerce/client/react";
import { createFileRoute, Link, notFound, useHydrated } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getVisitorPayload } from "@/lib/payload.server";

/** A published product and its published variants, priced in MUR. */
const getProduct = createServerFn({ method: "GET" })
  .middleware([hideServerErrors])
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const payload = await getVisitorPayload();
    const product = await payload.findByID({
      collection: "products",
      id: data.id,
      depth: 0,
      disableErrors: true,
      overrideAccess: false,
      select: { title: true },
    });
    if (!product) throw notFound();
    const { docs } = await payload.find({
      collection: "variants",
      depth: 0,
      overrideAccess: false,
      pagination: false,
      select: { inventory: true, priceInMUR: true, title: true },
      sort: "priceInMUR",
      where: { product: { equals: product.id } },
    });
    return {
      id: product.id,
      title: product.title,
      variants: docs.map((variant) => ({
        id: variant.id,
        inStock: (variant.inventory ?? 0) > 0,
        price: variant.priceInMUR ?? 0,
        title: variant.title ?? "",
      })),
    };
  });

export const Route = createFileRoute("/_frontend/_shop/products/$productID")({
  loader: ({ params }) => getProduct({ data: { id: params.productID } }),
  component: ProductPage,
});

function ProductPage() {
  const product = Route.useLoaderData();
  const hydrated = useHydrated();
  const { addItem, cart, isLoading } = useCart();
  const { formatCurrency } = useCurrency();
  const [variant, setVariant] = useState(product.variants.find((option) => option.inStock)?.id);
  const itemsInCart = (cart?.items ?? []).reduce((total, item) => total + item.quantity, 0);

  return (
    <main
      data-hydrated={hydrated || undefined}
      className="mx-auto my-16 flex max-w-2xl flex-col gap-6 px-4"
    >
      <h1 className="text-3xl font-semibold">{product.title}</h1>
      <div className="flex flex-col gap-2">
        <Label htmlFor="variant">Size</Label>
        <NativeSelect
          id="variant"
          value={variant}
          onChange={(event) =>
            setVariant(
              product.variants.find((option) => String(option.id) === event.target.value)?.id,
            )
          }
        >
          {product.variants.map((option) => (
            <NativeSelectOption key={option.id} value={option.id} disabled={!option.inStock}>
              {option.title}, {formatCurrency(option.price)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-center gap-4">
        <Button
          type="button"
          disabled={variant === undefined || isLoading}
          onClick={() => {
            if (variant !== undefined) void addItem({ product: product.id, variant });
          }}
        >
          Add to cart
        </Button>
        <p role="status">
          {itemsInCart === 1 ? "1 item in your cart" : `${itemsInCart} items in your cart`}
        </p>
      </div>
      {itemsInCart > 0 ? <Link to="/checkout">Go to checkout</Link> : null}
    </main>
  );
}

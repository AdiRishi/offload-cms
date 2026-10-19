import { hideServerErrors } from "@adirishi/offload-tanstack";
import { useCart, useCurrency } from "@payloadcms/plugin-ecommerce/client/react";
import { createFileRoute, Link, notFound, useHydrated } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
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
  const itemsInCart = (cart?.items ?? []).reduce((total, item) => total + item.quantity, 0);

  return (
    <main
      data-hydrated={hydrated || undefined}
      className="mx-auto my-16 flex max-w-2xl flex-col gap-6 px-4"
    >
      <h1 className="text-3xl font-semibold">{product.title}</h1>
      <ul aria-label="Sizes" className="flex flex-col gap-2">
        {product.variants.map((variant) => (
          <li key={variant.id} className="flex items-center justify-between gap-4">
            <span>
              {variant.title}, {formatCurrency(variant.price)}
            </span>
            <Button
              type="button"
              disabled={!variant.inStock || isLoading}
              onClick={() => void addItem({ product: product.id, variant: variant.id })}
            >
              Add to cart
            </Button>
          </li>
        ))}
      </ul>
      <p role="status">
        {itemsInCart === 1 ? "1 item in your cart" : `${itemsInCart} items in your cart`}
      </p>
      {itemsInCart > 0 ? <Link to="/checkout">Go to checkout</Link> : null}
    </main>
  );
}

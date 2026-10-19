// Offload's patches add these exports. The workspace type-checks against Payload's unpatched
// release, so declare them here. Delete this file when those patches are dropped.

import type { CollectionSlugMap } from "@payloadcms/plugin-ecommerce/types";
import type { DefaultDocumentIDType, PayloadRequest, SanitizedConfig } from "payload";

declare module "@payloadcms/plugin-ecommerce" {
  export const settleTransaction: (args: {
    orderData: Record<string, unknown>;
    req: PayloadRequest;
    transactionID: DefaultDocumentIDType;
  }) => Promise<Record<string, unknown>>;

  export class CartAlreadyPurchasedError extends Error {}

  export const getEcommerceCollectionSlugs: (
    config: Pick<SanitizedConfig, "custom">,
  ) => CollectionSlugMap;
}

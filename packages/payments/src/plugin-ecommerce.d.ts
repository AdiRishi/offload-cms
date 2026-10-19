// Offload's patch `ecommerce-server-settlement` adds this export. The workspace type-checks against
// Payload's unpatched release, so declare it here. Delete this file when that patch is dropped.

import type { DefaultDocumentIDType, PayloadRequest } from "payload";

declare module "@payloadcms/plugin-ecommerce" {
  export const settleTransaction: (args: {
    cartsSlug?: string;
    orderData: Record<string, unknown>;
    ordersSlug?: string;
    productsSlug?: string;
    req: PayloadRequest;
    transactionID: DefaultDocumentIDType;
    transactionsSlug?: string;
    variantsSlug?: string;
  }) => Promise<Record<string, unknown>>;
}

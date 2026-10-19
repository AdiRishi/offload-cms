import type { PaymentAdapter, PaymentAdapterArgs } from "@payloadcms/plugin-ecommerce/types";
import type { DefaultDocumentIDType, Field, GroupField, PayloadRequest, Where } from "payload";

import { settleTransaction } from "@payloadcms/plugin-ecommerce";
import { z } from "zod";

type InitiateArgs = Parameters<PaymentAdapter["initiatePayment"]>[0];
type ConfirmArgs = Parameters<PaymentAdapter["confirmOrder"]>[0];

/** Creates the order for a transaction whose payment the gateway has confirmed. */
export type Finalize = ConfirmArgs["finalizeOrder"];

const documentID = z.union([z.number(), z.string()]);

export const transactionSchema = z.object({
  id: documentID,
  status: z.enum([
    "pending",
    "processing",
    "succeeded",
    "failed",
    "cancelled",
    "expired",
    "refunded",
  ]),
  amount: z.number().int(),
  currency: z.string(),
  cart: documentID.nullish(),
  customer: documentID.nullish(),
  customerEmail: z.string().nullish(),
  items: z.array(
    z.object({ product: documentID, quantity: z.number(), variant: documentID.nullish() }),
  ),
  order: documentID.nullish(),
  paymentMethod: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Transaction = z.infer<typeof transactionSchema>;

/**
 * The fields every Offload gateway keeps in its transaction group after its own: the shipping
 * address that the order needs, and the last error the gateway reported. Spread them into the
 * schema of a gateway's group.
 */
export const gatewayFields = {
  shippingAddress: z.unknown(),
  lastError: z.string().nullish(),
};

/**
 * The transaction group of an Offload gateway: its own fields, then `shippingAddress` and
 * `lastError`. The admin shows the group only on that gateway's transactions.
 */
export const gatewayGroup = ({
  fields,
  name,
  overrides,
}: {
  fields: Field[];
  name: string;
  overrides?: PaymentAdapterArgs["groupOverrides"];
}): GroupField => {
  const defaultFields: Field[] = [
    ...fields,
    { name: "shippingAddress", type: "json", admin: { readOnly: true } },
    { name: "lastError", type: "text", admin: { readOnly: true } },
  ];
  return {
    name,
    type: "group",
    ...overrides,
    admin: { condition: (data) => data?.paymentMethod === name, ...overrides?.admin },
    fields: overrides?.fields ? overrides.fields({ defaultFields }) : defaultFields,
  };
};

const relationID = (value: DefaultDocumentIDType | { id: DefaultDocumentIDType }) =>
  typeof value === "object" ? value.id : value;

/**
 * Creates the `pending` transaction for a checkout. It charges the cart's subtotal, which the
 * carts collection computes from stored prices, so the browser never supplies an amount. A
 * customer of `customersSlug` owns the transaction. Anyone else is a guest, known by email.
 */
export const createPendingTransaction = async (
  { customersSlug = "users", data, req, transactionsSlug }: InitiateArgs,
  { gateway, name }: { gateway: Record<string, unknown>; name: string },
) => {
  const { billingAddress, cart, currency, customerEmail, shippingAddress } = data;
  if (cart.items.length === 0) throw new Error("The cart is empty.");
  const amount = cart.subtotal;
  if (amount === undefined || !Number.isInteger(amount) || amount <= 0) {
    throw new Error("The cart has no amount to charge.");
  }

  const transaction = await req.payload.create({
    collection: transactionsSlug,
    data: {
      ...(req.user?.collection === customersSlug ? { customer: req.user.id } : { customerEmail }),
      amount,
      billingAddress,
      cart: cart.id,
      currency: currency.toUpperCase(),
      items: cart.items.map((item) => ({
        product: relationID(item.product),
        quantity: item.quantity,
        variant: item.variant ? relationID(item.variant) : undefined,
      })),
      paymentMethod: name,
      status: "pending",
      [name]: { ...gateway, shippingAddress },
    },
    overrideAccess: true,
    req,
  });
  return transactionSchema.parse(transaction);
};

/** Finds the one transaction that matches `where`, or `undefined`. Throws if several match. */
export const findTransaction = async <TSchema extends z.ZodType>(
  req: PayloadRequest,
  where: Where,
  schema: TSchema,
): Promise<z.infer<TSchema> | undefined> => {
  const { docs } = await req.payload.find({
    collection: "transactions",
    depth: 0,
    limit: 2,
    overrideAccess: true,
    pagination: false,
    req,
    where,
  });
  if (docs.length > 1) throw new Error("More than one transaction matches the gateway's order.");
  return docs[0] && schema.parse(docs[0]);
};

/** The gateway reported a payment that doesn't match the transaction. Retrying won't help. */
export class PaymentMismatch extends Error {}

/**
 * Settles a transaction after the gateway's API confirmed the payment. The gateway's amount, in
 * the currency's minor unit, and its currency must equal the transaction's. `finalize` is core's
 * `finalizeOrder` in confirm-order, or `settleOnServer(req)` elsewhere. Either returns the
 * existing order when the transaction is already settled.
 */
export const settlePaidTransaction = ({
  finalize,
  paid,
  shippingAddress,
  transaction,
}: {
  finalize: Finalize;
  paid: { amount: number; currency: string };
  shippingAddress: unknown;
  transaction: Transaction;
}) => {
  if (paid.amount !== transaction.amount) {
    throw new PaymentMismatch(
      `The gateway reports ${paid.amount}, but transaction ${transaction.id} is for ${transaction.amount}.`,
    );
  }
  if (paid.currency.toUpperCase() !== transaction.currency.toUpperCase()) {
    throw new PaymentMismatch(
      `The gateway reports ${paid.currency}, but transaction ${transaction.id} is in ${transaction.currency}.`,
    );
  }
  return finalize({
    transactionID: transaction.id,
    orderData: {
      amount: transaction.amount,
      currency: transaction.currency,
      ...(transaction.customer
        ? { customer: transaction.customer }
        : { customerEmail: transaction.customerEmail }),
      items: transaction.items,
      ...(shippingAddress ? { shippingAddress } : {}),
      status: "processing",
    },
  });
};

/** Settles outside confirm-order: from a webhook, a payment notification, or reconciliation. */
export const settleOnServer =
  (req: PayloadRequest): Finalize =>
  (args) =>
    settleTransaction({ ...args, req });

/**
 * Writes the gateway's group without touching the transaction's status, so it can't undo a
 * settlement that runs at the same time. Pass the whole group: MongoDB replaces it.
 */
export const updateGatewayGroup = async (
  req: PayloadRequest,
  transaction: Transaction,
  name: string,
  group: Record<string, unknown>,
) => {
  await req.payload.db.updateOne({
    collection: "transactions",
    id: transaction.id,
    data: { [name]: group },
    req,
  });
};

/**
 * Moves a transaction from `pending` to `expired` when no order took it. Returns whether this
 * call expired it. A settlement that wins the race keeps the transaction.
 */
export const expireTransaction = async (req: PayloadRequest, transaction: Transaction) => {
  const expired = await req.payload.db.updateOne({
    collection: "transactions",
    data: { status: "expired" },
    options: { atomic: true },
    req,
    where: {
      and: [
        { id: { equals: transaction.id } },
        { status: { equals: "pending" } },
        { order: { exists: false } },
      ],
    },
  });
  return Boolean(expired);
};

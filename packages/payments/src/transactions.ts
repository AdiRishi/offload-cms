import type { PaymentAdapter, PaymentAdapterArgs } from "@payloadcms/plugin-ecommerce/types";
import type { DefaultDocumentIDType, Field, GroupField, PayloadRequest, Where } from "payload";

import {
  CartAlreadyPurchasedError,
  getEcommerceCollectionSlugs,
  settleTransaction,
} from "@payloadcms/plugin-ecommerce";
import { killTransaction } from "payload";
import { z } from "zod";

/** The collection slugs the ecommerce plugin was configured with. */
export const collectionSlugs = (req: PayloadRequest) =>
  getEcommerceCollectionSlugs(req.payload.config);

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
  // A product deleted after the checkout leaves its item without one.
  items: z.array(
    z.object({
      product: documentID.nullish(),
      quantity: z.number(),
      variant: documentID.nullish(),
    }),
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

// Offload's patch `ecommerce-adapter-customers-slug` passes the plugin's currencies to
// initiatePayment. The workspace type-checks against Payload's unpatched release, which lacks them.
const initiateCurrencies = z.object({
  currenciesConfig: z.object({
    supportedCurrencies: z.array(z.object({ code: z.string(), decimals: z.number().int().min(0) })),
  }),
});

/**
 * The configured `decimals` of the checkout's currency. A transaction's `amount` is in units of
 * `10 ** decimals` of its currency.
 */
export const currencyDecimals = (args: InitiateArgs) => {
  const { currency } = args.data;
  const configured = initiateCurrencies
    .parse(args)
    .currenciesConfig.supportedCurrencies.find(
      ({ code }) => code.toUpperCase() === currency.toUpperCase(),
    );
  if (!configured) throw new Error(`${currency} is not a configured currency.`);
  return configured.decimals;
};

/**
 * Creates the `pending` transaction for a checkout. It charges the cart's subtotal, which the
 * carts collection computes from stored prices, so the browser never supplies an amount. A
 * logged-in user of the plugin's customers collection owns the transaction. Anyone else,
 * including an admin user of another collection, is a guest, known by email.
 */
export const createPendingTransaction = async (
  args: InitiateArgs,
  { gateway, name }: { gateway: Record<string, unknown>; name: string },
) => {
  const { customersSlug, data, req } = args;
  const { billingAddress, cart, currency, customerEmail, shippingAddress } = data;
  if (cart.items.length === 0) throw new Error("The cart is empty.");
  const amount = cart.subtotal;
  if (amount === undefined || !Number.isInteger(amount) || amount <= 0) {
    throw new Error("The cart has no amount to charge.");
  }
  const transaction = await req.payload.create({
    collection: collectionSlugs(req).transactions,
    depth: 0,
    data: {
      ...(req.user && req.user.collection === customersSlug
        ? { customer: req.user.id }
        : { customerEmail }),
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
    collection: collectionSlugs(req).transactions,
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

/**
 * The gateway holds a payment that must not settle the transaction: it doesn't match the
 * transaction, or the cart was already bought through another transaction. Retrying won't help.
 */
export class PaymentRefused extends Error {}

/**
 * Throws `PaymentRefused` unless the gateway's amount, in the units the transaction stores, and its
 * currency equal the transaction's.
 */
export const assertPaymentMatches = (
  paid: { amount: number; currency: string },
  transaction: Transaction,
) => {
  if (paid.amount !== transaction.amount) {
    throw new PaymentRefused(
      `The gateway reports ${paid.amount}, but transaction ${transaction.id} is for ${transaction.amount}.`,
    );
  }
  if (paid.currency.toUpperCase() !== transaction.currency.toUpperCase()) {
    throw new PaymentRefused(
      `The gateway reports ${paid.currency}, but transaction ${transaction.id} is in ${transaction.currency}.`,
    );
  }
};

/** Another transaction for the same cart that is settled or settling. */
const otherPurchase = async (req: PayloadRequest, transaction: Transaction) => {
  if (transaction.cart === null || transaction.cart === undefined) return undefined;
  const { docs } = await req.payload.find({
    collection: collectionSlugs(req).transactions,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    select: { id: true },
    where: {
      and: [
        { cart: { equals: transaction.cart } },
        { id: { not_equals: transaction.id } },
        { status: { in: ["processing", "succeeded"] } },
      ],
    },
  });
  return docs[0]?.id;
};

const secondPayment = (paymentID: string, transaction: Transaction, other: string) =>
  `Payment ${paymentID} is a second payment for cart ${transaction.cart}, which ${other} bought. The customer paid twice. Refund payment ${paymentID} from the gateway's dashboard.`;

/**
 * Throws `PaymentRefused` when another transaction already bought the transaction's cart, so a
 * second payment never becomes a second order. The transaction's own settlement doesn't count.
 */
export const assertCartOpen = async (
  req: PayloadRequest,
  transaction: Transaction,
  paymentID: string,
) => {
  const other = await otherPurchase(req, transaction);
  if (other !== undefined)
    throw new PaymentRefused(secondPayment(paymentID, transaction, `transaction ${other}`));
};

/**
 * Prepares a transaction for a payment that the gateway confirmed late. A transaction that
 * reconciliation expired goes back to `pending`, atomically, so the payment settles it, unless
 * another transaction bought the cart meanwhile. A transaction in any other state that can't
 * settle any more throws `PaymentRefused`: the customer was charged and has no order. Returns the
 * transaction to settle.
 */
export const reopenForLatePayment = async (
  req: PayloadRequest,
  transaction: Transaction,
  paymentID: string,
): Promise<Transaction> => {
  if (["pending", "processing", "succeeded"].includes(transaction.status)) return transaction;
  if (transaction.status !== "expired") {
    throw new PaymentRefused(
      `Payment ${paymentID} was charged for ${transaction.status} transaction ${transaction.id}, which has no order. Refund it from the gateway's dashboard.`,
    );
  }
  await assertCartOpen(req, transaction, paymentID);
  await req.payload.db.updateOne({
    collection: collectionSlugs(req).transactions,
    data: { status: "pending" },
    options: { atomic: true },
    req,
    where: {
      and: [
        { id: { equals: transaction.id } },
        { status: { equals: "expired" } },
        { order: { exists: false } },
      ],
    },
  });
  req.payload.logger.warn(
    `Payment ${paymentID} arrived for expired transaction ${transaction.id}, which is pending again.`,
  );
  return { ...transaction, status: "pending" };
};

/**
 * Settles a transaction after the gateway's API confirmed the payment `paid`. Its amount and
 * currency must equal the transaction's, and no other transaction may have bought the cart.
 * `finalize` is core's `finalizeOrder` in confirm-order, or `settleOnServer(req)` elsewhere. Either
 * returns the existing order when the transaction is already settled.
 *
 * Two payments for one cart that settle at the same moment both pass the cart check, but core
 * gives each order the cart's unique `cartKey`, so only one order is created. The other payment is
 * refused like any second payment.
 */
export const settlePaidTransaction = async ({
  finalize,
  paid,
  req,
  shippingAddress,
  transaction,
}: {
  finalize: Finalize;
  paid: { amount: number; currency: string; id: string };
  req: PayloadRequest;
  shippingAddress: unknown;
  transaction: Transaction;
}) => {
  assertPaymentMatches(paid, transaction);
  // A settled or settling transaction gets its existing order back from `finalize`. Its cart
  // already counts as bought, by this transaction or one that is settling it right now.
  if (transaction.status === "pending") await assertCartOpen(req, transaction, paid.id);
  try {
    return await finalize({
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
  } catch (error) {
    if (!(error instanceof CartAlreadyPurchasedError)) throw error;
    // On Postgres in confirm-order, the failed insert has aborted core's database transaction, so
    // this can't look up which transaction bought the cart.
    throw new PaymentRefused(secondPayment(paid.id, transaction, "another transaction"));
  }
};

/** Settles outside confirm-order: from a webhook, a payment notification, or reconciliation. */
export const settleOnServer =
  (req: PayloadRequest): Finalize =>
  (args) =>
    settleTransaction({ ...args, req });

/**
 * Writes only `fields` of the gateway's group, so it can't undo a concurrent settlement or erase
 * what another request wrote to the group's other fields. With `whilePending`, it writes only while
 * the transaction is still `pending`, and returns whether it wrote. The SQL adapters write the
 * given columns only. MongoDB would replace the whole group, and Offload doesn't run on it.
 */
export const writeGatewayFields = async (
  req: PayloadRequest,
  transaction: Transaction,
  name: string,
  fields: Record<string, unknown>,
  { whilePending = false }: { whilePending?: boolean } = {},
) => {
  const collection = collectionSlugs(req).transactions;
  const data = { [name]: fields };
  const written = whilePending
    ? await req.payload.db.updateOne({
        collection,
        data,
        options: { atomic: true },
        req,
        where: {
          and: [{ id: { equals: transaction.id } }, { status: { equals: "pending" } }],
        },
      })
    : await req.payload.db.updateOne({ collection, id: transaction.id, data, req });
  return Boolean(written);
};

/**
 * Records a payment that must not settle: logs `message` at error level and writes it to the
 * group's `lastError`, for an admin to refund. Inside confirm-order, core holds a database
 * transaction that it rolls back when the adapter throws. Nothing in it needs keeping, so this
 * ends it first, and the flag survives on Postgres as on D1.
 */
export const flagPayment = async (
  req: PayloadRequest,
  transaction: Transaction,
  name: string,
  message: string,
) => {
  req.payload.logger.error(message);
  if (await req.transactionID) await killTransaction(req);
  await writeGatewayFields(req, transaction, name, { lastError: message });
};

/**
 * Moves a transaction from `pending` to `expired` when no order took it. Returns whether this
 * call expired it. A settlement that wins the race keeps the transaction.
 */
export const expireTransaction = async (req: PayloadRequest, transaction: Transaction) => {
  const expired = await req.payload.db.updateOne({
    collection: collectionSlugs(req).transactions,
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

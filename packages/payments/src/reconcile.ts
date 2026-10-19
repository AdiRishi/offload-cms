import type { PaymentAdapter } from "@payloadcms/plugin-ecommerce/types";
import type { DefaultDocumentIDType, PayloadRequest, TaskConfig } from "payload";

type ScheduleConfig = NonNullable<TaskConfig["schedule"]>[number];

import { z } from "zod";

import { collectionSlugs } from "./transactions.ts";

/** What reconciliation did with one pending transaction. */
export type ReconcileResult = "settled" | "expired" | "pending";

/** A payment adapter from this package, which the reconciliation task can ask about a payment. */
export type OffloadPaymentAdapter = PaymentAdapter & {
  /**
   * Asks the gateway about one `pending` transaction of this adapter. Settles it when the gateway
   * holds a matching payment, expires it when no payment can arrive any more, and otherwise leaves
   * it pending.
   */
  reconcile: (args: {
    req: PayloadRequest;
    transactionID: DefaultDocumentIDType;
  }) => Promise<ReconcileResult>;
};

/** How long a settlement may hold a transaction in `processing` before reconciliation repairs it. */
const processingTimeoutMs = 15 * 60 * 1000;

const documentID = z.union([z.number(), z.string()]);
const pendingTransaction = z.object({ id: documentID, paymentMethod: z.string() });
const stuckTransaction = z.object({ id: documentID, cart: documentID.nullish() });
const groupOf = z.record(z.string(), z.unknown());

export type ReconcilePaymentsOptions = {
  /** The adapters whose transactions the task reconciles. Pass the ones in `paymentMethods`. */
  adapters: OffloadPaymentAdapter[];
  /** When Payload queues the task. Defaults to every ten minutes on the `default` queue. */
  schedule?: ScheduleConfig[];
  /**
   * How many pending transactions one run asks the gateways about, least recently checked first.
   * Each costs a few gateway calls and database queries, which count towards the Worker's
   * subrequest limit for one invocation. Defaults to 50.
   */
  batchSize?: number;
};

/**
 * A Payload job task that settles payments the browser and the gateway's notifications missed.
 * Add it to `jobs.tasks`. The Worker's Cron Trigger queues and runs it, from
 * `createPayloadWorker()`, so the Cron Trigger must run at least as often as `schedule`.
 *
 * Each run first repairs transactions that a settlement left in `processing` for 15 minutes, which
 * happens only when a Worker stops mid-settlement on D1. An order carries its transaction's ID as
 * its `settlementKey`, written in the order's first insert. If such an order exists, the task marks
 * the transaction `succeeded` and logs an error, because the stock decrement may not have run. If
 * none exists, settlement wrote nothing else, so the task returns the transaction to `pending`.
 * Then it asks each adapter about the pending transactions it checked least recently. A failure
 * goes to the transaction's `lastError` and the log, and the job's output counts the results.
 */
export const reconcilePaymentsTask = ({
  adapters,
  batchSize = 50,
  schedule = [{ cron: "0 */10 * * * *", queue: "default" }],
}: ReconcilePaymentsOptions): TaskConfig => ({
  slug: "reconcilePayments",
  schedule,
  outputSchema: [
    { name: "checked", type: "number", required: true },
    { name: "settled", type: "number", required: true },
    { name: "expired", type: "number", required: true },
    { name: "pending", type: "number", required: true },
    { name: "failed", type: "number", required: true },
  ],
  handler: async ({ req }) => {
    const slugs = collectionSlugs(req);
    const paymentMethods = adapters.map((adapter) => adapter.name);
    await repairInterruptedSettlements(req, paymentMethods);

    const { docs } = await req.payload.find({
      collection: slugs.transactions,
      depth: 0,
      limit: batchSize,
      overrideAccess: true,
      pagination: false,
      req,
      select: { paymentMethod: true },
      sort: "updatedAt",
      where: {
        and: [{ status: { equals: "pending" } }, { paymentMethod: { in: paymentMethods } }],
      },
    });

    const output = { checked: 0, expired: 0, failed: 0, pending: 0, settled: 0 };
    for (const doc of docs) {
      const { id, paymentMethod } = pendingTransaction.parse(doc);
      const adapter = adapters.find((candidate) => candidate.name === paymentMethod);
      if (!adapter) continue;
      output.checked++;
      const result = await adapter.reconcile({ req, transactionID: id }).catch(async (error) => {
        const message = `Reconciling transaction ${id} failed: ${error instanceof Error ? error.message : String(error)}`;
        req.payload.logger.error({ err: error, msg: message });
        await recordError(req, id, paymentMethod, message);
        return "failed" as const;
      });
      output[result]++;
      // Moves a transaction that stays pending behind the others, so that transactions waiting
      // out a gateway's payment window, or failing every run, can't hold every place in the batch.
      if (result === "pending" || result === "failed") {
        await req.payload.db.updateOne({
          collection: slugs.transactions,
          id,
          data: { updatedAt: new Date().toISOString() },
          req,
        });
      }
    }
    req.payload.logger.info({ msg: "Reconciled payments", ...output });
    return { output };
  },
});

const recordError = async (
  req: PayloadRequest,
  id: z.infer<typeof documentID>,
  paymentMethod: string,
  message: string,
) => {
  const transaction = await req.payload.findByID({
    collection: collectionSlugs(req).transactions,
    id,
    depth: 0,
    overrideAccess: true,
    req,
  });
  const group = groupOf.safeParse(transaction[paymentMethod]);
  await req.payload.db.updateOne({
    collection: collectionSlugs(req).transactions,
    id,
    data: { [paymentMethod]: { ...(group.success ? group.data : {}), lastError: message } },
    req,
  });
};

const repairInterruptedSettlements = async (req: PayloadRequest, paymentMethods: string[]) => {
  const slugs = collectionSlugs(req);
  const { docs } = await req.payload.find({
    collection: slugs.transactions,
    depth: 0,
    limit: 50,
    overrideAccess: true,
    pagination: false,
    req,
    select: { cart: true },
    where: {
      and: [
        { status: { equals: "processing" } },
        { paymentMethod: { in: paymentMethods } },
        { updatedAt: { less_than: new Date(Date.now() - processingTimeoutMs).toISOString() } },
      ],
    },
  });

  for (const doc of docs) {
    const transaction = stuckTransaction.parse(doc);
    const {
      docs: [order],
    } = await req.payload.find({
      collection: slugs.orders,
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      req,
      where: { settlementKey: { equals: String(transaction.id) } },
    });

    if (!order) {
      await req.payload.db.updateOne({
        collection: slugs.transactions,
        data: { status: "pending" },
        options: { atomic: true },
        req,
        where: {
          and: [
            { id: { equals: transaction.id } },
            { status: { equals: "processing" } },
            { order: { exists: false } },
          ],
        },
      });
      req.payload.logger.warn(
        `Transaction ${transaction.id} was left in processing with no order. It is pending again.`,
      );
      continue;
    }

    const repaired = await req.payload.db.updateOne({
      collection: slugs.transactions,
      data: { order: order.id, status: "succeeded" },
      options: { atomic: true },
      req,
      where: { and: [{ id: { equals: transaction.id } }, { status: { equals: "processing" } }] },
    });
    if (!repaired) continue;
    await req.payload.update({
      collection: slugs.orders,
      id: order.id,
      data: { transactions: [transaction.id] },
      depth: 0,
      overrideAccess: true,
      req,
    });
    if (transaction.cart !== null && transaction.cart !== undefined) {
      await req.payload.update({
        collection: slugs.carts,
        id: transaction.cart,
        data: { purchasedAt: new Date().toISOString() },
        depth: 0,
        overrideAccess: true,
        req,
      });
    }
    req.payload.logger.error(
      `Settlement of transaction ${transaction.id} stopped after it created order ${order.id}. The transaction is now succeeded. Check the stock of its items, which may not have been decremented.`,
    );
  }
};

import type { PaymentAdapter } from "@payloadcms/plugin-ecommerce/types";
import type { DefaultDocumentIDType, PayloadRequest, TaskConfig } from "payload";

type ScheduleConfig = NonNullable<TaskConfig["schedule"]>[number];

import { z } from "zod";

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

/** How many pending transactions one run asks the gateways about, least recently checked first. */
const batchSize = 50;

const documentID = z.union([z.number(), z.string()]);
const pendingTransaction = z.object({ id: documentID, paymentMethod: z.string() });
const stuckTransaction = z.object({ id: documentID, cart: documentID.nullish() });

export type ReconcilePaymentsOptions = {
  /** The adapters whose transactions the task reconciles. Pass the ones in `paymentMethods`. */
  adapters: OffloadPaymentAdapter[];
  /** When Payload queues the task. Defaults to every ten minutes on the `default` queue. */
  schedule?: ScheduleConfig[];
};

/**
 * A Payload job task that settles payments the browser and the gateway's notifications missed.
 * Add it to `jobs.tasks`. The Worker's Cron Trigger queues and runs it, from
 * `createPayloadWorker()`, so the Cron Trigger must run at least as often as `schedule`.
 *
 * Each run first repairs transactions that a settlement left in `processing` for 15 minutes,
 * which happens only when a Worker stops mid-settlement on D1. If an order took the transaction,
 * it marks the transaction `succeeded` and logs an error, because the cart and inventory updates
 * may not have run. If no order took it, nothing else ran either, so it returns the transaction to
 * `pending`. Then it asks each adapter about the pending transactions it checked least recently.
 */
export const reconcilePaymentsTask = ({
  adapters,
  schedule = [{ cron: "0 */10 * * * *", queue: "default" }],
}: ReconcilePaymentsOptions): TaskConfig => ({
  slug: "reconcilePayments",
  schedule,
  handler: async ({ req }) => {
    const paymentMethods = adapters.map((adapter) => adapter.name);
    await repairInterruptedSettlements(req, paymentMethods);

    const { docs } = await req.payload.find({
      collection: "transactions",
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

    const results: Record<ReconcileResult | "failed", number> = {
      expired: 0,
      failed: 0,
      pending: 0,
      settled: 0,
    };
    for (const doc of docs) {
      const { id, paymentMethod } = pendingTransaction.parse(doc);
      const adapter = adapters.find((candidate) => candidate.name === paymentMethod);
      if (!adapter) continue;
      try {
        const result = await adapter.reconcile({ req, transactionID: id });
        results[result]++;
        // Moves a transaction that stays pending behind the others, so that transactions waiting
        // out a gateway's payment window can't hold every place in the batch.
        if (result === "pending") {
          await req.payload.db.updateOne({
            collection: "transactions",
            id,
            data: { updatedAt: new Date().toISOString() },
            req,
          });
        }
      } catch (error) {
        results.failed++;
        req.payload.logger.error({ err: error, msg: `Reconciling transaction ${id} failed` });
      }
    }
    req.payload.logger.info({ msg: "Reconciled payments", ...results });
    return { output: {} };
  },
});

const repairInterruptedSettlements = async (req: PayloadRequest, paymentMethods: string[]) => {
  const { docs } = await req.payload.find({
    collection: "transactions",
    depth: 0,
    limit: batchSize,
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
    const orders = await req.payload.find({
      collection: "orders",
      depth: 0,
      limit: 2,
      overrideAccess: true,
      pagination: false,
      req,
      where: { transactions: { equals: transaction.id } },
    });
    const [order, ...others] = orders.docs;

    if (!order) {
      await req.payload.db.updateOne({
        collection: "transactions",
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

    if (others.length > 0) {
      req.payload.logger.error(
        `Transaction ${transaction.id} is in processing and has several orders. Reconcile it by hand.`,
      );
      continue;
    }

    const repaired = await req.payload.db.updateOne({
      collection: "transactions",
      data: { order: order.id, status: "succeeded" },
      options: { atomic: true },
      req,
      where: { and: [{ id: { equals: transaction.id } }, { status: { equals: "processing" } }] },
    });
    if (!repaired) continue;
    if (transaction.cart !== null && transaction.cart !== undefined) {
      await req.payload.update({
        collection: "carts",
        id: transaction.cart,
        data: { purchasedAt: new Date().toISOString() },
        overrideAccess: true,
        req,
      });
    }
    req.payload.logger.error(
      `Settlement of transaction ${transaction.id} stopped after it created order ${order.id}. The transaction is now succeeded. Check the stock of its items, which may not have been decremented.`,
    );
  }
};

import type { Config, Endpoint, PayloadRequest } from "payload";

import { type OffloadPaymentAdapter, reconcilePaymentsTask } from "@adirishi/offload-payments";

import { isStaff } from "./access";

const recordAudit = (req: PayloadRequest, action: string, summary: string) =>
  req.payload.create({
    collection: "audit-logs",
    data: { action, summary },
    overrideAccess: true,
    req,
  });

export const createJobs = ({
  paymentMethods,
}: {
  paymentMethods: OffloadPaymentAdapter[];
}): NonNullable<Config["jobs"]> => ({
  tasks: [
    // The suite queues reconciliation itself. A scheduled run could settle a payment that a
    // test running in parallel expects to stay pending.
    reconcilePaymentsTask({ adapters: paymentMethods, schedule: [] }),
    {
      slug: "recordHeartbeat",
      inputSchema: [{ name: "message", type: "text", required: true }],
      handler: async ({ input, req }) => {
        await recordAudit(req, "heartbeat", input.message);
        return { output: {} };
      },
    },
  ],
  workflows: [
    {
      slug: "heartbeatTwice",
      inputSchema: [{ name: "message", type: "text", required: true }],
      handler: async ({ job, tasks }) => {
        await tasks.recordHeartbeat("1", { input: { message: `${job.input.message} (1 of 2)` } });
        await tasks.recordHeartbeat("2", { input: { message: `${job.input.message} (2 of 2)` } });
      },
    },
  ],
});

/**
 * Lets the suite queue work for the next Cron Trigger. Payload's own `payload-jobs`
 * collection is closed to REST, which is correct for real sites.
 */
export const queueJobEndpoint: Endpoint = {
  path: "/e2e/queue",
  method: "post",
  handler: async (req) => {
    if (!isStaff({ req })) return Response.json({ error: "Forbidden" }, { status: 403 });
    const body: unknown = await req.json?.();
    if (
      typeof body === "object" &&
      body !== null &&
      "task" in body &&
      body.task === "reconcilePayments"
    ) {
      const job = await req.payload.jobs.queue({
        input: {},
        overrideAccess: true,
        req,
        task: "reconcilePayments",
      });
      return Response.json({ id: job.id });
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !("message" in body) ||
      typeof body.message !== "string"
    ) {
      return Response.json(
        { error: "Send { message, workflow? } or { task: 'reconcilePayments' }" },
        { status: 400 },
      );
    }
    const input = { message: body.message };
    const job =
      "workflow" in body && body.workflow === true
        ? await req.payload.jobs.queue({
            input,
            overrideAccess: true,
            req,
            workflow: "heartbeatTwice",
          })
        : await req.payload.jobs.queue({
            input,
            overrideAccess: true,
            req,
            task: "recordHeartbeat",
          });
    return Response.json({ id: job.id });
  },
};

/**
 * Queues Payload's built-in `schedulePublish` task the way the admin's schedule
 * dialog does, due immediately, so the suite can drive it with the Cron Trigger.
 */
export const schedulePublishEndpoint: Endpoint = {
  path: "/e2e/schedule-publish",
  method: "post",
  handler: async (req) => {
    if (req.user?.collection !== "users")
      return Response.json({ error: "Forbidden" }, { status: 403 });
    const body: unknown = await req.json?.();
    if (
      typeof body !== "object" ||
      body === null ||
      !("id" in body) ||
      typeof body.id !== "number" ||
      !("collection" in body) ||
      body.collection !== "pages"
    ) {
      return Response.json({ error: "Send { collection: 'pages', id }" }, { status: 400 });
    }
    const job = await req.payload.jobs.queue({
      input: {
        doc: { relationTo: body.collection, value: body.id },
        // Like the admin's "Publish in English". Without a locale, every locale's required fields must be filled.
        locale: "en",
        type: "publish",
        user: { relationTo: "users", value: req.user.id },
      },
      overrideAccess: true,
      req,
      task: "schedulePublish",
      waitUntil: new Date(),
    });
    return Response.json({ id: job.id });
  },
};

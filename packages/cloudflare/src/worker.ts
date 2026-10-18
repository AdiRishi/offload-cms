import type { Payload, SanitizedConfig } from "payload";

type RunOptions = Omit<NonNullable<Parameters<Payload["jobs"]["run"]>[0]>, "req">;

type PayloadWorkerArgs = {
  /** The default export of `@payload-config`. */
  config: Promise<SanitizedConfig>;
  /** The TanStack Start handler from `@tanstack/react-start/server-entry`. */
  handler: { fetch: (request: Request) => Promise<Response> | Response };
  /** Options for each `payload.jobs.run()`. Defaults to all queues with access control bypassed. */
  jobs?: RunOptions;
};

/**
 * The Worker's default export: TanStack Start serves requests, and every
 * Cron Trigger queues Payload's scheduled jobs and runs the due ones.
 */
export const createPayloadWorker = ({ config, handler, jobs }: PayloadWorkerArgs) =>
  ({
    fetch: (request) => handler.fetch(request),
    scheduled: async (_controller, _env, ctx) => {
      const { getPayload } = await import("payload");
      const payload = await getPayload({ config: await config });
      ctx.waitUntil(
        (async () => {
          await payload.jobs.handleSchedules({ allQueues: true });
          await payload.jobs.run({ allQueues: true, overrideAccess: true, ...jobs });
        })(),
      );
    },
  }) satisfies ExportedHandler;

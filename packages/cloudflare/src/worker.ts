import type { JobsRunOptions } from "./rsc-entry.ts";

import { loadRscPayload } from "./rsc-payload.ts";

type PayloadWorkerArgs = {
  /** The TanStack Start handler from `@tanstack/react-start/server-entry`. */
  handler: { fetch: (request: Request) => Promise<Response> | Response };
  /** Options for each `payload.jobs.run()`. Defaults to all queues with access control bypassed. */
  jobs?: JobsRunOptions;
};

/**
 * The Worker's default export: TanStack Start serves requests, and every
 * Cron Trigger queues Payload's scheduled jobs and runs the due ones.
 */
export const createPayloadWorker = ({ handler, jobs }: PayloadWorkerArgs) =>
  ({
    fetch: (request) => handler.fetch(request),
    scheduled: async (_controller, _env, ctx) =>
      (await loadRscPayload()).runScheduledJobs(ctx, jobs),
  }) satisfies ExportedHandler;

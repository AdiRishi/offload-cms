import type { Payload } from "payload";

import config from "@payload-config";
import { handleAPIRoute, handleGraphQL } from "@payloadcms/tanstack-start/server";
import { getPayload } from "payload";

export type JobsRunOptions = Omit<NonNullable<Parameters<Payload["jobs"]["run"]>[0]>, "req">;

export const handleRESTRequest = async (request: Request) =>
  handleAPIRoute({ config: await config, request });

export const handleGraphQLRequest = (request: Request) => handleGraphQL({ config, request });

export const runScheduledJobs = async (ctx: ExecutionContext, jobs?: JobsRunOptions) => {
  const payload = await getPayload({ config: await config });
  ctx.waitUntil(
    (async () => {
      await payload.jobs.handleSchedules({ allQueues: true });
      await payload.jobs.run({ allQueues: true, overrideAccess: true, ...jobs });
    })(),
  );
};

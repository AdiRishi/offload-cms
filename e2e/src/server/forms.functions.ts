import { getBindings } from "@adirishi/offload-cloudflare";
import { submissionInput } from "@adirishi/offload-form-builder";
import { saveFormSubmission } from "@adirishi/offload-form-builder/server";
import { hideServerErrors } from "@adirishi/offload-tanstack";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { getVisitorPayload } from "@/lib/payload.server";

/**
 * Saves a submission to a form-builder form. A page offers a form through a Form or Newsletter
 * block, so only a form in a block of a page the visitor can read takes submissions.
 */
export const submitForm = createServerFn({ method: "POST" })
  .middleware([hideServerErrors])
  .validator(submissionInput)
  .handler(async ({ data }) => {
    const [env, payload] = await Promise.all([getBindings(), getVisitorPayload()]);
    return saveFormSubmission({
      submission: data,
      payload,
      request: getRequest(),
      turnstileSecret: env.TURNSTILE_SECRET_KEY,
      rateLimit: env.SUBMISSIONS,
      isOffered: async (form) => {
        const { totalDocs } = await payload.count({
          collection: "pages",
          where: {
            or: [{ "layout.form": { equals: form } }, { "layout.signupForm": { equals: form } }],
          },
          overrideAccess: false,
        });
        return totalDocs > 0;
      },
    });
  });

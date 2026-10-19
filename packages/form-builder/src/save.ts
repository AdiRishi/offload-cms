import type { Payload, RequiredDataFromCollectionSlug } from "payload";

import { z } from "zod";

import {
  formSchema,
  isInputField,
  type FormField,
  type SubmissionInput,
  type SubmissionResult,
  submissionData,
} from "./schema.ts";
import { verifyTurnstile } from "./turnstile.ts";

export type SaveFormSubmissionOptions = {
  /** The validated input of the site's server function. */
  submission: SubmissionInput;
  payload: Payload;
  /** The request that called the server function. */
  request: Request;
  /** The Turnstile widget's secret key. */
  turnstileSecret: string;
  /** A Workers Rate Limiting binding. Each visitor IP gets its own allowance. */
  rateLimit: RateLimit;
  /**
   * Whether the visitor's page offers this form. Without it, every form the visitor can read
   * takes submissions.
   */
  isOffered?: (form: SubmissionInput["form"]) => boolean | Promise<boolean>;
  /** More fields to save on the submission, such as a relationship to the page it came from. */
  data?: Partial<RequiredDataFromCollectionSlug<"form-submissions">>;
};

/**
 * Saves a form-builder submission from a public form. In order, it applies the rate limit,
 * verifies the Turnstile token, checks that the visitor can read the form and that `isOffered`
 * accepts it, and validates the answers against the stored form. Only then does it create the
 * submission, with access control bypassed, so `form-submissions` can stay closed to public
 * creates. A failure is logged and reaches the visitor only as `error`.
 */
export const saveFormSubmission = async ({
  submission,
  payload,
  request,
  turnstileSecret,
  rateLimit,
  isOffered,
  data,
}: SaveFormSubmissionOptions): Promise<SubmissionResult> => {
  try {
    // Cloudflare sets the header on every request. Vite dev doesn't, so dev shares one allowance.
    const ip = request.headers.get("cf-connecting-ip") ?? undefined;
    const { success } = await rateLimit.limit({ key: `form:${ip ?? "unknown"}` });
    if (!success) return { status: "limited" };

    const verified = await verifyTurnstile({
      token: submission.turnstileToken,
      secret: turnstileSecret,
      hostname: new URL(request.url).hostname,
      remoteip: ip,
    });
    if (!verified) return { status: "unverified" };

    const {
      docs: [form],
    } = await payload.find({
      collection: "forms",
      where: { id: { equals: submission.form } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: false,
    });
    if (!form || (isOffered && !(await isOffered(submission.form)))) return { status: "refused" };

    const fields: readonly FormField[] = form.fields ?? [];
    const inputs = fields.filter(isInputField);
    const result = formSchema(inputs).safeParse(submission.values);
    if (!result.success) {
      const { fieldErrors } = z.flattenError(result.error);
      return {
        status: "invalid",
        errors: Object.fromEntries(
          Object.entries(fieldErrors).map(([name, messages]) => [name, messages?.[0] ?? ""]),
        ),
      };
    }

    await payload.create({
      collection: "form-submissions",
      data: { ...data, form: form.id, submissionData: submissionData(inputs, result.data) },
      overrideAccess: true,
    });
    return { status: "sent" };
  } catch (error) {
    console.error("A form submission failed", error);
    return { status: "error" };
  }
};

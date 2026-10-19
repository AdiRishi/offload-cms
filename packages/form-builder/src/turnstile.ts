import { z } from "zod";

const siteverifyResponse = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).default([]),
  metadata: z.object({ result_with_testing_key: z.boolean().optional() }).optional(),
});

export type TurnstileCheck = {
  /** The token the widget gave the visitor. */
  token: string;
  /** The widget's secret key. */
  secret: string;
  /** The host the visitor's page was served from, which the widget must have run on. */
  hostname: string;
  /** The visitor's IP address. */
  remoteip?: string;
};

/**
 * Checks a Turnstile token with Cloudflare's Siteverify API. A token passes only once. A token
 * from another host fails, except a result from Cloudflare's testing keys, which always names
 * `example.com`. A production secret rejects tokens from the testing keys.
 */
export const verifyTurnstile = async (
  { token, secret, hostname, remoteip }: TurnstileCheck,
  fetcher: typeof fetch = fetch,
) => {
  const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, ...(remoteip && { remoteip }) }),
  });
  if (!response.ok) {
    console.warn("Turnstile Siteverify answered", response.status);
    return false;
  }
  const outcome = siteverifyResponse.parse(await response.json());
  if (!outcome.success) {
    console.warn("Turnstile rejected a token", outcome["error-codes"]);
    return false;
  }
  if (!outcome.metadata?.result_with_testing_key && outcome.hostname !== hostname) {
    console.warn("Turnstile token was issued for another host", outcome.hostname);
    return false;
  }
  return true;
};

import { z } from "zod";

const siteverifyResponse = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
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
  /** The `action` the widget was rendered with. */
  action: string;
  /** The visitor's IP address. */
  remoteip?: string;
};

/**
 * Checks a Turnstile token with Cloudflare's Siteverify API. A token passes only once. A token
 * from another host or for another action fails, except a result from Cloudflare's testing keys,
 * which always names `example.com` and no action. A production secret rejects tokens from the
 * testing keys.
 */
export const verifyTurnstile = async (
  { token, secret, hostname, action, remoteip }: TurnstileCheck,
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
  if (outcome.metadata?.result_with_testing_key) return true;
  if (outcome.hostname !== hostname) {
    console.warn("Turnstile token was issued for another host", outcome.hostname);
    return false;
  }
  if (outcome.action !== action) {
    console.warn("Turnstile token was issued for another action", outcome.action);
    return false;
  }
  return true;
};

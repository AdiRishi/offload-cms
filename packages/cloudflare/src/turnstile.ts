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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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
  const outcome: unknown = await response.json();
  if (!isRecord(outcome) || outcome.success !== true) {
    console.warn(
      "Turnstile rejected a token",
      isRecord(outcome) ? outcome["error-codes"] : outcome,
    );
    return false;
  }
  if (isRecord(outcome.metadata) && outcome.metadata.result_with_testing_key === true) return true;
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

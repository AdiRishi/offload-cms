import { accountCollection } from "@adirishi/offload-accounts/config";
import { getBindings } from "@adirishi/offload-cloudflare";

const env = await getBindings();

/** Visitors who log in to the site. They never reach the admin. */
export const Customers = accountCollection(
  {
    slug: "customers",
    // Short enough that the suite sees a session slide, long enough for any one test.
    auth: { tokenExpiration: 90 },
    fields: [{ name: "name", type: "text" }],
  },
  { siteURL: env.SITE_URL, rateLimit: () => env.ACCOUNTS },
);

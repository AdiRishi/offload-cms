// Creates the local admin user from DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD in .dev.vars.
import { getBindings } from "@adirishi/offload-cloudflare";
import config from "@payload-config";
import { getPayload } from "payload";

const { DEV_ADMIN_EMAIL: email, DEV_ADMIN_PASSWORD: password } = await getBindings();
if (!email || !password)
  throw new Error("Set DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD in .dev.vars.");

const payload = await getPayload({ config });
const { totalDocs } = await payload.count({
  collection: "users",
  where: { email: { equals: email } },
  overrideAccess: true,
});
if (totalDocs > 0) {
  payload.logger.info(`${email} already exists.`);
} else {
  await payload.create({ collection: "users", data: { email, password }, overrideAccess: true });
  payload.logger.info(`Created ${email}.`);
}
process.exit(0);

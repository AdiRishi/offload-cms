// Builds the Worker for the default environment and fails when its compressed upload size
// grows past the budget. `wrangler deploy --dry-run` reports the size without contacting
// Cloudflare, so it needs no account or credentials.

import { execFileSync } from "node:child_process";

/** Raise it only for growth you meant to ship, and keep about 5% of headroom. */
const budgetKiB = 3160;

const env = { ...process.env };
delete env.CLOUDFLARE_ENV;
execFileSync("pnpm", ["build"], { env, stdio: "inherit" });
const output = execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run"], {
  encoding: "utf8",
  env,
});

const match = /Total Upload: ([\d.]+) KiB \/ gzip: ([\d.]+) KiB/.exec(output);
if (!match) throw new Error(`wrangler deploy --dry-run printed no upload size:\n${output}`);
const [, total, gzip] = match;
console.log(`Worker upload: ${total} KiB, ${gzip} KiB compressed. Budget: ${budgetKiB} KiB.`);
if (Number(gzip) > budgetKiB) {
  console.error(`The compressed Worker is over its budget of ${budgetKiB} KiB.`);
  process.exitCode = 1;
}

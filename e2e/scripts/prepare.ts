// Prepares a fresh e2e run: an empty database with migrations applied, and a Worker
// build for the selected database. CLOUDFLARE_ENV=postgres selects Postgres through
// Hyperdrive; otherwise the run uses D1.

import { execFileSync } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";

const run = (command: string, args: string[]) => execFileSync(command, args, { stdio: "inherit" });

// Local secrets for the Worker, and the public values for the build. The example values are fine
// for tests, and copying them each run picks up values added since the last run.
copyFileSync(".dev.vars.example", ".dev.vars");
copyFileSync(".env.example", ".env.local");

// Local D1 and R2 data for both environments.
rmSync(".wrangler/state", { force: true, recursive: true });

if (process.env.CLOUDFLARE_ENV === "postgres") {
  run("docker", ["compose", "up", "--detach", "--wait"]);
  run("docker", [
    "compose",
    "exec",
    "-T",
    "postgres",
    "psql",
    "--quiet",
    "-U",
    "offload",
    "-d",
    "offload_e2e",
    "-c",
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
  ]);
}

run("pnpm", ["payload", "migrate"]);
run("pnpm", ["build"]);

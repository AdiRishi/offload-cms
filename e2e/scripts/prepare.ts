// Prepares a fresh e2e run: an empty database with migrations applied, and a Worker
// build for the selected database. CLOUDFLARE_ENV=postgres selects Postgres through
// Hyperdrive; otherwise the run uses D1.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";

const run = (command: string, args: string[]) => execFileSync(command, args, { stdio: "inherit" });

// Local secrets for the Worker. The example values are fine for tests.
if (!existsSync(".dev.vars")) copyFileSync(".dev.vars.example", ".dev.vars");

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

// Drop a database that has documents in it, then run every migration's down, so a database
// command that fails on D1 fails the run. migrate:fresh puts every migration in one batch, which
// migrate:down rolls back newest first. migrate:reset would run the downs oldest first
// (payloadcms/payload#15334). The CLI opens the local database, so it must finish before the
// suite starts the preview server.
run("pnpm", ["payload", "migrate"]);
run("pnpm", [
  "payload",
  "createDocuments",
  "--slug=pages",
  `--documents=${JSON.stringify([
    {
      data: {
        _status: "published",
        layout: [{ blockType: "cta", href: "/", label: "Home" }],
        slug: "reset",
        title: "Reset",
      },
    },
  ])}`,
]);
run("pnpm", ["payload", "migrate:fresh", "--force-accept-warning"]);
run("pnpm", ["payload", "migrate:down"]);
run("pnpm", ["payload", "migrate"]);
run("pnpm", ["build"]);

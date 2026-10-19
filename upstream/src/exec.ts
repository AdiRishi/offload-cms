import { execFileSync, type ExecFileSyncOptions } from "node:child_process";

import { checkoutDir } from "./pin.ts";

export const run = (command: string, args: string[], options: ExecFileSyncOptions = {}) => {
  execFileSync(command, args, { stdio: "inherit", ...options });
};

export const output = (command: string, args: string[], options: ExecFileSyncOptions = {}) =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  })
    .toString()
    .trim();

/** Runs git in the checkout. Upstream's husky hooks never run for our commits. */
export const git = (args: string[]) =>
  run("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: checkoutDir });

export const gitOutput = (args: string[]) => output("git", args, { cwd: checkoutDir });

/** Uncommitted changes in the checkout, ignoring the AGENTS.md block Turborepo rewrites on every run. */
export const checkoutChanges = () => gitOutput(["status", "--porcelain", "--", ".", ":!AGENTS.md"]);

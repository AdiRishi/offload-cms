import { checkoutChanges, gitOutput, run } from "./exec.ts";
import { patchFiles } from "./patches.ts";
import { checkoutDir, pin } from "./pin.ts";

/** Builds every Payload package in the checkout, after checking that it is the pin plus the patches. */
export const build = () => {
  if (
    gitOutput(["rev-parse", "offload-base"]) !== pin.commit ||
    Number(gitOutput(["rev-list", "--count", `${pin.commit}..offload`])) !== patchFiles().length ||
    checkoutChanges() !== ""
  ) {
    throw new Error(
      "upstream/payload does not match the pin and patches. Export your commits with `pnpm upstream export`, or reset it with `pnpm upstream checkout --force`.",
    );
  }

  // Building needs no install scripts. Skipping them avoids compiling better-sqlite3 and
  // downloading MongoDB for Payload's test suite.
  run("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"], { cwd: checkoutDir });
  run("pnpm", ["build:all"], { cwd: checkoutDir });
};

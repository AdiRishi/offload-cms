import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { checkoutChanges, git, gitOutput, run } from "./exec.ts";
import { patchFiles } from "./patches.ts";
import { checkoutDir, pin } from "./pin.ts";

const hasPinnedCommit = () => {
  try {
    gitOutput(["cat-file", "-e", `${pin.commit}^{commit}`]);
    return true;
  } catch {
    return false;
  }
};

/** Creates upstream/payload: Payload at the pinned commit with the patches applied on branch `offload`. */
export const checkout = ({ force }: { force: boolean }) => {
  if (!existsSync(path.join(checkoutDir, ".git"))) {
    mkdirSync(path.dirname(checkoutDir), { recursive: true });
    run("git", ["clone", "--filter=blob:none", "--no-checkout", pin.repository, checkoutDir]);
  } else if (checkoutChanges() !== "" && !force) {
    throw new Error(
      "upstream/payload has uncommitted changes. Commit and `pnpm upstream:export` them, or rerun with --force.",
    );
  }

  if (!hasPinnedCommit()) git(["fetch", "--tags", "origin"]);

  git(["config", "rerere.enabled", "true"]);
  git(["config", "rerere.autoupdate", "true"]);
  git(["config", "user.name", "Offload"]);
  git(["config", "user.email", "offload@localhost"]);
  // Patch files carry no signatures, so signing the throwaway commits here adds nothing.
  git(["config", "commit.gpgsign", "false"]);
  git(["checkout", "--force", "-B", "offload", pin.commit]);
  git(["clean", "-fdq", "--exclude=node_modules"]);
  git(["tag", "--force", "offload-base", pin.commit]);

  const patches = patchFiles();
  if (patches.length > 0) {
    try {
      git(["am", "-3", "--committer-date-is-author-date", ...patches]);
    } catch {
      throw new Error(
        [
          "A patch did not apply. Resolve the conflict in upstream/payload, then:",
          "  git -C upstream/payload add <files> && git -C upstream/payload am --continue",
          "  pnpm upstream:export",
        ].join("\n"),
      );
    }
  }

  console.log(
    `\nupstream/payload is ${pin.tag} with ${patches.length} Offload patch(es) on branch offload.`,
  );
};

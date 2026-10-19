import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { checkoutChanges, git, gitOutput } from "./exec.ts";
import { exportPatches } from "./export.ts";
import { type PatchCommit, readPatchCommits } from "./patches.ts";
import { checkoutDir, pin, writePin } from "./pin.ts";

type QueuedPatch = Pick<PatchCommit, "id" | "intent" | "sha" | "subject">;
type PendingUpgrade = { commit: string; queue: QueuedPatch[]; tag: string };

const statePath = path.join(checkoutDir, ".git", "offload-upgrade.json");

const saveState = (state: PendingUpgrade) =>
  writeFileSync(statePath, JSON.stringify(state, null, 2));

const applyQueue = (state: PendingUpgrade) => {
  if (existsSync(path.join(checkoutDir, ".git", "CHERRY_PICK_HEAD"))) {
    throw new Error(
      "A cherry-pick is still in progress. Resolve it and run `git -C upstream/payload cherry-pick --continue` first.",
    );
  }

  for (const [index, patch] of state.queue.entries()) {
    saveState({ ...state, queue: state.queue.slice(index + 1) });
    console.log(`\nApplying ${patch.id}: ${patch.subject}`);
    try {
      git(["cherry-pick", "--allow-empty", "--keep-redundant-commits", patch.sha]);
    } catch {
      throw new Error(
        [
          `Patch ${patch.id} conflicts with ${state.tag}. Its intent:`,
          "",
          patch.intent,
          "",
          "Resolve the conflict in upstream/payload, then run:",
          "  git -C upstream/payload add <files> && git -C upstream/payload cherry-pick --continue",
          "  pnpm upstream:upgrade --continue",
        ].join("\n"),
      );
    }
    if (gitOutput(["diff", "--stat", "HEAD~1", "HEAD"]) === "") {
      console.log(`${patch.id} is empty on ${state.tag}, so upstream already has it. Dropping it.`);
      git(["reset", "--hard", "HEAD~1"]);
    }
  }

  git(["tag", "--force", "offload-base", state.commit]);
  writePin({ ...pin, commit: state.commit, revision: 0, tag: state.tag });
  rmSync(statePath, { force: true });
  exportPatches(state);
  console.log(`\nUpgraded to ${state.tag}. Review upstream/patches, then build, test and release.`);
};

/**
 * Moves the patches onto a newer upstream release by cherry-picking them one at
 * a time. On a conflict it stops and prints the patch's intent; resolve it, then
 * run `upgradeContinue`. A patch that becomes empty is already upstream and is
 * dropped. The old branch stays at refs/offload/previous.
 */
export const upgrade = ({ drop, tag }: { drop: string[]; tag: string }) => {
  if (checkoutChanges() !== "") {
    throw new Error("upstream/payload has uncommitted changes. Export or discard them first.");
  }

  const commits = readPatchCommits({ base: pin.commit, head: "offload" });
  const unknownDrops = drop.filter((id) => !commits.some((patch) => patch.id === id));
  if (unknownDrops.length > 0) throw new Error(`Unknown patch id(s): ${unknownDrops.join(", ")}`);

  git(["fetch", "--tags", "origin"]);
  const commit = gitOutput(["rev-parse", `${tag}^{commit}`]);

  git(["update-ref", "refs/offload/previous", "offload"]);
  git(["checkout", "--force", "-B", "offload", commit]);

  applyQueue({
    commit,
    queue: commits
      .filter((patch) => !drop.includes(patch.id))
      .map(({ id, intent, sha, subject }) => ({ id, intent, sha, subject })),
    tag,
  });
};

export const upgradeContinue = () => {
  if (!existsSync(statePath)) throw new Error("No upgrade in progress.");
  const state: PendingUpgrade = JSON.parse(readFileSync(statePath, "utf8"));
  applyQueue(state);
};

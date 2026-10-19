import { output } from "./exec.ts";
import { readPatchCommits } from "./patches.ts";
import { pin } from "./pin.ts";

const pullRequest = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/;

const upstreamState = (upstream: string | undefined, against: string | undefined) => {
  const match = upstream === undefined ? null : pullRequest.exec(upstream);
  if (!match) return upstream === undefined ? "not proposed" : "not a PR";
  const [, repository = "", number = ""] = match;

  const [state = "", mergeSha = ""] = output("gh", [
    "pr",
    "view",
    number,
    "--repo",
    repository,
    "--json",
    "state,mergeCommit",
    "--jq",
    '[.state, .mergeCommit.oid // ""] | @tsv',
  ]).split("\t");
  if (state !== "MERGED" || against === undefined) return state.toLowerCase();
  if (mergeSha === "") return "merged";

  const comparison = output("gh", [
    "api",
    `repos/${repository}/compare/${mergeSha}...${against}`,
    "--jq",
    ".status",
  ]);
  return comparison === "ahead" || comparison === "identical"
    ? `merged, in ${against}: drop this patch`
    : `merged, not in ${against}`;
};

/**
 * Lists the patches and the state of each upstream PR. With `against`, also
 * reports whether that release already contains the merged PR, which means the
 * patch can be dropped on upgrade.
 */
export const status = ({ against }: { against?: string }) => {
  const commits = readPatchCommits({ base: pin.commit, head: "offload" });

  console.log(`Payload ${pin.tag}, ${commits.length} patch(es)\n`);
  for (const patch of commits) {
    console.log(`${patch.id}: ${patch.subject}`);
    console.log(
      `  upstream:  ${patch.upstream ?? "-"} (${upstreamState(patch.upstream, against)})`,
    );
    console.log(`  drop when: ${patch.dropWhen}`);
    console.log(`  tests:     ${patch.tests}\n`);
  }
};

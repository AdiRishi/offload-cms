import { latestRelease, offloadVersion, releaseTag } from "@repo/upstream";
import { execFileSync, spawnSync } from "node:child_process";

import { repoRoot } from "./exec.ts";

/** Paths whose changes reach the published packages. A change anywhere else releases nothing. */
const shippedPaths = [
  "packages",
  "release/package.json",
  "release/src",
  "upstream/patches",
  "upstream/payload.json",
  ":!*AGENTS.md",
  ":!*.test.ts",
];

const gitSucceeds = (args: string[]) =>
  spawnSync("git", args, { cwd: repoRoot, stdio: "ignore" }).status === 0;

export type NextRelease = { publish: true; version: string } | { publish: false; reason: string };

/**
 * The release HEAD should publish: the next revision after the latest release
 * tag, when HEAD is newer than that tag and changes what the packages ship.
 */
export const nextRelease = (): NextRelease => {
  const latest = latestRelease();
  if (latest === undefined) return { publish: true, version: offloadVersion(0) };

  // CI for an older commit can finish after a newer commit was released.
  if (gitSucceeds(["merge-base", "--is-ancestor", "HEAD", latest.tag])) {
    return { publish: false, reason: `HEAD is already part of ${latest.version}.` };
  }
  if (gitSucceeds(["diff", "--quiet", latest.tag, "HEAD", "--", ...shippedPaths])) {
    return {
      publish: false,
      reason: `Nothing the packages ship has changed since ${latest.version}.`,
    };
  }
  return { publish: true, version: offloadVersion(latest.revision + 1) };
};

/** Tags HEAD as the commit `version` was published from, and pushes the tag. */
export const tagRelease = (version: string) => {
  const tag = releaseTag(version);
  execFileSync("git", ["tag", tag, "HEAD"], { cwd: repoRoot, stdio: "inherit" });
  execFileSync("git", ["push", "origin", tag], { cwd: repoRoot, stdio: "inherit" });
};

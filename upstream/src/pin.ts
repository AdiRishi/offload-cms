import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import pinFile from "../payload.json" with { type: "json" };

export type UpstreamPin = {
  commit: string;
  repository: string;
  tag: string;
};

export const pin: UpstreamPin = pinFile;

export const upstreamDir = path.resolve(import.meta.dirname, "..");
export const patchesDir = path.join(upstreamDir, "patches");
/** Payload at the pinned commit with the patches applied, created by `upstream checkout`. */
export const checkoutDir = path.join(upstreamDir, "payload");

export const writePin = (next: UpstreamPin) =>
  writeFileSync(path.join(upstreamDir, "payload.json"), `${JSON.stringify(next, null, 2)}\n`);

const payloadVersion = pin.tag.replace(/^v/, "");

/** Offload release `revision` of the pinned tag: `v4.0.0-beta.2` at revision 3 is `4.0.0-beta.2-offload.3`. */
export const offloadVersion = (revision: number) => `${payloadVersion}-offload.${revision}`;

/** The version `pnpm release e2e` publishes the working tree at. No real release has it. */
export const workingTreeVersion = `${payloadVersion}-offload.dev`;

/** The git tag on the commit a release was published from. */
export const releaseTag = (version: string) => `v${version}`;

const releaseTagPrefix = releaseTag(`${payloadVersion}-offload.`);

/** The newest published release of the pinned tag, read from the release tags. */
export const latestRelease = () => {
  const revisions = execFileSync("git", ["tag", "--list", `${releaseTagPrefix}*`], {
    cwd: upstreamDir,
    encoding: "utf8",
  })
    .split("\n")
    .map((tag) => tag.slice(releaseTagPrefix.length))
    .filter((revision) => /^\d+$/.test(revision))
    .map(Number);
  if (revisions.length === 0) return undefined;
  const revision = Math.max(...revisions);
  const version = offloadVersion(revision);
  return { revision, tag: releaseTag(version), version };
};

/** Published name for an upstream package: `payload` → `@adirishi/offload-payload`, `@payloadcms/ui` → `@adirishi/offload-ui`. */
export const offloadPackageName = (upstreamName: string) =>
  `@adirishi/offload-${upstreamName.replace(/^@payloadcms\//, "")}`;

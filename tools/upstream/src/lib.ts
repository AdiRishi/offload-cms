import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const repoRoot = path.resolve(import.meta.dirname, "../../..");
export const upstreamDir = path.join(repoRoot, "upstream");
export const patchesDir = path.join(upstreamDir, "patches");
export const vendorDir = path.join(repoRoot, "vendor", "payload");

export type UpstreamPin = {
  commit: string;
  repository: string;
  /** Offload release number on top of `tag`; reset to 0 when the tag changes. */
  revision: number;
  tag: string;
};

const pinPath = path.join(upstreamDir, "payload.json");

export const readPin = (): UpstreamPin => {
  const pin: unknown = JSON.parse(readFileSync(pinPath, "utf8"));
  if (
    typeof pin === "object" &&
    pin !== null &&
    "commit" in pin &&
    typeof pin.commit === "string" &&
    "repository" in pin &&
    typeof pin.repository === "string" &&
    "revision" in pin &&
    typeof pin.revision === "number" &&
    "tag" in pin &&
    typeof pin.tag === "string"
  ) {
    return { commit: pin.commit, repository: pin.repository, revision: pin.revision, tag: pin.tag };
  }
  return fail(`${pinPath} must contain repository, tag, commit and revision`);
};

export const writePin = (pin: UpstreamPin) =>
  writeFileSync(pinPath, `${JSON.stringify(pin, null, 2)}\n`);

/** `v4.0.0-beta.2` at revision 3 releases as `4.0.0-beta.2-offload.3`. */
export const offloadVersion = (pin: UpstreamPin) =>
  `${pin.tag.replace(/^v/, "")}-offload.${pin.revision}`;

/** Published name for an upstream package: `payload` → `@arishi/offload-payload`, `@payloadcms/ui` → `@arishi/offload-ui`. */
export const offloadPackageName = (upstreamName: string) =>
  `@arishi/offload-${upstreamName.replace(/^@payloadcms\//, "")}`;

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

/** Runs git inside the vendored checkout. Upstream's husky hooks never run for our commits. */
export const vendorGit = (args: string[], options: ExecFileSyncOptions = {}) =>
  run("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: vendorDir, ...options });

export const vendorGitOutput = (args: string[]) => output("git", args, { cwd: vendorDir });

/** Uncommitted changes in vendor/payload, ignoring the AGENTS.md block Turborepo rewrites on every run. */
export const vendorChanges = () =>
  vendorGitOutput(["status", "--porcelain", "--", ".", ":!AGENTS.md"]);

export const fail = (message: string): never => {
  console.error(`\n${message}`);
  process.exit(1);
};

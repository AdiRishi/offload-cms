// Builds the patched Payload in vendor/payload and publishes every package as
// @adirishi/offload-<name>, followed by Offload's own packages in packages/.
//
// Internal dependencies become npm aliases ("@payloadcms/ui":
// "npm:@adirishi/offload-ui@<version>"), so code keeps importing `payload` and
// `@payloadcms/*` and sites install the Offload builds under those names.
//
// usage: pnpm release [--skip-build] [--registry <url>]
//   OFFLOAD_REGISTRY        registry URL (default http://localhost:4873)
//   OFFLOAD_REGISTRY_TOKEN  auth token (not needed for the local registry)

import {
  checkoutDir as vendorDir,
  offloadPackageName,
  offloadVersion as version,
} from "@repo/upstream";
import { execFile, execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const registryArg = process.argv.indexOf("--registry");
const registry =
  (registryArg === -1 ? undefined : process.argv[registryArg + 1]) ??
  process.env.OFFLOAD_REGISTRY ??
  "http://localhost:4873";
const skipBuild = process.argv.includes("--skip-build");

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const fail = (message: string): never => {
  console.error(`\n${message}`);
  process.exit(1);
};
const output = (command: string, args: string[]) =>
  execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

const npmrc = path.join(mkdtempSync(path.join(tmpdir(), "offload-npmrc-")), ".npmrc");
const registryHost = registry.replace(/^https?:/, "");
writeFileSync(
  npmrc,
  `${registryHost.endsWith("/") ? registryHost : `${registryHost}/`}:_authToken=${process.env.OFFLOAD_REGISTRY_TOKEN ?? "local-registry"}\n`,
);

// A version is published once. Releasing an unchanged pin is a no-op, so CI can run this on every push.
const alreadyPublished = (() => {
  try {
    const name = offloadPackageName("payload");
    return (
      output("npm", [
        "view",
        `${name}@${version}`,
        "version",
        "--registry",
        registry,
        "--userconfig",
        npmrc,
      ]) === version
    );
  } catch {
    return false;
  }
})();
if (alreadyPublished) {
  console.log(
    `${version} is already published to ${registry}. Bump revision in upstream/payload.json to release changes.`,
  );
  process.exit(0);
}

// Offload's identity replaces Payload's on every package it republishes. The repository
// link is also how GitHub Packages attaches the packages to this repo.
const rootManifest: unknown = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const rootField = (field: string) =>
  typeof rootManifest === "object" && rootManifest !== null && field in rootManifest
    ? Reflect.get(rootManifest, field)
    : undefined;
const identity = {
  bugs: rootField("bugs"),
  homepage: rootField("homepage"),
  repository: rootField("repository"),
};
const homepage = String(identity.homepage).replace(/#readme$/, "");

const offloadReadme = ({ published, upstream }: { published: string; upstream: string }) =>
  [
    `# ${published}`,
    "",
    `Part of [Offload](${homepage}): [Payload CMS](https://payloadcms.com) v4 for TanStack Start sites on Cloudflare Workers.`,
    "",
    `This package is \`${upstream}\` with Offload's patches applied. Offload is not affiliated with Payload. Install it under the upstream name, so code and Payload's documentation keep working:`,
    "",
    "```json",
    `"${upstream.slice(0, upstream.lastIndexOf("@"))}": "npm:${published}@${version}"`,
    "```",
    "",
    "Payload is MIT-licensed by Payload CMS, LLC. See `LICENSE.md`.",
    "",
  ].join("\n");

// Builds and verifies the checkout through Turborepo, then builds packages/.
if (!skipBuild)
  execFileSync("pnpm", ["turbo", "run", "build"], { cwd: repoRoot, stdio: "inherit" });

// Payload's own release order: dependencies before dependents.
const publishList = [
  ...readFileSync(path.join(vendorDir, "tools/releaser/src/lib/publishList.ts"), "utf8").matchAll(
    /^\s*'([a-z0-9-]+)',?$/gm,
  ),
].map(([, directory = ""]) => path.join(vendorDir, "packages", directory));
if (publishList.length === 0) fail("Could not read the publish list from vendor/payload.");

const ownPackages = readdirSync(path.join(repoRoot, "packages"))
  .map((directory) => path.join(repoRoot, "packages", directory))
  .filter((directory) => {
    const manifest: unknown = JSON.parse(
      readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    return (
      typeof manifest === "object" &&
      manifest !== null &&
      !("private" in manifest && manifest.private === true)
    );
  });

const packDir = mkdtempSync(path.join(tmpdir(), "offload-release-"));

type Packed = { directory: string; manifest: Record<string, unknown>; manifestPath: string };

const execFileAsync = promisify(execFile);

/** Runs `task` over `items` with at most `limit` in flight. Results keep the input order. */
const mapConcurrent = async <T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) => {
  const results: R[] = [];
  const entries = items.entries();
  const worker = async () => {
    // Each worker takes the next item from the shared iterator, so it awaits one at a time.
    // oxlint-disable-next-line eslint/no-await-in-loop
    for (const [index, item] of entries) results[index] = await task(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

const pack = async (packageDir: string): Promise<Packed> => {
  const { stdout } = await execFileAsync("pnpm", ["pack", "--pack-destination", packDir], {
    cwd: packageDir,
  });
  const tarball = stdout.split("\n").findLast((line) => line.endsWith(".tgz"));
  if (tarball === undefined) return fail(`pnpm pack produced no tarball for ${packageDir}`);

  const directory = mkdtempSync(path.join(packDir, "pkg-"));
  await execFileAsync("tar", ["-xzf", path.resolve(packDir, tarball), "-C", directory]);
  const manifestPath = path.join(directory, "package", "package.json");
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return fail(`${manifestPath} is not a JSON object`);
  }
  return { directory: path.join(directory, "package"), manifest: { ...manifest }, manifestPath };
};

const concurrency = 8;
const upstreamPackages = await mapConcurrent(publishList, concurrency, pack);
const ownPacked = await mapConcurrent(ownPackages, concurrency, pack);
const upstreamNames = new Set(upstreamPackages.map(({ manifest }) => String(manifest.name)));

const isDependencyMap = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((range) => typeof range === "string");

const rewrite = ({ directory, manifest, manifestPath }: Packed) => {
  const name = String(manifest.name);
  const isUpstream = upstreamNames.has(name);
  const upstream = `${name}@${String(manifest.version)}`;
  const published = isUpstream ? offloadPackageName(name) : name;
  const rewritten: Record<string, unknown> = {
    ...manifest,
    ...(isUpstream && {
      ...identity,
      author: undefined,
      description: `Offload build of ${upstream}. Payload CMS v4 for TanStack Start sites on Cloudflare Workers.`,
      funding: undefined,
      keywords: ["offload", "payload", "cms", "cloudflare-workers", "tanstack-start"],
      maintainers: undefined,
      offload: { upstream },
    }),
    name: published,
    version,
    publishConfig: undefined,
    // Consumers never install devDependencies, and ours name unpublished workspace packages.
    devDependencies: undefined,
  };

  if (isUpstream) {
    writeFileSync(path.join(directory, "README.md"), offloadReadme({ published, upstream }));
    // MIT requires Payload's notice in every copy; some packages don't ship it.
    if (!existsSync(path.join(directory, "LICENSE.md"))) {
      copyFileSync(path.join(vendorDir, "LICENSE.md"), path.join(directory, "LICENSE.md"));
    }
  }

  for (const field of ["dependencies", "optionalDependencies"]) {
    const dependencies = manifest[field];
    if (!isDependencyMap(dependencies)) continue;
    rewritten[field] = Object.fromEntries(
      Object.entries(dependencies).map(([dependency, range]) => [
        dependency,
        upstreamNames.has(dependency) ? `npm:${offloadPackageName(dependency)}@${version}` : range,
      ]),
    );
  }
  // Peers keep the names the site installs, so only the version changes.
  const peers = manifest.peerDependencies;
  if (isDependencyMap(peers)) {
    rewritten.peerDependencies = Object.fromEntries(
      Object.entries(peers).map(([dependency, range]) => [
        dependency,
        upstreamNames.has(dependency) ? version : range,
      ]),
    );
  }

  writeFileSync(manifestPath, `${JSON.stringify(rewritten, null, 2)}\n`);
  return String(rewritten.name);
};

const published = await mapConcurrent(
  [...upstreamPackages, ...ownPacked],
  concurrency,
  async (packed) => {
    const name = rewrite(packed);
    try {
      await execFileAsync("npm", [
        "publish",
        packed.directory,
        "--registry",
        registry,
        "--tag",
        "latest",
        "--userconfig",
        npmrc,
      ]);
    } catch (error) {
      fail(`Publishing ${name} failed:\n${error instanceof Error ? error.message : String(error)}`);
    }
    console.log(`+ ${name}@${version}`);
    return name;
  },
);

rmSync(packDir, { force: true, recursive: true });
console.log(`\nPublished ${published.length} packages at ${version} to ${registry}:`);
console.log(published.map((name) => `  ${name}`).join("\n"));

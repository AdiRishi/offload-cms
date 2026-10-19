import { checkoutDir, offloadPackageName, pin, releaseTag } from "@repo/upstream";
import { execFile } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { repoRoot, run } from "./exec.ts";
import { nameCollisions, releaseManifest } from "./manifest.ts";
import {
  offloadPackageDirs,
  readManifest,
  upstreamPackageDirs,
  writeManifest,
} from "./packages.ts";

const execFileAsync = promisify(execFile);
const concurrency = 8;
/** The tarballs `pack` makes, which the Publish workflow attests and then `publish` uploads. */
const distDir = path.resolve(import.meta.dirname, "../dist");
/** The version of the tarballs in distDir. */
const releaseFile = path.join(distDir, "release.json");

type PackedRelease = { version: string };

const packedTarballs = () =>
  readdirSync(distDir)
    .filter((file) => file.endsWith(".tgz"))
    .map((file) => path.join(distDir, file));

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

const docsUrl = "https://adirishi.github.io/offload-cms";

const offloadReadme = ({
  packageDir,
  published,
  upstreamName,
  version,
}: {
  packageDir: string;
  published: string;
  upstreamName: string;
  version: string;
}) =>
  [
    `# ${published}`,
    "",
    `This package is \`${upstreamName}\` from Payload ${pin.tag}, with [Offload's patches](${docsUrl}/patches) applied. [Offload](${docsUrl}) runs Payload sites built with TanStack Start on Cloudflare Workers.`,
    "",
    "## Install",
    "",
    "Install the package under its upstream name, so imports and Payload's documentation keep working. Every Payload package in a site must be an Offload build at the same version:",
    "",
    "```json",
    `"${upstreamName}": "npm:${published}@${version}"`,
    "```",
    "",
    `GitHub Packages needs a token with the \`read:packages\` scope. [Getting started](${docsUrl}/getting-started) shows the \`.npmrc\` and the rest of a site's setup.`,
    "",
    "## Documentation",
    "",
    `Use [Payload's documentation](https://payloadcms.com/docs) and the [upstream source](https://github.com/payloadcms/payload/tree/${pin.tag}/packages/${path.basename(packageDir)}).`,
    "",
    "Offload is not affiliated with Payload. Payload is MIT-licensed by Payload CMS, LLC. See `LICENSE.md`.",
    "",
  ].join("\n");

/** Packs a package with pnpm and unpacks it, returning the directory to rewrite for the release. */
const unpack = async (packageDir: string, workDir: string) => {
  const { stdout } = await execFileAsync("pnpm", ["pack", "--pack-destination", workDir], {
    cwd: packageDir,
  });
  const tarball = stdout.split("\n").findLast((line) => line.endsWith(".tgz"));
  if (tarball === undefined) throw new Error(`pnpm pack produced no tarball for ${packageDir}`);
  const directory = mkdtempSync(path.join(workDir, "pkg-"));
  await execFileAsync("tar", ["-xzf", path.resolve(workDir, tarball), "-C", directory]);
  return path.join(directory, "package");
};

/**
 * Builds the Payload packages as `@adirishi/offload-<name>` and Offload's own
 * packages, all at `version`, and packs each into release/dist. Publishes nothing.
 */
export const pack = async (version: string) => {
  rmSync(distDir, { force: true, recursive: true });
  mkdirSync(distDir, { recursive: true });
  const workDir = mkdtempSync(path.join(tmpdir(), "offload-release-"));

  try {
    const upstreamDirs = await upstreamPackageDirs();
    const upstreamNames = new Set(upstreamDirs.map((directory) => readManifest(directory).name));
    const offloadDirs = offloadPackageDirs();
    const collisions = nameCollisions(
      offloadDirs.map((directory) => readManifest(directory).name),
      upstreamNames,
    );
    if (collisions.length > 0) {
      throw new Error(
        `Upstream Payload now has a package that publishes as ${collisions.join(", ")}, which an Offload package in packages/ already uses. Remove or rename the Offload package.`,
      );
    }

    await run("pnpm", ["turbo", "run", "build", "--filter=@repo/release^..."], { cwd: repoRoot });

    await mapConcurrent([...upstreamDirs, ...offloadDirs], concurrency, async (packageDir) => {
      const directory = await unpack(packageDir, workDir);
      const manifest = readManifest(directory);
      const release = releaseManifest(manifest, { upstreamNames, version });
      writeManifest(directory, release);

      if (upstreamNames.has(manifest.name)) {
        writeFileSync(
          path.join(directory, "README.md"),
          offloadReadme({
            packageDir,
            published: release.name,
            upstreamName: manifest.name,
            version,
          }),
        );
        // MIT requires Payload's notice in every copy; some packages don't ship it.
        if (!existsSync(path.join(directory, "LICENSE.md"))) {
          copyFileSync(path.join(checkoutDir, "LICENSE.md"), path.join(directory, "LICENSE.md"));
        }
      }

      await execFileAsync("npm", [
        "pack",
        directory,
        "--pack-destination",
        distDir,
        "--ignore-scripts",
      ]);
    });

    writeFileSync(releaseFile, `${JSON.stringify({ version } satisfies PackedRelease)}\n`);
    console.log(`Packed ${packedTarballs().length} packages at ${version} into ${distDir}.`);
  } finally {
    rmSync(workDir, { force: true, recursive: true });
  }
};

/**
 * Uploads every tarball that `pack` left in release/dist, unchanged, and
 * returns their version. Uploading the files, not package directories, makes
 * the registry serve exactly the bytes the Publish workflow attested.
 */
export const publish = async ({ registry, token }: { registry: string; token: string }) => {
  if (!existsSync(releaseFile)) throw new Error(`${distDir} has no release. Run pack first.`);
  const { version }: PackedRelease = JSON.parse(readFileSync(releaseFile, "utf8"));
  const tarballs = packedTarballs();

  const workDir = mkdtempSync(path.join(tmpdir(), "offload-release-"));
  const npmrc = path.join(workDir, ".npmrc");
  const registryHost = registry.replace(/^https?:/, "").replace(/\/?$/, "/");
  writeFileSync(npmrc, `${registryHost}:_authToken=${token}\n`);
  const npm = (args: string[]) =>
    execFileAsync("npm", [...args, "--registry", registry, "--userconfig", npmrc]);

  try {
    const published = await npm([
      "view",
      `${offloadPackageName("payload")}@${version}`,
      "version",
    ]).then(
      ({ stdout }) => stdout.trim() === version,
      () => false,
    );
    if (published) {
      throw new Error(
        `${version} is already in ${registry}, but no ${releaseTag(version)} tag marks it. Tag the commit it was published from and push the tag.`,
      );
    }

    await mapConcurrent(tarballs, concurrency, async (tarball) => {
      await npm(["publish", tarball, "--tag", "latest", "--ignore-scripts"]).catch(
        (error: unknown) => {
          throw new Error(`Publishing ${path.basename(tarball)} failed:\n${String(error)}`);
        },
      );
      console.log(`+ ${path.basename(tarball)}`);
    });

    console.log(`\nPublished ${tarballs.length} packages at ${version} to ${registry}.`);
    return version;
  } finally {
    rmSync(workDir, { force: true, recursive: true });
  }
};

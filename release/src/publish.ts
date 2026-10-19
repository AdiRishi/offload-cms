import { checkoutDir, offloadPackageName, pin, releaseTag } from "@repo/upstream";
import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { repoRoot, run } from "./exec.ts";
import { releaseManifest } from "./manifest.ts";
import {
  offloadPackageDirs,
  readManifest,
  upstreamPackageDirs,
  writeManifest,
} from "./packages.ts";

const execFileAsync = promisify(execFile);
const concurrency = 8;
/** Every tarball the last publish uploaded, byte for byte, for the Publish workflow to attest. */
const tarballsDir = path.resolve(import.meta.dirname, "../dist");

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
    "Install the package under its upstream name, so imports and Payload's documentation keep working:",
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

/** Packs a package with pnpm and unpacks it, returning the directory npm publishes. */
const pack = async (packageDir: string, workDir: string) => {
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
 * Builds and publishes the Payload packages as `@adirishi/offload-<name>` and
 * Offload's own packages, all at `version`.
 */
export const publish = async ({
  registry,
  token,
  version,
}: {
  registry: string;
  token: string;
  version: string;
}) => {
  rmSync(tarballsDir, { force: true, recursive: true });
  mkdirSync(tarballsDir, { recursive: true });
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
        `${version} is already in ${registry}, but no ${releaseTag(version)} tag marks it. Tag the commit it was published from, then run publish again.`,
      );
    }

    await run("pnpm", ["turbo", "run", "build", "--filter=@repo/release^..."], { cwd: repoRoot });
    const upstreamDirs = await upstreamPackageDirs();
    const upstreamNames = new Set(upstreamDirs.map((directory) => readManifest(directory).name));

    const names = await mapConcurrent(
      [...upstreamDirs, ...offloadPackageDirs()],
      concurrency,
      async (packageDir) => {
        const directory = await pack(packageDir, workDir);
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

        // Publishing the packed file, not the directory, makes the registry serve exactly the
        // bytes left in tarballsDir, so an attestation of that file covers what sites install.
        const { stdout } = await npm([
          "pack",
          directory,
          "--pack-destination",
          tarballsDir,
          "--ignore-scripts",
        ]);
        const tarball = path.join(tarballsDir, stdout.trim().split("\n").at(-1) ?? "");
        await npm(["publish", tarball, "--tag", "latest", "--ignore-scripts"]).catch(
          (error: unknown) => {
            throw new Error(`Publishing ${release.name} failed:\n${String(error)}`);
          },
        );
        console.log(`+ ${release.name}@${version}`);
        return release.name;
      },
    );

    console.log(`\nPublished ${names.length} packages at ${version} to ${registry}.`);
  } finally {
    rmSync(workDir, { force: true, recursive: true });
  }
};

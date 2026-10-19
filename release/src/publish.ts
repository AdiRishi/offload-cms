import { checkoutDir, offloadPackageName, offloadVersion } from "@repo/upstream";
import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import rootManifest from "../../package.json" with { type: "json" };
import { releaseManifest } from "./manifest.ts";
import { offloadPackageDirs, readManifest, upstreamPackageDirs } from "./packages.ts";

const execFileAsync = promisify(execFile);
const concurrency = 8;

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

const offloadReadme = ({ published, upstream }: { published: string; upstream: string }) =>
  [
    `# ${published}`,
    "",
    `Part of [Offload](${rootManifest.homepage.replace(/#readme$/, "")}): [Payload CMS](https://payloadcms.com) v4 for TanStack Start sites on Cloudflare Workers.`,
    "",
    `This package is \`${upstream}\` with Offload's patches applied. Offload is not affiliated with Payload. Install it under the upstream name, so code and Payload's documentation keep working:`,
    "",
    "```json",
    `"${upstream.slice(0, upstream.lastIndexOf("@"))}": "npm:${published}@${offloadVersion}"`,
    "```",
    "",
    "Payload is MIT-licensed by Payload CMS, LLC. See `LICENSE.md`.",
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
 * Publishes the built Payload packages as `@adirishi/offload-<name>` and
 * Offload's own packages, all at the pinned Offload version. A version is
 * published once: if it is already in the registry, this does nothing.
 */
export const publish = async ({ registry, token }: { registry: string; token: string }) => {
  const workDir = mkdtempSync(path.join(tmpdir(), "offload-release-"));
  const npmrc = path.join(workDir, ".npmrc");
  const registryHost = registry.replace(/^https?:/, "").replace(/\/?$/, "/");
  writeFileSync(npmrc, `${registryHost}:_authToken=${token}\n`);
  const npm = (args: string[]) =>
    execFileAsync("npm", [...args, "--registry", registry, "--userconfig", npmrc]);

  try {
    const published = await npm([
      "view",
      `${offloadPackageName("payload")}@${offloadVersion}`,
      "version",
    ]).then(
      ({ stdout }) => stdout.trim() === offloadVersion,
      () => false,
    );
    if (published) {
      console.log(
        `${offloadVersion} is already published to ${registry}. Bump revision in upstream/payload.json to release changes.`,
      );
      return;
    }

    const upstreamDirs = await upstreamPackageDirs();
    const upstreamNames = new Set(upstreamDirs.map((directory) => readManifest(directory).name));

    const names = await mapConcurrent(
      [...upstreamDirs, ...offloadPackageDirs()],
      concurrency,
      async (packageDir) => {
        const directory = await pack(packageDir, workDir);
        const manifest = readManifest(directory);
        const release = releaseManifest(manifest, { upstreamNames, version: offloadVersion });
        writeFileSync(
          path.join(directory, "package.json"),
          `${JSON.stringify(release, null, 2)}\n`,
        );

        if (upstreamNames.has(manifest.name)) {
          writeFileSync(
            path.join(directory, "README.md"),
            offloadReadme({
              published: release.name,
              upstream: `${manifest.name}@${manifest.version}`,
            }),
          );
          // MIT requires Payload's notice in every copy; some packages don't ship it.
          if (!existsSync(path.join(directory, "LICENSE.md"))) {
            copyFileSync(path.join(checkoutDir, "LICENSE.md"), path.join(directory, "LICENSE.md"));
          }
        }

        await npm(["publish", directory, "--tag", "latest"]).catch((error: unknown) => {
          throw new Error(`Publishing ${release.name} failed:\n${String(error)}`);
        });
        console.log(`+ ${release.name}@${offloadVersion}`);
        return release.name;
      },
    );

    console.log(`\nPublished ${names.length} packages at ${offloadVersion} to ${registry}.`);
  } finally {
    rmSync(workDir, { force: true, recursive: true });
  }
};

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import workspaceTurbo from "../../turbo.json" with { type: "json" };
import { checkoutChanges, gitOutput, run } from "./exec.ts";
import { patchFiles } from "./patches.ts";
import { checkoutDir, pin, upstreamDir } from "./pin.ts";

type PublishManifest = {
  name: string;
  private?: boolean;
  publishConfig?: { exports?: Record<string, string | { types?: string }> };
};

/**
 * The adapter's declarations reference Vite and TanStack Start, which the checkout installs at
 * other versions than the workspace does, and mixing two copies breaks every type between them.
 */
const typesFromRelease = new Set(["@payloadcms/tanstack-start"]);

/**
 * Maps every entry point of the built Payload packages to its declarations, as their published
 * manifests do. Offload's packages extend it, so they type-check against the patched build
 * instead of the upstream release that pnpm installs for them.
 */
const writeTypesConfig = () => {
  const packagesDir = path.join(checkoutDir, "packages");
  const paths: Record<string, string[]> = {};
  for (const directory of readdirSync(packagesDir)) {
    const manifestFile = path.join(packagesDir, directory, "package.json");
    if (!existsSync(manifestFile)) continue;
    const manifest: PublishManifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    if (manifest.private || typesFromRelease.has(manifest.name)) continue;
    for (const [subpath, target] of Object.entries(manifest.publishConfig?.exports ?? {})) {
      if (typeof target === "string" || target.types === undefined) continue;
      paths[path.posix.join(manifest.name, subpath)] = [
        `./${path.posix.join("payload/packages", directory, target.types)}`,
      ];
    }
  }
  writeFileSync(
    path.join(upstreamDir, "tsconfig.payload.json"),
    `${JSON.stringify({ compilerOptions: { paths } }, null, 2)}\n`,
  );
};

const turboConfigFile = path.join(upstreamDir, "turbo.payload.json");

/**
 * Payload's Turborepo config with the workspace's remote cache, so every checkout and CI job shares
 * the Payload build. Payload's turbo enables artifact signing only from a config file, and a file
 * inside the checkout would make it differ from the pin.
 */
const writeTurboConfig = () => {
  const config: Record<string, unknown> = JSON.parse(
    readFileSync(path.join(checkoutDir, "turbo.json"), "utf8"),
  );
  writeFileSync(
    turboConfigFile,
    `${JSON.stringify({ ...config, remoteCache: workspaceTurbo.remoteCache }, null, 2)}\n`,
  );
};

/** Builds every Payload package in the checkout, after checking that it is the pin plus the patches. */
export const build = () => {
  if (
    gitOutput(["rev-parse", "offload-base"]) !== pin.commit ||
    Number(gitOutput(["rev-list", "--count", `${pin.commit}..offload`])) !== patchFiles().length ||
    checkoutChanges() !== ""
  ) {
    throw new Error(
      "upstream/payload does not match the pin and patches. Export your commits with `pnpm upstream export`, or reset it with `pnpm upstream checkout --force`.",
    );
  }

  // Building needs no install scripts. Skipping them avoids compiling better-sqlite3 and
  // downloading MongoDB for Payload's test suite.
  run("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"], { cwd: checkoutDir });
  writeTurboConfig();
  run("pnpm", ["build:all"], {
    cwd: checkoutDir,
    env: { ...process.env, TURBO_ROOT_TURBO_JSON: turboConfigFile },
  });
  writeTypesConfig();
};

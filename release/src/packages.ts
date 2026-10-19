import { checkoutDir } from "@repo/upstream";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { PackageManifest } from "./manifest.ts";

import releasePackage from "../package.json" with { type: "json" };

export const readManifest = (directory: string): PackageManifest =>
  JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));

export const writeManifest = (directory: string, manifest: PackageManifest) =>
  writeFileSync(path.join(directory, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);

/** The Payload packages upstream publishes, from Payload's own release tooling. */
export const upstreamPackageDirs = async () => {
  const publishList = path.join(checkoutDir, "tools/releaser/src/lib/publishList.ts");
  const { packagePublishList }: { packagePublishList: unknown } = await import(
    pathToFileURL(publishList).href
  );
  if (
    !Array.isArray(packagePublishList) ||
    !packagePublishList.every((directory) => typeof directory === "string")
  ) {
    throw new Error(`${publishList} no longer exports packagePublishList as a list of names.`);
  }
  return packagePublishList.map((directory) => path.join(checkoutDir, "packages", directory));
};

/**
 * Offload's own packages: the public workspace packages that @repo/release
 * depends on. Depending on them also puts them in the build that `publish` runs first.
 */
export const offloadPackageDirs = () =>
  Object.entries({ ...releasePackage.dependencies, ...releasePackage.devDependencies })
    .filter(([, range]) => range.startsWith("workspace:"))
    .map(([name]) => realpathSync(path.join(import.meta.dirname, "..", "node_modules", name)))
    .filter((directory) => readManifest(directory).private !== true);

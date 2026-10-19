import { offloadPackageName } from "@repo/upstream";

import rootManifest from "../../package.json" with { type: "json" };

type Dependencies = Record<string, string>;

export type PackageManifest = {
  [field: string]: unknown;
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
  name: string;
  optionalDependencies?: Dependencies;
  peerDependencies?: Dependencies;
  private?: boolean;
  version: string;
};

const mapRanges = (
  dependencies: Dependencies | undefined,
  range: (name: string, current: string) => string,
) =>
  dependencies &&
  Object.fromEntries(
    Object.entries(dependencies).map(([name, current]) => [name, range(name, current)]),
  );

/**
 * The manifest a package is published with. Every package takes the Offload
 * version. An upstream package also takes its Offload name and Offload's
 * identity. Dependencies on upstream packages become npm aliases
 * (`"@payloadcms/ui": "npm:@adirishi/offload-ui@<version>"`), so code keeps
 * importing the upstream names. Peers keep the names a site installs, so only
 * their version changes.
 */
export const releaseManifest = (
  manifest: PackageManifest,
  { upstreamNames, version }: { upstreamNames: ReadonlySet<string>; version: string },
): PackageManifest => {
  const isUpstream = upstreamNames.has(manifest.name);
  const upstream = `${manifest.name}@${manifest.version}`;
  const alias = (name: string, range: string) =>
    upstreamNames.has(name) ? `npm:${offloadPackageName(name)}@${version}` : range;

  return {
    ...manifest,
    ...(isUpstream && {
      // The repository link is also how GitHub Packages attaches the packages to this repo.
      bugs: rootManifest.bugs,
      homepage: rootManifest.homepage,
      repository: rootManifest.repository,
      author: undefined,
      description: `${upstream} with Offload's patches, for Payload sites on Cloudflare Workers`,
      funding: undefined,
      keywords: ["offload", "payload", "cms", "cloudflare-workers", "tanstack-start"],
      maintainers: undefined,
      offload: { upstream },
    }),
    name: isUpstream ? offloadPackageName(manifest.name) : manifest.name,
    version,
    publishConfig: undefined,
    // Consumers never install devDependencies, and ours name unpublished workspace packages.
    devDependencies: undefined,
    dependencies: mapRanges(manifest.dependencies, alias),
    optionalDependencies: mapRanges(manifest.optionalDependencies, alias),
    peerDependencies: mapRanges(manifest.peerDependencies, (name, range) =>
      upstreamNames.has(name) ? version : range,
    ),
  };
};

const offloadAlias = /^npm:(@adirishi\/offload-[a-z0-9-]+)@/;

/** Points every `@adirishi/offload-*` dependency of a site, including npm aliases, at `version`. */
export const withOffloadVersion = (manifest: PackageManifest, version: string): PackageManifest => {
  const pin = (name: string, range: string) => {
    const alias = offloadAlias.exec(range)?.[1];
    if (alias !== undefined) return `npm:${alias}@${version}`;
    return name.startsWith("@adirishi/offload-") ? version : range;
  };
  return {
    ...manifest,
    dependencies: mapRanges(manifest.dependencies, pin),
    devDependencies: mapRanges(manifest.devDependencies, pin),
    peerDependencies: mapRanges(manifest.peerDependencies, pin),
  };
};

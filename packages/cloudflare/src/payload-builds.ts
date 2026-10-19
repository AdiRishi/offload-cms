import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  /** Absent only in the nested manifests some packages use to set `type`. */
  name?: string;
  version: string;
};

export const readManifest = (file: string): Manifest => JSON.parse(readFileSync(file, "utf8"));

const isPayloadPackage = (name: string) => name === "payload" || name.startsWith("@payloadcms/");

const offloadName = (upstreamName: string) =>
  `@adirishi/offload-${upstreamName.replace(/^@payloadcms\//, "")}`;

const installLine = (name: string, version: string) =>
  `"${name}": "npm:${offloadName(name)}@${version}"`;

/** The installed manifest of `name`, found the way Node resolves packages from `root`. */
const installedManifest = (root: string, name: string) => {
  for (let directory = root; ; directory = path.dirname(directory)) {
    const file = path.join(directory, "node_modules", name, "package.json");
    if (existsSync(file)) return readManifest(file);
    if (path.dirname(directory) === directory) return undefined;
  }
};

/**
 * Throws unless every Payload package the site at `root` depends on is the
 * Offload build at `version`. An upstream build fails Payload's version check,
 * and it installs upstream copies of other Payload packages without Offload's patches.
 */
export const assertOffloadBuilds = ({ root, version }: { root: string; version: string }) => {
  const site = readManifest(path.join(root, "package.json"));
  const problems = Object.keys({ ...site.dependencies, ...site.devDependencies })
    .filter(isPayloadPackage)
    .flatMap((name) => {
      const installed = installedManifest(root, name);
      if (installed === undefined) return [];
      if (installed.name !== offloadName(name)) {
        return [`${name} is Payload's own build. Install it as ${installLine(name, version)}.`];
      }
      if (installed.version !== version) {
        return [
          `${name} is Offload ${installed.version}, and @adirishi/offload-cloudflare is ${version}. Install it as ${installLine(name, version)}.`,
        ];
      }
      return [];
    });

  if (problems.length > 0) {
    throw new Error(
      [
        "Every Payload package in an Offload site must be an Offload build at the same version.",
        ...problems.map((problem) => `- ${problem}`),
      ].join("\n"),
    );
  }
};

const packageNames = new Map<string, string | undefined>();

/** The name of the package that contains `file`, from the nearest manifest that has one. */
const packageName = (directory: string): string | undefined => {
  if (packageNames.has(directory)) return packageNames.get(directory);
  const file = path.join(directory, "package.json");
  const name = existsSync(file) ? readManifest(file).name : undefined;
  const parent = path.dirname(directory);
  const found = name ?? (parent === directory ? undefined : packageName(parent));
  packageNames.set(directory, found);
  return found;
};

/**
 * The upstream Payload package that `moduleId` comes from, or undefined. An
 * Offload build is named `@adirishi/offload-*` in its manifest, even when it is
 * installed in a directory with the upstream name.
 */
export const upstreamPayloadPackage = (moduleId: string) => {
  if (!path.isAbsolute(moduleId) || !moduleId.includes(`${path.sep}node_modules${path.sep}`)) {
    return undefined;
  }
  const name = packageName(path.dirname(moduleId.replace(/[?#].*$/, "")));
  return name !== undefined && isPayloadPackage(name) ? name : undefined;
};

export const upstreamBundleError = (names: Iterable<string>, version: string) =>
  [
    "The build includes Payload's own builds of these packages. Every Payload package in an Offload site must be an Offload build:",
    ...[...names].toSorted().map((name) => `- ${installLine(name, version)}`),
    "If another dependency installs one of them, add the same line to your package manager's overrides.",
  ].join("\n");

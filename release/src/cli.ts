#!/usr/bin/env node
import { latestRelease } from "@repo/upstream";
import path from "node:path";
import { parseArgs } from "node:util";

import { e2e } from "./e2e.ts";
import { withOffloadVersion } from "./manifest.ts";
import { readManifest, writeManifest } from "./packages.ts";
import { publish } from "./publish.ts";
import { nextRelease, tagRelease } from "./releases.ts";

const usage = `usage: release <command>

  publish [--registry <url>]          Publish and tag the next release, if HEAD changes what ships
  use-version <site-dir> [version]    Point a site's Offload dependencies at a release (default: the latest)
  e2e [--postgres]                    Release to a throwaway registry and run the e2e suite

  OFFLOAD_REGISTRY        registry URL for publish, unless --registry is given
  OFFLOAD_REGISTRY_TOKEN  auth token (not needed for a local registry)`;

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "publish": {
      const { values } = parseArgs({ args, options: { registry: { type: "string" } } });
      const registry = values.registry ?? process.env.OFFLOAD_REGISTRY;
      if (registry === undefined)
        throw new Error(`Set OFFLOAD_REGISTRY or pass --registry.\n\n${usage}`);
      const release = nextRelease();
      if (!release.publish) {
        console.log(release.reason);
        break;
      }
      await publish({
        registry,
        token: process.env.OFFLOAD_REGISTRY_TOKEN ?? "local-registry",
        version: release.version,
      });
      tagRelease(release.version);
      break;
    }
    case "use-version": {
      const { positionals } = parseArgs({ args, allowPositionals: true });
      const [siteDir, version = latestRelease()?.version] = positionals;
      if (siteDir === undefined) throw new Error(usage);
      if (version === undefined)
        throw new Error("The pinned Payload tag has no release yet. Pass a version.");
      const site = path.resolve(siteDir);
      writeManifest(site, withOffloadVersion(readManifest(site), version));
      console.log(`Pointed the Offload dependencies in ${site} at ${version}.`);
      break;
    }
    case "e2e": {
      const { values } = parseArgs({
        args,
        options: { postgres: { type: "boolean", default: false } },
      });
      await e2e(values);
      break;
    }
    default:
      throw new Error(usage);
  }
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

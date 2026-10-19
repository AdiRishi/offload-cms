#!/usr/bin/env node
import { offloadVersion } from "@repo/upstream";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { withOffloadVersion } from "./manifest.ts";
import { readManifest } from "./packages.ts";
import { publish } from "./publish.ts";

const usage = `usage: release <command>

  publish [--registry <url>]          Publish the built packages at the pinned version
  use-version <site-dir> [version]    Point a site's Offload dependencies at a release

  OFFLOAD_REGISTRY        registry URL (default http://localhost:4873)
  OFFLOAD_REGISTRY_TOKEN  auth token (not needed for the local registry)`;

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "publish": {
      const { values } = parseArgs({
        args,
        options: {
          registry: {
            type: "string",
            default: process.env.OFFLOAD_REGISTRY ?? "http://localhost:4873",
          },
        },
      });
      await publish({
        registry: values.registry,
        token: process.env.OFFLOAD_REGISTRY_TOKEN ?? "local-registry",
      });
      break;
    }
    case "use-version": {
      const { positionals } = parseArgs({ args, allowPositionals: true });
      const [siteDir, version = offloadVersion] = positionals;
      if (siteDir === undefined) throw new Error(usage);
      const site = path.resolve(siteDir);
      const manifest = withOffloadVersion(readManifest(site), version);
      writeFileSync(path.join(site, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`Pointed the Offload dependencies in ${site} at ${version}.`);
      break;
    }
    default:
      throw new Error(usage);
  }
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

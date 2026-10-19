#!/usr/bin/env node
import { parseArgs } from "node:util";

import { build } from "./build.ts";
import { checkout } from "./checkout.ts";
import { exportPatches } from "./export.ts";
import { pin } from "./pin.ts";
import { status } from "./status.ts";
import { upgrade, upgradeContinue } from "./upgrade.ts";

const usage = `usage: upstream <command>

  checkout [--force]              Create upstream/payload from the pin and the patches
  export                          Write the checkout's commits to patches/ and the docs' patch pages
  status [--against <tag>]        Show each patch's upstream PR state
  upgrade <tag> [--drop <id>]...  Move the patch series to a newer Payload release
  upgrade --continue              Apply the remaining patches after resolving a conflict
  build                           Build the checkout, after checking it matches the pin`;

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "checkout": {
      const { values } = parseArgs({
        args,
        options: { force: { type: "boolean", default: false } },
      });
      checkout(values);
      break;
    }
    case "export":
      parseArgs({ args });
      exportPatches(pin);
      break;
    case "status": {
      const { values } = parseArgs({ args, options: { against: { type: "string" } } });
      status(values);
      break;
    }
    case "upgrade": {
      const { positionals, values } = parseArgs({
        args,
        allowPositionals: true,
        options: {
          continue: { type: "boolean", default: false },
          drop: { type: "string", multiple: true, default: [] },
        },
      });
      const [tag] = positionals;
      if (values.continue) upgradeContinue();
      else if (tag === undefined) throw new Error(usage);
      else upgrade({ drop: values.drop, tag });
      break;
    }
    case "build":
      parseArgs({ args });
      build();
      break;
    default:
      throw new Error(usage);
  }
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

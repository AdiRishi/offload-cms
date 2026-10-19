// Builds Offload's shadcn registry from packages/form-builder into public/r. Each item's `meta`
// names the @adirishi/offload-form-builder release it was built for, which `shadcn view` shows.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { version } from "./version.ts";

type Registry = { items: Record<string, unknown>[] };

const packageDir = path.resolve(import.meta.dirname, "../packages/form-builder");
const registry: Registry = JSON.parse(readFileSync(path.join(packageDir, "registry.json"), "utf8"));
for (const item of registry.items) item.meta = { "@adirishi/offload-form-builder": version };
const stampedPath = path.join(
  mkdtempSync(path.join(tmpdir(), "offload-registry-")),
  "registry.json",
);
writeFileSync(stampedPath, JSON.stringify(registry));

execFileSync(
  "pnpm",
  [
    "exec",
    "shadcn",
    "build",
    stampedPath,
    "--cwd",
    packageDir,
    "--output",
    path.resolve(import.meta.dirname, "public/r"),
  ],
  { stdio: "inherit" },
);

// Builds Offload's shadcn registry into public/r from the registry.json in each package. Each
// item's `meta` names the release of the package that holds it, which `shadcn view` shows.

import { execFileSync } from "node:child_process";
import { globSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { version } from "./version.ts";

type Registry = { items: { meta?: Record<string, string>; files: { path: string }[] }[] };

const root = path.resolve(import.meta.dirname, "..");

// One registry, so that public/r/registry.json lists every item. File paths become relative to
// the repository.
const items = globSync("packages/*/registry.json", { cwd: root })
  .toSorted()
  .flatMap((file) => {
    const packageDir = path.dirname(file);
    const { name }: { name: string } = JSON.parse(
      readFileSync(path.join(root, packageDir, "package.json"), "utf8"),
    );
    const registry: Registry = JSON.parse(readFileSync(path.join(root, file), "utf8"));
    for (const item of registry.items) {
      item.meta = { [name]: version };
      for (const source of item.files) source.path = path.posix.join(packageDir, source.path);
    }
    return registry.items;
  });

const stampedPath = path.join(
  mkdtempSync(path.join(tmpdir(), "offload-registry-")),
  "registry.json",
);
writeFileSync(
  stampedPath,
  JSON.stringify({
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "offload",
    homepage: "https://adirishi.github.io/offload-cms",
    items,
  }),
);

execFileSync(
  "pnpm",
  [
    "exec",
    "shadcn",
    "build",
    stampedPath,
    "--cwd",
    root,
    "--output",
    path.resolve(import.meta.dirname, "public/r"),
  ],
  { stdio: "inherit" },
);

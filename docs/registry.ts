// Builds Offload's shadcn registry from the packages that ship registry items into public/r.
// Each item's `meta` names the release of its package that it was built for, which `shadcn view`
// shows.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { version } from "./version.ts";

type Registry = { items: ({ files: { path: string }[] } & Record<string, unknown>)[] };

const packagesDir = path.resolve(import.meta.dirname, "../packages");
const packages = [
  { dir: "form-builder", name: "@adirishi/offload-form-builder" },
  { dir: "payments", name: "@adirishi/offload-payments" },
];

const items = packages.flatMap(({ dir, name }) => {
  const registry: Registry = JSON.parse(
    readFileSync(path.join(packagesDir, dir, "registry.json"), "utf8"),
  );
  return registry.items.map((item) => ({
    ...item,
    meta: { [name]: version },
    files: item.files.map((file) => ({ ...file, path: path.join(dir, file.path) })),
  }));
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
    packagesDir,
    "--output",
    path.resolve(import.meta.dirname, "public/r"),
  ],
  { stdio: "inherit" },
);

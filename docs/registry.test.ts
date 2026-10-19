import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

type Registry = {
  items: {
    name: string;
    registryDependencies?: string[];
    files: { path: string; target: string }[];
  }[];
};

const root = path.resolve(import.meta.dirname, "..");
const e2eComponents = path.join(root, "e2e/src/components");
const registries = globSync("packages/*/registry.json", { cwd: root }).map((file) => {
  const registry: Registry = JSON.parse(readFileSync(path.join(root, file), "utf8"));
  return { packageDir: path.join(root, path.dirname(file)), registry };
});

// The e2e site installs the registry with the shadcn CLI and keeps the files, as a site does.
// Its suite tests those copies, so they must be the files the registry serves.
test("the e2e site's copies of the registry components match the registry", () => {
  for (const { packageDir, registry } of registries) {
    for (const { path: source, target } of registry.items.flatMap((item) => item.files)) {
      const installed = path.join(e2eComponents, target.replace(/^@components\//, ""));
      assert.equal(
        readFileSync(installed, "utf8"),
        readFileSync(path.join(packageDir, source), "utf8"),
        `${path.relative(root, installed)} differs from ${path.relative(root, path.join(packageDir, source))}. Reinstall it with the shadcn CLI.`,
      );
    }
  }
});

// `shadcn add --overwrite` overwrites every file of every registry dependency. A shadcn component
// listed here would replace the site's own copy of it each time the site updates Offload's items.
test("registry items depend only on other Offload items", () => {
  for (const { registry } of registries) {
    for (const item of registry.items) {
      for (const dependency of item.registryDependencies ?? []) {
        assert.match(dependency, /^@offload\//, `${item.name} depends on ${dependency}.`);
      }
    }
  }
});

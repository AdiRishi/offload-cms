import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { type Plugin, resolveConfig } from "vite";

import { offloadVite } from "./vite.ts";

test("pluginsBefore runs a site's pre plugin before Payload's, TanStack Start's and Offload's", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "offload-site-"));
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "site" }));
  mkdirSync(path.join(root, "src/app"), { recursive: true });
  writeFileSync(path.join(root, "src/router.tsx"), "export const getRouter = () => {};");
  writeFileSync(path.join(root, "src/app/__root.tsx"), "export const Route = {};");
  process.chdir(root);
  const sourceInjection: Plugin = { name: "site:inject-source", enforce: "pre" };
  const tailwind: Plugin = { name: "site:tailwind" };

  const config = await offloadVite({
    payloadConfigPath: path.join(root, "src/payload.config.ts"),
    pluginsBefore: [sourceInjection],
    vite: () => ({ plugins: [tailwind] }),
  })({ command: "serve", mode: "development" });
  const { plugins } = await resolveConfig({ ...config, configFile: false, root }, "serve");
  const names = plugins.map((plugin) => plugin.name);

  const firstFrameworkPlugin = names.findIndex((name) =>
    /^(payload|offload|rsc|tanstack|@tanstack|vite:react)/.test(name),
  );
  assert.notEqual(firstFrameworkPlugin, -1);
  assert.ok(
    names.indexOf("site:inject-source") < firstFrameworkPlugin,
    `site:inject-source runs at ${names.indexOf("site:inject-source")}, after ${names[firstFrameworkPlugin]}`,
  );
  assert.ok(names.indexOf("site:tailwind") > firstFrameworkPlugin);
});

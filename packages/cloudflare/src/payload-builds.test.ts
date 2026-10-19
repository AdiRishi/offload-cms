import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { assertOffloadBuilds, upstreamPayloadPackage } from "./payload-builds.ts";

const version = "4.0.0-beta.2-offload.5";

/** A site whose `node_modules/<name>` holds the given manifest, as a package manager installs an alias. */
const site = (installed: Record<string, { name: string; version: string }>) => {
  const root = mkdtempSync(path.join(tmpdir(), "offload-site-"));
  const dependencies = Object.fromEntries(
    Object.entries(installed).map(([name, manifest]) => [
      name,
      `npm:${manifest.name}@${manifest.version}`,
    ]),
  );
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "site", dependencies: { ...dependencies, react: "19.3.1" } }),
  );
  for (const [name, manifest] of Object.entries(installed)) {
    const directory = path.join(root, "node_modules", name);
    mkdirSync(path.join(directory, "dist"), { recursive: true });
    writeFileSync(path.join(directory, "package.json"), JSON.stringify(manifest));
    writeFileSync(path.join(directory, "dist", "package.json"), JSON.stringify({ type: "module" }));
    writeFileSync(path.join(directory, "dist", "index.js"), "");
  }
  return root;
};

describe("assertOffloadBuilds", () => {
  test("accepts a site whose Payload packages are all Offload builds at the same version", () => {
    const root = site({
      payload: { name: "@adirishi/offload-payload", version },
      "@payloadcms/ui": { name: "@adirishi/offload-ui", version },
    });

    assert.doesNotThrow(() => assertOffloadBuilds({ root, version }));
  });

  test("rejects Payload's own build of a plugin and names the Offload build to install", () => {
    const root = site({
      payload: { name: "@adirishi/offload-payload", version },
      "@payloadcms/plugin-seo": { name: "@payloadcms/plugin-seo", version: "4.0.0-beta.2" },
    });

    assert.throws(
      () => assertOffloadBuilds({ root, version }),
      (error: Error) =>
        error.message.includes(
          `"@payloadcms/plugin-seo": "npm:@adirishi/offload-plugin-seo@4.0.0-beta.2-offload.5"`,
        ) && !error.message.includes("- payload"),
    );
  });

  test("rejects an Offload build from another release", () => {
    const root = site({
      payload: { name: "@adirishi/offload-payload", version },
      "@payloadcms/ui": { name: "@adirishi/offload-ui", version: "4.0.0-beta.2-offload.4" },
    });

    assert.throws(
      () => assertOffloadBuilds({ root, version }),
      /@payloadcms\/ui is Offload 4\.0\.0-beta\.2-offload\.4/,
    );
  });
});

describe("upstreamPayloadPackage", () => {
  test("names the upstream package a bundled module comes from", () => {
    const root = site({ "@payloadcms/ui": { name: "@payloadcms/ui", version: "4.0.0-beta.2" } });

    assert.equal(
      upstreamPayloadPackage(path.join(root, "node_modules/@payloadcms/ui/dist/index.js")),
      "@payloadcms/ui",
    );
  });

  test("passes an Offload build installed under the upstream name", () => {
    const root = site({ "@payloadcms/ui": { name: "@adirishi/offload-ui", version } });

    assert.equal(
      upstreamPayloadPackage(path.join(root, "node_modules/@payloadcms/ui/dist/index.js?v=1")),
      undefined,
    );
  });
});

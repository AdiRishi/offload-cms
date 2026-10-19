import type { Server } from "node:http";

import { workingTreeVersion } from "@repo/upstream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runServer } from "verdaccio";

import { repoRoot, run } from "./exec.ts";
import { withOffloadVersion } from "./manifest.ts";
import { readManifest, writeManifest } from "./packages.ts";
import { publish } from "./publish.ts";

const e2eDir = path.join(repoRoot, "e2e");
/** The port e2e/.npmrc installs @adirishi packages from. */
const registryPort = 4873;

/** Starts an empty registry that stores @adirishi packages and proxies the rest from npm. */
const startRegistry = async () => {
  const storage = mkdtempSync(path.join(tmpdir(), "offload-registry-"));
  const app: { listen: (port: number, listening: () => void) => Server } = await runServer({
    self_path: storage,
    storage,
    uplinks: { npmjs: { url: "https://registry.npmjs.org/" } },
    packages: {
      "@adirishi/*": { access: "$all", publish: "$all", unpublish: "$all" },
      "**": { access: "$all", proxy: "npmjs" },
    },
    max_body_size: "200mb",
    log: { type: "stdout", format: "pretty", level: "warn" },
  });
  const server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(registryPort, () => resolve(listening));
    listening.once("error", () =>
      reject(new Error(`Port ${registryPort} is in use. Stop whatever is listening on it first.`)),
    );
  });
  return {
    url: `http://localhost:${registryPort}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      rmSync(storage, { force: true, recursive: true });
    },
  };
};

/**
 * Tests the working tree the way a site uses Offload: publishes a release to a
 * throwaway registry, installs e2e/ from it, then type-checks e2e/ and runs the
 * Playwright suite on D1, or on Postgres through Hyperdrive.
 */
export const e2e = async ({ postgres }: { postgres: boolean }) => {
  const registry = await startRegistry();
  try {
    await publish({ registry: registry.url, token: "local-registry", version: workingTreeVersion });
    writeManifest(e2eDir, withOffloadVersion(readManifest(e2eDir), workingTreeVersion));
    // Every run publishes the same version with new contents, so pnpm must forget the last one.
    // pnpm keeps an installed package directory whose version matches, even when the lockfile
    // records a new integrity, so node_modules goes too.
    rmSync(path.join(e2eDir, "pnpm-lock.yaml"), { force: true });
    rmSync(path.join(e2eDir, "node_modules"), { force: true, recursive: true });
    await run("pnpm", ["cache", "delete", "@adirishi/*"], { cwd: e2eDir });
    await run("pnpm", ["install"], { cwd: e2eDir });
  } finally {
    await registry.close();
  }

  const playwrightDeps = process.env.CI ? ["--with-deps"] : [];
  await run("pnpm", ["exec", "playwright", "install", ...playwrightDeps, "chromium"], {
    cwd: e2eDir,
  });
  await run("pnpm", ["typecheck"], { cwd: e2eDir });
  await run("pnpm", ["test"], { cwd: e2eDir, env: postgres ? { CLOUDFLARE_ENV: "postgres" } : {} });
};

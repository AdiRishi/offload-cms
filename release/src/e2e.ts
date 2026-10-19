import type { Server } from "node:http";

import { offloadVersion } from "@repo/upstream";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runServer } from "verdaccio";

import { withOffloadVersion } from "./manifest.ts";
import { readManifest, writeManifest } from "./packages.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const e2eDir = path.join(repoRoot, "e2e");
/** The port e2e/.npmrc installs @adirishi packages from. */
const registryPort = 4873;

const run = (command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    );
  });

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
    await run("pnpm", ["release"], { cwd: repoRoot, env: { OFFLOAD_REGISTRY: registry.url } });
    writeManifest(e2eDir, withOffloadVersion(readManifest(e2eDir), offloadVersion));
    // Every run publishes the same version with new contents, so pnpm must forget the last one.
    // pnpm restores a missing pnpm-lock.yaml from the copy it keeps in node_modules.
    rmSync(path.join(e2eDir, "pnpm-lock.yaml"), { force: true });
    rmSync(path.join(e2eDir, "node_modules/.pnpm/lock.yaml"), { force: true });
    await run("pnpm", ["cache", "delete", "@adirishi/*"], { cwd: e2eDir });
    await run("pnpm", ["install"], { cwd: e2eDir });
  } finally {
    await registry.close();
  }

  const playwrightDeps = process.env.CI ? ["--with-deps"] : [];
  await run("pnpm", ["exec", "playwright", "install", ...playwrightDeps, "chromium"], {
    cwd: e2eDir,
  });
  await run("pnpm", ["check-types"], { cwd: e2eDir });
  await run("pnpm", [postgres ? "e2e:postgres" : "e2e"], { cwd: e2eDir });
};

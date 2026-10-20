import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { repoRoot, run } from "./exec.ts";

const templateDir = path.join(repoRoot, "packages/create/template");
const previewPort = 4175;

/**
 * Creates a site with `pnpm create @adirishi/offload` and installs it, both from `registry`, the
 * way a new site starts. The registry must be serving.
 */
export const createTemplateSite = async (registry: string) => {
  const parent = mkdtempSync(path.join(tmpdir(), "offload-template-"));
  const site = path.join(parent, "template-site");
  // Every run publishes the same version, so dlx must not reuse the last run's create package.
  const config = [`--config.@adirishi:registry=${registry}`, "--config.dlx-cache-max-age=0"];
  await run("pnpm", [...config, "create", "@adirishi/offload", site], { cwd: parent });
  await run("pnpm", [...config, "install"], { cwd: site });
  return site;
};

const changedFrom = (site: string, file: string) =>
  readFileSync(path.join(site, file), "utf8") !==
  readFileSync(path.join(templateDir, file), "utf8");

const get = async (url: string) => {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== 200) throw new Error(`GET ${url} answered ${response.status}.`);
};

/**
 * Runs a site from `createTemplateSite()` through the steps its README and scripts describe:
 * types, migrations, the dev admin and a Worker build. Then serves the build and requests the
 * home page, the admin's login and the Cron Trigger. It fails when the template's import map no
 * longer matches the one Payload generates for its config.
 */
export const checkTemplateSite = async (site: string) => {
  // Types first, without .dev.vars, as the template's CI runs them.
  await run("pnpm", ["cf-typegen"], { cwd: site });
  await run("pnpm", ["typecheck"], { cwd: site });
  copyFileSync(path.join(site, ".dev.vars.example"), path.join(site, ".dev.vars"));
  await run("pnpm", ["generate:importmap"], { cwd: site });
  await run("pnpm", ["migrate:regenerate"], { cwd: site });
  await run("pnpm", ["admin:dev"], { cwd: site });
  await run("pnpm", ["build"], { cwd: site });
  const importMap = "src/app/_payload/importMap.js";
  if (changedFrom(site, importMap)) {
    throw new Error(
      `The template's ${importMap} is stale. Copy it from ${site} into ${templateDir}.`,
    );
  }

  // Vite itself, not `pnpm preview`, so stopping it stops the server.
  const preview = spawn(
    path.join(site, "node_modules/.bin/vite"),
    ["preview", "--port", String(previewPort), "--strictPort"],
    { cwd: site, stdio: "inherit" },
  );
  const origin = `http://localhost:${previewPort}`;
  try {
    for (let attempt = 0; ; attempt += 1) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Polls until the preview answers.
      const ready = await fetch(origin).then(
        () => true,
        () => false,
      );
      if (ready) break;
      if (attempt === 60) throw new Error(`The template site's preview didn't start on ${origin}.`);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Polls until the preview answers.
      await sleep(1000);
    }
    await get(origin);
    await get(`${origin}/admin/login`);
    await get(`${origin}/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*`);
  } finally {
    preview.kill();
  }
  console.log(`The template site in ${site} installs, type-checks, migrates, builds and serves.`);
};

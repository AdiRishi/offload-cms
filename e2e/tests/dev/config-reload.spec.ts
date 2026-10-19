// `vite dev` runs Payload in Node with bindings from Wrangler's platform proxy. Editing the
// Payload config reloads Payload in the running server, which must keep working.

import type { Page } from "@playwright/test";

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { lexical } from "../data";
import { expect, type PayloadApi, test, unique } from "../fixtures";

const originals = new Map<string, string>();

/** Replaces `from` with `to` in a source file, as an editor would. `afterEach` restores it. */
const edit = (file: string, from: string, to: string) => {
  const source = originals.get(file) ?? readFileSync(file, "utf8");
  if (!source.includes(from)) throw new Error(`${file} no longer contains ${from}`);
  originals.set(file, source);
  writeFileSync(file, source.replace(from, to));
};

test.afterEach(() => {
  for (const [file, source] of originals) writeFileSync(file, source);
  originals.clear();
});

// The workerd binary that the site's Wrangler starts, resolved the way Miniflare resolves it,
// wherever the package manager installed it.
const fromSite = createRequire(path.resolve("package.json"));
const fromMiniflare = createRequire(
  createRequire(fromSite.resolve("wrangler/package.json")).resolve("miniflare"),
);
const workerdBinary: string = fromMiniflare("workerd").default;

/**
 * The most Wrangler platform proxies that one process runs. Each proxy is a workerd child of the
 * process that started it. The dev server isn't the only such process: after every config load,
 * Payload runs `payload generate:types` in a child process, which starts its own proxy until it exits.
 */
const mostProxiesInOneProcess = () => {
  const proxies = new Map<string, number>();
  for (const line of execFileSync("ps", ["-A", "-o", "ppid=,command="], { encoding: "utf8" }).split(
    "\n",
  )) {
    const [, parent, command] = /^\s*(\d+) (.*)$/.exec(line) ?? [];
    if (parent !== undefined && command?.startsWith(`${workerdBinary} `)) {
      proxies.set(parent, (proxies.get(parent) ?? 0) + 1);
    }
  }
  return Math.max(0, ...proxies.values());
};

/** Polls a path until it returns 200. A request that hangs counts as a failed attempt. */
const expectOk = async (page: Page, url: string) => {
  await expect
    .poll(
      async () => {
        const response = await page.request.get(url, { timeout: 10_000 }).catch(() => null);
        return response?.status();
      },
      { intervals: [1_000], timeout: 60_000 },
    )
    .toBe(200);
};

/** Saves the config-level block through REST and Lexical, then opens it in the admin. */
const expectConfigLevelBlockWorks = async (api: PayloadApi, page: Page) => {
  const quote = unique("Pull quote");
  const pageDoc = await api.create("pages", {
    layout: [{ blockType: "pullQuote", quote }],
    slug: unique("dev-page"),
    title: "Dev page",
  });
  expect((await api.findByID("pages", pageDoc.id)).layout).toMatchObject([
    { blockType: "pullQuote", quote },
  ]);
  await api.create("posts", {
    content: lexical(["Rich text"], { blockType: "pullQuote", quote }),
    title: unique("Dev post"),
  });

  const admin = await page.request.get(`/admin/collections/pages/${pageDoc.id}`, {
    timeout: 60_000,
  });
  expect(admin.status()).toBe(200);
  expect(await admin.text()).toContain("Pull Quote");
};

test("Payload keeps working across config reloads", async ({ api, page }) => {
  await expectOk(page, "/api/users/init");
  await expectConfigLevelBlockWorks(api, page);
  expect(mostProxiesInOneProcess()).toBe(1);

  await test.step("edit the Payload config", async () => {
    edit(
      "src/payload.config.ts",
      "endpoints: [listJobsEndpoint, queueJobEndpoint, schedulePublishEndpoint],",
      `endpoints: [
    listJobsEndpoint,
    queueJobEndpoint,
    schedulePublishEndpoint,
    { handler: () => Response.json({ reloaded: true }), method: "get", path: "/e2e/reloaded" },
  ],`,
    );
    await expectOk(page, "/api/e2e/reloaded");
    await expectConfigLevelBlockWorks(api, page);
  });

  await test.step("edit a collection", async () => {
    edit(
      "src/collections/Posts.ts",
      'slug: "posts",',
      'slug: "posts",\n  labels: { plural: "Reloaded posts", singular: "Reloaded post" },',
    );
    await expect
      .poll(
        async () => {
          const response = await page.request
            .get("/admin/collections/posts", { timeout: 10_000 })
            .catch(() => null);
          return response?.ok() ? (await response.text()).includes("Reloaded posts") : false;
        },
        { intervals: [1_000], timeout: 60_000 },
      )
      .toBe(true);
    await expectConfigLevelBlockWorks(api, page);
  });

  expect(mostProxiesInOneProcess()).toBe(1);
});

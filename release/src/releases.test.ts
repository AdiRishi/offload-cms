import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

import { changesShippedFiles } from "./releases.ts";

describe("changesShippedFiles", () => {
  let repo: string;
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd: repo, encoding: "utf8" },
    ).trim();
  const commit = (files: Record<string, string>) => {
    for (const [file, contents] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
      writeFileSync(path.join(repo, file), contents);
    }
    git("add", "--all");
    git("commit", "--quiet", "--no-verify", "--message", "change");
    return git("rev-parse", "HEAD");
  };

  before(() => {
    repo = mkdtempSync(path.join(tmpdir(), "offload-releases-"));
    git("init", "--quiet");
  });
  after(() => rmSync(repo, { force: true, recursive: true }));

  test("ignores a change to the e2e suite and its runner", () => {
    const release = commit({
      "e2e/src/app.ts": "export {};\n",
      "release/src/e2e.ts": "export {};\n",
    });
    const next = commit({
      "e2e/src/app.ts": "export const app = 1;\n",
      "release/src/e2e.ts": "export const e2e = 1;\n",
    });

    assert.equal(changesShippedFiles({ cwd: repo, from: release, to: next }), false);
  });

  test("counts a change to how the packages are packed", () => {
    const release = commit({ "release/src/publish.ts": "export {};\n" });
    const next = commit({ "release/src/publish.ts": "export const pack = 1;\n" });

    assert.equal(changesShippedFiles({ cwd: repo, from: release, to: next }), true);
  });
});

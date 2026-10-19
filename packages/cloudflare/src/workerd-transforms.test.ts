import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { SourceMap } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { build } from "vite";

import { importMetaUrlFallback, literalGraphQLImports } from "./workerd-transforms.ts";

const sources = {
  "entry.js": [
    'import { loadGraphQL } from "./routes/graphql/handler.server.js";',
    "export const fail = () => { const url = import.meta.url; throw new Error(url); };",
    "export { loadGraphQL };",
  ].join("\n"),
  "routes/graphql/handler.server.js": [
    'const graphqlPackage = "@payloadcms/graphql";',
    "export const loadGraphQL = async () => { const graphql = await import(/* @vite-ignore */ graphqlPackage); if (!graphql.default) throw new TypeError(graphqlPackage); return graphql.default; };",
  ].join("\n"),
};

/** Builds the fixture for a server environment and returns the chunk and every log. */
const buildFixture = async () => {
  const root = mkdtempSync(path.join(tmpdir(), "offload-transforms-"));
  for (const [file, source] of Object.entries(sources)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), source);
  }
  const logs: string[] = [];
  const output = await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [importMetaUrlFallback(), literalGraphQLImports()],
    build: {
      minify: false,
      sourcemap: true,
      ssr: "entry.js",
      write: false,
      rolldownOptions: {
        external: ["@payloadcms/graphql"],
        onLog: (_level, log) => {
          logs.push(`${log.code ?? ""} ${log.message}`);
        },
      },
    },
  });
  const chunk = (Array.isArray(output) ? output : [output])
    .flatMap((result) => ("output" in result ? result.output : []))
    .find((file) => file.type === "chunk");
  assert.ok(chunk?.map, "the build emits a chunk with a sourcemap");
  return {
    chunk: { code: chunk.code, map: new SourceMap({ ...chunk.map, sourceRoot: "" }) },
    logs,
  };
};

/** The original position of the first occurrence of `token` in the built chunk. */
const originOf = (chunk: { code: string; map: SourceMap }, token: string) => {
  const offset = chunk.code.indexOf(token);
  assert.notEqual(offset, -1, `the chunk contains ${token}:\n${chunk.code}`);
  const before = chunk.code.slice(0, offset).split("\n");
  const entry = chunk.map.findEntry(before.length - 1, before.at(-1)?.length ?? 0);
  assert.ok("originalSource" in entry, `${token} has a source position`);
  return {
    file: path.basename(entry.originalSource),
    line: entry.originalLine,
    column: entry.originalColumn,
  };
};

const positionIn = (file: keyof typeof sources, token: string) => {
  const before = sources[file].slice(0, sources[file].indexOf(token)).split("\n");
  return { file: path.basename(file), line: before.length - 1, column: before.at(-1)?.length };
};

test("the workerd transforms keep stack traces on the original lines and columns", async () => {
  const { chunk, logs } = await buildFixture();

  assert.deepEqual(
    logs.filter((log) => log.startsWith("SOURCEMAP_BROKEN")),
    [],
  );
  assert.deepEqual(originOf(chunk, "throw new Error"), positionIn("entry.js", "throw new Error"));
  assert.deepEqual(
    originOf(chunk, "throw new TypeError"),
    positionIn("routes/graphql/handler.server.js", "throw new TypeError"),
  );
});

// Reinstalls this site's copies of Offload's registry items the way a site does. It serves the
// registry that `pnpm docs:registry` built into docs/public at the address components.json names,
// then runs `shadcn add --overwrite` for every item. The items list no shadcn components as
// registry dependencies, so `--overwrite` replaces only Offload's files.

import { spawn } from "node:child_process";
import { once } from "node:events";
import { globSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const publicDir = path.join(root, "docs/public");

const components: { registries: Record<string, string> } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../components.json"), "utf8"),
);
const registryUrl = components.registries["@offload"];
if (registryUrl === undefined) throw new Error("components.json names no @offload registry.");

const items = globSync("packages/*/registry.json", { cwd: root }).flatMap((file) => {
  const registry: { items: { name: string }[] } = JSON.parse(
    readFileSync(path.join(root, file), "utf8"),
  );
  return registry.items.map((item) => `@offload/${item.name}`);
});

const server = createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  try {
    response.end(readFileSync(path.join(publicDir, pathname)));
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(Number(new URL(registryUrl).port));
await once(server, "listening");

const shadcn = spawn("pnpm", ["exec", "shadcn", "add", ...items, "--overwrite"], {
  stdio: "inherit",
});
await once(shadcn, "exit");
server.close();
process.exitCode = shadcn.exitCode ?? 1;

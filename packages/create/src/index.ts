#!/usr/bin/env node
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const packageDir = path.join(import.meta.dirname, "..");
const { version }: { version: string } = JSON.parse(
  readFileSync(path.join(packageDir, "package.json"), "utf8"),
);

const [directory] = process.argv.slice(2);
if (!directory) {
  console.error("Usage: pnpm create @adirishi/offload <directory>");
  process.exit(1);
}
const target = path.resolve(directory);
if (existsSync(target) && readdirSync(target).length > 0) {
  console.error(`${target} isn't empty.`);
  process.exit(1);
}
// The Worker, D1 database and R2 bucket take this name, which allows lowercase letters, digits
// and hyphens.
const name = path
  .basename(target)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/^-+|-+$/g, "");

cpSync(path.join(packageDir, "template"), target, { recursive: true });
// npm drops .gitignore and .npmrc from a package, so the template stores them under other names.
renameSync(path.join(target, "_gitignore"), path.join(target, ".gitignore"));
renameSync(path.join(target, "_npmrc"), path.join(target, ".npmrc"));

for (const file of readdirSync(target, { recursive: true, withFileTypes: true })) {
  if (!file.isFile()) continue;
  const filePath = path.join(file.parentPath, file.name);
  const contents = readFileSync(filePath, "utf8");
  const replaced = contents.replaceAll("{{name}}", name).replaceAll("{{version}}", version);
  if (replaced !== contents) writeFileSync(filePath, replaced);
}

console.log(`Created ${name} with Offload ${version} in ${target}. Next:

  cd ${directory}
  cp .dev.vars.example .dev.vars
  pnpm install
  pnpm cf-typegen
  pnpm migrate:regenerate
  pnpm admin:dev
  pnpm dev
`);

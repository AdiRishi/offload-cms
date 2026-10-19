// Generates the selected database's `initial` migration from the current config, the way
// `payload migrate:create initial` does in an empty migrations directory. `check` fails when the
// committed migration differs from it, and `regenerate` writes it over the committed one.
// Run it through `payload run`. CLOUDFLARE_ENV=postgres selects Postgres; otherwise it uses D1.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getPayload } from "payload";

import config from "../src/payload.config";

const mode = process.argv[2];
if (mode !== "check" && mode !== "regenerate") {
  throw new Error("Usage: payload run scripts/migrations.ts <check|regenerate>");
}

const initialMigration = (dir: string) => {
  // The files Payload runs as migrations.
  const files = readdirSync(dir).filter(
    (file) => /\.[jt]s$/.test(file) && !/^index\.[jt]s$/.test(file),
  );
  const [file] = files;
  if (files.length !== 1 || !file?.endsWith("_initial.ts")) {
    throw new Error(
      `${dir} must hold one migration, *_initial.ts, but it holds ${files.join(", ") || "none"}.`,
    );
  }
  return path.join(dir, file);
};

// A fresh checkout has no .dev.vars to supply PAYLOAD_SECRET, and generating a migration signs nothing.
const payload = await getPayload({
  config: { ...(await config), secret: "unused" },
  disableDBConnect: true,
  disableOnInit: true,
});
const committed = initialMigration(payload.db.migrationDir);

// createMigration diffs the schema against the newest .json snapshot in the migrations
// directory, so an empty directory makes it generate the whole schema.
const generatedDir = mkdtempSync(path.join(tmpdir(), "offload-e2e-migrations-"));
try {
  payload.db.migrationDir = generatedDir;
  await payload.db.createMigration({ migrationName: "initial", payload, shouldPrompt: false });
  const generated = initialMigration(generatedDir);
  const relativePath = path.relative(process.cwd(), committed);

  if (readFileSync(generated, "utf8") === readFileSync(committed, "utf8")) {
    console.log(`${relativePath} matches the schema.`);
  } else if (mode === "regenerate") {
    writeFileSync(committed, readFileSync(generated));
    console.log(`Rewrote ${relativePath} from the schema.`);
  } else {
    spawnSync("git", ["diff", "--no-index", "--", committed, generated], { stdio: "inherit" });
    console.error(
      `${relativePath} does not match the schema. Run \`pnpm migrations:regenerate\` in e2e to rewrite it.`,
    );
    process.exitCode = 1;
  }
} finally {
  rmSync(generatedDir, { force: true, recursive: true });
}

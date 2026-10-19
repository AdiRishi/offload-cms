import { spawn } from "node:child_process";
import path from "node:path";

export const repoRoot = path.resolve(import.meta.dirname, "../..");

/** Runs a command with inherited stdio. It is async so an in-process registry keeps serving. */
export const run = (
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
) =>
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

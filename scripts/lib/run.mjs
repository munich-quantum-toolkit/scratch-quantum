import { spawnSync } from "node:child_process";

/** npm and npx are batch files on Windows, which only start through a shell. */
export function needsShell(command) {
  return process.platform === "win32" && (command === "npm" || command === "npx");
}

/**
 * Run a command and throw if it fails.
 * With `capture`, return its standard output; otherwise it writes to the terminal.
 */
export function run(command, args, { cwd, env, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: needsShell(command),
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const where = cwd ? ` in ${cwd}` : "";
    const details = capture && result.stderr ? `\n${result.stderr.trim()}` : "";
    throw new Error(`"${command} ${args.join(" ")}" failed${where}${details}`);
  }
  return capture ? result.stdout : "";
}

import { spawn } from "node:child_process";
import { main } from "./lib/cli.mjs";
import { layout } from "./lib/layout.mjs";
import { needsShell } from "./lib/run.mjs";
import { syncAll, watchAll } from "./sync.mjs";

main(import.meta.url, () => {
  const paths = layout();
  syncAll();
  const stopWatching = watchAll();
  const children = [
    ["vm", ["webpack", "--watch"]],
    ["gui", ["webpack", "serve"]],
  ].map(([repo, args]) =>
    spawn("npx", args, {
      cwd: paths.tree(repo),
      stdio: "inherit",
      shell: needsShell("npx"),
    }),
  );
  let stopping = false;
  const stop = (code) => {
    if (stopping) return;
    stopping = true;
    stopWatching();
    for (const child of children) child.kill();
    process.exitCode = code;
  };
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
  for (const child of children) child.on("exit", (code) => stop(code ?? 1));
});

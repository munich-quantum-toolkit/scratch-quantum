// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

import { spawn, spawnSync } from "node:child_process";
import { main } from "./lib/cli.mjs";
import { layout } from "./lib/layout.mjs";
import { needsShell } from "./lib/run.mjs";
import { syncAll, watchAll } from "./sync.mjs";

const WINDOWS = process.platform === "win32";

/** Kills a child and its descendants: npx does not forward signals on to webpack. */
function killTree(child) {
  if (WINDOWS) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // The process group is already gone.
  }
}

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
      // Own process group on POSIX, so that stopping kills webpack too.
      detached: !WINDOWS,
    }),
  );
  // If this process dies from an uncaught error, no handler below runs, but webpack must not outlive it.
  // Killing a process group that is already gone is harmless.
  process.on("exit", () => {
    for (const child of children) killTree(child);
  });
  let stopping = false;
  const stop = (code) => {
    if (stopping) return;
    stopping = true;
    stopWatching();
    for (const child of children) killTree(child);
    process.exitCode = code;
  };
  // The children no longer get the terminal's Ctrl+C themselves.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
    process.on(signal, () => stop(0));
  for (const child of children) {
    child.on("error", (error) => {
      console.error(error.message);
      stop(1);
    });
    child.on("exit", (code) => stop(code ?? 1));
  }
});

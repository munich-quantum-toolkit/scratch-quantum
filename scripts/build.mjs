// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

import fs from "node:fs";
import path from "node:path";
import { main } from "./lib/cli.mjs";
import { layout } from "./lib/layout.mjs";
import { run } from "./lib/run.mjs";
import { syncAll } from "./sync.mjs";

main(import.meta.url, () => {
  const paths = layout();
  syncAll();
  // Build the vm first: the editor build copies dist/web/extension-worker.js from it.
  run("npx", ["webpack"], { cwd: paths.tree("vm") });
  run("npm", ["run", "build"], {
    cwd: paths.tree("gui"),
    env: { NODE_ENV: "production" },
  });
  fs.rmSync(paths.build, { recursive: true, force: true });
  fs.cpSync(path.join(paths.tree("gui"), "build"), paths.build, {
    recursive: true,
  });
  console.log(`The editor is in ${paths.build}`);
});

// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

import { main } from "./lib/cli.mjs";
import { layout } from "./lib/layout.mjs";
import { listFiles } from "./lib/overlay.mjs";
import { run } from "./lib/run.mjs";
import { syncAll } from "./sync.mjs";

main(import.meta.url, () => {
  syncAll();
  const files = listFiles(layout().overlay("vm")).filter((file) =>
    file.endsWith(".js"),
  );
  run("npx", ["eslint", ...files], { cwd: layout().tree("vm") });
});

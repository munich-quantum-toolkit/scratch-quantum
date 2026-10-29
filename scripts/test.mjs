// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

import path from "node:path";
import { main } from "./lib/cli.mjs";
import { layout, REPO_ROOT } from "./lib/layout.mjs";
import { listFiles } from "./lib/overlay.mjs";
import { run } from "./lib/run.mjs";
import { syncAll } from "./sync.mjs";

const DEFAULT_TESTS = [
  ["test/unit", /^extension_quantum_[^/]*\.js$/],
  ["test/integration", /^quantum_[^/]*\.js$/],
];

/** The test files to run, relative to vm/: the given ones, or all tests of the extension. */
export function testFiles(root, args) {
  if (args.length > 0) return args.map((file) => file.replace(/^vm\//, ""));
  const overlay = layout(root).overlay("vm");
  return DEFAULT_TESTS.flatMap(([dir, pattern]) =>
    listFiles(path.join(overlay, dir))
      .filter((file) => pattern.test(file))
      .map((file) => `${dir}/${file}`),
  );
}

main(import.meta.url, (args) => {
  syncAll();
  run("npx", ["tap", "--no-coverage", ...testFiles(REPO_ROOT, args)], {
    cwd: layout().tree("vm"),
  });
});

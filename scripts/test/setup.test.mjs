// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { head } from "../lib/git.mjs";
import { setup } from "../setup.mjs";
import {
  gitIn,
  makePatches,
  makeProject,
  makeUpstreamRepo,
  readFile,
  writeFiles,
} from "./helpers.mjs";

const quiet = () => {};
const run = (root, options = {}) =>
  setup({ root, install: false, log: quiet, ...options });
const inTree = (root, repo, file = "") =>
  path.join(root, ".upstream", repo, file);

test("setup clones, patches and syncs both trees", () => {
  const { root } = makeProject();
  run(root);
  assert.equal(
    readFile(inTree(root, "vm", "src/engine.js")),
    "patched engine\n",
  );
  assert.equal(
    readFile(inTree(root, "vm", "src/extensions/ext/index.js")),
    "extension\n",
  );
  assert.equal(readFile(inTree(root, "gui", "src/icons/icon.svg")), "<svg/>\n");
  const state = JSON.parse(
    readFile(path.join(root, ".upstream", "state.json")),
  );
  assert.equal(state.vm.head, head(inTree(root, "vm")));
});

test("running setup again keeps the trees", () => {
  const { root } = makeProject();
  run(root);
  writeFiles(inTree(root, "vm"), { "notes.txt": "mine\n" });
  run(root);
  assert.equal(readFile(inTree(root, "vm", "notes.txt")), "mine\n");
});

test("setup re-creates an untouched tree when the patches change", () => {
  const { root, changePatches } = makeProject();
  run(root);
  changePatches();
  run(root);
  assert.equal(
    readFile(inTree(root, "vm", "src/engine.js")),
    "patched again\n",
  );
  assert.equal(
    readFile(inTree(root, "vm", "src/extensions/ext/index.js")),
    "extension\n",
  );
});

test("setup stops instead of discarding uncommitted changes", () => {
  const { root, changePatches } = makeProject();
  run(root);
  writeFiles(inTree(root, "vm"), { "src/engine.js": "my edit\n" });
  changePatches();
  assert.throws(() => run(root), /patches:update/);
  assert.equal(readFile(inTree(root, "vm", "src/engine.js")), "my edit\n");
});

test("setup stops instead of discarding a new untracked file", () => {
  const { root, changePatches } = makeProject();
  run(root);
  writeFiles(inTree(root, "vm"), { "src/new-upstream-file.js": "mine\n" });
  changePatches();
  assert.throws(() => run(root), /patches:update/);
  assert.equal(
    readFile(inTree(root, "vm", "src/new-upstream-file.js")),
    "mine\n",
  );
  run(root, { force: true });
  const backup = fs
    .readdirSync(path.join(root, ".upstream"))
    .find((name) => name.startsWith("vm.bak-"));
  assert.equal(
    readFile(path.join(root, ".upstream", backup, "src/new-upstream-file.js")),
    "mine\n",
  );
  assert.equal(
    fs.existsSync(inTree(root, "vm", "src/new-upstream-file.js")),
    false,
  );
});

test("setup stops instead of discarding commits that are not in patches/", () => {
  const { root, changePatches } = makeProject();
  run(root);
  writeFiles(inTree(root, "vm"), { "src/engine.js": "my edit\n" });
  gitIn(
    inTree(root, "vm"),
    "commit",
    "--quiet",
    "--all",
    "--message",
    "My change",
  );
  changePatches();
  assert.throws(() => run(root), /patches:update/);
  assert.equal(
    gitIn(inTree(root, "vm"), "log", "-1", "--format=%s"),
    "My change",
  );
});

test("--force moves a changed tree aside instead of deleting it", () => {
  const { root, changePatches } = makeProject();
  run(root);
  writeFiles(inTree(root, "vm"), { "src/engine.js": "my edit\n" });
  changePatches();
  run(root, { force: true });
  const backups = fs
    .readdirSync(path.join(root, ".upstream"))
    .filter((name) => name.startsWith("vm.bak-"));
  assert.equal(backups.length, 1);
  assert.equal(
    readFile(path.join(root, ".upstream", backups[0], "src/engine.js")),
    "my edit\n",
  );
  assert.equal(
    readFile(inTree(root, "vm", "src/engine.js")),
    "patched again\n",
  );
});

test("setup changes no tree when a later tree must stop", () => {
  const { root, guiUpstream, changePatches } = makeProject();
  run(root);
  makePatches(guiUpstream, path.join(root, "patches", "gui"), "Patch the gui", {
    "src/gui.js": "patched gui\n",
  });
  writeFiles(inTree(root, "gui"), { "src/gui.js": "my edit\n" });
  const vmHead = head(inTree(root, "vm"));
  changePatches();
  assert.throws(() => run(root), /patches:update/);
  assert.equal(
    readFile(inTree(root, "vm", "src/engine.js")),
    "patched engine\n",
  );
  assert.equal(head(inTree(root, "vm")), vmHead);
});

test("a patch that does not apply leaves no tree behind", () => {
  const { root, vmUpstream, patchDir } = makeProject();
  const other = makeUpstreamRepo({ "src/engine.js": "different\n" });
  makePatches(other, patchDir, "Patch the engine", { "src/engine.js": "x\n" });
  assert.throws(() => run(root), /0001-Patch-the-engine\.patch/);
  assert.equal(fs.existsSync(inTree(root, "vm")), false);
  makePatches(vmUpstream, patchDir, "Patch the engine", {
    "src/engine.js": "patched engine\n",
  });
  run(root);
  assert.equal(
    readFile(inTree(root, "vm", "src/engine.js")),
    "patched engine\n",
  );
});

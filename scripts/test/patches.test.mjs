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
import { updatePatches } from "../patches.mjs";
import { setup } from "../setup.mjs";
import { gitIn, makeProject, readFile, writeFiles } from "./helpers.mjs";

const quiet = () => {};
const run = (root) => setup({ root, install: false, log: quiet });
const tree = (root) => path.join(root, ".upstream", "vm");

test("updatePatches on a fresh setup changes nothing", () => {
  const { root, patchDir } = makeProject();
  run(root);
  const before = fs
    .readdirSync(patchDir)
    .map((name) => [name, readFile(path.join(patchDir, name))]);
  updatePatches({ root, log: quiet });
  const after = fs
    .readdirSync(patchDir)
    .map((name) => [name, readFile(path.join(patchDir, name))]);
  assert.deepEqual(after, before);
});

test("updatePatches writes new commits, and setup keeps and reproduces them", () => {
  const { root, patchDir } = makeProject();
  run(root);
  writeFiles(tree(root), { "src/engine.js": "engine v2\n" });
  gitIn(
    tree(root),
    "commit",
    "--quiet",
    "--all",
    "--message",
    "Change the engine again",
  );
  updatePatches({ root, log: quiet });
  assert.deepEqual(fs.readdirSync(patchDir).sort(), [
    "0001-Patch-the-engine.patch",
    "0002-Change-the-engine-again.patch",
  ]);
  writeFiles(tree(root), { "notes.txt": "mine\n" });
  run(root);
  assert.equal(readFile(path.join(tree(root), "notes.txt")), "mine\n");
  fs.rmSync(path.join(root, ".upstream"), { recursive: true, force: true });
  run(root);
  assert.equal(readFile(path.join(tree(root), "src/engine.js")), "engine v2\n");
});

test("updatePatches refuses uncommitted changes", () => {
  const { root, patchDir } = makeProject();
  run(root);
  const before = fs.readdirSync(patchDir);
  writeFiles(tree(root), { "src/engine.js": "not committed\n" });
  assert.throws(() => updatePatches({ root, log: quiet }), /Commit them/);
  assert.deepEqual(fs.readdirSync(patchDir), before);
});

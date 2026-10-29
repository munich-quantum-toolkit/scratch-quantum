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
import {
  applyPatches,
  cloneAt,
  formatPatches,
  hasTrackedChanges,
  head,
  patchFiles,
  untrackedFiles,
} from "../lib/git.mjs";
import {
  makePatches,
  makeUpstreamRepo,
  readFile,
  tempDir,
  writeFiles,
} from "./helpers.mjs";

const newTree = () => path.join(tempDir(), "tree");

test("cloneAt checks out the pinned commit", () => {
  const upstream = makeUpstreamRepo({ "a.txt": "a\n" });
  const dir = newTree();
  cloneAt(dir, upstream.url, upstream.commit);
  assert.equal(head(dir), upstream.commit);
  assert.equal(readFile(path.join(dir, "a.txt")), "a\n");
});

test("patches survive a round trip byte for byte", () => {
  const upstream = makeUpstreamRepo({ "a.txt": "a\n" });
  const patchDir = tempDir();
  const patches = makePatches(upstream, patchDir, "Change a", {
    "a.txt": "b\n",
  });
  assert.deepEqual(
    patches.map((file) => path.basename(file)),
    ["0001-Change-a.patch"],
  );
  const original = fs.readFileSync(patches[0]);
  const dir = newTree();
  cloneAt(dir, upstream.url, upstream.commit);
  applyPatches(dir, patches);
  assert.equal(readFile(path.join(dir, "a.txt")), "b\n");
  const again = formatPatches(dir, upstream.commit, patchDir);
  assert.deepEqual(fs.readFileSync(again[0]), original);
});

test("the user's git config does not change how patches apply or format", () => {
  const upstream = makeUpstreamRepo({ "a.txt": "a\n" });
  const patchDir = tempDir();
  const patches = makePatches(upstream, patchDir, "Change a", {
    "a.txt": "b\n",
  });
  const original = fs.readFileSync(patches[0]);
  const config = path.join(tempDir(), "gitconfig");
  fs.writeFileSync(
    config,
    "[commit]\n\tgpgsign = true\n[format]\n\tsignOff = true\n[core]\n\tabbrev = 12\n",
  );
  const dir = newTree();
  cloneAt(dir, upstream.url, upstream.commit);
  const previous = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = config;
  try {
    applyPatches(dir, patches);
    const again = formatPatches(dir, upstream.commit, patchDir);
    assert.deepEqual(fs.readFileSync(again[0]), original);
    assert.doesNotMatch(readFile(again[0]), /Signed-off-by/);
  } finally {
    if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = previous;
  }
});

test("applying the same patches gives the same HEAD everywhere", () => {
  const upstream = makeUpstreamRepo({ "a.txt": "a\n" });
  const patches = makePatches(upstream, tempDir(), "Change a", {
    "a.txt": "b\n",
  });
  const heads = [newTree(), newTree()].map((dir) => {
    cloneAt(dir, upstream.url, upstream.commit);
    applyPatches(dir, patches);
    return head(dir);
  });
  assert.equal(heads[0], heads[1]);
});

test("applyPatches names a patch that does not apply and aborts", () => {
  const upstream = makeUpstreamRepo({ "a.txt": "a\n" });
  const other = makeUpstreamRepo({ "a.txt": "something else\n" });
  const patches = makePatches(other, tempDir(), "Change a", { "a.txt": "b\n" });
  const dir = newTree();
  cloneAt(dir, upstream.url, upstream.commit);
  assert.throws(() => applyPatches(dir, patches), /0001-Change-a\.patch/);
  assert.equal(hasTrackedChanges(dir), false);
  assert.equal(head(dir), upstream.commit);
  // A failed `git am` leaves its session behind unless it is aborted.
  assert.equal(fs.existsSync(path.join(dir, ".git", "rebase-apply")), false);
  const good = makePatches(upstream, tempDir(), "Change a", { "a.txt": "b\n" });
  applyPatches(dir, good);
  assert.equal(readFile(path.join(dir, "a.txt")), "b\n");
});

test("hasTrackedChanges ignores untracked files", () => {
  const upstream = makeUpstreamRepo({ "a.txt": "a\n" });
  const dir = newTree();
  cloneAt(dir, upstream.url, upstream.commit);
  writeFiles(dir, { "new.txt": "new\n" });
  assert.equal(hasTrackedChanges(dir), false);
  writeFiles(dir, { "a.txt": "changed\n" });
  assert.equal(hasTrackedChanges(dir), true);
});

test("untrackedFiles lists new files, but not ignored ones", () => {
  const upstream = makeUpstreamRepo({
    "a.txt": "a\n",
    ".gitignore": "build/\n",
  });
  const dir = newTree();
  cloneAt(dir, upstream.url, upstream.commit);
  writeFiles(dir, {
    "new.txt": "new\n",
    "src/deep/other file.js": "x\n",
    "build/out.js": "ignored\n",
  });
  assert.deepEqual(untrackedFiles(dir).sort(), [
    "new.txt",
    "src/deep/other file.js",
  ]);
});

test("formatPatches replaces old patch files and keeps other files", () => {
  const upstream = makeUpstreamRepo({ "a.txt": "a\n" });
  const patchDir = tempDir();
  writeFiles(patchDir, { "0002-Old.patch": "old", README: "keep" });
  makePatches(upstream, patchDir, "Change a", { "a.txt": "b\n" });
  assert.deepEqual(fs.readdirSync(patchDir).sort(), [
    "0001-Change-a.patch",
    "README",
  ]);
});

test("formatPatches keeps the old patches when git format-patch fails", () => {
  const upstream = makeUpstreamRepo({ "a.txt": "a\n" });
  const patchDir = tempDir();
  makePatches(upstream, patchDir, "Change a", { "a.txt": "b\n" });
  const dir = newTree();
  cloneAt(dir, upstream.url, upstream.commit);
  assert.throws(() => formatPatches(dir, "not-a-commit", patchDir));
  assert.deepEqual(fs.readdirSync(patchDir), ["0001-Change-a.patch"]);
});

test("patchFiles lists patches in order and tolerates a missing directory", () => {
  const dir = tempDir();
  writeFiles(dir, { "0002-b.patch": "", "0001-a.patch": "", "notes.txt": "" });
  assert.deepEqual(
    patchFiles(dir).map((file) => path.basename(file)),
    ["0001-a.patch", "0002-b.patch"],
  );
  assert.deepEqual(patchFiles(path.join(dir, "missing")), []);
});

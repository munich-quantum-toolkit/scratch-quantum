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
import { listFiles, syncOverlay, watchOverlay } from "../lib/overlay.mjs";
import { readFile, tempDir, waitFor, writeFiles } from "./helpers.mjs";

function dirs() {
  return {
    source: tempDir(),
    target: tempDir(),
    manifest: path.join(tempDir(), "overlay.json"),
  };
}

test("listFiles returns sorted relative paths with / separators", () => {
  const dir = tempDir();
  writeFiles(dir, { "b.js": "", "a/c.js": "", "a/b/d.js": "" });
  assert.deepEqual(listFiles(dir), ["a/b/d.js", "a/c.js", "b.js"]);
});

test("listFiles of a missing directory is empty", () => {
  assert.deepEqual(listFiles(path.join(tempDir(), "missing")), []);
});

test("syncOverlay copies every file and leaves upstream files alone", () => {
  const d = dirs();
  writeFiles(d.source, { "src/ext/index.js": "one", "test/unit/t.js": "two" });
  writeFiles(d.target, { "src/upstream.js": "upstream" });
  assert.deepEqual(syncOverlay(d), {
    copied: ["src/ext/index.js", "test/unit/t.js"],
    removed: [],
  });
  assert.equal(readFile(path.join(d.target, "src/ext/index.js")), "one");
  assert.equal(readFile(path.join(d.target, "src/upstream.js")), "upstream");
});

test("copies are read-only", { skip: process.platform === "win32" }, () => {
  const d = dirs();
  writeFiles(d.source, { "a.js": "one" });
  syncOverlay(d);
  assert.equal(fs.statSync(path.join(d.target, "a.js")).mode & 0o222, 0);
});

test("a second sync copies only changed files, also over read-only copies", () => {
  const d = dirs();
  writeFiles(d.source, { "a.js": "one", "b.js": "two" });
  syncOverlay(d);
  writeFiles(d.source, { "b.js": "changed" });
  assert.deepEqual(syncOverlay(d), { copied: ["b.js"], removed: [] });
  assert.equal(readFile(path.join(d.target, "b.js")), "changed");
  assert.deepEqual(syncOverlay(d), { copied: [], removed: [] });
});

test("files deleted from the overlay are deleted from the target", () => {
  const d = dirs();
  writeFiles(d.source, { "src/ext/a.js": "a", "src/ext/b.js": "b" });
  writeFiles(d.target, { "src/upstream.js": "upstream" });
  syncOverlay(d);
  fs.rmSync(path.join(d.source, "src/ext/b.js"));
  assert.deepEqual(syncOverlay(d), { copied: [], removed: ["src/ext/b.js"] });
  assert.equal(fs.existsSync(path.join(d.target, "src/ext/b.js")), false);
  assert.equal(readFile(path.join(d.target, "src/upstream.js")), "upstream");
});

test("directories that a deletion empties are removed", () => {
  const d = dirs();
  writeFiles(d.source, { "src/ext/a.js": "a" });
  syncOverlay(d);
  fs.rmSync(path.join(d.source, "src/ext"), { recursive: true });
  syncOverlay(d);
  assert.equal(fs.existsSync(path.join(d.target, "src/ext")), false);
  assert.equal(fs.existsSync(d.target), true);
});

test("watchOverlay syncs changed files", async () => {
  const d = dirs();
  writeFiles(d.source, { "a.js": "one" });
  syncOverlay(d);
  const results = [];
  const stop = watchOverlay(d, (result) => results.push(result));
  try {
    writeFiles(d.source, { "a.js": "two" });
    await waitFor(() => readFile(path.join(d.target, "a.js")) === "two");
  } finally {
    stop();
  }
  assert.ok(results.some((result) => result.copied.includes("a.js")));
});

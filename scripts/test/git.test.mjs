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

test("patchFiles lists patches in order and tolerates a missing directory", () => {
  const dir = tempDir();
  writeFiles(dir, { "0002-b.patch": "", "0001-a.patch": "", "notes.txt": "" });
  assert.deepEqual(
    patchFiles(dir).map((file) => path.basename(file)),
    ["0001-a.patch", "0002-b.patch"],
  );
  assert.deepEqual(patchFiles(path.join(dir, "missing")), []);
});

// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import {
  decideSetupAction,
  hashPatches,
  readState,
  writeState,
} from "../lib/state.mjs";
import { tempDir, writeFiles } from "./helpers.mjs";

const wanted = { commit: "c1", patches: "p1" };
const recorded = { commit: "c1", patches: "p1", head: "h1" };

const cases = [
  ["a missing tree is created", { exists: false }, "create"],
  [
    "unchanged inputs keep the tree",
    { exists: true, recorded, head: "h1", dirty: false },
    "keep",
  ],
  [
    "unchanged inputs keep local work too",
    { exists: true, recorded, head: "h2", dirty: true },
    "keep",
  ],
  [
    "new patches replace an untouched tree",
    {
      exists: true,
      recorded: { ...recorded, patches: "p0" },
      head: "h1",
      dirty: false,
    },
    "recreate",
  ],
  [
    "a new pin replaces an untouched tree",
    {
      exists: true,
      recorded: { ...recorded, commit: "c0" },
      head: "h1",
      dirty: false,
    },
    "recreate",
  ],
  [
    "uncommitted changes stop setup",
    {
      exists: true,
      recorded: { ...recorded, patches: "p0" },
      head: "h1",
      dirty: true,
    },
    "stop",
  ],
  [
    "commits that are not in patches stop setup",
    {
      exists: true,
      recorded: { ...recorded, patches: "p0" },
      head: "h2",
      dirty: false,
    },
    "stop",
  ],
  [
    "a tree without recorded state stops setup",
    { exists: true, recorded: undefined, head: "h1", dirty: false },
    "stop",
  ],
  [
    "--force moves a changed tree aside",
    {
      exists: true,
      recorded: { ...recorded, patches: "p0" },
      head: "h1",
      dirty: true,
      force: true,
    },
    "backup",
  ],
];

for (const [name, input, expected] of cases) {
  test(`decideSetupAction: ${name}`, () => {
    assert.equal(
      decideSetupAction({ wanted, force: false, ...input }),
      expected,
    );
  });
}

test("hashPatches depends on names and contents", () => {
  const dir = tempDir();
  writeFiles(dir, { "0001-a.patch": "one", "0002-b.patch": "two" });
  const files = ["0001-a.patch", "0002-b.patch"].map((name) =>
    path.join(dir, name),
  );
  const first = hashPatches(files);
  assert.equal(hashPatches(files), first);
  writeFiles(dir, { "0002-b.patch": "changed" });
  assert.notEqual(hashPatches(files), first);
  assert.notEqual(hashPatches(files.slice(0, 1)), hashPatches(files));
  assert.equal(hashPatches([]), hashPatches([]));
});

test("readState of a missing file is empty, and writeState round-trips", () => {
  const file = path.join(tempDir(), "sub", "state.json");
  assert.deepEqual(readState(file), {});
  writeState(file, { vm: recorded });
  assert.deepEqual(readState(file), { vm: recorded });
});

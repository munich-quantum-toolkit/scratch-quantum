// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** A hash of the names and contents of the patch files. */
export function hashPatches(files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(`${path.basename(file)}\0`);
    hash.update(fs.readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function readState(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

export function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * What setup does with one upstream tree: "create" it, "keep" it, "recreate" it,
 * move it aside and create it again ("backup"), or "stop".
 */
export function decideSetupAction({
  exists,
  recorded,
  wanted,
  head,
  dirty,
  force,
}) {
  if (!exists) return "create";
  if (
    recorded &&
    recorded.commit === wanted.commit &&
    recorded.patches === wanted.patches
  )
    return "keep";
  // Replace the tree only if it holds nothing beyond what the last setup put there.
  if (recorded && recorded.head === head && !dirty) return "recreate";
  return force ? "backup" : "stop";
}

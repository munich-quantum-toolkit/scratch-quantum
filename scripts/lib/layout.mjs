// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const REPOS = ["vm", "gui"];

/** The paths of the repository at `root` and of its upstream trees in `.upstream/`. */
export function layout(root = REPO_ROOT) {
  const upstream = path.join(root, ".upstream");
  return {
    root,
    upstream,
    upstreamJson: path.join(root, "upstream.json"),
    stateFile: path.join(upstream, "state.json"),
    build: path.join(root, "build"),
    tree: (repo) => path.join(upstream, repo),
    overlay: (repo) => path.join(root, repo),
    patches: (repo) => path.join(root, "patches", repo),
    overlayOptions: (repo) => ({
      source: path.join(root, repo),
      target: path.join(upstream, repo),
      manifest: path.join(upstream, `${repo}.overlay.json`),
    }),
  };
}

export function readUpstream(root = REPO_ROOT) {
  return JSON.parse(fs.readFileSync(layout(root).upstreamJson, "utf8"));
}

export function requireTrees(paths) {
  for (const repo of REPOS) {
    if (!fs.existsSync(paths.tree(repo))) {
      throw new Error(
        `.upstream/${repo} is missing. Run "npm run setup" first.`,
      );
    }
  }
}

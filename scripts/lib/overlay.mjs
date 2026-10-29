// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

import fs from "node:fs";
import path from "node:path";

/** The files below `dir`, as sorted relative paths with "/" separators. */
export function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(dir, path.join(entry.parentPath ?? entry.path, entry.name))
        .split(path.sep)
        .join("/"),
    )
    .sort();
}

// Reading without checking first avoids a race between the check and the read.
function readIfExists(file, encoding) {
  try {
    return fs.readFileSync(file, encoding);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function sameContent(a, b) {
  const other = readIfExists(b);
  return other !== null && fs.readFileSync(a).equals(other);
}

function makeWritable(file) {
  fs.chmodSync(file, fs.statSync(file).mode | 0o200);
}

// Copies are read-only, so that editors warn before someone edits a copy instead of the original.
function copyReadOnly(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) makeWritable(target);
  fs.copyFileSync(source, target);
  fs.chmodSync(target, fs.statSync(source).mode & 0o555);
}

function removeFile(file, root) {
  if (!fs.existsSync(file)) return;
  makeWritable(file);
  fs.rmSync(file);
  for (
    let dir = path.dirname(file);
    dir !== root && fs.readdirSync(dir).length === 0;
    dir = path.dirname(dir)
  ) {
    fs.rmdirSync(dir);
  }
}

/**
 * Make `target` contain the files of `source`.
 * `manifest` records the files of the last sync, so that files deleted from `source` are deleted from `target`.
 */
export function syncOverlay({ source, target, manifest }) {
  const files = listFiles(source);
  const previous = JSON.parse(readIfExists(manifest, "utf8") ?? "[]");
  const current = new Set(files);
  const removed = previous.filter((file) => !current.has(file));
  for (const file of removed) removeFile(path.join(target, file), target);
  const copied = files.filter(
    (file) => !sameContent(path.join(source, file), path.join(target, file)),
  );
  for (const file of copied)
    copyReadOnly(path.join(source, file), path.join(target, file));
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, `${JSON.stringify(files, null, 2)}\n`);
  return { copied, removed };
}

/** Sync whenever a file below `options.source` changes. Returns a function that stops watching. */
export function watchOverlay(options, onSync = () => {}) {
  let timer;
  const watcher = fs.watch(options.source, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        onSync(syncOverlay(options));
      } catch (error) {
        console.error(error.message);
      }
    }, 100);
  });
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}

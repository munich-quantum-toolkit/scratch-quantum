import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cloneAt, formatPatches } from "../lib/git.mjs";
import { run } from "../lib/run.mjs";

export function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scratch-quantum-test-"));
}

/** Write `files` ({ relativePath: content }) below `dir`. */
export function writeFiles(dir, files) {
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

export function readFile(file) {
  return fs.readFileSync(file, "utf8");
}

/** Wait until `condition()` is true, or throw after `timeout` milliseconds. */
export async function waitFor(condition, timeout = 5000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("Timed out");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const TEST_IDENTITY = [
  "-c",
  "user.name=Test",
  "-c",
  "user.email=test@example.invalid",
];

export function gitIn(dir, ...args) {
  return run("git", [...TEST_IDENTITY, ...args], {
    cwd: dir,
    capture: true,
  }).trim();
}

/** A local repository that stands in for an upstream repository on GitHub. */
export function makeUpstreamRepo(files) {
  const dir = tempDir();
  gitIn(dir, "init", "--quiet", "--initial-branch=develop");
  gitIn(dir, "config", "uploadpack.allowAnySHA1InWant", "true");
  writeFiles(dir, files);
  gitIn(dir, "add", "--all");
  gitIn(dir, "commit", "--quiet", "--message", "Upstream release");
  return {
    dir,
    url: pathToFileURL(dir).href,
    commit: gitIn(dir, "rev-parse", "HEAD"),
  };
}

/** Write one patch with `subject` that changes `files` on top of `upstream` into `outDir`. */
export function makePatches(upstream, outDir, subject, files) {
  const dir = path.join(tempDir(), "work");
  cloneAt(dir, upstream.url, upstream.commit);
  writeFiles(dir, files);
  gitIn(dir, "add", "--all");
  gitIn(dir, "commit", "--quiet", "--message", subject);
  return formatPatches(dir, upstream.commit, outDir);
}

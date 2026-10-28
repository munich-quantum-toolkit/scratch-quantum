import fs from "node:fs";
import path from "node:path";
import { run } from "./run.mjs";

// A fixed committer and author dates make `git am` produce the same commits on every machine.
const COMMITTER = [
  "-c",
  "user.name=scratch-quantum setup",
  "-c",
  "user.email=setup@scratch-quantum.invalid",
];

const git = (dir, args) => run("git", args, { cwd: dir, capture: true }).trim();

/** Make `dir` a shallow checkout of `commit` from `repository`. */
export function cloneAt(dir, repository, commit) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ["-c", "init.defaultBranch=upstream", "init", "--quiet"]);
  git(dir, ["fetch", "--quiet", "--depth", "1", repository, commit]);
  git(dir, ["checkout", "--quiet", "--detach", "FETCH_HEAD"]);
}

/** The patch files in `dir`, in the order in which they apply. */
export function patchFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".patch"))
    .sort()
    .map((name) => path.join(dir, name));
}

/** Commit each patch on top of the checkout in `dir`. */
export function applyPatches(dir, files) {
  for (const file of files) {
    try {
      git(dir, [
        ...COMMITTER,
        "am",
        "--quiet",
        "--committer-date-is-author-date",
        file,
      ]);
    } catch (error) {
      try {
        git(dir, ["am", "--abort"]);
      } catch {
        // Nothing to abort.
      }
      throw new Error(
        `Patch ${path.basename(file)} does not apply to ${dir}.\n${error.message}`,
      );
    }
  }
}

export function head(dir) {
  return git(dir, ["rev-parse", "HEAD"]);
}

/** Whether files that git tracks have uncommitted changes. Untracked files, such as the overlay copies, don't count. */
export function hasTrackedChanges(dir) {
  return git(dir, ["status", "--porcelain", "--untracked-files=no"]) !== "";
}

/** Write the commits after `base` as patches into `outDir`, replacing the patches there. */
export function formatPatches(dir, base, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of patchFiles(outDir)) fs.rmSync(file);
  git(dir, [
    "format-patch",
    "--quiet",
    "--zero-commit",
    "--no-signature",
    "--no-stat",
    "--no-numbered",
    "--output-directory",
    outDir,
    `${base}..HEAD`,
  ]);
  return patchFiles(outDir);
}

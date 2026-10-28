import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "./run.mjs";

// The fixed committer identity and --committer-date-is-author-date (the dates come from the patches) make `git am` produce the same commits on every machine.
const COMMITTER = [
  "-c",
  "user.name=scratch-quantum setup",
  "-c",
  "user.email=setup@scratch-quantum.invalid",
];

const git = (dir, args, env) =>
  run("git", args, { cwd: dir, capture: true, env }).trim();

// Commands that write or read patches ignore the user's git config (signing, sign-off, abbreviation length, ...).
// `git fetch` keeps it, because it may need the user's proxy settings.
const ISOLATED = { GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: "1" };

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
      git(
        dir,
        [
          ...COMMITTER,
          "am",
          "--quiet",
          "--committer-date-is-author-date",
          file,
        ],
        ISOLATED,
      );
    } catch (error) {
      try {
        git(dir, [...COMMITTER, "am", "--abort"], ISOLATED);
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

/** The untracked files in `dir` that .gitignore does not hide, as relative paths with "/" separators. */
export function untrackedFiles(dir) {
  const output = run(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { cwd: dir, capture: true },
  );
  return output.split("\0").filter(Boolean);
}

/** Write the commits after `base` as patches into `outDir`, replacing the patches there. */
export function formatPatches(dir, base, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const file of patchFiles(outDir)) fs.rmSync(file);
  git(
    dir,
    [
      // Without this, the length of the "index" lines depends on the user's config and on the size of the repository.
      "-c",
      "core.abbrev=7",
      "format-patch",
      "--quiet",
      "--zero-commit",
      "--no-signature",
      "--no-stat",
      "--no-numbered",
      "--output-directory",
      outDir,
      `${base}..HEAD`,
    ],
    ISOLATED,
  );
  return patchFiles(outDir);
}

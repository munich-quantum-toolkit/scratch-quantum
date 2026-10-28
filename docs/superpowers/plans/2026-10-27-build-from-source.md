# Build the Editor from Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `scratch-quantum` from a repository with a committed editor build into the open-source home of the extension: our source, a few patches against pinned upstream Scratch, scripts that build the editor, and a GitHub Actions workflow that tests, deploys and previews it.

**Architecture:** `vm/` and `gui/` hold our files at the same paths as in the upstream repositories. `npm run setup` clones the pinned upstream commits into the git-ignored `.upstream/`, applies `patches/` with `git am`, copies (never links) the overlays into the upstream trees, and installs dependencies. The other npm scripts sync the overlays and then run upstream's own tools (`tap`, `webpack`, `eslint`) inside `.upstream/`. One workflow runs setup, tests and build for every pull request and push, deploys `main` to the `gh-pages` branch and gives each pull request a preview.

**Tech Stack:** Node.js ≥ 20.12 (ES modules, standard library only, `node:test`), git, npm, `git filter-repo` (one-time import), GitHub Actions with `JamesIves/github-pages-deploy-action@v4` and `rossjrw/pr-preview-action@v1`.

**Spec:** `docs/superpowers/specs/2026-10-27-build-from-source-design.md`

## Global Constraints

- Paths used in every task: `WS=/home/damian/01_research/scratch-quantum`, `REPO=$WS/scratch-quantum` (the `scratch-quantum` checkout, on branch `feat/build-from-source`). The forks are checked out at `$WS/scratch-vm` and `$WS/scratch-gui`.
- Pinned upstream commits:
  - `scratchfoundation/scratch-vm` `661546a0a442ecc264d2e3d2bec630195e71c6e6` (5.0.247)
  - `scratchfoundation/scratch-gui` `ceb1863ec2df72e927e3dbfcd945623baccaf2c5` (5.1.52)
- **Never modify** `$WS/scratch-vm`, `$WS/scratch-gui`, their stashes, or the forks on GitHub. Run `git filter-repo` only in fresh temporary clones.
- The scripts in `scripts/` use only the Node.js standard library and the `git`, `npm` and `npx` executables. The root `package.json` has no dependencies.
- Script style: Prettier defaults (2 spaces, double quotes, semicolons, trailing commas). Short JSDoc comments on exported functions.
- Commit messages follow the repository's gitmoji style (`✨ add …`, `🚚 import …`, `👷 add …`, `🔥 remove …`, `📝 …`, `🎨 pre-commit fixes`). They end with an empty line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Nothing outward-facing before Task 9:** no `git push`, no pull request, no `gh-pages` branch, no change to GitHub settings. In Task 9, each of these happens only after Damian says so in chat.
- **Docs pages** (`README.md`, `docs/*.md` outside `docs/superpowers/`) change only in Task 8, on a separate branch. That branch is merged into the feature branch only after the maintainer approves.
- Unless a step says otherwise, run commands from `$REPO`.

## File Structure

| Path                                   | Responsibility                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `vm/…`, `gui/…`                        | Overlay files (imported with history in Task 1) and `LICENSE` copies (Task 2).                           |
| `upstream.json`                        | Pinned upstream repositories and commits.                                                                 |
| `package.json`, `.nvmrc`               | npm scripts and the Node.js version.                                                                      |
| `scripts/lib/run.mjs`                  | `run()`: run a command, throw on failure, optionally capture output. `needsShell()`.                      |
| `scripts/lib/cli.mjs`                  | `main()`: run a script's body when it is started from the command line, exit code 1 on errors.            |
| `scripts/lib/layout.mjs`               | `REPO_ROOT`, `REPOS`, `layout()`, `readUpstream()`, `requireTrees()`: every path the scripts use.         |
| `scripts/lib/overlay.mjs`              | `listFiles()`, `syncOverlay()`, `watchOverlay()`: copying an overlay into an upstream tree.               |
| `scripts/lib/git.mjs`                  | `cloneAt()`, `patchFiles()`, `applyPatches()`, `formatPatches()`, `head()`, `hasTrackedChanges()`.        |
| `scripts/lib/state.mjs`                | `hashPatches()`, `readState()`, `writeState()`, `decideSetupAction()`: when setup may replace a tree.     |
| `scripts/setup.mjs`                    | `setup()` and the `npm run setup` command.                                                                |
| `scripts/patches.mjs`                  | `updatePatches()` and `npm run patches:update`.                                                           |
| `scripts/sync.mjs`                     | `syncAll()`, `watchAll()` and `npm run sync`.                                                             |
| `scripts/test.mjs`                     | `testFiles()` and `npm test`.                                                                             |
| `scripts/build.mjs`, `dev.mjs`, `lint.mjs` | `npm run build`, `npm run dev`, `npm run lint`.                                                       |
| `scripts/test/*.test.mjs`              | `node:test` tests of the scripts; `helpers.mjs` makes temporary directories and fake upstream repos.     |
| `patches/vm/*.patch`, `patches/gui/*.patch` | The three upstream changes (Task 5).                                                                 |
| `.github/workflows/editor.yml`         | Build, deploy and preview jobs (Task 7).                                                                  |

---

### Task 1: Import the extension with its history

**Files:**

- Create (by merge): `vm/src/extensions/mqt_quantum/*` (11 files), `vm/test/unit/extension_quantum_*.js` (11), `vm/test/integration/quantum_mlir_export.js`, `vm/test/fixtures/quantum/*` (6), `vm/tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs`, `docs/superpowers/specs/2026-10-21-mlir-export-design.md`, `docs/superpowers/plans/2026-10-21-mlir-export*.md` (2), `gui/src/lib/libraries/extensions/quantum/quantum.{png,svg}`

**Interfaces:**

- Produces: the overlay directories `vm/` and `gui/` with paths that mirror the upstream trees. Later tasks rely on exactly these paths.

- [ ] **Step 1: Check the starting point**

```bash
WS=/home/damian/01_research/scratch-quantum; REPO=$WS/scratch-quantum
git -C $REPO status --porcelain            # expected: no output
git -C $REPO branch --show-current         # expected: feat/build-from-source
for f in scratch-vm scratch-gui; do
  git -C $WS/$f fetch -q origin
  test "$(git -C $WS/$f rev-parse develop)" = "$(git -C $WS/$f rev-parse origin/develop)" && echo "$f develop = origin/develop"
done
git filter-repo --version                  # expected: a version hash, no error
```

Expected: both `… develop = origin/develop` lines. If one is missing, stop and tell Damian. The import must match GitHub.

- [ ] **Step 2: Clone both forks into a fresh temporary directory**

```bash
TMP=$(mktemp -d)
git clone -q --single-branch --branch develop git@github.com:DRovara/scratch-quantum-vm.git $TMP/vm
git clone -q --single-branch --branch develop git@github.com:DRovara/scratch-quantum-gui.git $TMP/gui
echo $TMP
```

Note `$TMP`; the following steps use it.

- [ ] **Step 3: Filter the clones**

```bash
cd $TMP/vm && git filter-repo \
  --path src/extensions/mqt_quantum/ \
  --path-glob 'test/unit/extension_quantum_*.js' \
  --path test/integration/quantum_mlir_export.js \
  --path test/fixtures/quantum/ \
  --path tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs \
  --path docs/superpowers/ \
  --path-rename src/:vm/src/ \
  --path-rename test/:vm/test/ \
  --path-rename tap-snapshots/:vm/tap-snapshots/
cd $TMP/gui && git filter-repo \
  --path src/lib/libraries/extensions/quantum/ \
  --path-rename src/:gui/src/
cd $REPO
git -C $TMP/vm ls-files | sed -E 's#/[^/]+$##' | sort | uniq -c
git -C $TMP/gui ls-files
```

If filter-repo refuses because it doesn't consider a clone fresh, re-run that command with `--force` added. This is safe because `$TMP` only holds throwaway clones. Never run filter-repo anywhere else. Expected directory counts: 11 in `vm/src/extensions/mqt_quantum`, 11 in `vm/test/unit`, 1 in `vm/test/integration`, 6 in `vm/test/fixtures/quantum`, 1 in `vm/tap-snapshots/test/integration`, 1 in `docs/superpowers/specs` and 2 in `docs/superpowers/plans`. The gui list should be the two files `gui/src/lib/libraries/extensions/quantum/quantum.{png,svg}`.

- [ ] **Step 4: Merge both histories into the feature branch**

```bash
git fetch -q $TMP/vm develop
git merge --allow-unrelated-histories --no-ff FETCH_HEAD \
  -m "🚚 import the extension source with its history from scratch-quantum-vm" \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git fetch -q $TMP/gui develop
git merge --allow-unrelated-histories --no-ff FETCH_HEAD \
  -m "🚚 import the extension icons with their history from scratch-quantum-gui" \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
echo "vm commits: $(git rev-list --count HEAD^1^2)  gui commits: $(git rev-list --count HEAD^2)"
```

Expected: both merges succeed without conflicts. Write the two commit counts down for the pull request description in Task 9.

- [ ] **Step 5: Check that nothing is missing**

```bash
diff <(git -C $WS/scratch-vm ls-tree -r develop \
        | grep -P '\t(src/extensions/mqt_quantum/|test/unit/extension_quantum_|test/integration/quantum_mlir_export\.js$|test/fixtures/quantum/|tap-snapshots/test/integration/quantum_mlir_export\.js\.test\.cjs$|docs/superpowers/)' \
        | sed -E 's#\t(src|test|tap-snapshots)/#\tvm/\1/#' | sort) \
     <(git ls-tree -r HEAD | grep -P '\t(vm/|docs/superpowers/(specs|plans)/2026-10-21-)' | sort) \
  && echo "vm import identical"
diff <(git -C $WS/scratch-gui ls-tree -r develop | grep -P '\tsrc/lib/libraries/extensions/quantum/' \
        | sed -E 's#\tsrc/#\tgui/src/#' | sort) \
     <(git ls-tree -r HEAD | grep -P '\tgui/' | sort) \
  && echo "gui import identical"
git ls-tree -r HEAD | grep -cP '\t(vm/|gui/|docs/superpowers/(specs|plans)/2026-10-21-)'
```

Expected: `vm import identical`, `gui import identical`, and the count `35` (33 vm entries and 2 gui entries). Each line compares mode, blob SHA and path, so equal output means every file is byte-identical. If anything differs, stop and report to Damian. Don't try to fix it by hand.

- [ ] **Step 6: Remove the temporary clones**

```bash
rm -rf "$TMP"
```

---

### Task 2: Scaffolding and overlay sync

**Files:**

- Create: `upstream.json`, `package.json`, `.nvmrc`, `vm/LICENSE`, `gui/LICENSE`, `scripts/lib/run.mjs`, `scripts/lib/cli.mjs`, `scripts/lib/layout.mjs`, `scripts/lib/overlay.mjs`, `scripts/sync.mjs`, `scripts/test/helpers.mjs`, `scripts/test/overlay.test.mjs`
- Modify: `.gitignore`

**Interfaces:**

- Produces:
  - `run(command: string, args: string[], { cwd?, env?, capture? = false }): string`. It returns stdout when `capture` is set and throws `Error` on a non-zero exit, including stderr when captured. `needsShell(command): boolean`.
  - `main(metaUrl: string, fn: (args: string[]) => unknown): void`
  - `REPO_ROOT: string`, `REPOS = ["vm", "gui"]`
  - `layout(root = REPO_ROOT)` returns `{ root, upstream, upstreamJson, stateFile, build, tree(repo), overlay(repo), patches(repo), overlayOptions(repo) }`, where `overlayOptions(repo)` is `{ source, target, manifest }`.
  - `readUpstream(root)` returns the parsed `upstream.json`. `requireTrees(paths)` throws if `.upstream/vm` or `.upstream/gui` is missing.
  - `listFiles(dir): string[]` returns sorted relative paths with `/` separators.
  - `syncOverlay({ source, target, manifest })` returns `{ copied: string[], removed: string[] }`. `watchOverlay(options, onSync)` returns a function `stop()`.
  - `syncAll(root?, log?)` and `watchAll(root?, log?)`, which returns `stop()`.
  - Test helpers: `tempDir()`, `writeFiles(dir, files)`, `readFile(file)`, `waitFor(condition, timeout?)`.

- [ ] **Step 1: Add the scaffolding files**

`upstream.json`:

```json
{
  "vm": {
    "repository": "https://github.com/scratchfoundation/scratch-vm",
    "commit": "661546a0a442ecc264d2e3d2bec630195e71c6e6",
    "version": "5.0.247"
  },
  "gui": {
    "repository": "https://github.com/scratchfoundation/scratch-gui",
    "commit": "ceb1863ec2df72e927e3dbfcd945623baccaf2c5",
    "version": "5.1.52"
  }
}
```

`package.json` (no `license` field: the license is open for the maintainer):

```json
{
  "name": "scratch-quantum",
  "private": true,
  "description": "Quantum computing extension for Scratch, built on pinned versions of scratch-vm and scratch-gui",
  "engines": {
    "node": ">=20.12"
  },
  "scripts": {
    "setup": "node scripts/setup.mjs",
    "sync": "node scripts/sync.mjs",
    "dev": "node scripts/dev.mjs",
    "build": "node scripts/build.mjs",
    "test": "node scripts/test.mjs",
    "test:scripts": "node --test scripts/test/*.test.mjs",
    "lint": "node scripts/lint.mjs",
    "patches:update": "node scripts/patches.mjs"
  }
}
```

`.nvmrc`:

```
20
```

Licenses, which are identical to upstream's:

```bash
git -C $WS/scratch-vm diff --quiet 661546a0 develop -- LICENSE && echo "vm LICENSE unchanged from upstream"
git -C $WS/scratch-gui diff --quiet ceb1863e develop -- LICENSE && echo "gui LICENSE unchanged from upstream"
git -C $WS/scratch-vm show develop:LICENSE > vm/LICENSE
git -C $WS/scratch-gui show develop:LICENSE > gui/LICENSE
```

Append to `.gitignore`:

```
/.upstream/
/node_modules/
/build/
```

- [ ] **Step 2: Write the helpers and the failing overlay tests**

`scripts/test/helpers.mjs` (its git helpers come in Task 3):

```js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
```

`scripts/test/overlay.test.mjs`:

```js
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
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `node --test scripts/test/overlay.test.mjs`
Expected: FAIL with `Cannot find module '…/scripts/lib/overlay.mjs'`.

- [ ] **Step 4: Implement the library modules**

`scripts/lib/run.mjs`:

```js
import { spawnSync } from "node:child_process";

/** npm and npx are batch files on Windows, which only start through a shell. */
export function needsShell(command) {
  return process.platform === "win32" && (command === "npm" || command === "npx");
}

/**
 * Run a command and throw if it fails.
 * With `capture`, return its standard output; otherwise it writes to the terminal.
 */
export function run(command, args, { cwd, env, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: needsShell(command),
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const where = cwd ? ` in ${cwd}` : "";
    const details = capture && result.stderr ? `\n${result.stderr.trim()}` : "";
    throw new Error(`"${command} ${args.join(" ")}" failed${where}${details}`);
  }
  return capture ? result.stdout : "";
}
```

`scripts/lib/cli.mjs`:

```js
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Run `fn` with the command-line arguments if the module at `metaUrl` was started with `node`,
 * and report errors as a message and exit code 1.
 */
export function main(metaUrl, fn) {
  const entry = process.argv[1];
  if (!entry || metaUrl !== pathToFileURL(fs.realpathSync(entry)).href) return;
  Promise.resolve()
    .then(() => fn(process.argv.slice(2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
```

`scripts/lib/layout.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
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
      throw new Error(`.upstream/${repo} is missing. Run "npm run setup" first.`);
    }
  }
}
```

`scripts/lib/overlay.mjs`:

```js
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

function sameContent(a, b) {
  if (!fs.existsSync(b) || fs.statSync(a).size !== fs.statSync(b).size) return false;
  return fs.readFileSync(a).equals(fs.readFileSync(b));
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
  for (let dir = path.dirname(file); dir !== root && fs.readdirSync(dir).length === 0; dir = path.dirname(dir)) {
    fs.rmdirSync(dir);
  }
}

/**
 * Make `target` contain the files of `source`.
 * `manifest` records the files of the last sync, so that files deleted from `source` are deleted from `target`.
 */
export function syncOverlay({ source, target, manifest }) {
  const files = listFiles(source);
  const previous = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, "utf8")) : [];
  const current = new Set(files);
  const removed = previous.filter((file) => !current.has(file));
  for (const file of removed) removeFile(path.join(target, file), target);
  const copied = files.filter((file) => !sameContent(path.join(source, file), path.join(target, file)));
  for (const file of copied) copyReadOnly(path.join(source, file), path.join(target, file));
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
```

`scripts/sync.mjs`:

```js
import { main } from "./lib/cli.mjs";
import { layout, REPO_ROOT, REPOS, requireTrees } from "./lib/layout.mjs";
import { syncOverlay, watchOverlay } from "./lib/overlay.mjs";

function report(log, repo, { copied, removed }) {
  if (copied.length || removed.length) log(`${repo}: copied ${copied.length}, removed ${removed.length}`);
}

/** Copy vm/ and gui/ into the upstream trees in .upstream/. */
export function syncAll(root = REPO_ROOT, log = console.log) {
  const paths = layout(root);
  requireTrees(paths);
  for (const repo of REPOS) report(log, repo, syncOverlay(paths.overlayOptions(repo)));
}

/** Keep syncing vm/ and gui/ until the returned function is called. */
export function watchAll(root = REPO_ROOT, log = console.log) {
  const paths = layout(root);
  const stops = REPOS.map((repo) =>
    watchOverlay(paths.overlayOptions(repo), (result) => report(log, repo, result)),
  );
  return () => stops.forEach((stop) => stop());
}

main(import.meta.url, (args) => {
  syncAll();
  if (args.includes("--watch")) {
    watchAll();
    console.log("Watching vm/ and gui/. Press Ctrl+C to stop.");
  }
});
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test scripts/test/overlay.test.mjs`
Expected: PASS, 8 tests (one of them is skipped on Windows).

- [ ] **Step 6: Commit**

```bash
git add .gitignore .nvmrc package.json upstream.json vm/LICENSE gui/LICENSE scripts/
git commit -m "✨ add the upstream pins and the overlay sync" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Git helpers and setup decisions

**Files:**

- Create: `scripts/lib/git.mjs`, `scripts/lib/state.mjs`, `scripts/test/git.test.mjs`, `scripts/test/state.test.mjs`
- Modify: `scripts/test/helpers.mjs` (add the git helpers)

**Interfaces:**

- Consumes: `run()` (Task 2).
- Produces:
  - `cloneAt(dir, repository, commit): void`
  - `patchFiles(dir): string[]` returns the absolute paths of `*.patch`, sorted.
  - `applyPatches(dir, files): void` throws an `Error` that names the patch that doesn't apply, after aborting `git am`.
  - `formatPatches(dir, base, outDir): string[]` replaces every `*.patch` in `outDir` and returns the new list.
  - `head(dir): string`
  - `hasTrackedChanges(dir): boolean`
  - `hashPatches(files): string`, `readState(file): object` (`{}` if the file is missing), `writeState(file, state): void`
  - `decideSetupAction({ exists, recorded, wanted, head, dirty, force })` returns `"create" | "keep" | "recreate" | "backup" | "stop"`. The state shapes are `recorded: { commit, patches, head } | undefined` and `wanted: { commit, patches }`.
  - Test helpers: `gitIn(dir, ...args): string` (trimmed stdout, fixed test identity), `makeUpstreamRepo(files)` returning `{ dir, url, commit }`, and `makePatches(upstream, outDir, subject, files): string[]`.

- [ ] **Step 1: Add the git test helpers**

Append to `scripts/test/helpers.mjs`. Move the three `import` lines to the top of the file, next to the existing imports:

```js
import { pathToFileURL } from "node:url";
import { cloneAt, formatPatches } from "../lib/git.mjs";
import { run } from "../lib/run.mjs";

const TEST_IDENTITY = ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"];

export function gitIn(dir, ...args) {
  return run("git", [...TEST_IDENTITY, ...args], { cwd: dir, capture: true }).trim();
}

/** A local repository that stands in for an upstream repository on GitHub. */
export function makeUpstreamRepo(files) {
  const dir = tempDir();
  gitIn(dir, "init", "--quiet", "--initial-branch=develop");
  gitIn(dir, "config", "uploadpack.allowAnySHA1InWant", "true");
  writeFiles(dir, files);
  gitIn(dir, "add", "--all");
  gitIn(dir, "commit", "--quiet", "--message", "Upstream release");
  return { dir, url: pathToFileURL(dir).href, commit: gitIn(dir, "rev-parse", "HEAD") };
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
```

- [ ] **Step 2: Write the failing tests**

`scripts/test/git.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { applyPatches, cloneAt, formatPatches, hasTrackedChanges, head, patchFiles } from "../lib/git.mjs";
import { makePatches, makeUpstreamRepo, readFile, tempDir, writeFiles } from "./helpers.mjs";

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
  const patches = makePatches(upstream, patchDir, "Change a", { "a.txt": "b\n" });
  assert.deepEqual(patches.map((file) => path.basename(file)), ["0001-Change-a.patch"]);
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
  const patches = makePatches(upstream, tempDir(), "Change a", { "a.txt": "b\n" });
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
  writeFiles(patchDir, { "0002-Old.patch": "old", "README": "keep" });
  makePatches(upstream, patchDir, "Change a", { "a.txt": "b\n" });
  assert.deepEqual(fs.readdirSync(patchDir).sort(), ["0001-Change-a.patch", "README"]);
});

test("patchFiles lists patches in order and tolerates a missing directory", () => {
  const dir = tempDir();
  writeFiles(dir, { "0002-b.patch": "", "0001-a.patch": "", "notes.txt": "" });
  assert.deepEqual(patchFiles(dir).map((file) => path.basename(file)), ["0001-a.patch", "0002-b.patch"]);
  assert.deepEqual(patchFiles(path.join(dir, "missing")), []);
});
```

`scripts/test/state.test.mjs`:

```js
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { decideSetupAction, hashPatches, readState, writeState } from "../lib/state.mjs";
import { tempDir, writeFiles } from "./helpers.mjs";

const wanted = { commit: "c1", patches: "p1" };
const recorded = { commit: "c1", patches: "p1", head: "h1" };

const cases = [
  ["a missing tree is created", { exists: false }, "create"],
  ["unchanged inputs keep the tree", { exists: true, recorded, head: "h1", dirty: false }, "keep"],
  ["unchanged inputs keep local work too", { exists: true, recorded, head: "h2", dirty: true }, "keep"],
  ["new patches replace an untouched tree", { exists: true, recorded: { ...recorded, patches: "p0" }, head: "h1", dirty: false }, "recreate"],
  ["a new pin replaces an untouched tree", { exists: true, recorded: { ...recorded, commit: "c0" }, head: "h1", dirty: false }, "recreate"],
  ["uncommitted changes stop setup", { exists: true, recorded: { ...recorded, patches: "p0" }, head: "h1", dirty: true }, "stop"],
  ["commits that are not in patches stop setup", { exists: true, recorded: { ...recorded, patches: "p0" }, head: "h2", dirty: false }, "stop"],
  ["a tree without recorded state stops setup", { exists: true, recorded: undefined, head: "h1", dirty: false }, "stop"],
  ["--force moves a changed tree aside", { exists: true, recorded: { ...recorded, patches: "p0" }, head: "h1", dirty: true, force: true }, "backup"],
];

for (const [name, input, expected] of cases) {
  test(`decideSetupAction: ${name}`, () => {
    assert.equal(decideSetupAction({ wanted, force: false, ...input }), expected);
  });
}

test("hashPatches depends on names and contents", () => {
  const dir = tempDir();
  writeFiles(dir, { "0001-a.patch": "one", "0002-b.patch": "two" });
  const files = ["0001-a.patch", "0002-b.patch"].map((name) => path.join(dir, name));
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
```

- [ ] **Step 3: Run the tests and see them fail**

Run: `node --test scripts/test/git.test.mjs scripts/test/state.test.mjs`
Expected: FAIL with `Cannot find module '…/scripts/lib/git.mjs'` (and `state.mjs`).

- [ ] **Step 4: Implement `git.mjs` and `state.mjs`**

`scripts/lib/git.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { run } from "./run.mjs";

// A fixed committer and author dates make `git am` produce the same commits on every machine.
const COMMITTER = ["-c", "user.name=scratch-quantum setup", "-c", "user.email=setup@scratch-quantum.invalid"];

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
      git(dir, [...COMMITTER, "am", "--quiet", "--committer-date-is-author-date", file]);
    } catch (error) {
      try {
        git(dir, ["am", "--abort"]);
      } catch {
        // Nothing to abort.
      }
      throw new Error(`Patch ${path.basename(file)} does not apply to ${dir}.\n${error.message}`);
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
```

`scripts/lib/state.mjs`:

```js
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
export function decideSetupAction({ exists, recorded, wanted, head, dirty, force }) {
  if (!exists) return "create";
  if (recorded && recorded.commit === wanted.commit && recorded.patches === wanted.patches) return "keep";
  // Replace the tree only if it holds nothing beyond what the last setup put there.
  if (recorded && recorded.head === head && !dirty) return "recreate";
  return force ? "backup" : "stop";
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test scripts/test/*.test.mjs`
Expected: PASS for all tests of Tasks 2 and 3.

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "✨ add the git helpers and the setup safety rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `npm run setup` and `npm run patches:update`

**Files:**

- Create: `scripts/setup.mjs`, `scripts/patches.mjs`, `scripts/test/setup.test.mjs`, `scripts/test/patches.test.mjs`

**Interfaces:**

- Consumes: everything from Tasks 2 and 3.
- Produces:
  - `setup({ root = REPO_ROOT, force = false, install = true, log = console.log }): void`. The CLI takes `--force` and `--skip-install`.
  - Test helper `makeProject()` returns `{ root, vmUpstream, patchDir, changePatches }`: a fake repository root with two fake upstream repos, one overlay file per repo and one vm patch. `changePatches()` replaces that patch with a different one.
  - `updatePatches({ root = REPO_ROOT, log = console.log }): void`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test/helpers.mjs`:

```js
/** A repository root with fake upstream repositories, an overlay file per repository and one vm patch. */
export function makeProject() {
  const vmUpstream = makeUpstreamRepo({ "src/engine.js": "upstream engine\n", LICENSE: "license\n" });
  const guiUpstream = makeUpstreamRepo({ "src/gui.js": "upstream gui\n" });
  const root = tempDir();
  writeFiles(root, {
    "upstream.json": JSON.stringify({
      vm: { repository: vmUpstream.url, commit: vmUpstream.commit, version: "1.0.0" },
      gui: { repository: guiUpstream.url, commit: guiUpstream.commit, version: "2.0.0" },
    }),
    "vm/src/extensions/ext/index.js": "extension\n",
    "gui/src/icons/icon.svg": "<svg/>\n",
  });
  const patchDir = path.join(root, "patches", "vm");
  makePatches(vmUpstream, patchDir, "Patch the engine", { "src/engine.js": "patched engine\n" });
  const changePatches = () =>
    makePatches(vmUpstream, patchDir, "Patch the engine", { "src/engine.js": "patched again\n" });
  return { root, vmUpstream, patchDir, changePatches };
}
```

`scripts/test/setup.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { head } from "../lib/git.mjs";
import { setup } from "../setup.mjs";
import { gitIn, makePatches, makeProject, makeUpstreamRepo, readFile, writeFiles } from "./helpers.mjs";

const quiet = () => {};
const run = (root, options = {}) => setup({ root, install: false, log: quiet, ...options });
const inTree = (root, repo, file = "") => path.join(root, ".upstream", repo, file);

test("setup clones, patches and syncs both trees", () => {
  const { root } = makeProject();
  run(root);
  assert.equal(readFile(inTree(root, "vm", "src/engine.js")), "patched engine\n");
  assert.equal(readFile(inTree(root, "vm", "src/extensions/ext/index.js")), "extension\n");
  assert.equal(readFile(inTree(root, "gui", "src/icons/icon.svg")), "<svg/>\n");
  const state = JSON.parse(readFile(path.join(root, ".upstream", "state.json")));
  assert.equal(state.vm.head, head(inTree(root, "vm")));
});

test("running setup again keeps the trees", () => {
  const { root } = makeProject();
  run(root);
  writeFiles(inTree(root, "vm"), { "notes.txt": "mine\n" });
  run(root);
  assert.equal(readFile(inTree(root, "vm", "notes.txt")), "mine\n");
});

test("setup re-creates an untouched tree when the patches change", () => {
  const { root, changePatches } = makeProject();
  run(root);
  changePatches();
  run(root);
  assert.equal(readFile(inTree(root, "vm", "src/engine.js")), "patched again\n");
  assert.equal(readFile(inTree(root, "vm", "src/extensions/ext/index.js")), "extension\n");
});

test("setup stops instead of discarding uncommitted changes", () => {
  const { root, changePatches } = makeProject();
  run(root);
  writeFiles(inTree(root, "vm"), { "src/engine.js": "my edit\n" });
  changePatches();
  assert.throws(() => run(root), /patches:update/);
  assert.equal(readFile(inTree(root, "vm", "src/engine.js")), "my edit\n");
});

test("setup stops instead of discarding commits that are not in patches/", () => {
  const { root, changePatches } = makeProject();
  run(root);
  writeFiles(inTree(root, "vm"), { "src/engine.js": "my edit\n" });
  gitIn(inTree(root, "vm"), "commit", "--quiet", "--all", "--message", "My change");
  changePatches();
  assert.throws(() => run(root), /patches:update/);
  assert.equal(gitIn(inTree(root, "vm"), "log", "-1", "--format=%s"), "My change");
});

test("--force moves a changed tree aside instead of deleting it", () => {
  const { root, changePatches } = makeProject();
  run(root);
  writeFiles(inTree(root, "vm"), { "src/engine.js": "my edit\n" });
  changePatches();
  run(root, { force: true });
  const backups = fs.readdirSync(path.join(root, ".upstream")).filter((name) => name.startsWith("vm.bak-"));
  assert.equal(backups.length, 1);
  assert.equal(readFile(path.join(root, ".upstream", backups[0], "src/engine.js")), "my edit\n");
  assert.equal(readFile(inTree(root, "vm", "src/engine.js")), "patched again\n");
});

test("a patch that does not apply leaves no tree behind", () => {
  const { root, vmUpstream, patchDir } = makeProject();
  const other = makeUpstreamRepo({ "src/engine.js": "different\n" });
  makePatches(other, patchDir, "Patch the engine", { "src/engine.js": "x\n" });
  assert.throws(() => run(root), /0001-Patch-the-engine\.patch/);
  assert.equal(fs.existsSync(inTree(root, "vm")), false);
  makePatches(vmUpstream, patchDir, "Patch the engine", { "src/engine.js": "patched engine\n" });
  run(root);
  assert.equal(readFile(inTree(root, "vm", "src/engine.js")), "patched engine\n");
});
```

`scripts/test/patches.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { updatePatches } from "../patches.mjs";
import { setup } from "../setup.mjs";
import { gitIn, makeProject, readFile, writeFiles } from "./helpers.mjs";

const quiet = () => {};
const run = (root) => setup({ root, install: false, log: quiet });
const tree = (root) => path.join(root, ".upstream", "vm");

test("updatePatches on a fresh setup changes nothing", () => {
  const { root, patchDir } = makeProject();
  run(root);
  const before = fs.readdirSync(patchDir).map((name) => [name, readFile(path.join(patchDir, name))]);
  updatePatches({ root, log: quiet });
  const after = fs.readdirSync(patchDir).map((name) => [name, readFile(path.join(patchDir, name))]);
  assert.deepEqual(after, before);
});

test("updatePatches writes new commits, and setup keeps and reproduces them", () => {
  const { root, patchDir } = makeProject();
  run(root);
  writeFiles(tree(root), { "src/engine.js": "engine v2\n" });
  gitIn(tree(root), "commit", "--quiet", "--all", "--message", "Change the engine again");
  updatePatches({ root, log: quiet });
  assert.deepEqual(fs.readdirSync(patchDir).sort(), [
    "0001-Patch-the-engine.patch",
    "0002-Change-the-engine-again.patch",
  ]);
  writeFiles(tree(root), { "notes.txt": "mine\n" });
  run(root);
  assert.equal(readFile(path.join(tree(root), "notes.txt")), "mine\n");
  fs.rmSync(path.join(root, ".upstream"), { recursive: true, force: true });
  run(root);
  assert.equal(readFile(path.join(tree(root), "src/engine.js")), "engine v2\n");
});

test("updatePatches refuses uncommitted changes", () => {
  const { root, patchDir } = makeProject();
  run(root);
  const before = fs.readdirSync(patchDir);
  writeFiles(tree(root), { "src/engine.js": "not committed\n" });
  assert.throws(() => updatePatches({ root, log: quiet }), /Commit them/);
  assert.deepEqual(fs.readdirSync(patchDir), before);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test scripts/test/setup.test.mjs scripts/test/patches.test.mjs`
Expected: FAIL with `Cannot find module '…/scripts/setup.mjs'`.

- [ ] **Step 3: Implement `setup.mjs`**

```js
import fs from "node:fs";
import path from "node:path";
import { main } from "./lib/cli.mjs";
import { applyPatches, cloneAt, hasTrackedChanges, head, patchFiles } from "./lib/git.mjs";
import { layout, readUpstream, REPO_ROOT, REPOS } from "./lib/layout.mjs";
import { syncOverlay } from "./lib/overlay.mjs";
import { run } from "./lib/run.mjs";
import { decideSetupAction, hashPatches, readState, writeState } from "./lib/state.mjs";

const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

function createTree(paths, repo, pin, patches) {
  const tree = paths.tree(repo);
  fs.rmSync(paths.overlayOptions(repo).manifest, { force: true });
  try {
    cloneAt(tree, pin.repository, pin.commit);
    applyPatches(tree, patches);
  } catch (error) {
    // A half-made tree holds no work of yours; remove it so that the next run starts clean.
    fs.rmSync(tree, { recursive: true, force: true });
    throw error;
  }
}

// Does what `npm link` did in the old workflow, without a global install.
function linkVmIntoGui(paths) {
  const link = path.join(paths.tree("gui"), "node_modules", "scratch-vm");
  fs.rmSync(link, { recursive: true, force: true });
  if (process.platform === "win32") fs.symlinkSync(paths.tree("vm"), link, "junction");
  else fs.symlinkSync(path.relative(path.dirname(link), paths.tree("vm")), link);
}

/** Clone the pinned upstream repositories, apply the patches, sync the overlays and install dependencies. */
export function setup({ root = REPO_ROOT, force = false, install = true, log = console.log } = {}) {
  const paths = layout(root);
  const upstream = readUpstream(root);
  const state = readState(paths.stateFile);
  for (const repo of REPOS) {
    const tree = paths.tree(repo);
    const patches = patchFiles(paths.patches(repo));
    const wanted = { commit: upstream[repo].commit, patches: hashPatches(patches) };
    const exists = fs.existsSync(tree);
    const action = decideSetupAction({
      exists,
      recorded: state[repo],
      wanted,
      head: exists ? head(tree) : undefined,
      dirty: exists && hasTrackedChanges(tree),
      force,
    });
    if (action === "stop") {
      throw new Error(
        `.upstream/${repo} has changes that are not in patches/${repo}/ yet, and setup would replace it.\n` +
          `Run "npm run patches:update" to keep them, or "npm run setup -- --force" to move .upstream/${repo} aside.`,
      );
    }
    if (action === "backup") {
      const backup = `${tree}.bak-${timestamp()}`;
      fs.renameSync(tree, backup);
      log(`Moved .upstream/${repo} to ${path.relative(root, backup)}`);
    }
    if (action === "recreate") fs.rmSync(tree, { recursive: true, force: true });
    if (action !== "keep") {
      log(`Setting up .upstream/${repo}: ${upstream[repo].version} with ${patches.length} patch(es)`);
      createTree(paths, repo, upstream[repo], patches);
      state[repo] = { ...wanted, head: head(tree) };
      writeState(paths.stateFile, state);
    }
    syncOverlay(paths.overlayOptions(repo));
    if (install && (action !== "keep" || !fs.existsSync(path.join(tree, "node_modules")))) {
      // HUSKY=0 keeps upstream's commit hooks out of .upstream, so that patch commits need no special format.
      run("npm", ["ci"], { cwd: tree, env: { HUSKY: "0" } });
    }
  }
  if (install) linkVmIntoGui(paths);
}

main(import.meta.url, (args) =>
  setup({ force: args.includes("--force"), install: !args.includes("--skip-install") }),
);
```

- [ ] **Step 4: Implement `patches.mjs`**

```js
import { main } from "./lib/cli.mjs";
import { formatPatches, hasTrackedChanges, head } from "./lib/git.mjs";
import { layout, readUpstream, REPO_ROOT, REPOS, requireTrees } from "./lib/layout.mjs";
import { hashPatches, readState, writeState } from "./lib/state.mjs";

/** Write the commits in .upstream/<repo> on top of the pinned commit to patches/<repo>/. */
export function updatePatches({ root = REPO_ROOT, log = console.log } = {}) {
  const paths = layout(root);
  requireTrees(paths);
  for (const repo of REPOS) {
    if (hasTrackedChanges(paths.tree(repo))) {
      throw new Error(
        `.upstream/${repo} has uncommitted changes to upstream files. ` +
          `Commit them in .upstream/${repo} first, then run "npm run patches:update" again.`,
      );
    }
  }
  const upstream = readUpstream(root);
  const state = readState(paths.stateFile);
  for (const repo of REPOS) {
    const files = formatPatches(paths.tree(repo), upstream[repo].commit, paths.patches(repo));
    // Record the result, so that the next setup keeps this tree instead of replacing it.
    state[repo] = { commit: upstream[repo].commit, patches: hashPatches(files), head: head(paths.tree(repo)) };
    log(`patches/${repo}: ${files.length} patch(es)`);
  }
  writeState(paths.stateFile, state);
}

main(import.meta.url, () => updatePatches());
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `npm run test:scripts`
Expected: PASS for all tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "✨ add the setup and patches:update commands" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Create the real patches and check the reconstruction

**Files:**

- Create: `patches/vm/0001-Allow-blocks-to-set-their-own-colour.patch`, `patches/vm/0002-Register-the-quantum-extension.patch`, `patches/gui/0001-Add-the-quantum-extension-to-the-extension-library.patch`

**Interfaces:**

- Consumes: `npm run setup`, `npm run patches:update`.
- Produces: a working `.upstream/` with all dependencies installed. The patch files are named after the commit subjects.

- [ ] **Step 1: Set up without patches**

Run: `npm run setup` (this takes several minutes, mostly `npm ci`)
Expected: `Setting up .upstream/vm: 5.0.247 with 0 patch(es)`, the same for gui with 5.1.52, then npm output and exit code 0. `ls -l .upstream/gui/node_modules/scratch-vm` shows a link to `../../vm`.

- [ ] **Step 2: Commit the three upstream changes in `.upstream/`**

```bash
git -C $WS/scratch-vm diff 661546a0 develop -- src/engine/runtime.js | git -C .upstream/vm apply
git -C .upstream/vm commit --quiet -m "Allow blocks to set their own colour" \
  -m "An extension block can set \`color\` in its block info. The block then uses that colour instead of the colour of its category. The quantum extension uses this to draw its blocks in different colours." \
  -- src/engine/runtime.js
git -C $WS/scratch-vm diff 661546a0 develop -- src/extension-support/extension-manager.js | git -C .upstream/vm apply
git -C .upstream/vm commit --quiet -m "Register the quantum extension" \
  -m "Adds \`quantum\` to the built-in extensions. The extension itself is in \`src/extensions/mqt_quantum/\`." \
  -- src/extension-support/extension-manager.js
git -C $WS/scratch-gui diff ceb1863e develop -- src/lib/libraries/extensions/index.jsx | git -C .upstream/gui apply
git -C .upstream/gui commit --quiet -m "Add the quantum extension to the extension library" \
  -m "Adds a featured \"Quantum\" entry that uses the icons in \`src/lib/libraries/extensions/quantum/\`." \
  -- src/lib/libraries/extensions/index.jsx
git -C .upstream/vm status --porcelain --untracked-files=no; git -C .upstream/gui status --porcelain --untracked-files=no
```

Expected: no output from the two status commands.

- [ ] **Step 3: Write the patches**

Run: `npm run patches:update && ls patches/*`
Expected: `patches/vm: 2 patch(es)`, `patches/gui: 1 patch(es)`, and the three file names listed under **Files**. Read each patch: it must contain exactly the one-file diff shown by `git -C $WS/scratch-vm diff 661546a0 develop -- <file>` (and the gui equivalent).

- [ ] **Step 4: Commit the patches**

```bash
git add patches/
git commit -m "✨ add the patches against upstream Scratch" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Check that a fresh setup reproduces the patches**

```bash
rm -rf .upstream
npm run setup && npm run patches:update
git status --porcelain patches/
```

Expected: no output from `git status`, so the round trip is byte-identical.

- [ ] **Step 6: Check that the patched trees equal the forks**

```bash
check_tree() {  # $1 = upstream tree, $2 = fork checkout
  local idx=$(mktemp -u)
  GIT_INDEX_FILE=$idx git -C "$1" read-tree HEAD
  GIT_INDEX_FILE=$idx git -C "$1" add --all
  local tree=$(GIT_INDEX_FILE=$idx git -C "$1" write-tree)
  rm -f "$idx"
  diff <(git -C "$1" ls-tree -r "$tree" | grep -vP '\tdocs/' | sort) \
       <(git -C "$2" ls-tree -r develop | grep -vP '\tdocs/' | sort) && echo "identical: $1"
}
check_tree .upstream/vm $WS/scratch-vm
check_tree .upstream/gui $WS/scratch-gui
```

Expected: `identical: .upstream/vm` and `identical: .upstream/gui`. The temporary index snapshots every file that git doesn't ignore, including the untracked overlay copies, and `diff` compares mode, blob SHA and path against the fork. If there is any difference, stop and report it to Damian.

---

### Task 6: Test, build, lint and dev commands

**Files:**

- Create: `scripts/test.mjs`, `scripts/build.mjs`, `scripts/dev.mjs`, `scripts/lint.mjs`, `scripts/test/test-command.test.mjs`

**Interfaces:**

- Consumes: `syncAll()`, `watchAll()` (Task 2), `listFiles()`, `layout()`, `run()`, `needsShell()`, `main()`.
- Produces: `testFiles(root: string, args: string[]): string[]`, which returns paths relative to `vm/`.

- [ ] **Step 1: Write the failing test**

`scripts/test/test-command.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { testFiles } from "../test.mjs";
import { tempDir, writeFiles } from "./helpers.mjs";

test("by default, npm test runs the unit and integration tests of the extension", () => {
  const root = tempDir();
  writeFiles(root, {
    "vm/test/unit/extension_quantum_b.js": "",
    "vm/test/unit/extension_quantum_a.js": "",
    "vm/test/unit/helper.js": "",
    "vm/test/integration/quantum_c.js": "",
    "vm/test/fixtures/quantum/extension_quantum_x.js": "",
  });
  assert.deepEqual(testFiles(root, []), [
    "test/unit/extension_quantum_a.js",
    "test/unit/extension_quantum_b.js",
    "test/integration/quantum_c.js",
  ]);
});

test("given files are passed on relative to vm/", () => {
  assert.deepEqual(testFiles(tempDir(), ["vm/test/unit/x.js", "test/unit/y.js"]), [
    "test/unit/x.js",
    "test/unit/y.js",
  ]);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test scripts/test/test-command.test.mjs`
Expected: FAIL with `Cannot find module '…/scripts/test.mjs'`.

- [ ] **Step 3: Implement the four commands**

`scripts/test.mjs`:

```js
import path from "node:path";
import { main } from "./lib/cli.mjs";
import { layout, REPO_ROOT } from "./lib/layout.mjs";
import { listFiles } from "./lib/overlay.mjs";
import { run } from "./lib/run.mjs";
import { syncAll } from "./sync.mjs";

const DEFAULT_TESTS = [
  ["test/unit", /^extension_quantum_[^/]*\.js$/],
  ["test/integration", /^quantum_[^/]*\.js$/],
];

/** The test files to run, relative to vm/: the given ones, or all tests of the extension. */
export function testFiles(root, args) {
  if (args.length > 0) return args.map((file) => file.replace(/^vm\//, ""));
  const overlay = layout(root).overlay("vm");
  return DEFAULT_TESTS.flatMap(([dir, pattern]) =>
    listFiles(path.join(overlay, dir))
      .filter((file) => pattern.test(file))
      .map((file) => `${dir}/${file}`),
  );
}

main(import.meta.url, (args) => {
  syncAll();
  run("npx", ["tap", "--no-coverage", ...testFiles(REPO_ROOT, args)], { cwd: layout().tree("vm") });
});
```

`scripts/build.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { main } from "./lib/cli.mjs";
import { layout } from "./lib/layout.mjs";
import { run } from "./lib/run.mjs";
import { syncAll } from "./sync.mjs";

main(import.meta.url, () => {
  const paths = layout();
  syncAll();
  // Build the vm first: the editor build copies dist/web/extension-worker.js from it.
  run("npx", ["webpack"], { cwd: paths.tree("vm") });
  run("npm", ["run", "build"], { cwd: paths.tree("gui"), env: { NODE_ENV: "production" } });
  fs.rmSync(paths.build, { recursive: true, force: true });
  fs.cpSync(path.join(paths.tree("gui"), "build"), paths.build, { recursive: true });
  console.log(`The editor is in ${paths.build}`);
});
```

`scripts/dev.mjs`:

```js
import { spawn } from "node:child_process";
import { main } from "./lib/cli.mjs";
import { layout } from "./lib/layout.mjs";
import { needsShell } from "./lib/run.mjs";
import { syncAll, watchAll } from "./sync.mjs";

main(import.meta.url, () => {
  const paths = layout();
  syncAll();
  const stopWatching = watchAll();
  const children = [
    ["vm", ["webpack", "--watch"]],
    ["gui", ["webpack", "serve"]],
  ].map(([repo, args]) =>
    spawn("npx", args, { cwd: paths.tree(repo), stdio: "inherit", shell: needsShell("npx") }),
  );
  let stopping = false;
  const stop = (code) => {
    if (stopping) return;
    stopping = true;
    stopWatching();
    for (const child of children) child.kill();
    process.exitCode = code;
  };
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
  for (const child of children) child.on("exit", (code) => stop(code ?? 1));
});
```

`scripts/lint.mjs`:

```js
import { main } from "./lib/cli.mjs";
import { layout } from "./lib/layout.mjs";
import { listFiles } from "./lib/overlay.mjs";
import { run } from "./lib/run.mjs";
import { syncAll } from "./sync.mjs";

main(import.meta.url, () => {
  syncAll();
  const files = listFiles(layout().overlay("vm")).filter((file) => file.endsWith(".js"));
  run("npx", ["eslint", ...files], { cwd: layout().tree("vm") });
});
```

- [ ] **Step 4: Run the script tests**

Run: `npm run test:scripts`
Expected: PASS for all tests.

- [ ] **Step 5: Run the extension tests and compare them with the fork**

```bash
MQT_CC=/home/damian/01_research/core/.claude/worktrees/lucid-davinci-63efad/build/llvm23-release/mlir/tools/mqt-cc/mqt-cc
(cd $WS/scratch-vm && npx tap --no-coverage test/unit/extension_quantum_*.js test/integration/quantum_*.js 2>&1 | tail -6)
npm test 2>&1 | tail -6
(cd $WS/scratch-vm && MQT_CC=$MQT_CC npx tap --no-coverage test/unit/extension_quantum_*.js test/integration/quantum_*.js 2>&1 | tail -6)
MQT_CC=$MQT_CC npm test 2>&1 | tail -6
```

Expected: `npm test` reports the same totals (pass, fail, skip) as the fork run directly above it, and there are no failures. If the `mqt-cc` binary no longer exists, skip the two `MQT_CC` runs and say so in the report.

- [ ] **Step 6: Build and compare with the deployed build**

```bash
npm run build
diff <(ls -A build | sort) \
     <(git ls-tree --name-only origin/main | grep -vxE 'docs|README.md|\.gitignore|\.nojekyll|\.pre-commit-config\.yaml|\.readthedocs\.yaml|pyproject\.toml|uv\.lock' | sort) \
  && echo "same top-level files as the deployed build"
grep -c "Export Circuits to MLIR" build/gui.js
```

Expected: `same top-level files as the deployed build`, and a count of at least 1.

- [ ] **Step 7: Check `npm run dev` by hand**

Start `npm run dev` in the background. Wait until the gui output reports a successful compile, then check:

```bash
curl -sf http://localhost:8601/ | grep -c gui.js                 # expected: 1
echo "// sync check" > vm/src/extensions/mqt_quantum/zz-sync-check.js
sleep 2; cat .upstream/vm/src/extensions/mqt_quantum/zz-sync-check.js   # expected: // sync check
rm vm/src/extensions/mqt_quantum/zz-sync-check.js
sleep 2; ls .upstream/vm/src/extensions/mqt_quantum/zz-sync-check.js    # expected: No such file
```

Then open http://localhost:8601 in the browser pane. Add the Quantum extension from the extension library, and check that the Quantum category shows its blocks, including "Export Circuits to MLIR". Take a screenshot for the report, then stop the dev process.

- [ ] **Step 8: Commit**

```bash
git add scripts/
git commit -m "✨ add the test, build, lint and dev commands" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Remove the committed build, configure the repository and add the workflow

**Files:**

- Delete: the build files at the root (`*.html`, `*.js`, `*.map`, `*.LICENSE.txt`, `*.hex`, `chunks/`, `static/`, `.nojekyll`)
- Modify: `.pre-commit-config.yaml`, `.readthedocs.yaml`
- Create: `.github/workflows/editor.yml`

**Interfaces:**

- Consumes: `npm run test:scripts`, `npm run setup`, `npm test`, `npm run build`.
- Produces: the artifact `editor`, the `gh-pages` layout (production at the root, previews in `pr-preview/pr-<N>/`).

- [ ] **Step 1: Remove the committed build**

```bash
git ls-tree --name-only HEAD | grep -E '^(chunks|static|\.nojekyll|[^/]+\.(html|js|map|hex|LICENSE\.txt))$'
git rm -r --quiet $(git ls-tree --name-only HEAD | grep -E '^(chunks|static|\.nojekyll|[^/]+\.(html|js|map|hex|LICENSE\.txt))$')
git ls-tree --name-only HEAD
```

The first command should list the build files only. Expected afterwards: the root holds only `.gitignore`, `.nvmrc`, `.pre-commit-config.yaml`, `.readthedocs.yaml`, `README.md`, `docs`, `gui`, `package.json`, `patches`, `pyproject.toml`, `scripts`, `upstream.json`, `uv.lock` and `vm` (`.github` only appears after Step 4).

- [ ] **Step 2: Update `.pre-commit-config.yaml`**

Replace these lines:

```yaml
# The deployed web app at the repository root is a generated build (see docs/development.md) and must not be modified.
# The design specs and plans in docs/superpowers/ are kept as written.
exclude: ^(chunks/|static/|[^/]+\.(html|js|map|hex)$|docs/superpowers/)
```

with:

```yaml
# Patches must apply byte for byte, and tap snapshots must match the test output exactly.
# The design specs and plans in docs/superpowers/ are kept as written.
exclude: ^(patches/|vm/tap-snapshots/|docs/superpowers/)
```

Add the `exclude` line to the prettier hook:

```yaml
      - id: prettier
        types_or: [yaml, markdown, html, css, scss, javascript, json]
        # The extension follows the eslint style of upstream Scratch.
        exclude: ^(vm|gui)/
```

Excluding `vm/tap-snapshots/` goes beyond the spec, which only names `patches/` and `docs/superpowers/`. The whitespace fixers would otherwise change snapshot strings and break the integration test.

- [ ] **Step 3: Remove the `skip ci` guard from `.readthedocs.yaml`**

Delete these three lines:

```yaml
    post_checkout:
      # Skip docs build if the commit message contains "skip ci" (e.g. web app deployments)
      - (git --no-pager log --pretty="tformat:%s -- %b" -1 | grep -viq "skip ci") || exit 183
```

- [ ] **Step 4: Add `.github/workflows/editor.yml`**

```yaml
name: Editor

on:
  pull_request:
    types: [opened, reopened, synchronize, closed]
    paths-ignore: ["docs/**", "**.md", ".readthedocs.yaml", "pyproject.toml", "uv.lock"]
  push:
    branches: [main]
    paths-ignore: ["docs/**", "**.md", ".readthedocs.yaml", "pyproject.toml", "uv.lock"]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build:
    name: Test and build
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - uses: actions/cache@v4
        with:
          path: ~/.npm
          key: npm-${{ hashFiles('upstream.json', 'patches/**') }}
          restore-keys: npm-
      - run: npm run test:scripts
      - run: npm run setup
      - run: npm test
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: editor
          path: build/
          retention-days: 7

  deploy:
    name: Deploy to GitHub Pages
    needs: build
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    concurrency:
      group: gh-pages
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: editor
          path: build
      - run: touch build/.nojekyll
      # single-commit keeps gh-pages to one commit; clean-exclude keeps the pull request previews.
      - uses: JamesIves/github-pages-deploy-action@v4
        with:
          branch: gh-pages
          folder: build
          clean-exclude: pr-preview/
          single-commit: true

  preview:
    name: Preview
    needs: build
    # Runs after a successful build, or to remove the preview when the pull request closes.
    # Pull requests from forks get no preview: their workflows can't push to this repository.
    if: >-
      !cancelled() &&
      github.event_name == 'pull_request' &&
      github.event.pull_request.head.repo.full_name == github.repository &&
      (needs.build.result == 'success' || github.event.action == 'closed')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    concurrency:
      group: gh-pages
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - if: github.event.action != 'closed'
        uses: actions/download-artifact@v4
        with:
          name: editor
          path: build
      # GitHub Pages sites may hold at most 1 GB, so previews keep only what the editor loads.
      - if: github.event.action != 'closed'
        run: |
          rm -f build/player.* build/blocksonly.* build/blocks-only.html build/compatibilitytesting.* build/compatibility-testing.html
          find build -name '*.map' -delete
          du -sh build
      # pr-preview-action does nothing for "reopened" in auto mode, so the action is set explicitly.
      - uses: rossjrw/pr-preview-action@v1
        with:
          source-dir: build
          preview-branch: gh-pages
          umbrella-dir: pr-preview
          action: ${{ github.event.action == 'closed' && 'remove' || 'deploy' }}
```

The combination of `single-commit` and `clean-exclude` was checked against the action's source while planning (v4.9.0, `src/worktree.ts` and `src/git.ts`). If `gh-pages` exists, the action starts an orphan commit from `origin/gh-pages`, and `clean-exclude` keeps `pr-preview/` out of `rsync --delete`. A production deploy therefore keeps the previews and still squashes the branch to one commit.

- [ ] **Step 5: Lint the workflow and run pre-commit**

```bash
uvx --from actionlint-py actionlint .github/workflows/editor.yml
uvx pre-commit run --all-files
```

Expected:

- actionlint prints no errors.
- pre-commit may fix files in `vm/`, `gui/` or `scripts/`, for example missing final newlines.
- If `typos` reports a word in `vm/`:
  - If it's a correct identifier or term, add it to `[tool.typos.default.extend-words]` in `pyproject.toml` with a short comment.
  - If it's a real typo in a comment or string, fix it.
- Re-run until every hook passes. Then run `npm run test:scripts && npm test` again; expected: PASS.

- [ ] **Step 6: Commit**

Commit in three steps, so that the pre-commit fixes stay apart from the deliberate changes:

```bash
git add -A -- ':!vm' ':!gui' ':!scripts' ':!pyproject.toml'
git commit -m "🔥 remove the committed editor build and add the editor workflow" \
  -m "The editor is now built from source by .github/workflows/editor.yml and deployed to the gh-pages branch. Pull requests get a preview in pr-preview/pr-<N>/." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add -A
git diff --cached --quiet || git commit -m "🎨 pre-commit fixes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git status --porcelain     # expected: no output
```

---

### Task 8: Docs changes, on a separate branch (needs the maintainer's approval)

The maintainer wants to be asked before docs changes. Prepare the changes on a separate local branch and push nothing. Task 9 merges the branch only once Damian confirms the maintainer agreed.

**Files:**

- Modify: `README.md`, `docs/development.md`, `docs/credits.md`, `docs/architecture.md`

- [ ] **Step 1: Create the branch**

```bash
git switch -c feat/build-from-source-docs
```

- [ ] **Step 2: `README.md`, a new section after "Key Features" (before "## Contributors and Supporters")**

````md
## Building the Editor

This repository contains the source of the extension, not a copy of Scratch.
The build downloads `scratch-vm` and `scratch-gui` at pinned versions, applies a few patches, and adds the extension.
You need Node.js 20 or later and git:

```bash
npm run setup   # download and prepare Scratch, and install its dependencies
npm run dev     # run the editor at http://localhost:8601
npm test        # run the tests of the extension
npm run build   # build the editor into build/
```

The [development guide](https://mqt.readthedocs.io/projects/scratch-quantum/en/latest/development.html) explains the details.
````

- [ ] **Step 3: `docs/development.md`**

Make these changes to the page. Keep everything else, including "Building the documentation" and "Writing pages", unchanged.

**Intro:** change the second sentence to:

```md
It describes the layout of this repository, how to run and test the code, how the editor is deployed, and how to build the documentation.
```

**Replace the whole "## Repositories" section** with:

```md
## Repository layout

This [repository](https://github.com/munich-quantum-toolkit/scratch-quantum) holds the source of the extension, this documentation, and the scripts that build the editor.
It does not contain a copy of Scratch.
Instead, the scripts download the Scratch virtual machine (`scratch-vm`) and editor interface (`scratch-gui`) at the versions pinned in `upstream.json`, and add the extension to them.

`vm/`
: The files that the extension adds to `scratch-vm`, at the same paths as in `scratch-vm`: the extension in `vm/src/extensions/mqt_quantum/`, its tests in `vm/test/`, and the test snapshots in `vm/tap-snapshots/`.

`gui/`
: The files that the extension adds to `scratch-gui`: the icons of the extension in `gui/src/lib/libraries/extensions/quantum/`.

`patches/`
: Changes to existing files of `scratch-vm` and `scratch-gui`, one patch per change.
They let blocks set their own colour, register the extension, and add it to the extension library.

`scripts/`
: The scripts behind the `npm run` commands on this page, with their tests in `scripts/test/`.

`docs/`
: This documentation.

The scripts put the patched upstream repositories in `.upstream/vm` and `.upstream/gui`, which git ignores, and copy `vm/` and `gui/` into them.
Always edit the files in `vm/` and `gui/`, never their copies in `.upstream/`: the scripts overwrite the copies.
The copies are read-only, so most editors warn you if you open one by mistake.
```

**Replace the whole "## Running the editor locally" section** with:

````md
## Running the editor locally

You need [Node.js](https://nodejs.org/) 20 or later (`.nvmrc` pins version 20), `npm`, and `git`.

1. Download and patch the upstream repositories and install their dependencies:

   ```bash
   npm run setup
   ```

   The first run takes a few minutes.
   Run it again after you pull changes to `upstream.json` or `patches/`; it only redoes what changed.

2. Start the editor:

   ```bash
   npm run dev
   ```

   The editor is then available at `http://localhost:8601`.
   You can choose another port with the `PORT` environment variable.
   While `npm run dev` runs, it copies every change in `vm/` and `gui/` to `.upstream/`, and the editor rebuilds.
   Reload the page to see your change.
````

**Replace the whole "## Running the tests" section** with:

````md
## Running the tests

Run the tests of the extension from the root of this repository:

```bash
npm test
```

To run single test files, pass their paths relative to `vm/`:

```bash
npm test -- test/unit/extension_quantum_gates.js
```

The tests of the {doc}`MLIR export <mlir-export>` can validate the exported files with the compiler driver `mqt-cc` of {doc}`MQT Core <core:index>`.
This validation is skipped unless you set the environment variable `MQT_CC` to the path of an `mqt-cc` binary:

```bash
MQT_CC=/path/to/mqt-cc npm test
```

Check the code with ESLint:

```bash
npm run lint
```

ESLint still reports errors in older code of the extension that are not fixed yet.
Make sure that you do not add new ones in the files you change.

The scripts in `scripts/` have their own tests:

```bash
npm run test:scripts
```

The complete test suite of `scratch-vm` also contains the upstream tests of Scratch; run it with `npm run tap` in `.upstream/vm`.
The test `test/unit/io_clock.js` can fail by chance when the machine is under load; it is unrelated to the extension.

## Changing Scratch itself

Most changes only touch files in `vm/` and `gui/`.
If you need to change a file that belongs to `scratch-vm` or `scratch-gui`, change it in `.upstream/` and save the change as a patch:

1. Edit the file in `.upstream/vm` or `.upstream/gui`.
2. Commit the change in that directory, with a message that explains it, for example `git -C .upstream/vm commit -am "Explain the change"`.
   To change an existing patch instead, change its commit, for example with `git rebase -i`.
3. Write the patches with `npm run patches:update`.
4. Commit the changed files in `patches/` in this repository.

`npm run setup` refuses to replace an upstream directory that contains changes that are not in `patches/` yet, so you cannot lose them by accident.
To replace such a directory anyway, run `npm run setup -- --force`: it moves the old directory aside, to `.upstream/vm.bak-<time>` or `.upstream/gui.bak-<time>`, instead of deleting it.
````

**Replace the whole "## Deploying the editor" section, including the note at its end,** with:

```md
## Deploying the editor

You do not deploy the editor by hand.
The workflow `.github/workflows/editor.yml` tests and builds the editor for every pull request and every push to `main`:

- A push to `main` deploys the build to the `gh-pages` branch, from which GitHub Pages serves {{ editor_url }}.
- A pull request from a branch of this repository gets a preview below {{ editor_url }}, in `pr-preview/pr-<number>/`, and a bot posts the link in the pull request.
  Closing the pull request removes the preview.
  Pull requests from forks are tested and built, but get no preview.

To build the editor locally, run `npm run build`; the result is in `build/`.
```

**In "### Publishing on Read the Docs",** delete the sentence:

```md
A build is skipped when the message of the latest commit contains `skip ci`.
```

- [ ] **Step 4: `docs/credits.md`, the first paragraph under "## Licenses"**

Replace:

```md
The editor, and so the web app that is deployed from this repository, is built from forks of the `scratch-vm` and `scratch-gui` repositories of the Scratch Foundation.
Both upstream repositories are licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only), and the forks keep that license.
```

with:

```md
The editor, and so the web app that is deployed from this repository, is built from the `scratch-vm` and `scratch-gui` repositories of the Scratch Foundation, at versions pinned in this repository, together with the extension and a few patches.
Both upstream repositories are licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only), and the files in `vm/`, `gui/`, and `patches/` of this repository keep that license.
```

Keep the sentence that follows, with the links to the license texts.

- [ ] **Step 5: `docs/architecture.md`, step 5 of the list for adding a block**

Replace:

```md
5. Add tests in `test/unit/` of `scratch-vm`, next to the existing `extension_quantum_*.js` tests.
```

with:

```md
5. Add tests in `vm/test/unit/` of this repository, next to the existing `extension_quantum_*.js` tests.
```

- [ ] **Step 6: Build the docs and run pre-commit**

```bash
uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html
uvx pre-commit run --all-files
```

Expected: Sphinx finishes without warnings, and every pre-commit hook passes. Re-run pre-commit after it fixes something.

- [ ] **Step 7: Commit and switch back**

```bash
git add README.md docs/development.md docs/credits.md docs/architecture.md
git commit -m "📝 describe building the editor from source" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git switch feat/build-from-source
```

---

### Task 9: Publish and cut over (each step needs Damian's go-ahead)

Every step here is outward-facing. Pushing the branch publishes the extension source. Ask Damian before each step, quoting what it will do, and continue only after a clear yes.

- [ ] **Step 1: Ask about the docs branch**

Ask Damian whether the maintainer approved the docs changes from Task 8.
If yes: `git merge --ff-only feat/build-from-source-docs`.
If not: leave the branch alone. The pull request description then says that the docs pages still describe the old workflow, and the docs follow in a later push.

- [ ] **Step 2: Create `gh-pages` from the build currently on `main`** (needs Damian's OK)

```bash
TMP=$(mktemp -d)
git clone -q --branch main git@github.com:munich-quantum-toolkit/scratch-quantum.git $TMP/pages
cd $TMP/pages
MAIN=$(git rev-parse --short HEAD)
git checkout -q --orphan gh-pages
git rm -r -q --cached docs README.md .gitignore .pre-commit-config.yaml .readthedocs.yaml pyproject.toml uv.lock
git commit -q -m "🚀 deploy the editor built on main at $MAIN"
git ls-tree --name-only HEAD     # expected: only build files and .nojekyll
git push origin gh-pages
cd $REPO; rm -rf "$TMP"
```

- [ ] **Step 3: Switch GitHub Pages to `gh-pages`** (a repository admin does this)

Ask Damian, or the admin, to set Settings → Pages → "Deploy from a branch" to `gh-pages` / `(root)`. Then check:

```bash
gh api repos/munich-quantum-toolkit/scratch-quantum/pages -q '.source'   # expected: {"branch":"gh-pages","path":"/"}
curl -sf https://munich-quantum-toolkit.github.io/scratch-quantum/ | grep -c gui.js   # expected: 1
```

- [ ] **Step 4: Push the branch and open the pull request** (needs Damian's OK)

```bash
git push -u origin feat/build-from-source
gh pr create --repo munich-quantum-toolkit/scratch-quantum --base main --head feat/build-from-source \
  --title "Build the editor from source" --body-file <(cat <<'EOF'
This makes the repository the open-source home of the extension. Instead of a committed editor build, it holds:

- `vm/` and `gui/`: the extension source, imported with its history from the private forks (<VM_COUNT> and <GUI_COUNT> commits; every file byte-identical to the forks' `develop`)
- `patches/`: three small changes to upstream Scratch (per-block colours, registering the extension, the extension library entry)
- `upstream.json`: the pinned upstream versions (scratch-vm 5.0.247, scratch-gui 5.1.52), the versions the forks were based on
- `scripts/` and `npm run setup | dev | test | build | lint | patches:update`
- `.github/workflows/editor.yml`: tests and builds every pull request, deploys `main` to `gh-pages`, and gives pull requests from this repository a preview

The patched upstream trees were compared file by file with the forks and are identical.

**Before merging**
- [x] `gh-pages` was created from the current build on `main`, and GitHub Pages serves from it
- [ ] License: `vm/`, `gui/` and `patches/` are AGPL-3.0 (as upstream). The license of the repository root is for the maintainers to decide.

**Docs:** <DOCS_LINE>

Also removes the `skip ci` guard from `.readthedocs.yaml`, since build commits no longer land on `main`.

Design: `docs/superpowers/specs/2026-10-27-build-from-source-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
```

Before running this, replace `<VM_COUNT>` and `<GUI_COUNT>` with the counts from Task 1 Step 4. Replace `<DOCS_LINE>` with "README, development, credits and architecture pages updated for the new workflow" if Step 1 merged the docs branch, or with "The docs pages still describe the old workflow; the update is ready and follows once approved" if it didn't.

After opening the pull request, bind it with the app's pull request tools and wait for the CI result notification. Don't poll.

- [ ] **Step 5: Check the preview**

Once `Test and build` and `Preview` have passed, open the preview URL from the bot comment in the browser pane. Add the Quantum extension, build the Bell example from the quickstart (`docs/quickstart.md`), run it, and take a screenshot.

- [ ] **Step 6: After Damian merges**

```bash
git -C $REPO fetch -q origin
git -C $REPO log -1 --format=%s origin/gh-pages      # the deploy commit of the merge
curl -sf https://munich-quantum-toolkit.github.io/scratch-quantum/ | grep -c gui.js   # expected: 1
```

Open the live editor in the browser pane and repeat the check from Step 5. If another pull request has a preview, check that it survived the deploy. Confirm that the preview folder of the merged pull request is gone:

```bash
git -C $REPO ls-tree --name-only origin/gh-pages pr-preview/
```

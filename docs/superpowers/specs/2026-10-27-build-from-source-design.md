# Building the editor from source in `scratch-quantum`

Date: 2026-10-27
Status: approved design, spec under review

## Goal

`scratch-quantum` becomes the open-source home of the extension.
Today `main` holds a committed webpack build, and the source lives in two private forks
(`DRovara/scratch-quantum-vm`, `DRovara/scratch-quantum-gui`).
After this change the repository holds the extension source, a few patches against upstream Scratch, and
scripts that build the editor, both locally and in GitHub Actions.
Every push to `main` deploys the editor, and every pull request gets a preview of the editor.

## Decisions

| Topic                | Decision                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Source layout        | Overlay on a pinned upstream: only our files and patches are in the repo; upstream is cloned at build time.                           |
| Hosting and previews | GitHub Pages from a `gh-pages` branch; production at the root, previews at `pr-preview/pr-<N>/`.                                       |
| Commit history       | Import the extension's history with `git filter-repo`, run only in fresh, temporary clones from GitHub.                               |
| Read the Docs        | Remove the `skip ci` guard from `.readthedocs.yaml`; build commits no longer land on `main`.                                         |
| Stashes in the forks | Ignored. They stay in the local `scratch-vm` checkout and are not imported.                                                           |
| Overlay mechanism    | Copy our files into the upstream tree (not symlinks), because Node and webpack resolve relative `require` paths from a symlink target. |

## Current state (checked on 2026-10-27)

- Fork `develop` branches equal their GitHub remotes: `scratch-vm` at `2ff03400`, `scratch-gui` at `233b6de2`.
  No uncommitted changes, and all local branches are merged into `develop`.
- Fork bases, fetchable by SHA from the (archived) Scratch Foundation repositories:
  - `scratchfoundation/scratch-vm` `661546a0a442ecc264d2e3d2bec630195e71c6e6` (5.0.247)
  - `scratchfoundation/scratch-gui` `ceb1863ec2df72e927e3dbfcd945623baccaf2c5` (5.1.52)
- Changes of the `scratch-vm` fork against its base (excluding `docs/`):
  - our own files: `src/extensions/mqt_quantum/` (11 files), `test/unit/extension_quantum_*.js` (11),
    `test/integration/quantum_mlir_export.js`, `test/fixtures/quantum/` (4 `.sb3` projects, 2 helpers),
    `tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs`;
  - edits to upstream files: `src/engine/runtime.js` (a block may set its own `color`) and
    `src/extension-support/extension-manager.js` (registers `quantum`).
- Changes of the `scratch-gui` fork: `src/lib/libraries/extensions/quantum/` (2 icons) and an entry in
  `src/lib/libraries/extensions/index.jsx`.
- The fork's `package-lock.json` files are unchanged from upstream, and both forks pin Node.js 20 (`.nvmrc`).
- The extension `require`s `../../extension-support/…`, and the tests `require` `../../src/…`.
- The production build on `main` is about 147 MB: `static/` 66 MB, and four bundles of about 20 MB each
  (`gui.js`, `player.js`, `blocksonly.js`, `compatibilitytesting.js`); the source maps are tiny.
  `index.html` loads only `gui.js`.
- Upstream `eslint` reports 219 errors in our files.

## Repository layout

```
scratch-quantum/
├── vm/                                   # overlay on scratch-vm; paths mirror the upstream tree
│   ├── LICENSE                           # AGPL-3.0, identical to upstream
│   ├── src/extensions/mqt_quantum/
│   ├── test/unit/extension_quantum_*.js
│   ├── test/integration/quantum_*.js
│   ├── test/fixtures/quantum/
│   └── tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs
├── gui/                                  # overlay on scratch-gui
│   ├── LICENSE                           # AGPL-3.0, identical to upstream
│   └── src/lib/libraries/extensions/quantum/
├── patches/
│   ├── vm/0001-allow-blocks-to-set-their-own-colour.patch
│   ├── vm/0002-register-the-quantum-extension.patch
│   └── gui/0001-add-the-quantum-extension-to-the-library.patch
├── scripts/                              # Node.js ES modules, no dependencies
├── upstream.json
├── package.json                          # private; npm scripts only, no dependencies
├── .nvmrc                                # 20
├── docs/                                 # unchanged, except the edits listed under "Documentation"
└── .github/workflows/editor.yml
```

- The build files at the repository root (`*.html`, `*.js`, `*.map`, `*.LICENSE.txt`, `*.hex`, `chunks/`,
  `static/`, `.nojekyll`) are deleted from `main`.
- `.gitignore` adds `.upstream/`, `node_modules/` and `build/`.
- Paths in `vm/` and `gui/` mirror the upstream trees, so syncing an overlay means copying it file by file.
- New tests follow the existing naming: `vm/test/unit/extension_quantum_*.js`, `vm/test/integration/quantum_*.js`.

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

## Patches

- Each patch is a `git format-patch` file with a commit message that explains the change.
- Setup applies them with `git am` on top of the pinned commit, in file name order.
  This gives `.upstream/vm` and `.upstream/gui` one local commit per patch.
- To change upstream code, edit the file in `.upstream/<repo>`, commit there (new commit or `--amend` /
  `git rebase -i` for an existing patch), and run `npm run patches:update`.
  It rewrites `patches/<repo>/` from `git format-patch <pinned>..HEAD` with stable output
  (`--zero-commit --no-signature --no-stat`), so unchanged patches produce no diff.
- `patches:update` refuses to run while `.upstream/<repo>` has uncommitted changes to tracked files,
  and tells you to commit them first.

## Scripts and commands

All scripts are Node.js ES modules in `scripts/` that only use the standard library and the `git` and `npm`
executables. They run on Linux, macOS and Windows.

| Command                     | What it does                                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run setup`             | Clone upstream, apply patches, sync the overlays, install dependencies, link the vm into the gui.                                                                         |
| `npm run dev`               | Sync with watching, `webpack --watch` in the vm, and `webpack serve` in the gui (http://localhost:8601). Ctrl+C stops all three.                                         |
| `npm run build`             | Sync, build the vm (`webpack`), build the gui (`NODE_ENV=production npm run build`), and copy the result to `build/`.                                                    |
| `npm test [-- <files>]`     | Sync, then run `tap` in `.upstream/vm` on `test/unit/extension_quantum_*.js` and `test/integration/quantum_*.js` (or the given files). MLIR round trips need `MQT_CC`. |
| `npm run lint`              | Run upstream `eslint` on the overlay files in `.upstream/vm`. Not part of CI yet (see "Out of scope").                                                                     |
| `npm run patches:update`    | Regenerate `patches/` from `.upstream/` as described above.                                                                                                                |

### `setup`

1. **Clone.** For each of `vm` and `gui`: `git init`, `git fetch --depth 1 <repository> <commit>`, check it out
   detached into `.upstream/<repo>`.
2. **Patch.** `git am` the patches, with a fixed committer identity so it works without a git config.
   If a patch does not apply, stop and name the patch.
3. **Sync** the overlay (see below).
4. **Install.** `npm ci` in both trees, then replace `.upstream/gui/node_modules/scratch-vm` with a relative
   symbolic link to `.upstream/vm`. This does what `npm link` did in the old workflow, without a global
   install.
5. **Record** the inputs (pinned commit, hashes of the patch files, the resulting `HEAD`) in
   `.upstream/state.json`.

Running `setup` again:

- If the recorded inputs match, it skips steps 1, 2 and 4 (step 4 still runs if `node_modules` is missing).
- If they changed (new pin or edited patches), it re-creates the tree. It does this only if `.upstream/<repo>`
  has no uncommitted changes to tracked files and its `HEAD` equals the recorded `HEAD`. Otherwise you have
  work there that `patches/` does not contain yet, and it stops with a message telling you to run
  `npm run patches:update` first.
- With `--force` it moves the old tree to `.upstream/<repo>.bak-<timestamp>` instead of stopping.
  Setup never deletes a tree that has local changes.

### Overlay sync

- **Copy, never link.** Sync copies every file of `vm/` into `.upstream/vm/`, and of `gui/` into
  `.upstream/gui/`. Copies keep relative `require` paths working for both Node and webpack.
- **Deletions.** A manifest (`.upstream/<repo>.overlay.json`) lists the files of the last sync. Files that were
  removed from the overlay are removed from the upstream tree.
- **Read-only copies.** Copies are made read-only, so editors warn when someone edits the copy instead of the
  original in `vm/` or `gui/`. Git tracks only the executable bit, so this does not show up in `git status`.
- **Watch mode** (`npm run dev`) uses `fs.watch` with `recursive: true` and syncs only the changed files.

## History import

The import runs once, while implementing this design. It never touches the existing checkouts or the forks on
GitHub.

1. Clone each fork from GitHub into a new temporary directory outside the workspace:
   `git clone --single-branch --branch develop git@github.com:DRovara/scratch-quantum-vm.git <tmp>/vm`
   (the same for `scratch-quantum-gui`).
2. In `<tmp>/vm`, run `git filter-repo` and keep only:
   - `src/extensions/mqt_quantum/`
   - `test/unit/extension_quantum_*.js`
   - `test/integration/quantum_mlir_export.js`
   - `test/fixtures/quantum/`
   - `tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs`
   - `docs/superpowers/` (the MLIR export spec and plans)

   Then rename `src/`, `test/` and `tap-snapshots/` to `vm/src/`, `vm/test/` and `vm/tap-snapshots/`.
   `docs/superpowers/` stays where it is. Its file names don't clash with the existing ones in
   `scratch-quantum`, and Sphinx already excludes the folder.
3. In `<tmp>/gui`, keep `src/lib/libraries/extensions/quantum/` and rename it to
   `gui/src/lib/libraries/extensions/quantum/`.
4. On the `scratch-quantum` feature branch, fetch each filtered clone and merge it with
   `--allow-unrelated-histories`, one merge commit per fork.
5. **Check that nothing is missing.** For every kept path, the blob SHAs in the fork's `develop`
   (`git ls-tree -r`) must equal those in the feature branch, with the `vm/` or `gui/` prefix removed.
   Also record the number of imported commits per fork.
6. Delete the temporary clones.

The changes to the upstream files `runtime.js`, `extension-manager.js` and `index.jsx` become the three
patches. Each patch has a commit message that describes the change, and their line-level history stays in
the private forks.

## CI and deployment

Everything runs in one workflow, `.github/workflows/editor.yml`.

**Triggers:**

- `pull_request` (`opened`, `reopened`, `synchronize`, `closed`), `push` to `main`, and `workflow_dispatch`.
- `paths-ignore`: `docs/**`, `**.md`, `.readthedocs.yaml`, `pyproject.toml`, `uv.lock`.

**Jobs:**

- **`build`** runs for every event except a closed pull request:
  1. Check out the repository and set up Node from `.nvmrc`.
  2. Restore `~/.npm` from a cache keyed on `upstream.json` and `patches/**`.
  3. Run `npm run setup`, `npm test` and `npm run build`.
  4. Upload `build/` as the artifact `editor`.
- **`deploy`** runs on pushes to `main` (and on `workflow_dispatch` from `main`), after `build`:
  1. Download the artifact and add `.nojekyll`.
  2. Push it to the root of `gh-pages` with `JamesIves/github-pages-deploy-action@v4`, using
     `clean-exclude: pr-preview/`.
  3. Use `single-commit: true` so that `gh-pages` doesn't keep the history of every build. The plan must
     check that this keeps `pr-preview/`. If it doesn't, drop `single-commit` and add a follow-up for
     cleaning up the branch history.
- **`preview`** runs for pull requests from branches of this repository
  (`github.event.pull_request.head.repo.full_name == github.repository`). It runs after `build` succeeds, or on
  `closed`:
  1. Download the artifact.
  2. Trim it to what the editor needs: delete `player.*`, `blocksonly.*`, `compatibilitytesting.*` and
     `*.map`.
  3. Run `rossjrw/pr-preview-action@v1` with `source-dir`, `preview-branch: gh-pages` and
     `umbrella-dir: pr-preview`. It deploys or removes the preview and comments the URL on the pull request.

**Permissions and concurrency:**

- The workflow runs with `contents: read`. `deploy` and `preview` raise this to `contents: write`, and
  `preview` adds `pull-requests: write`.
- Both jobs share `concurrency: { group: gh-pages, cancel-in-progress: false }`, so pushes to `gh-pages`
  never race.

**Limits:**

- **Site size.** GitHub Pages caps a site at 1 GB. Production uses about 150 MB and each trimmed preview
  about 90 MB, so about nine previews fit at once. Closing a pull request removes its preview.
- **Forks.** Pull requests from forks get `build` (tests and build) but no preview.
- **Docs only.** Pull requests that only change docs don't run the workflow at all. Read the Docs builds
  those.

## Cutover order

The live editor must not break while the change is merged.

1. Before merging, create `gh-pages` from the build files currently on `main`, with `.nojekyll`.
2. A repository admin switches Settings → Pages to "Deploy from a branch: `gh-pages` / root".
   Check that https://munich-quantum-toolkit.github.io/scratch-quantum/ still loads.
3. Merge the pull request. `deploy` replaces the root of `gh-pages` with the build from source.
4. Check the live editor again: the Quantum category loads and the Bell example from the quickstart runs.

## Other repository changes

- **`.readthedocs.yaml`:** remove the `post_checkout` job that skips builds for `skip ci` commits.
- **`.pre-commit-config.yaml`:**
  - Replace the top-level `exclude` with `^(patches/|docs/superpowers/)`. Whitespace fixers must never touch
    patch files.
  - Exclude `^(vm|gui)/` from `prettier`, because the extension follows upstream's eslint style.
  - Keep the other hooks for `vm/` and `gui/`, and fix or allow-list whatever `typos` reports.
- **Licenses:** `vm/LICENSE` and `gui/LICENSE` are the AGPL-3.0 files of the forks, which are identical to
  upstream. The license of the repository root stays open for the maintainer (see "Out of scope").

### Documentation

These edits change user-facing docs. The maintainer wants to be asked before any further docs changes, so
**Damian asks the maintainer before these commits are pushed**. They go in a separate commit, and the pull
request description lists them.

- `README.md`: a short "Building the editor" section with `npm run setup`, `npm run dev`, `npm test` and
  `npm run build`, linking to the development page.
- `docs/development.md`: rewrite "Repositories", "Running the editor", "Testing" and "Deploying the editor" for
  the new layout. Add a short section on patches.
- `docs/credits.md`: the editor is built from pinned upstream versions plus patches in this repository, not from
  forks.
- `docs/architecture.md`: tests go in `vm/test/unit/` of this repository.

## Testing and acceptance criteria

1. **Import is complete:** the blob SHA comparison from "History import" step 5 matches for every path.
2. **Reconstruction is exact:** after `npm run setup`, compare `.upstream/vm` and `.upstream/gui` with fresh
   clones of the forks' `develop` using `diff -r`, excluding `.git/`, `node_modules/`, `dist/`, `build/`,
   `playground/` and `docs/`. There must be no differences.
3. **Tests:** `npm test` passes, with the same pass and skip counts as the same files in the fork checkout,
   both with and without `MQT_CC`.
4. **Local workflow:** `npm run dev` serves the editor. Editing a file in `vm/src/extensions/mqt_quantum/` shows
   up after a reload, and deleting a file in `vm/` removes its copy.
5. **Safety of setup:** with an uncommitted edit in `.upstream/vm`, changing a patch and re-running `setup`
   stops without touching the tree, and `--force` moves the tree aside.
6. **Patch round trip:** `npm run patches:update` on a fresh setup produces no diff in `patches/`.
7. **CI:** the pull request for this change runs `build` successfully and gets a working preview link. The
   Quantum category loads there, and the Bell example runs.
8. **After the merge:** the cutover checks above pass.

## Out of scope / follow-ups

- **License of the repository root:** for the maintainer to decide; the pull request flags it. Because `vm/`,
  `gui/` and `patches/` are AGPL-3.0, AGPL-3.0 is the realistic choice.
- **Lint:** fix the 219 upstream eslint errors in our files, then add `npm run lint` to CI.
- **Upgrading upstream:** `scratch-vm` and `scratch-gui` are archived. Upstream development continues in the
  `scratchfoundation/scratch-editor` monorepo. Moving there changes `upstream.json` and the layout of the
  overlay, and needs its own design.
- **Old forks:** they stay private and are no longer updated. Archiving them is Damian's decision.
- **Previews for pull requests from forks:** these need a `workflow_run`-based setup.

# Development

This page is for you if you want to run the editor yourself, change the extension, update the deployed editor, or work on this documentation.
It describes the repositories, how to run and test the code, how the editor is deployed, and how to build the documentation.
The {doc}`architecture` page explains how the extension is built, and {doc}`contributing` describes how to propose changes.

## Repositories

The extension lives in three repositories.

`munich-quantum-toolkit/scratch-quantum`
: This [repository](https://github.com/munich-quantum-toolkit/scratch-quantum) holds the deployed editor and this documentation.
  The built editor is stored at the root of the repository, and GitHub Pages serves it from the `main` branch at {{ editor_url }}.
  The documentation sources are in the `docs/` directory.

`DRovara/scratch-quantum-vm`
: A fork of the Scratch virtual machine (`scratch-vm`).
  It contains the extension in `src/extensions/mqt_quantum/`.
  The default branch is `develop`.

`DRovara/scratch-quantum-gui`
: A fork of the Scratch editor interface (`scratch-gui`).
  It contains the editor, including the entry for the extension in the extension library.
  The default branch is `develop`.

The two forks are currently private.
If you need access, ask the maintainers, for example through the {doc}`support page <support>`.

The examples on this page assume that you cloned the repositories next to each other.
The names `scratch-vm`, `scratch-gui`, and `scratch-quantum` below refer to the three checkouts.

## Running the editor locally

You need [Node.js](https://nodejs.org/) and `npm`.
Both forks pin Node.js 20 in their `.nvmrc` file.

The editor consumes the virtual machine as a package.
To see your changes to the extension in the editor, build the virtual machine and link it into the editor.

1. In `scratch-vm`, install the dependencies and build the virtual machine:

   ```bash
   npm install
   npm run build
   ```

   The `build` script generates the API documentation (`npm run docs`) and then bundles the virtual machine with webpack.
   The editor uses the web build in `dist/web`.

2. Link the virtual machine into the editor.
   In `scratch-vm`, run `npm link`.
   In `scratch-gui`, install the dependencies and link the package:

   ```bash
   npm install
   npm link scratch-vm
   ```

   `npm link` replaces `node_modules/scratch-vm` of the editor with a symbolic link to your checkout of the virtual machine.
   Run `npm link scratch-vm` after `npm install`: installing again resets the link.

3. Start the development server of the editor:

   ```bash
   npm start
   ```

   The editor is then available at `http://localhost:8601`.
   You can choose another port with the `PORT` environment variable.

After you change the extension, run `npm run build` in `scratch-vm` again and reload the editor.
Alternatively, run `npm run watch` in `scratch-vm`, which rebuilds the virtual machine whenever a source file changes.

## Running the tests

The tests of the extension are in `scratch-vm`.
Run them from the root of that repository:

```bash
npx tap --no-coverage test/unit/extension_quantum_*.js test/integration/quantum_mlir_export.js
```

The tests of the {doc}`MLIR export <mlir-export>` can validate the exported files with the compiler driver `mqt-cc` of {doc}`MQT Core <core:index>`.
This validation is skipped unless you set the environment variable `MQT_CC` to the path of an `mqt-cc` binary:

```bash
MQT_CC=/path/to/mqt-cc npx tap --no-coverage test/unit/extension_quantum_*.js test/integration/quantum_mlir_export.js
```

Check new and changed files with ESLint:

```bash
npx eslint src/extensions/mqt_quantum/<file>.js
```

The file `src/extensions/mqt_quantum/index.js` has older lint errors that are not fixed yet.
Make sure that you do not add new ones.

The complete test suite of `scratch-vm` (`npm run tap`) also contains the upstream tests of Scratch.
The test `test/unit/io_clock.js` can fail by chance when the machine is under load; it is unrelated to the extension.

## Deploying the editor

The editor at {{ editor_url }} is a build of `scratch-gui` that is committed to the root of this repository.
To update it:

1. Build the virtual machine in `scratch-vm` (`npm run build`), as described above.
   Make sure that the link to the virtual machine is in place.

2. In `scratch-gui`, build the editor:

   ```bash
   npm run build
   ```

   The build removes the old `build/` directory and writes the new one.

3. In `scratch-quantum`, remove the files of the previous build and copy the new build to the root:

   ```bash
   rm -rf chunks static *.html *.js *.map *.hex
   cp -r /path/to/scratch-gui/build/. .
   ```

   The build consists of the HTML pages (`index.html`, `blocks-only.html`, `compatibility-testing.html`, `player.html`), their scripts and source maps (`gui.js`, `blocksonly.js`, `compatibilitytesting.js`, `player.js`, `extension-worker.js`, and the `.map` files), the `chunks/` and `static/` directories, and one `.hex` file.
   Removing the old files first prevents outdated chunks from piling up, because their file names change with their contents.

   Do not delete or overwrite the files that do not belong to the build: `docs/`, `.readthedocs.yaml`, `pyproject.toml`, `uv.lock`, `.gitignore`, and `.nojekyll`.
   The commands above leave them alone.
   Check `git status` before you commit: only build files should change.

4. Commit the result with a message that contains `[skip ci]` and push to `main`:

   ```bash
   git add -A
   git commit -m "build: :construction_worker: update the web app [skip ci]"
   git push origin main
   ```

   The marker `[skip ci]` tells Read the Docs not to rebuild the documentation for this commit, because the documentation does not change.

GitHub Pages then serves the new build at {{ editor_url }}.
The `.nojekyll` file at the root switches off Jekyll, so that GitHub Pages serves the files unchanged.

```{note}
The `deploy` script in `scratch-gui` is inherited from the upstream project and publishes to a `gh-pages` branch.
This editor is not deployed that way, so do not use it.
```

## Building the documentation

The documentation is built with [Sphinx](https://www.sphinx-doc.org/), the [Furo](https://pradyunsg.me/furo/) theme, and [MyST](https://myst-parser.readthedocs.io/) for the Markdown sources.
The dependencies are defined in the `docs` dependency group of `pyproject.toml`, and [uv](https://docs.astral.sh/uv/) installs them.

Build the documentation from the root of this repository:

```bash
uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html
```

The flag `-W` turns warnings into errors, so a build that succeeds is free of warnings, including broken cross-references and links.
Open the result in your browser by serving it locally:

```bash
python3 -m http.server --directory docs/_build/html
```

The output in `docs/_build/` is ignored by git.

### Writing pages

The pages are Markdown files in `docs/`.
New pages must be added to a `toctree` in `docs/index.md`.
Write one sentence per line, use sentence case for headings, and refer to other pages with the `{doc}` role.
The pages address you, the reader, directly.

Blocks are written with the `scratchblocks` directive, which renders them with [scratchblocks](https://github.com/scratchblocks/scratchblocks) (version 3.7.1) in the browser.
Follow these rules:

- Every quantum block ends with `:: extension`.
  The hat block is written `Quantum Circuit :: hat extension`.
- A quantum reporter inside an input is wrapped in parentheses and carries the tag too: `(qubit (0) of register [q] :: extension)`.
- `measure` is a boolean block, so it is wrapped in angle brackets: `<measure (qubit (0) of register [q] :: extension) :: extension>`.
- `controlled on` is a C-block: the blocks inside follow on separate lines and the block ends with `} :: extension`.
- Dropdowns are written `[X v]` and `[Statevector Simulator v]`, numbers `(2)`, and text `[q]`.
- Standard Scratch blocks (events, control, looks, variables, operators) need no tag.

For example:

````md
```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
controlled on (qubit (0) of register [q] :: extension) {
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
} :: extension
say <measure (qubit (0) of register [q] :: extension) :: extension>
```
````

The syntax is documented in the [scratchblocks syntax reference](https://en.scratch-wiki.info/wiki/Block_Plugin/Syntax).
Cite the publications with `{cite:p}` and the keys `qce_2026_01` and `mqt`; see {doc}`references`.

### Publishing on Read the Docs

The documentation is built and hosted by [Read the Docs](https://about.readthedocs.com/) and appears as a part of the Munich Quantum Toolkit documentation at `https://mqt.readthedocs.io/projects/scratch-quantum`.
The build is configured in `.readthedocs.yaml` at the root of the repository.
It installs the dependencies with `uv` and builds the HTML version and a zipped HTML version.
A build is skipped when the message of the latest commit contains `skip ci`.

You set up the project once on Read the Docs, as a maintainer of the MQT project:

1. Import the repository `munich-quantum-toolkit/scratch-quantum` as a new project.
2. Give the project the slug `scratch-quantum`.
3. Add the project as a subproject of the MQT project.
   Read the Docs then serves it below `https://mqt.readthedocs.io/projects/scratch-quantum`.

From then on, every push triggers a build.

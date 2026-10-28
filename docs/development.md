# Development

This page is for you if you want to run the editor yourself, change the extension, update the deployed editor, or work on this documentation.
It describes the layout of this repository, how to run and test the code, how the editor is deployed, and how to build the documentation.
The {doc}`architecture` page explains how the extension is built, and {doc}`contributing` describes how to propose changes.

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

## Running the editor locally

You need [Node.js](https://nodejs.org/) 20.12 or later (`.nvmrc` pins version 20), `npm`, and `git`.

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

## Running the tests

Run the tests of the extension from the root of this repository:

```bash
npm test
```

To run single test files, pass their paths relative to `vm/`:

```bash
npm test -- test/unit/extension_quantum_simulators.js
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

The pull request checks run it too, so a pull request with ESLint errors fails.

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
2. Commit the change in that directory, with a message that explains it, for example `git -C .upstream/vm add -A && git -C .upstream/vm commit -m "Explain the change"`.
   To change an existing patch instead, change its commit, for example with `git rebase -i`.
3. Write the patches with `npm run patches:update`.
4. Commit the changed files in `patches/` in this repository.

`npm run setup` refuses to replace an upstream directory that contains changes that are not in `patches/` yet, so you cannot lose them by accident.
To replace such a directory anyway, run `npm run setup -- --force`: it moves the old directory aside, to `.upstream/vm.bak-<time>` or `.upstream/gui.bak-<time>`, instead of deleting it.

## Deploying the editor

You do not deploy the editor by hand.
The workflow `.github/workflows/editor.yml` tests and builds the editor for every pull request and every push to `main` that changes more than the documentation:

- A push to `main` deploys the build to the `gh-pages` branch, from which GitHub Pages serves {{ editor_url }}.
- A pull request from a branch of this repository gets a preview below {{ editor_url }}, in `pr-preview/pr-<number>/`, and a bot posts the link in the pull request.
  Closing the pull request removes the preview.
  Pull requests from forks are tested and built, but get no preview.

If a deployment did not run or was cancelled, run the workflow again from the Actions tab of the repository, or start it for `main` with "Run workflow".

To build the editor locally, run `npm run build`; the result is in `build/`.

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

You set up the project once on Read the Docs, as a maintainer of the MQT project:

1. Import the repository `munich-quantum-toolkit/scratch-quantum` as a new project.
2. Give the project the slug `scratch-quantum`.
3. Add the project as a subproject of the MQT project.
   Read the Docs then serves it below `https://mqt.readthedocs.io/projects/scratch-quantum`.

From then on, every push triggers a build.

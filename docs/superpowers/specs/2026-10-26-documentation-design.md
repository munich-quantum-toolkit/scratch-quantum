# Documentation — Design

Date: 2026-10-26
Status: Draft (awaiting review)

## Goal

Add Read the Docs documentation for the quantum computing extension for Scratch, written in the house style of the
Munich Quantum Toolkit (MQT) repositories, and a README in the main repository that links to it. The documentation
serves four audiences: learners (students using the web app), educators (running the exercises in a course),
researchers/MQT users (resource estimation, MLIR export into the MQT toolchain), and developers (building and extending
the forks of scratch-vm and scratch-gui).

## Naming and attribution

- No new product name. Title everywhere (docs, README heading): **"Quantum Computing Extension for Scratch"**.
- Byline: "Developed by the Chair for Design Automation, Technical University of Munich, as part of the Munich Quantum
  Toolkit (MQT)." MQT logos and the standard MQT "Contributors and Supporters" section appear as in other MQT projects.
- "Scratch" is used only descriptively ("for Scratch", "built on Scratch 3.0"). A `credits` page states that the editor
  is built on Scratch 3.0 by the Scratch Foundation and reproduces the trademark notice from scratch-gui's `TRADEMARK`
  file: the Scratch name, logo and characters are trademarks of MIT and may not be used to endorse or promote derived
  products without permission. The docs use no Scratch logos or Scratch Cat artwork.

## Location and hosting

- Repository: `munich-quantum-toolkit/scratch-quantum` (the repository that serves the web app via GitHub Pages at
  `https://munich-quantum-toolkit.github.io/scratch-quantum/`; local remote still `DRovara/scratch-quantum`, which
  redirects). Work happens on branch `docs/initial-documentation`.
- Read the Docs project slug: `scratch-quantum`, intended as an MQT subproject at
  `https://mqt.readthedocs.io/projects/scratch-quantum`. Creating/linking the Read the Docs project is a manual step for
  the maintainers (documented in the developer guide); the repository only provides the configuration.
- GitHub Pages builds the repository root with Jekyll today. Markdown under `docs/` would then be processed by Jekyll
  (MyST syntax can break Liquid parsing). Add an empty `.nojekyll` file at the repository root so Pages serves the
  static app files unchanged and ignores the docs sources.

## Files added to the repository

| Path | Purpose |
|---|---|
| `README.md` | MQT-style README: Read the Docs badge, MQT logo, title, one-paragraph description, "Open the editor" link, documentation button, key features, contributors/supporters section. |
| `.readthedocs.yaml` | Same structure as mqt-debugger: `ubuntu-24.04`, Python 3.12, skip on "skip ci" commits, `uv` via asdf, HTML (`uv run --frozen --no-dev --group docs -m sphinx -T -b html …`) and htmlzip outputs. No C++/Doxygen steps. |
| `pyproject.toml` | Minimal, non-package project (`[tool.uv] package = false`) that only defines the `docs` dependency group: `furo`, `myst-parser`, `sphinx`, `sphinx-copybutton`, `sphinx-design`, `sphinxext-opengraph`, `sphinxcontrib-bibtex`. |
| `uv.lock` | Lock file for the docs group (needed for `--frozen`). |
| `.nojekyll` | See above. |
| `docs/conf.py` | Sphinx config modelled on mqt-debugger (project, author, copyright, MyST extensions, Furo theme with MQT logos, copybutton, opengraph, bibtex), without version detection, autodoc, breathe or notebooks. Excludes `superpowers/**`. Adds `_ext` to `sys.path` for the local `scratchblocks` extension. |
| `docs/_ext/scratchblocks.py` | Tiny Sphinx extension: a `scratchblocks` directive that emits `<pre class="blocks">…</pre>` (HTML-escaped text) and adds the scratchblocks script and an init script to every page. |
| `docs/_static/` | `mqt_dark.png`, `mqt_light.png` (copied from mqt-debugger), `custom.css` (MQT styles + scratchblocks colour override), `scratchblocks-init.js`. |
| `docs/_templates/page.html` | Copied from mqt-debugger (MQT's Furo footer with next/previous links). |
| `docs/*.md`, `docs/**/*.md` | The pages below. |
| `docs/exercises/templates/*.sb3` | Exercise templates for download. |
| `docs/refs.bib`, `docs/lit_header.bib` | Bibliography for the references page: `lit_header.bib` copied from mqt-debugger; `refs.bib` contains the `mqt` entry (The MQT Handbook) copied from mqt-debugger's `refs.bib`. |

## Rendering Scratch blocks

- Library: scratchblocks 3.7.1, loaded from jsDelivr (`https://cdn.jsdelivr.net/npm/scratchblocks@3.7.1/build/scratchblocks.min.js`),
  rendered client-side with `scratchblocks.renderMatching('pre.blocks', {style: 'scratch3', languages: ['en'], scale: 0.675})`.
- Authoring: fenced MyST directive
  ````md
  ```{scratchblocks}
  Quantum Circuit :: hat extension
  create quantum register [q] with (2) qubits :: extension
  apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
  ```
  ````
  Quantum blocks are tagged `:: extension` (hats `:: hat extension`, reporters inside inputs as shown); standard Scratch
  blocks need no tag.
- scratchblocks has no per-block colours. `custom.css` recolours the `sb3-extension` class (fill/stroke and the `-alt`
  variant) to the extension's main colours `#0065bd` / `#005293`, so all quantum blocks appear in the quantum blue.
  The finer per-group colours of the real palette are not reproduced; the block reference says so in one sentence.
- Without JavaScript the blocks fall back to their readable text inside `<pre>`.

## Page structure

```
index                     Overview, "Open the editor" button, byline, where to start, MQT footer
Getting Started
  quickstart              Bell state in five minutes: register, H, controlled X, Quantum Circuit hat,
                          Run Quantum Circuits, reading the measurement; what to try next
  quantum-basics          Just enough quantum computing for the blocks: qubits and registers,
                          superposition (H), measurement, controlled gates (incl. negated controls),
                          rotations/U3; links to deeper material
Exercises
  exercises/index         For educators: purpose, prerequisites, order, time per sheet, how to run as a lab
  exercises/01-warmup … exercises/05-compilation
                          Task text converted from the LaTeX sheets, time estimate, template download
Reference
  blocks                  Every block, grouped like the palette (see below)
  qubit-expressions       q[0] / "q[0] and not q[1]" syntax, broadcasting over registers, negated controls,
                          the "/" placeholder
  simulation              How circuits run: Quantum Circuit hats, Run Quantum Circuits (and starting state),
                          one simulator per circuit, measurement results as values, Set Simulator
  resource-estimation     What is counted (qubits incl. ancillas, n-qubit gates, SWAPs), the three decomposition
                          switches, the reporter blocks, circuit numbering
  mlir-export             For researchers: what the export block produces, translation of each construct to
                          the qc dialect, module shape for one/several circuits, limitations, how to run mqt-cc
Developers
  development             The three repositories and their roles, running scratch-vm and scratch-gui locally,
                          tests, building and deploying the web app to this repository, setting up Read the Docs
  architecture            Extension layout (index.js, simulators, resource estimator, exporter), adding a block
  contributing            Contribution workflow (commit style, tests, lint)
references                How to cite: the MQT Handbook ({cite:p}`mqt`), as on other MQT references pages
support                   Where to ask (GitHub issues/discussions of the repository)
credits                   Scratch credit and trademark notice, licenses
```

### Block reference contents (`blocks`)

Grouped as in the palette; for each block: rendered block, inputs (with defaults), behaviour, reported value, short example.

1. Registers and qubits: `create quantum register [NAME] with [NUM] qubits`, `qubit [QUBIT] of register [NAME]`,
   `qubits of register [NAME]`.
2. Gates: `apply [GATE] gate to [QUBIT]` (X, Y, Z, H, S, T), `apply SWAP gate to [QUBIT1] and [QUBIT2]`.
3. Controls: `controlled on [QUBIT]`, `[QUBIT1] and [QUBIT2]`, `negated control [QUBIT]`.
4. Rotations: `rotate [QUBIT] by [ANGLE] degrees around [AXIS] axis`, `apply U3 gate to [QUBIT] with angles [THETA] [PHI] [LAMBDA]`.
5. Measurement: `measure [QUBIT]`.
6. Circuit execution: `Quantum Circuit` hat, `Run Quantum Circuits`, `Run Quantum Circuits starting from [STATE]`,
   `Set Simulator to [SIMULATOR]`.
7. Resource estimation: `Perform Quantum Resource Estimation`, `Estimated Quantum Resources`,
   `Estimated Quantum Resources of Circuit #[CIRCUIT]`, `Estimated Qubit Requirements of Circuit #[CIRCUIT]`,
   `Estimated [COUNT] Qubit Gates in Circuit #[CIRCUIT]`, `Estimated SWAP Gates in Circuit #[CIRCUIT]`,
   `[ENABLED] SWAP decomposition`, `[ENABLED] substitute negative control lines`, `[ENABLED] Toffoli decomposition`.
8. Compatibility: `Export Circuits to MLIR`.

Behaviour is documented from the extension source (`scratch-vm/src/extensions/mqt_quantum/`) and verified against it;
the MLIR export pages describe the project-wide export (branch `feat/mlir-export-project`) including the pending fixes
(registers passed from `@main` to `@circuit_k` for several circuits; see the export spec in scratch-vm). If those fixes
change before merge, the page is updated together with them.

### Exercises

- Source of the task text: the LaTeX sheets `qswlab-exercises/01`–`05` (`0N.tex`), converted to MyST by hand
  (sections, highlighted sub-tasks (a), (b), …, file names, menu paths), keeping their wording.
- Templates: the `.sb3` files from `exercises-2/` (newest set), offered with the `{download}` role. Each page names the
  template it uses.
- No solutions in the docs.
- Time estimates are taken from the combined sheet `exercises/tex/readme.tex` (5/10/10/10 minutes; warm-up untimed).
- The questionnaire link from the sheets is not included unless the maintainers ask for it (it belongs to a past study).

## Build and quality checks

- Local build: `uv run --group docs sphinx -W --keep-going -b html docs docs/_build/html` must succeed without warnings.
- `uv run --group docs sphinx -b linkcheck docs docs/_build/linkcheck` is run once before merge; failing external links
  are fixed or removed (links to the not-yet-created Read the Docs project are expected to fail until it exists).
- Manual check in a browser: blocks render (scratchblocks loaded, quantum blue), light/dark mode logos, downloads work.
- `docs/_build/` is git-ignored.

## Out of scope

- Translations; API documentation generated from source; a CI workflow for the docs (Read the Docs builds PR previews
  once the project is set up); changes to the web app itself; exercise solutions.

# Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MQT-style Read the Docs documentation (Sphinx + MyST + Furo) for the quantum computing extension for Scratch to the `scratch-quantum` repository, plus a README linking to it.

**Architecture:** A `docs/` Sphinx project, configured like the MQT repositories (mqt-debugger as the template) but without API docs. A tiny local extension renders Scratch blocks client-side with scratchblocks. Content pages are written in MyST Markdown from the extension's source code, the LaTeX exercise sheets and the export spec. Read the Docs builds with `uv`.

**Tech Stack:** Sphinx ≥ 8.2, myst-parser, Furo, sphinx-copybutton, sphinx-design, sphinxext-opengraph, sphinxcontrib-bibtex, scratchblocks 3.7.1 (CDN), uv.

**Spec:** `docs/superpowers/specs/2026-10-26-documentation-design.md` (read it before starting any task).

## Global Constraints

- Repository: `/home/damian/01_research/scratch-quantum/scratch-quantum` (GitHub: `munich-quantum-toolkit/scratch-quantum`), branch `docs/initial-documentation`. Don't modify the web app files at the repository root (`*.html`, `*.js`, `*.map`, `chunks/`, `static/`, the `.hex` file). Don't touch other repositories; read them only (`../scratch-vm`, `../scratch-gui`, `../exercises`, `../exercises-2`, `../qswlab-exercises`, `~/01_research/mqt-debugger`).
- Title wording, exactly: "Quantum Computing Extension for Scratch". Byline, exactly: "Developed by the Chair for Design Automation, Technical University of Munich, as part of the Munich Quantum Toolkit (MQT)." Never invent a product name (no "MQT Scratch", "MQT Blocks", …). Use "Scratch" only descriptively ("for Scratch", "built on Scratch 3.0"). No Scratch logos or Scratch Cat images.
- Links: editor `https://munich-quantum-toolkit.github.io/scratch-quantum/` (MyST substitution `{{ editor_url }}` is available only in body text, not in link targets — write the URL literally in links); docs `https://mqt.readthedocs.io/projects/scratch-quantum`; repository `https://github.com/munich-quantum-toolkit/scratch-quantum`.
- Writing: English, second person ("you"), short paragraphs, one sentence per line in Markdown source (MQT style). Headings in sentence case. Cross-references with `{doc}` roles. Citations with `{cite:p}` and the keys `qce_2026_01` and `mqt`.
- Scratch blocks are written with the `scratchblocks` directive (scratchblocks 3.7.1 syntax, https://en.scratch-wiki.info/wiki/Block_Plugin/Syntax):
  - Every quantum block ends with `:: extension`; the `Quantum Circuit` hat is written `Quantum Circuit :: hat extension`; a quantum reporter inside an input is wrapped in parentheses and tagged too: `(qubit (0) of register [q] :: extension)`; `measure` is a boolean block: `<measure (qubit (0) of register [q] :: extension) :: extension>`; `controlled on` is a C-block: `controlled on (…) {` … `} :: extension`.
  - Dropdowns use `[X v]` (gate menu: X, Y, Z, H, S, T; axis menu: X, Y, Z; `[Enable v]`/`[Disable v]`; `[Statevector Simulator v]`), number inputs `(2)`, text inputs `[q]`.
  - Standard Scratch blocks (events, control, looks, variables, operators) need no tag.
  - Example (renders correctly, verified):
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
- Facts about blocks and behaviour come from the extension source, read from the branch that is going to be released: `git -C ../scratch-vm show feat/mlir-export-project:src/extensions/mqt_quantum/<file>` (`index.js`, `statevector-simulator.js`, `resource-estimator.js`, `simulator.js`, `qubit-expression.js`, `exporter.js`, `mlir-emitter.js`). Describe intended, fixed behaviour: rotations/U3 work (fixed on scratch-vm branch `fix/simulator-gates`), and several exported circuits receive their registers from `@main` (fix pending on `feat/mlir-export-project`; target shape in `../scratch-vm/.superpowers/sdd/2026-10-21-mlir-export-project/final-fix-findings.md`, finding 2). Never document anything you could not verify in these sources.
- Build check after every task, from the repository root: `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html` must print `build succeeded` with no warnings. `docs/_build/` and `.venv/` are git-ignored and never committed.
- Commit messages: gitmoji style (`docs: :memo: …`, `build: :construction_worker: …`), each ending with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| Path | Task | Responsibility |
|---|---|---|
| `pyproject.toml`, `uv.lock`, `.readthedocs.yaml`, `.gitignore` | 1 | Docs dependencies (uv group `docs`), Read the Docs build |
| `docs/conf.py`, `docs/_ext/scratchblocks.py`, `docs/_static/*`, `docs/_templates/page.html`, `docs/lit_header.bib`, `docs/refs.bib` | 1 | Sphinx setup, block rendering, MQT look, bibliography |
| `docs/index.md`, `docs/references.md`, `docs/support.md`, `docs/credits.md` | 1 | Landing page and "About" pages |
| `docs/quickstart.md`, `docs/quantum-basics.md` | 2 | Getting started |
| `docs/blocks.md`, `docs/qubit-expressions.md` | 3 | Block reference |
| `docs/simulation.md`, `docs/resource-estimation.md` | 4 | Running circuits, resource estimation |
| `docs/mlir-export.md` | 5 | MLIR export for researchers |
| `docs/exercises/*.md`, `docs/exercises/templates/*.sb3` | 6 | Exercises and templates |
| `docs/development.md`, `docs/architecture.md`, `docs/contributing.md` | 7 | Developer guide |
| `README.md` | 8 | Repository README with documentation link |

`docs/index.md` holds the navigation. Task 1 creates it with the "About" toctree only. Each later task inserts its own toctree block **above** the "About" block, in this final order: Getting Started (Task 2), Exercises (Task 6), Reference (Tasks 3–5), Developers (Task 7), About (Task 1).

---

### Task 1: Sphinx infrastructure, landing page and About pages

**Files:**
- Create: `.gitignore`, `pyproject.toml`, `uv.lock` (generated), `.readthedocs.yaml`
- Create: `docs/conf.py`, `docs/_ext/scratchblocks.py`, `docs/_static/custom.css`, `docs/_static/scratchblocks-init.js`, `docs/refs.bib`
- Copy from `~/01_research/mqt-debugger/docs/`: `_static/mqt_dark.png`, `_static/mqt_light.png`, `_templates/page.html`, `lit_header.bib`
- Create: `docs/index.md`, `docs/references.md`, `docs/support.md`, `docs/credits.md`

**Interfaces:**
- Produces: the `scratchblocks` directive (body = scratchblocks text); `{doc}` targets `index`, `references`, `support`, `credits`; citation keys `qce_2026_01`, `mqt`; build command `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html`.

- [ ] **Step 1: Configuration files**

`.gitignore`:

```gitignore
.venv/
docs/_build/
```

`pyproject.toml`:

```toml
[project]
name = "scratch-quantum-docs"
version = "0.0.0"
description = "Documentation of the quantum computing extension for Scratch"
requires-python = ">=3.12"

[dependency-groups]
docs = [
    "furo>=2025.9.25",
    "myst-parser>=4.0.1",
    "sphinx>=8.2.3",
    "sphinx-copybutton>=0.5.2",
    "sphinx-design>=0.6.1",
    "sphinxcontrib-bibtex>=2.6.5",
    "sphinxext-opengraph>=0.10.0",
]

[tool.uv]
package = false
```

`.readthedocs.yaml`:

```yaml
version: 2

formats:
  - htmlzip

sphinx:
  configuration: docs/conf.py

build:
  os: ubuntu-24.04
  tools:
    python: "3.12"
  jobs:
    post_checkout:
      # Skip docs build if the commit message contains "skip ci" (e.g. web app deployments)
      - (git --no-pager log --pretty="tformat:%s -- %b" -1 | grep -viq "skip ci") || exit 183
    pre_build:
      # Set up uv
      - asdf plugin add uv
      - asdf install uv latest
      - asdf global uv latest
    build:
      html:
        - uv run --frozen --no-dev --group docs -m sphinx -T -b html -d docs/_build/doctrees -D language=en docs $READTHEDOCS_OUTPUT/html
      htmlzip:
        - uv run --frozen --no-dev --group docs -m sphinx -T -b dirhtml -d docs/_build/doctrees -D language=en docs docs/_build/dirhtml
        - mkdir -p $READTHEDOCS_OUTPUT/htmlzip
        - zip -r $READTHEDOCS_OUTPUT/htmlzip/html.zip docs/_build/dirhtml/*
```

Then run `uv lock` in the repository root to create `uv.lock`.

- [ ] **Step 2: Sphinx configuration and block rendering**

Copy the four files from mqt-debugger listed above. Create `docs/conf.py`:

```python
# Copyright (c) 2026 Chair for Design Automation, TUM
# All rights reserved.
#
# SPDX-License-Identifier: MIT
#
# Licensed under the MIT License

"""Sphinx configuration file."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import TYPE_CHECKING

import pybtex.plugin
from pybtex.style.formatting.unsrt import Style as UnsrtStyle
from pybtex.style.template import field, href

if TYPE_CHECKING:
    from pybtex.database import Entry
    from pybtex.richtext import HRef

sys.path.insert(0, str(Path(__file__).parent / "_ext"))

project = "Quantum Computing Extension for Scratch"
author = "Chair for Design Automation, TUM"
language = "en"
project_copyright = "2026 Chair for Design Automation, TUM"

master_doc = "index"

templates_path = ["_templates"]
html_css_files = ["custom.css"]

extensions = [
    "myst_parser",
    "sphinx.ext.intersphinx",
    "sphinx_copybutton",
    "sphinx_design",
    "sphinxext.opengraph",
    "sphinxcontrib.bibtex",
    "scratchblocks",
]

source_suffix = [".md"]

exclude_patterns = [
    "_build",
    "superpowers",
    "Thumbs.db",
    ".DS_Store",
    ".env",
    ".venv",
]

pygments_style = "colorful"

intersphinx_mapping = {
    "mqt": ("https://mqt.readthedocs.io/en/latest", None),
    "core": ("https://mqt.readthedocs.io/projects/core/en/latest", None),
}

myst_enable_extensions = [
    "amsmath",
    "colon_fence",
    "substitution",
    "deflist",
    "dollarmath",
]
myst_substitutions = {
    "editor_url": "https://munich-quantum-toolkit.github.io/scratch-quantum/",
}
myst_heading_anchors = 3


class CDAStyle(UnsrtStyle):
    """Custom style for including PDF links."""

    def format_url(self, _e: Entry) -> HRef:  # noqa: PLR6301
        """Format URL field as a link to the PDF.

        Returns:
            The formatted URL field.
        """
        url = field("url", raw=True)
        return href()[url, "[PDF]"]


pybtex.plugin.register_plugin("pybtex.style.formatting", "cda_style", CDAStyle)

bibtex_bibfiles = ["lit_header.bib", "refs.bib"]
bibtex_default_style = "cda_style"

copybutton_prompt_text = r"(?:\(\.?venv\) )?(?:\[.*\] )?\$ "
copybutton_prompt_is_regexp = True
copybutton_line_continuation_character = "\\"

# -- Options for HTML output -------------------------------------------------
html_theme = "furo"
html_static_path = ["_static"]
html_theme_options = {
    "light_logo": "mqt_dark.png",
    "dark_logo": "mqt_light.png",
    "source_repository": "https://github.com/munich-quantum-toolkit/scratch-quantum/",
    "source_branch": "main",
    "source_directory": "docs/",
    "navigation_with_keys": True,
}
```

`docs/_ext/scratchblocks.py`:

```python
"""Render Scratch blocks with scratchblocks (https://scratchblocks.github.io).

The ``scratchblocks`` directive emits the block text in a ``<pre class="blocks">`` element.
The scratchblocks script, loaded on every page, turns those elements into block images.
"""

from __future__ import annotations

import html
from typing import TYPE_CHECKING, ClassVar

from docutils import nodes
from sphinx.util.docutils import SphinxDirective

if TYPE_CHECKING:
    from sphinx.application import Sphinx

SCRATCHBLOCKS_JS = "https://cdn.jsdelivr.net/npm/scratchblocks@3.7.1/build/scratchblocks.min.js"


class ScratchblocksDirective(SphinxDirective):
    """Show a script written in scratchblocks syntax."""

    has_content = True
    option_spec: ClassVar[dict] = {}

    def run(self) -> list[nodes.Node]:
        """Return a raw HTML node holding the escaped block text.

        Returns:
            The raw node.
        """
        text = html.escape("\n".join(self.content))
        return [nodes.raw("", f'<pre class="blocks">{text}</pre>\n', format="html")]


def setup(app: Sphinx) -> dict[str, bool]:
    """Register the directive and the scripts.

    Returns:
        The extension metadata.
    """
    app.add_directive("scratchblocks", ScratchblocksDirective)
    app.add_js_file(SCRATCHBLOCKS_JS)
    app.add_js_file("scratchblocks-init.js")
    return {"parallel_read_safe": True, "parallel_write_safe": True}
```

`docs/_static/scratchblocks-init.js`:

```js
// Render every <pre class="blocks"> element (see docs/_ext/scratchblocks.py) as Scratch 3.0 blocks.
document.addEventListener("DOMContentLoaded", () => {
  scratchblocks.renderMatching("pre.blocks", {
    style: "scratch3",
    languages: ["en"],
    scale: 0.675,
  });
});
```

`docs/_static/custom.css`: copy `~/01_research/mqt-debugger/docs/_static/custom.css` and append:

```css
/* Scratch blocks (docs/_ext/scratchblocks.py): show extension blocks in the quantum extension's blue
   instead of scratchblocks' generic extension green. */
svg.scratchblocks-style-scratch3 .sb3-extension:not(.sb3-input-number):not(.sb3-input-string) {
  fill: #0065bd;
  stroke: #003359;
}

svg.scratchblocks-style-scratch3 .sb3-extension-alt {
  fill: #005293;
}

svg.scratchblocks-style-scratch3 .sb3-extension-dark {
  fill: #003359;
}

svg.scratchblocks-style-scratch3 .sb3-extension-line {
  stroke: #005293;
}

pre.blocks {
  background: none;
  border: none;
}
```

(The `:not(.sb3-input-number):not(.sb3-input-string)` part is required: without it, number and text inputs turn blue and their values become invisible.)

`docs/refs.bib`:

```bibtex
@inproceedings{qce_2026_01,
  title     = {{Teaching Quantum Design Automation with Block-Based Programming}},
  author    = {D. Rovara and R. Wille},
  booktitle = qce,
  year      = {2026},
}

@inproceedings{mqt,
  title               = {The {{MQT}} Handbook: {{A}} Summary of Design Automation Tools and Software for Quantum Computing},
  shorttitle          = {The MQT Handbook},
  author              = {Robert Wille and Lucas Berent and Tobias Forster and Jagatheesan Kunasaikaran and Kevin Mato and Tom Peham and Nils Quetschlich and Damian Rovara and Aaron Sander and Ludwig Schmid and Daniel Schoenberger and Yannick Stade and Lukas Burgholzer},
  year                = {2024},
  booktitle           = {IEEE International Conference on Quantum Software (QSW)},
  doi                 = {10.1109/QSW62656.2024.00013},
  eprint              = {2405.17543},
  eprinttype          = {arxiv},
  addendum            = {A live version of this document is available at \url{https://mqt.readthedocs.io}},
}
```

- [ ] **Step 3: Landing and About pages**

`docs/index.md` — write this page in full:
- H1 `# Quantum Computing Extension for Scratch`.
- One paragraph: the extension adds quantum computing blocks to the Scratch editor, so you can build quantum circuits by snapping blocks together, run them on a built-in simulator, estimate the resources they need, and export them to the MQT compiler toolchain. Then the byline sentence verbatim (Global Constraints), with "Munich Quantum Toolkit (MQT)" linking to `https://mqt.readthedocs.io`.
- A sphinx-design button linking to the editor:
  ```md
  ```{button-link} https://munich-quantum-toolkit.github.io/scratch-quantum/
  :color: primary
  :shadow:

  Open the editor
  ```
  ```
- A short scratchblocks example (the verified example from Global Constraints) with one sentence explaining it creates two qubits and entangles them.
- "Where to start" paragraph modelled on mqt-debugger's index ("We recommend you to start with …"): learners → quickstart; educators → exercises; researchers → resource estimation and MLIR export; developers → development guide. Until those pages exist, phrase these as plain text without `{doc}` links; the task that creates each page turns the mention into a `{doc}` link.
- Toctrees (exactly):
  ```md
  ```{toctree}
  :hidden:

  self
  ```

  ```{toctree}
  :caption: About
  :hidden:
  :maxdepth: 1

  references
  support
  credits
  ```
  ```
- The "Contributors and Supporters" section from `~/01_research/mqt-debugger/docs/index.md` (from `## Contributors and Supporters` to the end), adapted: "MQT Debugger" → "the quantum computing extension for Scratch", contributors image/link → repository `munich-quantum-toolkit/scratch-quantum`.

`docs/references.md`: H1 `# References`; sentence that the extension is described in {cite:p}`qce_2026_01` and that it is part of the MQT, described in {cite:p}`mqt`; "When you use the extension in your teaching or research, please cite:" followed by both BibTeX entries in a `bibtex` code block (copy them from `docs/refs.bib`); then
```md
```{bibliography}
```
```

`docs/support.md`: H1 `# Support`; bugs and feature requests as issues on `https://github.com/munich-quantum-toolkit/scratch-quantum/issues` (say what to include: browser, steps, the `.sb3` project if possible); questions about the MQT via `https://mqt.readthedocs.io`.

`docs/credits.md`: H1 `# Credits`; the editor is built on Scratch 3.0 by the Scratch Foundation (`https://scratch.mit.edu`), using the open-source `scratch-vm` and `scratch-gui` repositories (link `https://github.com/scratchfoundation`); the quantum extension, simulators, resource estimation and MLIR export are developed by the Chair for Design Automation, TUM; blocks in these pages are drawn with scratchblocks (`https://github.com/scratchblocks/scratchblocks`); then a "Trademarks" section quoting the notice from `../scratch-gui/TRADEMARK` verbatim in a blockquote and stating that this project is not affiliated with or endorsed by the Scratch Foundation or MIT.

- [ ] **Step 4: Build and check**

Run `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html`. Expected: `build succeeded`, no warnings.
Check: `grep -c 'class="blocks"' docs/_build/html/index.html` prints `1`; `grep -c 'scratchblocks@3.7.1' docs/_build/html/index.html` prints `1`; `grep -c 'Teaching Quantum Design Automation' docs/_build/html/references.html` is at least `1`.
Visual check: serve the build (`python3 -m http.server 8765 --bind 127.0.0.1 --directory docs/_build/html`) and confirm in a browser that the example blocks render in blue with readable input values (`2`, `0`, `q`) and the `say` block in purple. Report what you saw.

- [ ] **Step 5: Commit**

```bash
git add .gitignore pyproject.toml uv.lock .readthedocs.yaml docs/conf.py docs/_ext docs/_static docs/_templates docs/lit_header.bib docs/refs.bib docs/index.md docs/references.md docs/support.md docs/credits.md
git commit -m "build: :construction_worker: set up Sphinx documentation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Getting started — quickstart and quantum basics

**Files:**
- Create: `docs/quickstart.md`, `docs/quantum-basics.md`
- Modify: `docs/index.md` (add the Getting Started toctree above "About"; link the learners mention)

**Interfaces:**
- Consumes: `scratchblocks` directive, `{doc}` targets from Task 1.
- Produces: `{doc}` targets `quickstart`, `quantum-basics`. Later pages link to `quickstart` and `quantum-basics`; this task may link to pages created later only as plain text.

- [ ] **Step 1: `docs/quickstart.md`** — H1 `# Quickstart`. Sections:
  1. *Open the editor*: link; the quantum blocks are in the "Quantum" category at the bottom of the palette (verify the category name `Quantum` in `index.js` `getInfo`).
  2. *Build your first circuit* (Bell state): step by step, each step with the block it adds — drag a `Quantum Circuit` hat; `create quantum register [q] with (2) qubits`; `apply [H v] gate to (qubit (0) of register [q])`; `controlled on (qubit (0) of register [q])` containing `apply [X v] gate to (qubit (1) of register [q])`; `set [result v] to <measure (qubits of register [q])>` plus `say (result)` — check in `index.js` what `measure` returns for several qubits (it concatenates one character per qubit) and describe it accordingly. Show the complete script once with scratchblocks.
  3. *Run it*: a separate script `when green flag clicked` → `Run Quantum Circuits`; click the green flag; the sprite says `00` or `11`, never `01` or `10`; run it a few times. Explain why in two sentences (entanglement) and link to `quantum-basics`.
  4. *What next*: try a different gate, measure only one qubit, try the exercises (plain text until Task 6), read the block reference (plain text until Task 3).
- [ ] **Step 2: `docs/quantum-basics.md`** — H1 `# Quantum computing basics`. "Just enough" theory, each concept tied to the block that uses it, with one small scratchblocks example per section: qubits and registers; basis states and measurement (probabilistic outcome, collapse — measuring changes the state); superposition (H); the single-qubit gates X, Y, Z, H, S, T (one-line meaning each; `$` math allowed, e.g. $H|0\rangle = (|0\rangle+|1\rangle)/\sqrt{2}$); controlled gates and entanglement (CNOT as `controlled on` + X; several controls; negated controls apply when the control is 0); rotations (angles in degrees in the blocks) and the U3 gate; a "Learn more" list linking to `https://mqt.readthedocs.io` and to standard introductions (e.g. the Qiskit textbook successor `https://quantum.cloud.ibm.com/learning`). Keep the page under ~250 lines.
- [ ] **Step 3: Navigation** — in `docs/index.md`, insert above the "About" toctree:
  ```md
  ```{toctree}
  :caption: Getting Started
  :hidden:
  :maxdepth: 1

  quickstart
  quantum-basics
  ```
  ```
  and turn the learners mention in "Where to start" into a `{doc}` link to `quickstart`.
- [ ] **Step 4: Build and check** — `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html` succeeds without warnings; `grep -c 'class="blocks"' docs/_build/html/quickstart.html` ≥ 3. Visually check the quickstart page (server as in Task 1) and report that every block renders as a block (none shows as raw text or red "undefined" blocks).
- [ ] **Step 5: Commit** — `git add docs/quickstart.md docs/quantum-basics.md docs/index.md` and commit `docs: :memo: add quickstart and quantum basics`.

---

### Task 3: Block reference and qubit expressions

**Files:**
- Create: `docs/blocks.md`, `docs/qubit-expressions.md`
- Modify: `docs/index.md` (add the Reference toctree with these two pages), `docs/quickstart.md` (link to `blocks`)

**Interfaces:**
- Produces: `{doc}` targets `blocks`, `qubit-expressions`; MyST heading anchors (`myst_heading_anchors = 3`) for each block group in `blocks.md`, e.g. `blocks.md#registers-and-qubits`.

- [ ] **Step 1: `docs/blocks.md`** — H1 `# Block reference`. Intro: blocks grouped as in the palette; one sentence that the palette uses several shades of blue for groups while these pages draw all quantum blocks in the main colour. One `##` section per group, in this order and with exactly these blocks (block texts from `index.js` `getInfo`):
  1. Registers and qubits: `create quantum register [NAME] with [NUM] qubits`, `qubit [QUBIT] of register [NAME]`, `qubits of register [NAME]`.
  2. Gates: `apply [GATE] gate to [QUBIT]`, `apply SWAP gate to [QUBIT1] and [QUBIT2]`.
  3. Controls: `controlled on [QUBIT]`, `[QUBIT1] and [QUBIT2]`, `negated control [QUBIT]`.
  4. Rotations: `rotate [QUBIT] by [ANGLE] degrees around [AXIS] axis`, `apply U3 gate to [QUBIT] with angles [THETA] [PHI] [LAMBDA]`.
  5. Measurement: `measure [QUBIT]`.
  6. Circuit execution: `Quantum Circuit`, `Run Quantum Circuits`, `Run Quantum Circuits starting from [STATE]`, `Set Simulator to [SIMULATOR]`.
  7. Resource estimation: `Perform Quantum Resource Estimation`, `Estimated Quantum Resources`, `Estimated Quantum Resources of Circuit #[CIRCUIT]`, `Estimated Qubit Requirements of Circuit #[CIRCUIT]`, `Estimated [COUNT] Qubit Gates in Circuit #[CIRCUIT]`, `Estimated SWAP Gates in Circuit #[CIRCUIT]`, `[ENABLED] SWAP decomposition`, `[ENABLED] substitute negative control lines`, `[ENABLED] Toffoli decomposition`.
  8. Compatibility: `Export Circuits to MLIR`.
  For each block a `###` heading (the block text with inputs in words, e.g. "Create quantum register"), the rendered block (scratchblocks, with the default input values from `getInfo`), and a definition list (`deflist` is enabled): **Inputs** (each input, its type, default), **Behaviour** (what happens, read from the handler method of the same name in `index.js` and the simulator it calls), **Reports** (for reporters/booleans; what string/value), **Notes** (errors and limits, e.g. invalid register names, the "/" placeholder, measuring several qubits). Short example where it helps. Sections 6–8 keep their entries brief and link to the detailed pages (`simulation`, `resource-estimation`, `mlir-export`) as plain text until those exist; Tasks 4 and 5 turn them into links.
- [ ] **Step 2: `docs/qubit-expressions.md`** — H1 `# Qubit expressions`. Explain from `qubit-expression.js` and the `getQubit`/`getQubits`/`and`/`negated` handlers: qubit inputs accept the reporter blocks or typed text like `q[0]`; the text form `register[index]` (register name rules: letters, digits, underscore, not starting with a digit; index ≥ 0); `and` to combine (gates broadcast: one gate per qubit); `qubits of register` = all qubits joined with `and`; `not`/`negated control` only for controls (what happens if used as a target: check `index.js`); the `/` placeholder default meaning "no qubit" and how `and` treats it. Examples with scratchblocks.
- [ ] **Step 3: Navigation** — in `docs/index.md`, insert above "About" (it will later sit below Getting Started/Exercises):
  ```md
  ```{toctree}
  :caption: Reference
  :hidden:
  :maxdepth: 1

  blocks
  qubit-expressions
  ```
  ```
  Link the "block reference" mention in `quickstart.md`'s *What next* with `{doc}`.
- [ ] **Step 4: Build and check** — `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html` succeeds without warnings; visual check of `blocks.html`: every block renders (none raw or red), report any block that does not.
- [ ] **Step 5: Commit** — `docs: :memo: add block reference and qubit expressions`.

---

### Task 4: Simulation and resource estimation

**Files:**
- Create: `docs/simulation.md`, `docs/resource-estimation.md`
- Modify: `docs/index.md` (append both to the Reference toctree after `qubit-expressions`; link the researchers mention to `resource-estimation`), `docs/blocks.md` (link sections 6 and 7)

- [ ] **Step 1: `docs/simulation.md`** — H1 `# Running circuits`. From `index.js` (`quantumEvaluate`, `runCircuits`, `runCircuitsState`, `genericRunCircuits`, `getCurrentExecutionInformation`, `setSimulator`) and `statevector-simulator.js`: what a `Quantum Circuit` script is; `Run Quantum Circuits` starts every such script in the project (all sprites and the stage) and waits until they finish; each script gets its own fresh simulator (circuits don't share qubits); clicking a circuit script directly also runs it; `starting from [STATE]`: the integer's binary digits initialise the qubits created first (state the bit order as implemented in `_setupStartingState`/`_reduceStartingState`); measurement collapses the state and returns `0`/`1` per qubit, usable in variables and `if` blocks; the statevector simulator's size limit (`MAX_QUBITS` in `statevector-simulator.js`) and what happens above it; `Set Simulator` currently offers only the statevector simulator. Example: a coin-flip circuit with `if <measure …> then say [Heads]`.
- [ ] **Step 2: `docs/resource-estimation.md`** — H1 `# Resource estimation`. From `resource-estimator.js` and the estimation blocks in `index.js`: what `Perform Quantum Resource Estimation` does (runs every circuit with the estimator instead of the simulator, no amplitudes); what is counted (qubits including ancillas; gates grouped by number of qubits they act on, named like `CCX`; SWAPs; measurements); the reporter blocks and the format of their text (read `_getResourceEstimateOfCircuit`); circuit numbering (#1, #2, … in the order the circuits were started); the three switches and their exact effect (`[Enable v] SWAP decomposition` → 3 controlled X gates; `substitute negative control lines` → X gates around negated controls; `Toffoli decomposition` → multi-controlled gates decomposed using ancilla qubits and `CCX` decompositions into H/T/T†/CX/S — read `_logPosGateUse`/`_logDecomposedCCX` and describe precisely); how measurements behave during estimation (deterministic for known classical states, random otherwise). Example using the switches before estimating, as in exercise 04/05.
- [ ] **Step 3: Navigation and links** — add `simulation` and `resource-estimation` to the Reference toctree (after `qubit-expressions`); link `blocks.md` sections 6 and 7 to these pages; turn the researchers mention in `index.md` into links (`resource-estimation`; MLIR export stays plain text until Task 5).
- [ ] **Step 4: Build and check** — `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html` succeeds without warnings; visual check of both pages.
- [ ] **Step 5: Commit** — `docs: :memo: document circuit execution and resource estimation`.

---

### Task 5: MLIR export

**Files:**
- Create: `docs/mlir-export.md`
- Modify: `docs/index.md` (append `mlir-export` to the Reference toctree; link it in "Where to start"), `docs/blocks.md` (link section 8)

- [ ] **Step 1: `docs/mlir-export.md`** — H1 `# Exporting to MLIR`. Audience: researchers and MQT users. Sources: `../scratch-vm/docs/superpowers/specs/2026-10-21-mlir-export-design.md` read from branch `feat/mlir-export-project` (`git -C ../scratch-vm show feat/mlir-export-project:docs/superpowers/specs/2026-10-21-mlir-export-design.md`), `exporter.js`, and the multi-circuit target shape in `final-fix-findings.md` (finding 2). Sections:
  1. What it does: put `Export Circuits to MLIR` in a script outside the circuits (e.g. under `when green flag clicked`); it translates every `Quantum Circuit` script of the project into one MQT `qc` dialect module and downloads `quantum_circuits.mlir`; the translation is static (loops/ifs/variables become `scf`/SSA), not a recording of a run.
  2. Using the file with MQT: `mqt-cc` from MQT Core ({doc}`core:index` via intersphinx, or link `https://mqt.readthedocs.io/projects/core`), e.g. `mqt-cc --emit=qco-optimized quantum_circuits.mlir` and `--emit=qir-adaptive`.
  3. Example: the Bell circuit as scratchblocks next to the exported MLIR (generate it: write the Bell script as in the quickstart and run the exporter via Node — `node -e` with the `ScriptBuilder` fixture from `../scratch-vm/test/fixtures/quantum/script-builder.js` on branch `feat/mlir-export-project` — or transcribe carefully from `exporter.js` rules; show it in an `mlir` code block, falling back to `text` if Pygments has no `mlir` lexer — the build must stay warning-free).
  4. Translation table (block → `qc` / `arith` / `scf` op) for registers, gates, rotations/U3 (degrees → radians), SWAP, `controlled on` (one `qc.ctrl` per gate, negated controls as X before/after), measurement, `repeat` → `scf.for`, `if`/`if-else` → `scf.if`, variables → SSA values (loop-carried / `scf.if` results), number operators and comparisons.
  5. Module shape: one circuit → body of `@main`; several → `@circuit_<k>` helpers receiving their registers as `memref` arguments, `@main` allocates (`mqt.register_name = "circuit_<k>_<name>"`), calls and deallocates (from finding 2).
  6. Errors and limitations: errors appear as an alert (and a bubble on the block when it belongs to the sprite you are editing); supported vs unsupported blocks (from the spec's "Other blocks"); the spec's "Known limitations".
- [ ] **Step 2: Navigation and links** — add `mlir-export` to the Reference toctree (last); link it in `index.md` "Where to start" and in `blocks.md` section 8.
- [ ] **Step 3: Build and check** — `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html` succeeds without warnings; visual check.
- [ ] **Step 4: Commit** — `docs: :memo: document the MLIR export`.

---

### Task 6: Exercises

**Files:**
- Create: `docs/exercises/index.md`, `docs/exercises/01-warmup.md`, `docs/exercises/02-circuits.md`, `docs/exercises/03-verification.md`, `docs/exercises/04-resource-estimation.md`, `docs/exercises/05-compilation.md`
- Copy: `../exercises-2/01-warmup.sb3`, `02-circuits.sb3`, `03-verification.sb3`, `04-resource-estimation.sb3`, `05-compilation.sb3` → `docs/exercises/templates/`
- Modify: `docs/index.md` (Exercises toctree; link the educators mention), `docs/quickstart.md` (link exercises)

- [ ] **Step 1: Templates** — copy the five `.sb3` files unchanged.
- [ ] **Step 2: Exercise pages** — one page per sheet, converted from `../qswlab-exercises/0N/0N.tex` (keep the wording; convert `\section` → `#`, `\highlight{(a)}` → bold `**(a)**`, `\texttt{…}` → inline code, `\say{…}` → quotes, `\scratchurl{}` → the editor link). File names in the text must match the templates in `docs/exercises/templates/` (the sheets may use older names such as `02-circuit.sb3` — use the template names). Each page starts with: the time estimate (from `../exercises/tex/readme.tex` section titles: warm-up untimed, 5, 10, 10, 10 minutes), a download link written as ``{download}`Download the template <templates/0N-name.sb3>` `` (with the actual template file name), and "Open the editor, then *File → Load from your computer*". Where a sheet refers to specific blocks, show them with scratchblocks. Omit the questionnaire link. No solutions. At the end of each page link the relevant reference pages (`blocks`, `simulation`, `resource-estimation`, `mlir-export` as they fit).
- [ ] **Step 3: `docs/exercises/index.md`** — H1 `# Exercises`. For learners: what the five exercises cover, in order. For educators: prerequisites (none; exercise 01 introduces Scratch), total time (~35 minutes plus warm-up), suggested format (pairs, one laptop, sheets as handouts or these pages), where the templates are, that there are no published solutions. Toctree:
  ```md
  ```{toctree}
  :maxdepth: 1

  01-warmup
  02-circuits
  03-verification
  04-resource-estimation
  05-compilation
  ```
  ```
- [ ] **Step 4: Navigation** — in `docs/index.md` insert, between the Getting Started and Reference toctrees:
  ```md
  ```{toctree}
  :caption: Exercises
  :hidden:
  :maxdepth: 2

  exercises/index
  ```
  ```
  Link the educators mention in "Where to start" and the exercises mention in `quickstart.md`.
- [ ] **Step 5: Build and check** — `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html` succeeds without warnings; `ls docs/_build/html/_downloads/*/*.sb3 | wc -l` prints `5`; visual check of one exercise page.
- [ ] **Step 6: Commit** — `docs: :memo: add exercises with templates`.

---

### Task 7: Developer guide

**Files:**
- Create: `docs/development.md`, `docs/architecture.md`, `docs/contributing.md`
- Modify: `docs/index.md` (Developers toctree between Reference and About; link the developers mention)

- [ ] **Step 1: `docs/development.md`** — H1 `# Development`. Sections:
  1. Repositories: `scratch-quantum` (this repository: the deployed web app at the root, served by GitHub Pages, plus the documentation), the scratch-vm fork with the extension (`src/extensions/mqt_quantum/`; local `../scratch-vm`, remote from `git -C ../scratch-vm remote get-url origin`), the scratch-gui fork (local `../scratch-gui`, remote likewise); exercises are not in a repository (don't mention local paths outside the three repositories).
  2. Running locally: Node.js; in scratch-vm `npm install`, `npm run build` (the GUI uses `dist/web`); in scratch-gui `npm install`, link the local VM (check how `../scratch-gui/node_modules/scratch-vm` is linked: it is a symlink to `../../scratch-vm`; describe `npm link`), `npm start` → `http://localhost:8601`.
  3. Tests: in scratch-vm `npx tap --no-coverage test/unit/extension_quantum_*.js test/integration/quantum_mlir_export.js`; MLIR validation with `MQT_CC=/path/to/mqt-cc`; lint with `npx eslint <file>` (the extension's `index.js` has known older lint errors).
  4. Deploying the web app: `npm run build` in scratch-gui produces `build/`; copy its contents into the root of this repository, **without deleting** `docs/`, `README.md`, `.readthedocs.yaml`, `pyproject.toml`, `uv.lock`, `.gitignore`, `.nojekyll`; commit with a message containing `[skip ci]` (skips the docs build) and push `main`; GitHub Pages serves it at the editor URL. Verify the file list against `ls ../scratch-gui/build` and the repository root.
  5. Documentation: building locally (`uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html`; `python3 -m http.server --directory docs/_build/html`), writing blocks with the `scratchblocks` directive (copy the rules from Global Constraints), and setting up Read the Docs once (import `munich-quantum-toolkit/scratch-quantum` with slug `scratch-quantum`, add it as a subproject of the MQT project so it appears under `https://mqt.readthedocs.io/projects/scratch-quantum`; the config is `.readthedocs.yaml`).
- [ ] **Step 2: `docs/architecture.md`** — H1 `# Architecture`. From the sources: `index.js` (block definitions in `getInfo`, handlers per opcode, per-thread circuit state, `genericRunCircuits`), `simulator.js` (the interface: `createRegister`, `applyGate`, `applyRotation`, `measure`, `getResults`), `statevector-simulator.js`, `resource-estimator.js` (same interface, records gates), `qubit-expression.js`, the exporter (`exporter.js`, `mlir-emitter.js`, `download.js`). A small diagram as a Mermaid-free text/ASCII figure or a table (no new Sphinx extensions). "Adding a block": define it in `getInfo`, implement the handler, extend the simulators if it is a new gate, add exporter support or let it be reported as unsupported, add tests, document it in `blocks.md`.
- [ ] **Step 3: `docs/contributing.md`** — H1 `# Contributing`: issues first for larger changes; commit style (gitmoji conventional commits, as used in the repositories, e.g. `feat: :sparkles: …`); tests and lint must pass; documentation updates with every user-visible change; pull requests against the default branch of the respective repository.
- [ ] **Step 4: Navigation** — in `docs/index.md` insert between Reference and About:
  ```md
  ```{toctree}
  :caption: Developers
  :hidden:
  :maxdepth: 1

  development
  architecture
  contributing
  ```
  ```
  and link the developers mention in "Where to start".
- [ ] **Step 5: Build and check** — `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html` succeeds without warnings.
- [ ] **Step 6: Commit** — `docs: :memo: add developer guide`.

---

### Task 8: README and final checks

**Files:**
- Create: `README.md`
- Modify: none other unless the link check finds broken links

- [ ] **Step 1: `README.md`** — model it on `~/01_research/mqt-debugger/README.md` (same order and HTML structure):
  1. Badges: License (MIT; only if a license file exists in this repository — otherwise omit the license badge) and Documentation:
     `[![Documentation](https://img.shields.io/readthedocs/scratch-quantum?logo=readthedocs&style=flat-square)](https://mqt.readthedocs.io/projects/scratch-quantum)`
  2. The MQT logo block (`<p align="center"><a href="https://mqt.readthedocs.io"><picture>…` copied verbatim).
  3. `# Quantum Computing Extension for Scratch`, then the description paragraph and the byline sentence from `docs/index.md`.
  4. Two centered buttons: the "documentation" badge-button linking to the docs (copy mqt-debugger's `<p align="center"><a href=…><img width=30% src="https://img.shields.io/badge/documentation-blue?style=for-the-badge&logo=read%20the%20docs" …>`) and an "open the editor" button in the same style (`https://img.shields.io/badge/open%20the%20editor-blue?style=for-the-badge`) linking to the editor.
  5. `## Key Features` (4–5 bullets: quantum blocks for circuits incl. controls and rotations; statevector simulation inside Scratch; resource estimation with decomposition options; export to the MQT `qc` MLIR dialect; ready-to-use exercises).
  6. `## Contributors and Supporters` copied from mqt-debugger's README (from that heading through the sponsor section), adapted to this repository.
  7. `## Cite This` with the two BibTeX entries from `docs/refs.bib` (`qce_2026_01` written out with `booktitle = {IEEE International Conference on Quantum Computing and Engineering (QCE)}` instead of the `qce` macro, and `mqt`).
  8. A short "Scratch is a project of the Scratch Foundation…" credit with the trademark sentence (as on `docs/credits.md`).
- [ ] **Step 2: Final build and link check** — `uv run --group docs -m sphinx -W --keep-going -b html docs docs/_build/html` succeeds without warnings. Run `uv run --group docs -m sphinx -b linkcheck docs docs/_build/linkcheck` and fix or remove broken links, except links to `https://mqt.readthedocs.io/projects/scratch-quantum` (the Read the Docs project does not exist yet) — list those in the report.
- [ ] **Step 3: Visual check** — serve the build and check index, quickstart, blocks and one exercise page in light and dark mode (logos switch, blocks readable). Report the result.
- [ ] **Step 4: Commit** — `docs: :memo: add README with documentation link`.

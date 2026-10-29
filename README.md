[![License: MIT and AGPL-3.0](https://img.shields.io/badge/license-MIT%20%7C%20AGPL--3.0-blue.svg?style=flat-square)](#credits)
[![CI](https://img.shields.io/github/actions/workflow/status/munich-quantum-toolkit/scratch-quantum/editor.yml?branch=main&style=flat-square&logo=github&label=ci)](https://github.com/munich-quantum-toolkit/scratch-quantum/actions/workflows/editor.yml)
[![Documentation](https://img.shields.io/readthedocs/scratch-quantum?logo=readthedocs&style=flat-square)](https://mqt.readthedocs.io/projects/scratch-quantum)

<p align="center">
  <a href="https://mqt.readthedocs.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/munich-quantum-toolkit/.github/refs/heads/main/docs/_static/logo-mqt-dark.svg" width="60%">
      <img src="https://raw.githubusercontent.com/munich-quantum-toolkit/.github/refs/heads/main/docs/_static/logo-mqt-light.svg" width="60%" alt="MQT Logo">
    </picture>
  </a>
</p>

# Quantum Computing Extension for Scratch

The quantum computing extension adds quantum computing blocks to the Scratch editor.
With it, you build quantum circuits by snapping blocks together, run them on a built-in simulator, estimate the resources they need, and export them to the MQT compiler toolchain.
Developed by the Chair for Design Automation, Technical University of Munich, as part of the [_Munich Quantum Toolkit (MQT)_](https://mqt.readthedocs.io).

The extension is built to teach _quantum design automation_ (compilation, resource estimation, and verification), which is hard to learn from textual representations.
Because quantum circuits live inside normal Scratch programs, loops, conditionals, and variables work around and inside them, instead of unrolling a loop into a long circuit as in circuit editors.
Simulation and resource estimation run in the same place, and the MLIR export opens the path to the wider quantum software ecosystem; see the [paper](#cite-this) for details.

<p align="center">
  <a href="https://mqt.readthedocs.io/projects/scratch-quantum">
  <img width=30% src="https://img.shields.io/badge/documentation-blue?style=for-the-badge&logo=read%20the%20docs" alt="Documentation" />
  </a>
  <a href="https://munich-quantum-toolkit.github.io/scratch-quantum/">
  <img width=30% src="https://img.shields.io/badge/open%20the%20editor-blue?style=for-the-badge" alt="Open the editor" />
  </a>
</p>

## Key Features

- Quantum blocks for building circuits, including controlled operations and rotation gates
- Statevector simulation directly inside Scratch
- Resource estimation with configurable gate decomposition options
- Export of circuits to the MQT `qc` MLIR dialect
- Ready-to-use exercises for teaching quantum computing

If you have any questions, feel free to create an [issue](https://github.com/munich-quantum-toolkit/scratch-quantum/issues) on [GitHub](https://github.com/munich-quantum-toolkit/scratch-quantum).

## Building the Editor

This repository contains the source of the extension, not a copy of Scratch.
The build downloads `scratch-vm` and `scratch-gui` at pinned versions, applies a few patches, and adds the extension.
You need Node.js 24 or later and git 2.32 or later:

```bash
npm run setup   # download and prepare Scratch, and install its dependencies
npm run dev     # run the editor at http://localhost:8601
npm test        # run the tests of the extension
npm run build   # build the editor into build/
```

The [development guide](https://mqt.readthedocs.io/projects/scratch-quantum/en/latest/development.html) explains the details.

## Contributors and Supporters

The _[Munich Quantum Toolkit (MQT)](https://mqt.readthedocs.io)_ is developed by the [Chair for Design Automation](https://www.cda.cit.tum.de/) at the [Technical University of Munich](https://www.tum.de/) and supported by the [Munich Quantum Software Company (MQSC)](https://munichquantum.software).
Among others, it is part of the [Munich Quantum Software Stack (MQSS)](https://www.munich-quantum-valley.de/research/research-areas/mqss) ecosystem, which is being developed as part of the [Munich Quantum Valley (MQV)](https://www.munich-quantum-valley.de) initiative.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/munich-quantum-toolkit/.github/refs/heads/main/docs/_static/mqt-logo-banner-dark.svg" width="90%">
    <img src="https://raw.githubusercontent.com/munich-quantum-toolkit/.github/refs/heads/main/docs/_static/mqt-logo-banner-light.svg" width="90%" alt="MQT Partner Logos">
  </picture>
</p>

Thank you to all the contributors who have helped make the quantum computing extension for Scratch a reality!

<p align="center">
  <a href="https://github.com/munich-quantum-toolkit/scratch-quantum/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=munich-quantum-toolkit/scratch-quantum" alt="Contributors to munich-quantum-toolkit/scratch-quantum" />
  </a>
</p>

The MQT will remain free, open-source, and permissively licensed—now and in the future.
We are firmly committed to keeping it open and actively maintained for the quantum computing community.

To support this endeavor, please consider:

- Starring and sharing our repositories: https://github.com/munich-quantum-toolkit
- Contributing code, documentation, tests, or examples via issues and pull requests
- Citing the MQT in your publications (see [Cite This](#cite-this))
- Citing our research in your publications (see [References](https://mqt.readthedocs.io/projects/scratch-quantum/en/latest/references.html))
- Using the MQT in research and teaching, and sharing feedback and use cases
- Sponsoring us on GitHub: https://github.com/sponsors/munich-quantum-toolkit

<p align="center">
  <a href="https://github.com/sponsors/munich-quantum-toolkit">
  <img width=20% src="https://img.shields.io/badge/Sponsor-white?style=for-the-badge&logo=githubsponsors&labelColor=black&color=blue" alt="Sponsor the MQT" />
  </a>
</p>

## Cite This

Please cite the work that best fits your use case.

### The quantum computing extension for Scratch

When citing the extension or its use in teaching, cite the QCE paper:

```bibtex
@inproceedings{qce_2026_01,
  title     = {{Teaching Quantum Design Automation with Block-Based Programming}},
  author    = {D. Rovara and R. Wille},
  booktitle = {IEEE International Conference on Quantum Computing and Engineering (QCE)},
  year      = {2026},
}
```

### The Munich Quantum Toolkit (the project)

When discussing the overall MQT project or its ecosystem, cite the MQT Handbook:

```bibtex
@inproceedings{mqt,
  title        = {The {{MQT}} Handbook: {{A}} Summary of Design Automation Tools and Software for Quantum Computing},
  shorttitle   = {The MQT Handbook},
  author       = {Robert Wille and Lucas Berent and Tobias Forster and Jagatheesan Kunasaikaran and Kevin Mato and Tom Peham and Nils Quetschlich and Damian Rovara and Aaron Sander and Ludwig Schmid and Daniel Schoenberger and Yannick Stade and Lukas Burgholzer},
  year         = {2024},
  booktitle    = {IEEE International Conference on Quantum Software (QSW)},
  doi          = {10.1109/QSW62656.2024.00013},
  eprint       = {2405.17543},
  eprinttype   = {arxiv},
  addendum     = {A live version of this document is available at \url{https://mqt.readthedocs.io}}
}
```

## Credits

The editor is built on Scratch 3.0, developed by the [Scratch Foundation](https://scratch.mit.edu).
This project is not affiliated with or endorsed by the Scratch Foundation or MIT.
The Scratch trademarks, including the Scratch name, logo, and Scratch Cat, are property of the Massachusetts Institute of Technology (MIT).

This repository is licensed under the MIT License, except for the directories `vm/`, `gui/`, and `patches/`, which are licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only) like Scratch itself.
The deployed editor contains Scratch and is therefore distributed under the AGPL-3.0.

---

## Acknowledgements

The Munich Quantum Toolkit has been supported by the European Research Council (ERC) under the European Union's Horizon 2020 research and innovation program (grant agreement No. 101001318), the Bavarian State Ministry for Science and Arts through the Distinguished Professorship Program, as well as the Munich Quantum Valley, which is supported by the Bavarian state government with funds from the Hightech Agenda Bayern Plus.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/munich-quantum-toolkit/.github/refs/heads/main/docs/_static/mqt-funding-footer-dark.svg" width="90%">
    <img src="https://raw.githubusercontent.com/munich-quantum-toolkit/.github/refs/heads/main/docs/_static/mqt-funding-footer-light.svg" width="90%" alt="MQT Funding Footer">
  </picture>
</p>

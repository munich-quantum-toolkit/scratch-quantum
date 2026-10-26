# Quantum Computing Extension for Scratch

The quantum computing extension adds quantum computing blocks to the Scratch editor.
With it, you build quantum circuits by snapping blocks together, run them on a built-in simulator, estimate the resources they need, and export them to the MQT compiler toolchain.
Developed by the Chair for Design Automation, Technical University of Munich, as part of the [Munich Quantum Toolkit (MQT)](https://mqt.readthedocs.io).

```{button-link} https://munich-quantum-toolkit.github.io/scratch-quantum/
:color: primary
:shadow:

Open the editor
```

A quantum circuit is a script of blocks.
The following script creates two qubits and entangles them:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
controlled on (qubit (0) of register [q] :: extension) {
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
} :: extension
say <measure (qubit (0) of register [q] :: extension) :: extension>
```

## Where to start

We recommend that you start with the {doc}`quickstart` if you are new to the extension and want to build your first circuits.
If you teach quantum computing, have a look at the {doc}`exercises <exercises/index>` that you can use in your classroom.
If you are interested in research, read about the {doc}`resource estimation <resource-estimation>` and the {doc}`MLIR export <mlir-export>`.
If you want to change the extension or run the editor yourself, read the {doc}`development guide <development>`.

If you are interested in the background of the extension, have a look at the publications in the {doc}`publication list <references>`.
If you are having trouble using the extension, please let us know on our {doc}`support page <support>`.

```{toctree}
:hidden:

self
```

```{toctree}
:caption: Getting Started
:hidden:
:maxdepth: 1

quickstart
quantum-basics
```

```{toctree}
:caption: Exercises
:hidden:
:maxdepth: 2

exercises/index
```

```{toctree}
:caption: Reference
:hidden:
:maxdepth: 1

blocks
qubit-expressions
simulation
resource-estimation
mlir-export
```

```{toctree}
:caption: Developers
:hidden:
:maxdepth: 1

development
architecture
contributing
```

```{toctree}
:caption: About
:hidden:
:maxdepth: 1

references
support
credits
```

## Contributors and Supporters

The _[Munich Quantum Toolkit (MQT)](https://mqt.readthedocs.io)_ is developed by the [Chair for Design Automation](https://www.cda.cit.tum.de/) at the [Technical University of Munich](https://www.tum.de/) and supported by the [Munich Quantum Software Company (MQSC)](https://munichquantum.software).
Among others, it is part of the [Munich Quantum Software Stack (MQSS)](https://www.munich-quantum-valley.de/research/research-areas/mqss) ecosystem, which is being developed as part of the [Munich Quantum Valley (MQV)](https://www.munich-quantum-valley.de) initiative.

<div style="margin-top: 0.5em">
<div class="only-light" align="center">
  <img src="https://raw.githubusercontent.com/munich-quantum-toolkit/.github/refs/heads/main/docs/_static/mqt-logo-banner-light.svg" width="90%" alt="MQT Banner">
</div>
<div class="only-dark" align="center">
  <img src="https://raw.githubusercontent.com/munich-quantum-toolkit/.github/refs/heads/main/docs/_static/mqt-logo-banner-dark.svg" width="90%" alt="MQT Banner">
</div>
</div>

Thank you to all the contributors who have helped make the quantum computing extension for Scratch a reality!

<p align="center">
<a href="https://github.com/munich-quantum-toolkit/scratch-quantum/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=munich-quantum-toolkit/scratch-quantum" />
</a>
</p>

The MQT will remain free, open-source, and permissively licensed—now and in the future.
We are firmly committed to keeping it open and actively maintained for the quantum computing community.

To support this endeavor, please consider:

- Starring and sharing our repositories: [https://github.com/munich-quantum-toolkit](https://github.com/munich-quantum-toolkit)
- Contributing code, documentation, tests, or examples via issues and pull requests
- Citing the MQT in your publications (see {doc}`References <references>`)
- Using the MQT in research and teaching, and sharing feedback and use cases
- Sponsoring us on GitHub: [https://github.com/sponsors/munich-quantum-toolkit](https://github.com/sponsors/munich-quantum-toolkit)

<p align="center">
<iframe src="https://github.com/sponsors/munich-quantum-toolkit/button" title="Sponsor munich-quantum-toolkit" height="32" width="114" style="border: 0; border-radius: 6px;"></iframe>
</p>

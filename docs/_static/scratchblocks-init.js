// Copyright (c) 2026 Chair for Design Automation, TUM
// All rights reserved.
//
// SPDX-License-Identifier: MIT
//
// Licensed under the MIT License

// Render every <pre class="blocks"> element (see docs/_ext/scratchblocks.py) as Scratch 3.0 blocks.

// scratchblocks draws all extension blocks in one colour, but the quantum extension gives each group of blocks its own
// colour (`color` in `getInfo` of scratch-vm's src/extensions/mqt_quantum/index.js; blocks without one use the
// extension's `color1`, #0065bd). Blocks are identified by their label text without inputs.
const QUANTUM_BLOCK_COLOURS = {
  "create quantum register with qubits": "#003359",
  "qubit of register": "#003359",
  "qubits of register": "#003359",
  "apply gate to": "#0065bd",
  "apply SWAP gate to and": "#0065bd",
  "controlled on": "#64a0c8",
  and: "#98c6ea",
  "negated control": "#98c6ea",
  "rotate by degrees around axis": "#0065bd",
  "apply U3 gate to with angles": "#0065bd",
  measure: "#59c059",
  "Quantum Circuit": "#64a0c8",
  "Run Quantum Circuits": "#64a0c8",
  "Run Quantum Circuits starting from": "#64a0c8",
  "Set Simulator to": "#64a0c8",
  "Perform Quantum Resource Estimation": "#64a0c8",
  "Estimated Quantum Resources": "#64a0c8",
  "Estimated Quantum Resources of Circuit #": "#64a0c8",
  "Estimated Qubit Requirements of Circuit #": "#64a0c8",
  "Estimated Qubit Gates in Circuit #": "#64a0c8",
  "Estimated SWAP Gates in Circuit #": "#64a0c8",
  "SWAP decomposition": "#64a0c8",
  "substitute negative control lines": "#64a0c8",
  "Toffoli decomposition": "#64a0c8",
  "Export Circuits to MLIR": "#1c466c",
};

// The label of a block: its own text elements, without the text inside its inputs (those are nested groups).
const blockLabel = (blockGroup) =>
  [...blockGroup.children]
    .filter((child) => child.tagName === "text")
    .map((child) => child.textContent)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const colourQuantumBlocks = () => {
  document
    // Block bodies: paths for stack, C and hat blocks, rects for round reporters (input fields carry sb3-input).
    .querySelectorAll(
      "svg.scratchblocks-style-scratch3 :is(path, rect).sb3-extension:not(.sb3-input)",
    )
    .forEach((body) => {
      const colour = QUANTUM_BLOCK_COLOURS[blockLabel(body.parentElement)];
      if (colour) {
        body.style.fill = colour;
      }
    });
};

document.addEventListener("DOMContentLoaded", () => {
  scratchblocks.renderMatching("pre.blocks", {
    style: "scratch3",
    languages: ["en"],
    scale: 0.675,
  });
  colourQuantumBlocks();
});

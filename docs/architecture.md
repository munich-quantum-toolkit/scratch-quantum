# Architecture

This page describes how the extension is built, so that you can find your way around the code and add features.
It refers to the files in `src/extensions/mqt_quantum/` of the virtual machine; see {doc}`development` for the repositories.

## Overview

The extension is a regular Scratch extension, registered under the ID `quantum` in the virtual machine.
Everything the editor shows, such as the blocks, their colors, and their menus, comes from the extension itself.
The only part in the editor is the entry of the extension in the extension library.

A circuit is a script of blocks.
When it runs, every block calls a handler of the extension, and the handler passes the operation on to a simulator object.
The simulators are interchangeable: the statevector simulator calculates the quantum state, and the resource estimator only records which gates a circuit uses.
The MLIR export is separate from this: it reads the blocks without running them.

```text
          blocks of a Quantum Circuit script
                  |                  |
      run (click a script,           Export Circuits
      Run Quantum Circuits,             to MLIR
      Perform Quantum
      Resource Estimation)
                  |                  |
          handlers in index.js    exporter.js
                  |                  |
        +---------+---------+     mlir-emitter.js
        |                   |        |
 statevector-         resource-   download.js
 simulator.js         estimator.js   |
 (quantum state)      (gate counts)  quantum_circuits.mlir
```

## The files

| File                       | Purpose                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `index.js`                 | The extension: block definitions, menus, and one handler per block.                                          |
| `simulator.js`             | The base class `Simulator` that all simulators extend, and the class `Control`.                              |
| `statevector-simulator.js` | The simulator that calculates the full quantum state.                                                        |
| `resource-estimator.js`    | The simulator that counts the gates a circuit uses.                                                          |
| `symbolic-simulator.js`    | A simulator that `index.js` does not use at the moment.                                                      |
| `qubit-expression.js`      | Parser for the text of qubit expressions, and the validation of register names and qubit indices.            |
| `complex-math.js`          | Complex numbers, matrices, and vectors for the statevector simulator.                                        |
| `utils.js`                 | Helpers shared by the simulators: the classes `Register` and `QubitAccess`, and the function `targetAccess`. |
| `exporter.js`              | The translation of circuits to MLIR.                                                                         |
| `mlir-emitter.js`          | Builds the text of MLIR functions and modules.                                                               |
| `download.js`              | Offers a text to the browser as a file download.                                                             |

## The extension class

`index.js` exports the class `QuantumExtension`.

Block definitions
: The method `getInfo` returns the description of the extension: its ID, name, colors, the list of blocks, and the menus.
Every block has an `opcode`, a block type (command, reporter, boolean, hat, conditional, or button), its text with `[ARGUMENT]` placeholders, and its arguments.
The menus for gates, axes, the resource estimator settings, and the simulator are defined in the same place.

Handlers
: Scratch calls the method of the extension that is named like the `opcode` of the block.
The handler of `apply [GATE] gate to [QUBIT]` is `applyGate`, the handler of `measure` is `measure`, and so on.
The reporters for qubits return the text of a qubit expression, for example `q[0]`; the handlers parse these texts with `qubit-expression.js` and call the simulator.

Circuit state per thread
: Every `Quantum Circuit` script runs as its own Scratch thread.
The extension keeps one `CircuitExecutionInformation` object per thread in a `WeakMap`.
It holds the simulator of the circuit and the stack of the enclosing `controlled on` blocks.
If a thread has no such object yet, for example when you click a circuit script, `getCurrentExecutionInformation` creates one with a statevector simulator.

Controls
: The `controlled on` block pushes its qubit expression onto the control stack, runs the blocks inside, and pops the stack.
Gate handlers read the stack and pass the positive and negative controls to the simulator with every gate.

Running circuits
: `genericRunCircuits` implements `Run Quantum Circuits` and `Perform Quantum Resource Estimation`.
It starts all `Quantum Circuit` hats with `util.startHats`, creates a simulator of the requested class for each started thread, and yields until all threads have finished.
Then it collects the result of every simulator with `getResults`.
`Run Quantum Circuits` passes `StatevectorSimulator`, the resource estimation passes `ResourceEstimator` together with its settings.

Export
: The handler `toMLIR` collects all circuits of the project, passes them to `exportProjectToMLIR`, and offers the result for download.
A failed export is shown as a message and marks the block that caused it.

## Simulators

All simulators extend `Simulator` from `simulator.js`.
The base class keeps the list of registers and the helpers that map a qubit access such as `q[1]` to a global qubit index.
Its methods are the interface that the handlers in `index.js` use:

| Method                                                                    | Called for                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `createRegister(name, size)`                                              | `create quantum register`                                               |
| `applyGate(gate, targets, positiveControls, negativeControls)`            | `apply gate` and `apply SWAP gate`                                      |
| `applyRotation(axis, angle, targets, positiveControls, negativeControls)` | rotations around an axis and `U3` (which is applied as three rotations) |
| `measure(qubit)`                                                          | `measure`                                                               |
| `getResults()`                                                            | the end of a run                                                        |

The base class implements `getResults` to return an empty object and lets the other methods throw an error.
Its method signatures list a single `controls` parameter, but the handlers and both simulators pass positive and negative controls separately.
Follow the handlers when you write a new simulator.

`statevector-simulator.js`
: Keeps the state as a vector of complex amplitudes and applies the matrix of every gate, extended by its controls, to the affected qubits.
`measure` chooses an outcome randomly and collapses the state.
The `Run Quantum Circuits starting from` block makes the simulator start from a computational basis state instead of the all-zero state.
The simulator limits the number of qubits; see {doc}`simulation`.

`resource-estimator.js`
: Implements the same interface but does not calculate a state.
It records the gates that a circuit applies, grouped by the number of qubits they act on, and applies the options of the {doc}`resource estimation <resource-estimation>`: translating negative controls, decomposing Toffoli gates, and decomposing SWAP gates.
`getResults` returns the gate counts and the number of qubits, including the ancilla qubits that the decompositions need.

## Qubit expressions

`qubit-expression.js` turns the text of a qubit input into a small syntax tree.
The nodes are a single qubit (`LeafNode`), a negation (`NegatedNode`), and a conjunction (`AndNode`).
For gate blocks, a tree is expanded to a list of target qubits.
For `controlled on`, it is split into positive and negative controls.
The user-facing rules of qubit expressions are described in {doc}`qubit-expressions`.

## The MLIR export

The exporter does not run the circuit.
`exportProjectToMLIR` in `exporter.js` takes the `Quantum Circuit` scripts of the project, walks over their blocks, and writes the circuits as functions of one MLIR module.
One circuit becomes the body of `@main`; several circuits become private functions that `@main` calls in order.

The class `Exporter` translates one script.
It looks up a handler for every block by its full Scratch opcode, which for the blocks of this extension is `quantum_` followed by the opcode from `getInfo`.
The handlers are named `stmt_<opcode>` for blocks in a stack (for example `stmt_quantum_applyGate`), `num_<opcode>` for number reporters, `bool_<opcode>` for conditions (`bool_quantum_measure`), and `qubits_<opcode>` for qubit inputs (`qubits_quantum_getQubit`).
Standard Scratch blocks have handlers too, such as `stmt_control_repeat` and `num_operator_add`.
Blocks without a handler cause an `MLIRExportError` that names the block, unless they are on the list of blocks that the export skips on purpose.
`mlir-emitter.js` knows nothing about Scratch.
It only provides fresh names for values, indentation, and the framing of functions and modules.
`download.js` hands the finished text to the browser.

See {doc}`mlir-export` for what the export supports.

## Adding a block

To add a block to the extension, work through the following steps.

1. Define the block in `getInfo` in `index.js`: its `opcode`, block type, text, arguments, and, if needed, a menu.
2. Implement the handler, a method of `QuantumExtension` with the name of the `opcode`.
   The handler reads the arguments, parses qubit inputs with `qubit-expression.js`, reads the control stack for gates, and calls the simulator.
3. If the block is a new gate, extend the simulators.
   Add its matrix to the statevector simulator and decide how the resource estimator counts it.
   For a new gate kind, a new method in the interface of `Simulator` may be needed; then implement it in every simulator.
4. Add support to the exporter with a handler named after the full Scratch opcode, that is `quantum_` followed by the opcode from `getInfo`: `stmt_quantum_<opcode>` for a stack block, `bool_quantum_<opcode>` for a condition, or `qubits_quantum_<opcode>` for a qubit reporter.
   For example, a new stack block with the opcode `foo` needs the handler `stmt_quantum_foo`.
   You can also leave the block out.
   Without a handler, the export reports the block as unsupported, which is the right behavior for blocks that have no MLIR equivalent.
   If the block belongs to the extension but does nothing in the exported circuit, add its full opcode, for example `quantum_toMLIR`, to the list of skipped opcodes in `exporter.js`.
5. Add tests in `test/unit/` of `scratch-vm`, next to the existing `extension_quantum_*.js` tests.
6. Document the block in {doc}`blocks`, and, where it applies, on the pages for {doc}`running circuits <simulation>`, {doc}`resource estimation <resource-estimation>`, and the {doc}`MLIR export <mlir-export>`.

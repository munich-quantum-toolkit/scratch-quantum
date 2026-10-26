# Exporting to MLIR

The `Export Circuits to MLIR` block translates the circuits of your project into a file for the MQT compiler toolchain.
You can use it to take a circuit you built with blocks into the Munich Quantum Toolkit (MQT) and to optimize it or lower it to other representations there.

This page describes what the block exports, how you use the file, how the blocks are translated, and which blocks and constructs the export does not support.
The {doc}`block reference <blocks>` lists all quantum blocks.

## What the export does

Put the `Export Circuits to MLIR` block in a script outside of your circuits, for example below a `when green flag clicked` hat, and run it:

```{scratchblocks}
when green flag clicked
Export Circuits to MLIR :: extension
```

The block translates every `Quantum Circuit` script of the project, in all sprites and in the stage, into one module of the `qc` dialect of the MQT.
The browser downloads the module as `quantum_circuits.mlir` and shows a message.
If a circuit cannot be translated, nothing is downloaded; see [Errors](#errors).

The translation is static.
The export reads the blocks of each circuit and translates their structure; it does not run the circuits and does not record a run.
Loops become `scf.for` loops, `if` blocks become `scf.if` operations, and variables become values in the static single assignment (SSA) form of MLIR.
The file therefore describes the circuit for all possible outcomes, not the outcomes of one simulation.
The export does not use the simulator.

Blocks that do not belong to the circuit itself, such as `say`, are skipped; see [Supported blocks](#supported-blocks).

## Using the file with MQT

The module is written in the `qc` dialect of {doc}`MQT Core <core:index>`, for the current version of MQT Core.
MQT Core ships the compiler driver `mqt-cc`, which reads the file and lowers it.
Your version of `mqt-cc` may be older or newer than the dialect that the export targets; the export does not check this.
If your `mqt-cc` rejects the file, compare it with the module of a current MQT Core.

The following call optimizes the circuit and lowers it to the `qco` dialect:

```bash
mqt-cc --emit=qco-optimized quantum_circuits.mlir
```

The following call lowers the circuit to the adaptive profile of the Quantum Intermediate Representation (QIR):

```bash
mqt-cc --emit=qir-adaptive quantum_circuits.mlir
```

With `--emit=qc`, you can check that the file parses.

The `qir-adaptive` lowering has one known limitation: it fails if a measurement result is carried out of a `repeat` loop in a variable and then used by an `if` block; see [Limitations](#limitations).

## Example

The following circuit is the Bell state circuit from the {doc}`quickstart`.
It ends with a `say` block instead of the variable, because the export cannot store a measurement of several qubits in a variable (see [Limitations](#limitations)).

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
controlled on (qubit (0) of register [q] :: extension) {
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
} :: extension
say <measure (qubits of register [q] :: extension) :: extension>
```

Exporting a project with this circuit in a sprite called `Sprite1` gives the following file:

```text
// Exported from Scratch by the MQT quantum extension
module {
  // 'Quantum Circuit' script of sprite "Sprite1"
  func.func @main() attributes {mqt.entry_point} {
    %q = memref.alloc() {mqt.register_name = "q"} : memref<2x!qc.qubit>
    %c0 = arith.constant 0 : index
    %0 = memref.load %q[%c0] : memref<2x!qc.qubit>
    qc.h %0 : !qc.qubit
    %c0_1 = arith.constant 0 : index
    %1 = memref.load %q[%c0_1] : memref<2x!qc.qubit>
    %c1 = arith.constant 1 : index
    %2 = memref.load %q[%c1] : memref<2x!qc.qubit>
    qc.ctrl(%1) targets (%t = %2) {
      qc.x %t : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    // skipped: looks_say
    %c0_2 = arith.constant 0 : index
    %3 = memref.load %q[%c0_2] : memref<2x!qc.qubit>
    %4 = qc.measure %3 : !qc.qubit -> i1
    %c1_1 = arith.constant 1 : index
    %5 = memref.load %q[%c1_1] : memref<2x!qc.qubit>
    %6 = qc.measure %5 : !qc.qubit -> i1
    memref.dealloc %q : memref<2x!qc.qubit>
    return
  }
}
```

Reading the file from top to bottom:

- The register `q` becomes a `memref` of two `!qc.qubit` values, named `q` through the attribute `mqt.register_name`.
- Every use of a qubit loads it from the register right before the operation, so each gate is preceded by a constant index and a `memref.load`.
- The `H` gate becomes `qc.h`.
- The `controlled on` block becomes a `qc.ctrl` operation with the control qubit and the target qubit.
  The `X` gate inside it acts on the target.
- The `say` block is skipped and marked by a comment.
  The two measurements inside it are still translated, because they change the state of the qubits, but their results are not used.
- The register is released with `memref.dealloc` before the function returns.

## How blocks are translated

### Overview

The following table lists how the blocks translate.
The names in the second column are the operations of the dialects `qc` (quantum circuit), `arith` (arithmetic), `memref` (memory) and `scf` (structured control flow).

| Block | MLIR |
| --- | --- |
| `create quantum register [q] with (n) qubits` | `memref.alloc` of `memref<nx!qc.qubit>` with `mqt.register_name`; `memref.dealloc` before `return`, in reverse order of creation |
| `qubit (i) of register [q]` | `memref.load` of one qubit, right before the operation that uses it |
| `qubits of register [q]` | all qubits of the register |
| `[A] and [B]` | the qubits of both inputs |
| `negated control [Q]` | marks the qubits as negated controls |
| `apply [X/Y/Z/H/S/T v] gate to [Q]` | `qc.x`, `qc.y`, `qc.z`, `qc.h`, `qc.s`, `qc.t` |
| `apply SWAP gate to [Q1] and [Q2]` | `qc.swap` |
| `rotate [Q] by (a) degrees around [X/Y/Z v] axis` | `qc.rx`, `qc.ry`, `qc.rz` with the angle in radians |
| `apply U3 gate to [Q] with angles (θ) (φ) (λ)` | `qc.u` with the three angles in radians |
| `controlled on [Q] { … }` | one `qc.ctrl` per gate in the body |
| `measure [Q]` | `qc.measure`, which gives an `i1` value |
| `repeat (n)` | `scf.for` |
| `if … then`, `if … then … else` | `scf.if` |
| `set [v] to`, `change [v] by` and variables | SSA values |
| `+`, `-`, `*`, `/` | `arith.addf`, `arith.subf`, `arith.mulf`, `arith.divf` |
| `<`, `>`, `=` | `arith.cmpf` with `olt`, `ogt`, `oeq` |
| `not`, `and`, `or` | `arith.xori` with `true`, `arith.andi`, `arith.ori` |

The following paragraphs give the details for registers, qubits, gates and rotations.

Register names and sizes
: The name of a register must be fixed text, not a block, and it must be a valid name (letters, digits and `_`, starting with a letter or `_`).
  The number of qubits must be a fixed whole number of at least 1, because the size of a `memref` is static.
  You can create registers only at the top level of the circuit, not inside `repeat`, `if` or `controlled on`.

Qubit indices
: A fixed index is checked against the size of the register.
  An index that depends on a variable is converted with `arith.fptosi` and `arith.index_cast`, which truncates like the simulator, and is not checked.
  If the variable has a known value at that point, the export uses the value and checks it, so `qubit (i + 1) of register [q]` stays static as long as `i` holds a fixed value.

Gates
: A gate applied to several qubits becomes one operation per qubit, in order.
  The gate and axis menus must be set to a menu entry, not to a block.
  A `negated control` is an error in a target input.

Rotations
: The angles of `rotate` and `apply U3 gate` are in degrees in the blocks and in radians in MLIR.
  The export converts fixed angles itself and multiplies other angles by $\pi/180$ with `arith.mulf`.

### Controls

Every gate inside a `controlled on` block becomes its own `qc.ctrl` operation, also when the gate is nested in a `repeat` or `if` inside the body.
Nested `controlled on` blocks contribute all their controls to the same `qc.ctrl`.
The operation passes the target qubits as arguments to the body, as the dialect requires:

```text
qc.ctrl(%a, %b) targets (%t = %target) {
  qc.x %t : !qc.qubit
  qc.yield
} : {!qc.qubit, !qc.qubit}, {!qc.qubit}
```

The dialect has no negative controls.
For a negated control, the export applies `qc.x` to the control qubit before the `qc.ctrl` operation and again after it, as the OpenQASM importer of `mqt-cc` does.
For example, the circuit

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
controlled on (negated control (qubit (0) of register [q] :: extension) :: extension) {
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
} :: extension
```

gives the following sequence of operations on the qubits, after the register allocation and the loads:

```text
qc.x %0 : !qc.qubit
qc.ctrl(%0) targets (%t = %1) {
  qc.x %t : !qc.qubit
  qc.yield
} : {!qc.qubit}, {!qc.qubit}
qc.x %0 : !qc.qubit
```

The export does not merge consecutive controlled gates into larger `qc.ctrl` regions.
The optimizer of `mqt-cc` may merge them.

A qubit that is both a control and a target of the same gate is an error if the export can see this from fixed indices.
For indices that depend on variables, the check is left to the MLIR verifier.
You cannot measure inside `controlled on`.

### Measurement

`measure` gives an `i1` value, one per qubit.
In the export, you can use a measurement in the following places:

- As the condition of an `if` block, directly or inside `not`, `and` and `or`.
  The measurement must be of a single qubit.
- In `set [v] to <measure …>`.
  The measurement must be of a single qubit, and the variable then holds an `i1` value.
- In an input of a skipped block, such as `say <measure …>`.
  This emits one measurement per qubit and discards the results.

### Control flow

`repeat (n)` becomes `scf.for` from 0 to `n` in steps of 1.
A fixed `n` is rounded like Scratch does, and a negative `n` counts as 0.
A `n` that depends on a variable is converted with `arith.fptosi` and `arith.index_cast`, which truncates.

`if … then` and `if … then … else` become `scf.if`.
A condition must be a measurement, a variable that holds a measurement result, a comparison with `<`, `>` or `=`, or a combination with `not`, `and` and `or`.
A condition that is a fixed value still becomes an `scf.if` on a constant; the export does not remove the branch that is never taken.
The optimizer of `mqt-cc` can remove it.

The following circuit uses both blocks together with a variable:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
set [n v] to (0)
repeat (3)
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
change [n v] by (1)
end
if <measure (qubit (0) of register [q] :: extension) :: extension> then
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
end
```

The loop carries the variable `n`, so the `scf.for` has an `iter_args` entry for it, and its body ends with an `scf.yield` of the new value:

```text
%0 = scf.for %iv = %c0 to %c3 step %c1 iter_args(%arg = %cst) -> (f64) {
  %c0_1 = arith.constant 0 : index
  %1 = memref.load %q[%c0_1] : memref<2x!qc.qubit>
  qc.h %1 : !qc.qubit
  %cst_1 = arith.constant 1.0 : f64
  %2 = arith.addf %arg, %cst_1 : f64
  scf.yield %2 : f64
}
%c0_2 = arith.constant 0 : index
%3 = memref.load %q[%c0_2] : memref<2x!qc.qubit>
%4 = qc.measure %3 : !qc.qubit -> i1
scf.if %4 {
  %c1_1 = arith.constant 1 : index
  %5 = memref.load %q[%c1_1] : memref<2x!qc.qubit>
  qc.x %5 : !qc.qubit
}
```

### Variables and numbers

Scratch variables become SSA values.
The export gives each variable a type:
a variable that you set to a number is an `f64`, and a variable that you set to a measurement or a condition is an `i1`.
`change by` makes a variable an `f64`.
A variable that the circuit only reads gets its type from its current value: `true` and `false` are `i1`, everything else is `f64`.
A variable that you set to both kinds of values is an error.

Each variable starts with its value at the moment you export, converted to its type.
This lets a script outside the circuit, such as the green flag script that contains the export block, set parameters that the circuit reads.
A text that is not a number cannot start an `f64` variable.

A `set` rebinds the variable to a new value, and a `change by` adds to it with `arith.addf`.
Variables that a `repeat` body assigns become `iter_args` of the `scf.for` as shown above.
Variables that either branch of an `if` assigns become results of the `scf.if`; a branch that does not assign a variable passes the value it had before.
Number literals become `f64` constants.
While a variable holds a known value, the export treats it as that value, and an operator on two fixed values is calculated during the export instead of emitting an operation.
A calculation without a finite result, such as a division by zero, is an error.

## Module shape

The module starts with the comment `// Exported from Scratch by the MQT quantum extension`.
Every circuit function is preceded by a comment with the name of its sprite, for example `// 'Quantum Circuit' script of sprite "Sprite1"`.
The export collects the circuits in the order in which `Run Quantum Circuits` starts them, and it skips clones.

One circuit
: The translation of the circuit is the body of the entry point `func.func @main() attributes {mqt.entry_point}`, as in the example above.

Several circuits
: Each circuit becomes a function `@circuit_<k>`, with `k` counting from 1.
  The function receives the registers of its circuit as `memref` arguments, one per register, in the order in which the circuit creates them.
  It neither allocates nor releases them.
  The entry point `@main` allocates the registers of each circuit, calls the function of the circuit, and releases the registers again, one circuit after the other.

The current MQT Core only allows `@main`, the function marked as the entry point, to allocate qubits; helper functions must receive them as arguments.
This is why the registers are arguments of the helper functions.
`mqt-cc` requires register names to be unique in the program, so `@main` prefixes the register names with the number of the circuit: the register `q` of the second circuit is `circuit_2_q`.

The following module is the result for two circuits.
The circuit in `Sprite1` creates a register `q` with two qubits and applies an `H` gate to qubit 1.
The circuit in `Sprite2` creates a register `q` with one qubit and applies an `X` gate to qubit 0:

```text
// Exported from Scratch by the MQT quantum extension
module {
  // 'Quantum Circuit' script of sprite "Sprite1"
  func.func private @circuit_1(%q: memref<2x!qc.qubit>) {
    %c1 = arith.constant 1 : index
    %0 = memref.load %q[%c1] : memref<2x!qc.qubit>
    qc.h %0 : !qc.qubit
    return
  }
  // 'Quantum Circuit' script of sprite "Sprite2"
  func.func private @circuit_2(%q: memref<1x!qc.qubit>) {
    %c0 = arith.constant 0 : index
    %0 = memref.load %q[%c0] : memref<1x!qc.qubit>
    qc.x %0 : !qc.qubit
    return
  }
  func.func @main() attributes {mqt.entry_point} {
    %circuit_1_q = memref.alloc() {mqt.register_name = "circuit_1_q"} : memref<2x!qc.qubit>
    func.call @circuit_1(%circuit_1_q) : (memref<2x!qc.qubit>) -> ()
    memref.dealloc %circuit_1_q : memref<2x!qc.qubit>
    %circuit_2_q = memref.alloc() {mqt.register_name = "circuit_2_q"} : memref<1x!qc.qubit>
    func.call @circuit_2(%circuit_2_q) : (memref<1x!qc.qubit>) -> ()
    memref.dealloc %circuit_2_q : memref<1x!qc.qubit>
    return
  }
}
```

A circuit without registers gets a function `@circuit_<k>()` without arguments, and `@main` calls it without arguments.

The number `k` matches the number of the circuit in the {doc}`resource estimation <resource-estimation>`, as in `Estimated Quantum Resources of Circuit #(k)`, only if the project has no clones of circuits and no circuit is already running when you export.
Starting circuits also starts clones and skips scripts that are already running; the export does not.

If the project has no `Quantum Circuit` script, there is nothing to export, and a message says so.

An `Export Circuits to MLIR` block inside a circuit is skipped in the translation but still runs at runtime.
`Run Quantum Circuits` would then export the project once for each such circuit.
Use the block outside your circuits.

## Supported blocks

The export translates the quantum blocks of the {doc}`block reference <blocks>` for registers, qubits, gates, rotations, controls and measurement, as listed in the table above.
Of the regular Scratch blocks, it translates `repeat`, `if`, `if else`, `set … to`, `change … by`, variables, the number operators `+`, `-`, `*` and `/`, the comparisons `<`, `>` and `=`, and `not`, `and` and `or`.

Skipped blocks
: The export skips the blocks of the categories motion, looks, sound and pen, and the block `wait (…) seconds`.
  It also skips the settings blocks of the extension (`Set Simulator` and the three enable and disable blocks for the resource estimation) and the `Export Circuits to MLIR` block itself.
  A skipped block leaves a comment `// skipped: <opcode>` in the file.
  Quantum reporters in the inputs of a skipped block are still translated; see [Measurement](#measurement).

Unsupported blocks
: Every other block is an error.
  This includes lists, custom blocks, broadcasts, `forever`, `repeat until`, `wait until`, string operators, and the blocks that run circuits or estimate resources (`Run Quantum Circuits` and `Perform Quantum Resource Estimation`).

## Errors

The export stops at the first problem and downloads nothing.
It shows the reason in an alert that names the sprite, for example:

```text
MLIR export failed in sprite "Sprite1": The block 'data_addtolist' can't be exported to MLIR.
```

The alert always appears first.
If the failing block belongs to the sprite that you are editing, the editor also shows the reason in a bubble on the block.
The bubble is only possible for blocks of the sprite you are editing, so for an error in another sprite, you only see the alert.
The browser console shows the message together with the ID of the block.
Other messages that you may see are "Qubit index 3 is out of range: register 'q' has 3 qubits (0-2)." and "Registers must be created outside of 'repeat', 'if' and 'controlled on'."

If something unexpected goes wrong, the alert says that the export failed with an internal error and asks you to look at the console, which shows the details.
When the export succeeds, the alert reads "Exported circuits to quantum_circuits.mlir".

## Limitations

- The initial value of a variable is its value when the export block runs.
  If circuits ran before the export, a variable that a circuit only changes with `change by` and never sets starts from its value after the run.
  To avoid this, set the variables at the top of the circuit.
- A measurement result that a variable carries out of a `repeat` loop and an `if` block then uses is valid in `qc` and `qco`.
  `mqt-cc --emit=qir-adaptive` currently fails on it, which is an issue of the lowering in `mqt-cc`, not of the export.
- You cannot measure several qubits in a place that needs one value, for example in a condition or in `set [v] to <measure …>`.
  This means that the circuit of the {doc}`quickstart`, which stores the measurement of both qubits in a variable, cannot be exported as it is.
  Measure single qubits or move the measurement into a skipped block.
- You cannot compare measurement results with `=`, for example `<(m) = (1)>`.
  Setting a variable to a number before storing a measurement in the same variable is not supported either; the export reports that the variable is used for both numbers and measurement results.
- Qubit indices that depend on variables are not checked against the size of the register.
- Error messages name the blocks by their internal names, such as `data_addtolist`, and not by the text they show in the editor.
- `forever`, `repeat until`, custom blocks, and lists are not supported, and the export does not write source locations into the file.

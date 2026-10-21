# Export Circuits to MLIR — Design

Date: 2026-10-21
Status: Draft (awaiting review)

## Goal

The `Export Circuits to MLIR` block of the quantum extension (`src/extensions/mqt_quantum`) exports the
**circuit script it is placed in** to the MQT `qc` MLIR dialect and downloads it as a `.mlir` file that can be fed
directly into `mqt-cc`.

The translation is **static**: the block tree below the script's `Quantum Circuit` hat is translated structurally
(`repeat` → `scf.for`, `if` → `scf.if`, variables → SSA values), not traced from a simulation run.

## Reference: target dialect

Validated against `mqt-cc` built from `~/01_research/core` (`cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc`).
All constructs below parse with `--emit=qc` and lower through `--emit=qco-optimized` and `--emit=qir-adaptive`.

```mlir
module {
  func.func @main() attributes {mqt.entry_point} {
    %q = memref.alloc() {mqt.register_name = "q"} : memref<3x!qc.qubit>
    %c0 = arith.constant 0 : index
    %c1 = arith.constant 1 : index
    %0 = memref.load %q[%c0] : memref<3x!qc.qubit>
    %1 = memref.load %q[%c1] : memref<3x!qc.qubit>
    qc.h %0 : !qc.qubit
    qc.ctrl(%0) targets (%arg0 = %1) {
      qc.x %arg0 : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %m = qc.measure %0 : !qc.qubit -> i1
    scf.if %m { qc.x %1 : !qc.qubit }
    memref.dealloc %q : memref<3x!qc.qubit>
    return
  }
}
```

Dialect facts that shape the design:

- `qc.ctrl` bodies may only contain unitary ops and memory-effect-free classical ops without regions — no
  `memref.load`, no `scf.*`. Qubits used in the body must be passed via `targets`.
- There are no native negative controls; mqt-cc's own OpenQASM importer uses `qc.x` sandwiches.
- Unknown attributes in the `mqt.` namespace are rejected by the verifier.
- `memref.alloca` slots for classical values are **not** promoted by the pipeline and block QIR lowering, so classical
  variables must be emitted as pure SSA values.

## Architecture

```
[Export Circuits to MLIR] block executes
  └─ index.js  toMLIR(args, util)
       ├─ hat    = util.thread.topBlock
       ├─ blocks = util.thread.target.blocks
       ├─ mlir   = exportToMLIR(blocks, hat, variableLookup)    ← exporter.js (pure, no DOM)
       └─ downloadTextFile(`${spriteName}_circuit.mlir`, mlir)  ← download.js
```

Units (all in `src/extensions/mqt_quantum/`):

| File | Responsibility | Depends on |
|---|---|---|
| `mlir-emitter.js` | IR text builder: fresh SSA names, indentation of nested regions, constant helpers (`constIndex`, `constF64`, `constBool`), `loadQubit(reg, idx)`, raw `op(text)` emission, region open/close. Knows nothing about Scratch. | — |
| `qubit-expression.js` | `AST`, `AndNode`, `NegatedNode`, `LeafNode` moved verbatim out of `index.js` so simulator blocks and exporter share one parser for literal qubit strings like `q[0] and not q[1]`. | — |
| `exporter.js` | Walks the Scratch block tree and drives the emitter. Contains the expression evaluator (reporters → typed SSA value or static qubit set) and the statement translator (stack blocks → ops). Exports `exportToMLIR` and `MLIRExportError`. | `mlir-emitter.js`, `qubit-expression.js` |
| `download.js` | `downloadTextFile(name, text)`: Blob + `<a download>` click. No-op when `document` is undefined (Node tests). | DOM |
| `index.js` | `toMLIR` wires the above together and handles errors (see below). Imports the AST classes from `qubit-expression.js`. | all of the above |

The current draft `exporter.js` and `_traverseThread` in `index.js` are replaced.

Semantics: the **whole script** under the hat is exported regardless of where the export block sits; the export block
itself is skipped. The script still executes normally when run (the export does not depend on that execution).

Output header: `// Exported from Scratch sprite "<name>" by the MQT quantum extension` followed by the module.

## Translation rules

### Values

The evaluator produces one of:

- **Constant**: a JS number/boolean known at export time (enables folding and bounds checks).
- **SSA value** typed `f64`, `i1` or `index`.
- **Qubit set**: list of `{register, index, negated}` where `index` is a constant or an `index`-typed SSA value.

Constants are materialized (`arith.constant`) only when an SSA operand is required.

### Registers

`create quantum register [NAME] with [NUM] qubits` →
`%<name> = memref.alloc() {mqt.register_name = "<NAME>"} : memref<NUMx!qc.qubit>`.

- `NAME` must be a literal valid register name (existing `validateRegisterName` rules).
- `NUM` must evaluate to a constant integer ≥ 1 (static memref size).
- Only allowed at the top level of the script (not in `repeat`, `if`, `controlled on`). Duplicate names are errors.
- Every register gets `memref.dealloc` before `return`, in reverse creation order.

### Qubit expressions

| Reporter | Qubit set |
|---|---|
| `qubit [i] of register [NAME]` | one qubit. Constant `i` → bounds-checked constant index. Dynamic `i` → `arith.fptosi` (`f64`→`i64`) + `arith.index_cast` (truncation, matching the simulator's `parseInt`); not bounds-checked. |
| `qubits of register [NAME]` | all qubits of the register |
| `[A] and [B]` | concatenation |
| `negated control [Q]` | flips `negated` on every element |
| literal text | parsed with `AST.parse` from `qubit-expression.js` |

`NAME` must refer to a register created earlier in the script. Every use of a qubit emits a fresh `memref.load`
immediately before the op (same pattern as mqt-cc's importer). A `negated` qubit in a target position is an error.

### Gates

Gates broadcast over the target set: one op per target qubit.

| Block | Emitted op |
|---|---|
| `apply [X/Y/Z/H/S/T] gate to [Q]` | `qc.x` / `qc.y` / `qc.z` / `qc.h` / `qc.s` / `qc.t` |
| `apply SWAP gate to [Q1] and [Q2]` | `qc.swap %a, %b : !qc.qubit, !qc.qubit` (each input must be exactly one qubit) |
| `rotate [Q] by [ANGLE] degrees around [AXIS] axis` | `qc.rx` / `qc.ry` / `qc.rz` `(%rad)` |
| `apply U3 gate to [Q] with angles [θ] [φ] [λ]` | `qc.u(%θ, %φ, %λ)` |

- `GATE` and `AXIS` menus must evaluate to literal values.
- Angles are in degrees: constants are converted to radians in JS; dynamic angles get `arith.mulf` with the constant
  π/180.

### `controlled on [Q]`

The translator keeps a control stack (as the simulator does). Each gate inside the body (at any nesting depth,
including inside `repeat`/`if`) is emitted as its own

```mlir
qc.x %neg : !qc.qubit                              // once per negative control
qc.ctrl(%c0, %c1, %neg) targets (%arg0 = %t) {
  qc.<gate> %arg0 : !qc.qubit
  qc.yield
} : {!qc.qubit, !qc.qubit, !qc.qubit}, {!qc.qubit}
qc.x %neg : !qc.qubit
```

with all positive and negative controls of the stack flattened into one `qc.ctrl`. Rationale: one `qc.ctrl` per
`controlled on` block cannot hold `repeat`, `if` or dynamic qubit loads; per-gate wrapping is always valid and matches
simulator semantics exactly. Merging is left to mqt-cc's optimizer.

Errors: `measure` inside `controlled on`; a qubit that is both control and target (detected when all involved indices
are constants; dynamic overlaps are left to the MLIR verifier).

### Measurement

`measure [Q]` → `%m = qc.measure %q : !qc.qubit -> i1` per qubit in the set. Allowed uses:

- **Condition** of `if` / `if-else` (or operand of `not`/`and`/`or` there): single qubit only, result used directly.
- **`set [var] to (measure [Q])`**: single qubit only; the variable becomes `i1`.
- **Input of a skipped block** (e.g. `say (measure q[0])`): measurement ops are emitted for every qubit, results
  discarded.

Measuring more than one qubit in a value position (condition or variable) is an error.

### Control flow

- `repeat [N]` → `scf.for %iv = %c0 to %n step %c1` (with `iter_args` for loop-carried variables, see below).
  Constant `N` is rounded with `Math.round` like Scratch and must be ≥ 0; dynamic `N` is converted via
  `arith.fptosi` + `arith.index_cast` (truncation).
- `if <C> then` → `scf.if %c { … }`; `if <C> then … else …` → `scf.if %c { … } else { … }`.
- Conditions must evaluate to `i1`: `measure`, a boolean variable, `not` (`arith.xori` with `true`), `and`
  (`arith.andi`), `or` (`arith.ori`), or numeric comparisons `<` / `>` / `=` (`arith.cmpf olt` / `ogt` / `oeq`).
- Constant conditions are still emitted as `scf.if` on an `arith.constant` (no dead-branch elimination; mqt-cc
  canonicalizes it).

### Variables

Scratch variables (`data_variable`, `data_setvariableto`, `data_changevariableby`) are translated to SSA values.

1. **Type pre-pass**: scan the script; a variable assigned a numeric expression is `f64`, one assigned a boolean
   expression or a measurement is `i1`. Conflicting assignments are an error. `change by` implies `f64`. Variables
   only read get the type implied by their current value (`true`/`false` → `i1`, otherwise `f64`).
2. **Initial value**: each variable starts as a constant equal to its current Scratch value at export time, cast to
   its type (non-numeric strings for `f64` variables are an error). This lets a flag script set parameters (e.g. an
   angle) that the circuit reads.
3. **Assignment** rebinds the variable in the translator's environment (`set` → new value; `change by` → `arith.addf`).
4. **Loops**: variables assigned anywhere inside a `repeat` body become `iter_args` of the `scf.for`, initialized
   with their value before the loop; the body ends with `scf.yield` of their final values; after the loop the
   environment is rebound to the `scf.for` results.
5. **Branches**: variables assigned in either branch of an `if` become results of the `scf.if`
   (`scf.if %c -> (f64, …)`), each branch yielding its final value (or the unchanged incoming value). An `if` without
   `else` that assigns variables gets an `else` region that yields the incoming values.

Constant propagation: while a variable holds a constant (not yet merged by a loop/branch), reads produce that constant,
so e.g. `qubit (i + 1) of register q` stays static and bounds-checked.

### Number operators

`+` / `−` / `×` / `÷` → `arith.addf` / `subf` / `mulf` / `divf` on `f64`; folded in JS when both operands are
constants. Number literals are `f64` constants.

### Other blocks

- **Skipped** (emit `// skipped: <opcode>`; quantum reporters in their inputs are still translated): `looks_*`,
  `motion_*`, `sound_*`, `pen_*`, `control_wait`, and the extension's own `toMLIR`, `setSimulator`,
  `enableDisable*` blocks.
- **Error**: everything else, including lists, custom blocks (`procedures_*`), broadcasts, `forever`, `repeat until`,
  `wait until`, string operators, and the extension's `runCircuits*` / `estimateCircuitsResources` blocks.

## Error handling

The exporter stops at the first problem and throws `MLIRExportError { message, blockId }` with a student-facing
message, for example:

- "Qubit index 3 is out of range — register 'q' has 3 qubits (0–2)."
- "The block 'add to list' can't be exported to MLIR."
- "Registers must be created outside of 'repeat', 'if' and 'controlled on'."

`toMLIR` catches it and:

1. shows the message as a report bubble on the offending block via `runtime.visualReport(blockId, message)`;
2. shows it in an `alert()`;
3. logs it with the block id via `console.error`;
4. does not download anything.

Any other exception is treated as an internal error: generic alert ("MLIR export failed (internal error) — see
console") plus the stack trace in the console. The Scratch thread never crashes because of the exporter.

On success the file is downloaded and the alert reads "Exported circuit to `<sprite>_circuit.mlir`".

## Testing

Using the existing `tap` setup.

1. **Unit tests** — `test/unit/extension_quantum_mlir.js`: build block containers programmatically (`Blocks.createBlock`)
   and test each rule: every gate, broadcasting, positive/negative/nested controls, `repeat` with a loop-carried
   variable, `if`/`else` on measurement, operator folding, `i1`/`f64` variable typing, skipped blocks, and every error
   case (asserting message and `blockId`). Assertions match golden line snippets rather than whole files, so SSA
   renumbering does not cause brittleness. Emitter unit tests cover naming and region indentation.
2. **Integration test** — `test/integration/quantum_mlir_export.js`: load `exercises-2/02`–`05` `.sb3` projects (copied
   to `test/fixtures/quantum/`) into a VM, export every `Quantum Circuit` script, and compare against snapshots.
3. **Dialect validation** — if the `MQT_CC` environment variable points to an `mqt-cc` binary, the integration test
   runs each exported file through `mqt-cc --emit=qco-optimized` and `--emit=qir-adaptive` and requires exit code 0.
   Without `MQT_CC` the check is skipped with a note.
4. **Manual smoke test** — build scratch-gui, place the export block into each exercise circuit, verify the download
   and the error bubble on a deliberately unsupported block.

## Out of scope

- `forever`, `repeat until`, custom blocks, lists, multi-qubit measurement values.
- Exporting all circuits of a project at once.
- Merging consecutive controlled gates into larger `qc.ctrl` regions.
- Source locations / debug info in the emitted IR.
- Fixing unrelated simulator issues.

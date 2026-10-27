# Export Circuits to MLIR — Design

Date: 2026-10-21 (revised 2026-10-21: project-wide export)
Status: Implemented (project-wide export); manual GUI smoke test pending

## Goal

The `Export Circuits to MLIR` command block of the quantum extension (`src/extensions/mqt_quantum`) exports **every
`Quantum Circuit` script of the project** to one MQT `qc` MLIR module and downloads it as `quantum_circuits.mlir`, a
file that can be fed directly into `mqt-cc`. The block is used like `Run Quantum Circuits` (e.g. under "when green flag
clicked", or clicked on its own); it does not belong inside a circuit script.

The translation is **static**: the block tree below the script's `Quantum Circuit` hat is translated structurally
(`repeat` → `scf.for`, `if` → `scf.if`, variables → SSA values), not traced from a simulation run.

## Reference: target dialect

Validated against `mqt-cc` built from `~/01_research/core`
(`.claude/worktrees/lucid-davinci-63efad/build/llvm23-release/mlir/tools/mqt-cc/mqt-cc`; this build enforces the
entry-point allocation rule described under [Module shape](#module-shape)).
All constructs below parse with `--emit=qc` and lower through `--emit=qco-optimized`. They also lower through
`--emit=qir-adaptive`, with one exception (see [Known limitations](#known-limitations)).

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
       ├─ circuits = _collectCircuits()            ← every 'Quantum Circuit' hat via runtime.allScriptsByOpcodeDo
       │                                             (original targets only), as {blocks, hatId, spriteName, lookupVariable}
       ├─ mlir     = exportProjectToMLIR(circuits) ← exporter.js (pure, no DOM)
       └─ downloadTextFile('quantum_circuits.mlir', mlir) ← download.js
```

Units (all in `src/extensions/mqt_quantum/`):

| File | Responsibility | Depends on |
|---|---|---|
| `mlir-emitter.js` | IR text builder: fresh SSA names, indentation of nested regions, constant helpers (`constIndex`, `constF64`, `constBool`), region open/close; `toFunction(signature, comment)` wraps the body into a `func.func`, `buildModule(header, functions)` assembles the module. Knows nothing about Scratch. | — |
| `qubit-expression.js` | `AST`, `AndNode`, `NegatedNode`, `LeafNode` moved verbatim out of `index.js` so simulator blocks and exporter share one parser for literal qubit strings like `q[0] and not q[1]`. | — |
| `exporter.js` | Walks the Scratch block tree and drives the emitter. Contains the expression evaluator (reporters → typed SSA value or static qubit set) and the statement translator (stack blocks → ops). Exports `exportProjectToMLIR` (all circuits), `exportToMLIR` (one circuit) and `MLIRExportError`. | `mlir-emitter.js`, `qubit-expression.js` |
| `download.js` | `downloadTextFile(name, text)`: Blob + `<a download>` click. No-op when `document` is undefined (Node tests). | DOM |
| `index.js` | `toMLIR` wires the above together and handles errors (see below). Imports the AST classes from `qubit-expression.js`. | all of the above |

### Module shape

Circuits are collected in the order `Run Quantum Circuits` starts them; clones are skipped. `@circuit_<k>` matches
the resource estimator's "Circuit #k" only when there are no clones and no circuit script is already running
(`startHats` also starts clones and skips scripts that are running). The module starts with
`// Exported from Scratch by the MQT quantum extension`, and every circuit function is preceded by
`// 'Quantum Circuit' script of sprite "<name>"`. Line breaks in the sprite name are replaced with a space so the comment stays
on one line.

- **One circuit:** its translation is the body of `func.func @main() attributes {mqt.entry_point}`.
- **Several circuits:** each becomes `func.func private @circuit_<k>(...)` (k = 1, 2, …) that takes its registers as
  arguments. The MQT dialects require dynamic qubit allocations to be in the entry block of the `mqt.entry_point`
  function, and helper functions to receive quantum resources as arguments, so only `@main` allocates:

  ```mlir
  func.func private @circuit_1(%q: memref<2x!qc.qubit>) {
    ...
    return
  }
  func.func @main() attributes {mqt.entry_point} {
    %circuit_1_q = memref.alloc() {mqt.register_name = "circuit_1_q"} : memref<2x!qc.qubit>
    func.call @circuit_1(%circuit_1_q) : (memref<2x!qc.qubit>) -> ()
    memref.dealloc %circuit_1_q : memref<2x!qc.qubit>
    ...
    return
  }
  ```

  - Helper signature: one argument per register in creation order, named by the register's SSA name (`%q`), typed
    `memref<Nx!qc.qubit>`. A circuit without registers gets `@circuit_<k>()` and `func.call @circuit_<k>() : () -> ()`.
    Helpers neither allocate nor deallocate.
  - `@main` handles the circuits in order: allocate that circuit's registers in creation order, call, then deallocate
    them in reverse creation order. mqt-cc's QIR lowering requires register names to be unique in the program, so the
    `mqt.register_name` (and the SSA name in `@main`) of register `q` in circuit k is `circuit_<k>_q`.
- **No circuits:** `MLIRExportError` without a block; `toMLIR` shows it on the export block itself.

An export block inside a circuit script is skipped in the translation (`// skipped: quantum_toMLIR`) like other
side-effect-only blocks, but it still runs at runtime: `Run Quantum Circuits` would then export once per such circuit.
Use the export block outside circuit scripts.

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
- Every register gets `memref.dealloc` before `return`, in reverse creation order. With several circuits, allocation
  and deallocation move to `@main` (see [Module shape](#module-shape)).

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
  Constant `N` is rounded with `Math.round` like Scratch and a negative `N` is clamped to 0 (Scratch semantics); dynamic `N` is converted via
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

1. logs it with the block id via `console.error`;
2. shows it in an `alert()` (always, before the bubble);
3. shows it as a report bubble on the offending block via `runtime.visualReport(blockId, message)` — best effort: the
   GUI can only show it for blocks of the sprite being edited and throws otherwise, so this call is wrapped in its own
   `try`/`catch` (the error is logged, never rethrown — an escaping exception would re-run the block every frame and
   freeze the stage);
4. does not download anything.

The error carries the failing circuit's `spriteName`; the alert reads "MLIR export failed in sprite "<name>": …"
because the bubble is only visible when that sprite is being edited. An error without a block (no circuits) is shown on
the export block (`util.thread.peekStack()`).

Any other exception is treated as an internal error: generic alert ("MLIR export failed (internal error) — see
console") plus the stack trace in the console. The Scratch thread never crashes because of the exporter.

On success the file is downloaded and the alert reads "Exported circuits to quantum_circuits.mlir".

## Testing

Using the existing `tap` setup.

1. **Unit tests** — split into `test/unit/extension_quantum_mlir_*.js` (gates, controls, control flow, variables,
   parameters, emitter, project, block); scripts are built with the `ScriptBuilder` fixture. They test each rule: every gate, broadcasting, positive/negative/nested controls, `repeat` with a loop-carried
   variable, `if`/`else` on measurement, operator folding, `i1`/`f64` variable typing, skipped blocks, and every error
   case (asserting message and `blockId`). Assertions match golden line snippets rather than whole files, so SSA
   renumbering does not cause brittleness. Emitter unit tests cover naming and region indentation.
2. **Integration test** — `test/integration/quantum_mlir_export.js`: load `exercises-2/02`–`05` `.sb3` projects (copied
   to `test/fixtures/quantum/`) into a VM, run the export block once per project (03 and 05 contain two circuits each,
   covering the multi-function shape), and compare the downloaded module against a snapshot.
3. **Dialect validation** — if the `MQT_CC` environment variable points to an `mqt-cc` binary, the integration test
   runs each exported file through `mqt-cc --emit=qco-optimized` and `--emit=qir-adaptive` and requires exit code 0.
   Without `MQT_CC` the check is skipped with a note.
4. **Manual smoke test** — build scratch-gui, run the export block from a flag script in each exercise, verify the
   download and the error bubble on a deliberately unsupported block. Also: put the flag + export script on the Stage,
   break a circuit in Sprite2 while editing Sprite1 — expect an alert, no freeze, no download.

## Known limitations

- Initial variable values are the variables' values when the export block runs. If circuits ran before the export, a
  variable that a circuit only `change`s (never `set`s) starts from its post-run value. Recommendation: `set`
  variables at the top of the circuit.
- An `i1` variable (measurement result) carried out of an `scf.for` and then used by an `scf.if` is valid `qc`/`qco`,
  but `mqt-cc --emit=qir-adaptive` currently fails on it (`ub.poison`, an mqt-cc lowering issue).
- Comparing measurement results with `=` (e.g. `<(m) = 1>`) and initialising a variable with a number before storing a
  measurement in it are not supported (type error).
- Error messages name blocks by opcode (e.g. `data_addtolist`) rather than by their display text.

## Out of scope

- `forever`, `repeat until`, custom blocks, lists, multi-qubit measurement values.
- Merging consecutive controlled gates into larger `qc.ctrl` regions.
- Source locations / debug info in the emitted IR.
- Fixing unrelated simulator issues.

# Export Circuits to MLIR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `Export Circuits to MLIR` block statically translate the `Quantum Circuit` script it sits in into the MQT `qc` MLIR dialect and download it as `<sprite>_circuit.mlir`.

**Architecture:** A pure `exporter.js` walks the Scratch block tree from the script's hat and drives a small text builder (`mlir-emitter.js`). Handlers are found by opcode (`stmt_<opcode>`, `num_<opcode>`, `bool_<opcode>`, `qubits_<opcode>`). Scratch variables become SSA values threaded through `scf.for` `iter_args` and `scf.if` results. `index.js` wires the block to the exporter, a browser download helper, and error reporting.

**Tech Stack:** JavaScript (scratch-vm, CommonJS for new files), `tap` 16 tests, ESLint (`eslint-config-scratch`), `mqt-cc` for dialect validation.

**Spec:** `docs/superpowers/specs/2026-10-21-mlir-export-design.md`

## Global Constraints

- All work happens in `/home/damian/01_research/scratch-quantum/scratch-vm` on branch `feat/mlir-export`.
- The working tree contains the user's uncommitted draft: `src/extensions/mqt_quantum/index.js` (modified `toMLIR`, new `_traverseThread`) and the untracked `src/extensions/mqt_quantum/exporter.js`. The spec supersedes both. Task 3 overwrites `exporter.js`, and Task 8 replaces `toMLIR` and `_traverseThread`. Do not stage the draft changes to `index.js` before Task 8 replaces them; stage only the hunks each task names.
- New files use CommonJS (`require` / `module.exports`). Existing ES-module files (`simulator.js`, `statevector-simulator.js`, `resource-estimator.js`, `utils.js`, `complex-math.js`) stay ES modules.
- Every new or edited file except the code moved verbatim in Task 1 must pass `npx eslint <file>` (4-space indent, max line length 120, `func-style: expression`, JSDoc must be valid when present).
- Run tests with `npx tap --no-coverage <files>`. With coverage on, the coverage thresholds in `package.json` fail single-file runs.
- Validate with mqt-cc by setting `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc`. Without `MQT_CC`, the validation assertions are skipped.
- Known mqt-cc limitation: an `i1` carried out of an `scf.for` and then used by an `scf.if` fails `--emit=qir-adaptive` (`ub.poison`). Tests for that case validate only `--emit=qco-optimized`.
- Error messages are student-facing English sentences, and every `MLIRExportError` carries the id of the offending block.
- Commit messages follow the repo's gitmoji style (`feat: :sparkles: …`, `test: :white_check_mark: …`, `refactor: :recycle: …`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `src/extensions/mqt_quantum/qubit-expression.js` (create) | `AST`/`AndNode`/`NegatedNode`/`LeafNode` and register/index validation, moved verbatim from `index.js` |
| `src/extensions/mqt_quantum/mlir-emitter.js` (create) | MLIR text builder: SSA names, nested regions, constants, module wrapper |
| `src/extensions/mqt_quantum/exporter.js` (replace draft) | Scratch block tree to `qc` module; `exportToMLIR`, `MLIRExportError` |
| `src/extensions/mqt_quantum/download.js` (create) | Browser file download (no-op in Node) |
| `src/extensions/mqt_quantum/index.js` (modify) | Import moved parser; `toMLIR` wiring and error reporting |
| `src/extensions/mqt_quantum/{statevector-simulator,resource-estimator}.js` (modify) | Add `.js` to relative imports so Node can load the extension |
| `test/fixtures/quantum/script-builder.js` (create) | Builds block containers in the VM runtime format for tests |
| `test/fixtures/quantum/mlir-helpers.js` (create) | `exportScript`, `expectLines`, `expectExportError`, `validateWithMqtCc` |
| `test/fixtures/quantum/0{2,3,4,5}-*.sb3` (copy) | Exercise projects for the integration test |
| `test/unit/extension_quantum_*.js` (create) | Unit tests, one file per task |
| `test/integration/quantum_mlir_export.js` (create) | Exports all exercise circuits; snapshots and mqt-cc validation |

---

### Task 1: Shared qubit-expression module, loadable in Node

**Files:**
- Create: `src/extensions/mqt_quantum/qubit-expression.js`
- Modify: `src/extensions/mqt_quantum/index.js` (top of file, from `const error = function` through the end of `AST.parse`)
- Modify: `src/extensions/mqt_quantum/statevector-simulator.js:1-3`, `src/extensions/mqt_quantum/resource-estimator.js:1-2`
- Test: `test/unit/extension_quantum_qubit_expression.js`

**Interfaces:**
- Produces: `require('./qubit-expression')` exports `{AST, AndNode, NegatedNode, LeafNode, validateRegisterName, validateQubitIndex}`, unchanged behavior. `AST.parse(text).getPositiveNegative()` returns `[positiveLeaves, negativeLeaves]`; each leaf has `.register` (string) and `.index` (number, or `undefined` if invalid).

- [ ] **Step 1: Write the failing test**

Create `test/unit/extension_quantum_qubit_expression.js`:

```js
const test = require('tap').test;
const {AST} = require('../../src/extensions/mqt_quantum/qubit-expression');
const QuantumExtension = require('../../src/extensions/mqt_quantum/index.js');

test('qubit expressions split into positive and negated register accesses', t => {
    const [positive, negative] = AST.parse('q[0] and not r[2]').getPositiveNegative();
    t.same(positive.map(leaf => [leaf.register, leaf.index]), [['q', 0]]);
    t.same(negative.map(leaf => [leaf.register, leaf.index]), [['r', 2]]);
    t.end();
});

test('the quantum extension loads in Node', t => {
    t.equal(new QuantumExtension(null).getInfo().id, 'quantum');
    t.end();
});

test('the quantum extension still creates per-thread circuit state', t => {
    const extension = new QuantumExtension(null);
    t.ok(extension.getCurrentExecutionInformation({thread: {}}).simulationState);
    t.end();
});
```

The third test guards against accidentally moving `CircuitExecutionInformation` out of `index.js`. That mistake breaks running circuits, and the other tests don't notice it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tap --no-coverage test/unit/extension_quantum_qubit_expression.js`
Expected: FAIL with `Cannot find module '../../src/extensions/mqt_quantum/qubit-expression'`.

- [ ] **Step 3: Move the parser into `qubit-expression.js`**

Create `src/extensions/mqt_quantum/qubit-expression.js` by **moving** these top-level definitions from `src/extensions/mqt_quantum/index.js`, verbatim and in their current order:
- `const error = function (message) { … };`
- `const validateRegisterName = …`
- `const validateQubitIndex = …`
- `class AST`, `class AndNode`, `class NegatedNode`, `class LeafNode`
- `AST.parse = function (s) { … };`

**Do not move** the `TODOS` comment or `class CircuitExecutionInformation`; they stay in `index.js`. The moved code keeps its two pre-existing lint findings. End the new file with:

```js
module.exports = {
    AST,
    AndNode,
    NegatedNode,
    LeafNode,
    validateRegisterName,
    validateQubitIndex
};
```

In `index.js`, directly after the existing `require('./resource-estimator')` line, add:

```js
const {AST, LeafNode, NegatedNode, AndNode, validateRegisterName, validateQubitIndex} =
    require('./qubit-expression');

const error = function (message) {
    console.error(message);
};
```

`index.js` still uses `error` (for example in `createRegister`), so it keeps its own copy. The top of `index.js` should now read: requires, the `qubit-expression` import, `error`, the `TODOS` comment, `CircuitExecutionInformation`, then `const ResourceType = {`.

- [ ] **Step 4: Make the ES-module imports resolvable in Node**

Node's ES-module loader requires file extensions. In `src/extensions/mqt_quantum/statevector-simulator.js` change lines 1-3 to:

```js
import {Simulator} from './simulator.js';
import {Register, targetAccess, error} from './utils.js';
import {Vector, Matrix, Complex} from './complex-math.js';
```

In `src/extensions/mqt_quantum/resource-estimator.js` change lines 1-2 to:

```js
import {Simulator} from './simulator.js';
import {Register, targetAccess} from './utils.js';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx tap --no-coverage test/unit/extension_quantum_qubit_expression.js`
Expected: PASS (3 subtests).

- [ ] **Step 6: Commit**

`index.js` also contains the user's draft `toMLIR` changes. Stage only this task's hunks with `git add -p src/extensions/mqt_quantum/index.js`, selecting the hunks that remove the parser and add the `qubit-expression` import. Leave the `toMLIR` / `_traverseThread` hunks unstaged.

```bash
git add src/extensions/mqt_quantum/qubit-expression.js src/extensions/mqt_quantum/statevector-simulator.js src/extensions/mqt_quantum/resource-estimator.js test/unit/extension_quantum_qubit_expression.js
git commit -m "refactor: :recycle: move qubit expression parser into its own module

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: MLIR emitter

**Files:**
- Create: `src/extensions/mqt_quantum/mlir-emitter.js`
- Test: `test/unit/extension_quantum_mlir_emitter.js`

**Interfaces:**
- Produces: `const {MLIREmitter, formatF64} = require('./mlir-emitter')`.
  - `formatF64(number) → string`: MLIR float literal; throws for non-finite values.
  - `new MLIREmitter()` with methods:
    - `fresh(base?) → '%name'`: unique name; numbered `%0`, `%1`, … when `base` is omitted.
    - `line(text)`, `comment(text)`, `open(text)` (emits `text {`), `reopen(text)` (emits `} text {`), `close(suffix = '')` (emits `}suffix`).
    - `constIndex(n) → name`, `constF64(x) → name`, `constBool(b) → name`.
    - `toModule(header) → string`: wraps everything in `module { func.func @main() attributes {mqt.entry_point} { … return } }` with a leading `// header` line.

- [ ] **Step 1: Write the failing test**

Create `test/unit/extension_quantum_mlir_emitter.js`:

```js
const test = require('tap').test;
const {MLIREmitter, formatF64} = require('../../src/extensions/mqt_quantum/mlir-emitter');

test('formatF64 always produces an MLIR float literal', t => {
    t.equal(formatF64(1), '1.0');
    t.equal(formatF64(-0.5), '-0.5');
    t.equal(formatF64(1e-7), '1.0e-7');
    t.equal(formatF64(1e21), '1.0e+21');
    t.throws(() => formatF64(Infinity));
    t.end();
});

test('fresh names are unique', t => {
    const emitter = new MLIREmitter();
    t.equal(emitter.fresh('q'), '%q');
    t.equal(emitter.fresh('q'), '%q_1');
    t.equal(emitter.fresh(), '%0');
    t.equal(emitter.fresh(), '%1');
    t.equal(emitter.constIndex(0), '%c0');
    t.equal(emitter.constIndex(0), '%c0_1');
    t.end();
});

test('constants and nested regions are emitted into a module', t => {
    const emitter = new MLIREmitter();
    emitter.constF64(0.5);
    const condition = emitter.constBool(true);
    emitter.open(`scf.if ${condition}`);
    emitter.line('qc.x %q : !qc.qubit');
    emitter.reopen('else');
    emitter.comment('nothing');
    emitter.close();
    t.equal(emitter.toModule('header'), [
        '// header',
        'module {',
        '  func.func @main() attributes {mqt.entry_point} {',
        '    %cst = arith.constant 0.5 : f64',
        '    %true = arith.constant true',
        '    scf.if %true {',
        '      qc.x %q : !qc.qubit',
        '    } else {',
        '      // nothing',
        '    }',
        '    return',
        '  }',
        '}',
        ''
    ].join('\n'));
    t.end();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_emitter.js`
Expected: FAIL with `Cannot find module '../../src/extensions/mqt_quantum/mlir-emitter'`.

- [ ] **Step 3: Implement the emitter**

Create `src/extensions/mqt_quantum/mlir-emitter.js`:

```js
/**
 * Format a JS number as an MLIR f64 literal. MLIR float literals need a decimal point,
 * so `1` becomes `1.0` and `1e-7` becomes `1.0e-7`.
 * @param {number} value The number to format.
 * @return {string} The MLIR literal.
 */
const formatF64 = function (value) {
    if (!Number.isFinite(value)) {
        throw new Error(`Cannot emit the non-finite f64 constant ${value}`);
    }
    const text = String(value);
    if (text.includes('.')) {
        return text;
    }
    if (text.includes('e')) {
        return text.replace('e', '.0e');
    }
    return `${text}.0`;
};

/**
 * Builds the text of an MLIR `func.func @main` body: fresh SSA names, indentation of nested
 * regions and constants. Knows nothing about Scratch.
 */
class MLIREmitter {
    constructor () {
        this._lines = [];
        this._depth = 2;
        this._used = new Set();
        this._counter = 0;
    }

    /**
     * Reserve a fresh SSA name.
     * @param {string=} base Name hint (e.g. 'q' gives '%q', then '%q_1'); numbered ('%0', '%1') if omitted.
     * @return {string} The SSA name including the leading '%'.
     */
    fresh (base) {
        let name;
        if (base) {
            name = `%${base}`;
            for (let suffix = 1; this._used.has(name); suffix++) {
                name = `%${base}_${suffix}`;
            }
        } else {
            do {
                name = `%${this._counter++}`;
            } while (this._used.has(name));
        }
        this._used.add(name);
        return name;
    }

    line (text) {
        this._lines.push(`${'  '.repeat(this._depth)}${text}`);
    }

    comment (text) {
        this.line(`// ${text}`);
    }

    /**
     * Emit `<text> {` and indent the following lines.
     * @param {string} text The operation that owns the region.
     */
    open (text) {
        this.line(`${text} {`);
        this._depth++;
    }

    /**
     * Emit `} <text> {` (e.g. `} else {`) at the enclosing indentation.
     * @param {string} text Keyword between the two regions.
     */
    reopen (text) {
        this._depth--;
        this.line(`} ${text} {`);
        this._depth++;
    }

    /**
     * Emit `}<suffix>` and dedent.
     * @param {string=} suffix Text after the closing brace, e.g. the type list of qc.ctrl.
     */
    close (suffix = '') {
        this._depth--;
        this.line(`}${suffix}`);
    }

    constIndex (value) {
        const name = this.fresh(`c${value}`);
        this.line(`${name} = arith.constant ${value} : index`);
        return name;
    }

    constF64 (value) {
        const literal = formatF64(value);
        const name = this.fresh('cst');
        this.line(`${name} = arith.constant ${literal} : f64`);
        return name;
    }

    constBool (value) {
        const name = this.fresh(value ? 'true' : 'false');
        this.line(`${name} = arith.constant ${value}`);
        return name;
    }

    /**
     * Wrap the emitted lines into a module with a `@main` entry point.
     * @param {string} header Text of the leading comment line.
     * @return {string} The complete MLIR module.
     */
    toModule (header) {
        return [
            `// ${header}`,
            'module {',
            '  func.func @main() attributes {mqt.entry_point} {',
            ...this._lines,
            '    return',
            '  }',
            '}',
            ''
        ].join('\n');
    }
}

module.exports = {MLIREmitter, formatF64};
```

- [ ] **Step 4: Run the test and lint**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_emitter.js && npx eslint src/extensions/mqt_quantum/mlir-emitter.js test/unit/extension_quantum_mlir_emitter.js`
Expected: PASS (3 subtests), no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/mqt_quantum/mlir-emitter.js test/unit/extension_quantum_mlir_emitter.js
git commit -m "feat: :sparkles: add MLIR text emitter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Exporter core — registers, qubits, gates, measurement, skipped blocks

**Files:**
- Create (overwriting the untracked draft): `src/extensions/mqt_quantum/exporter.js`
- Create: `test/fixtures/quantum/script-builder.js`, `test/fixtures/quantum/mlir-helpers.js`
- Test: `test/unit/extension_quantum_mlir_gates.js`

**Interfaces:**
- Consumes: `MLIREmitter` (Task 2); `AST` (Task 1).
- Produces:
  - `const {exportToMLIR, MLIRExportError} = require('./exporter')`.
  - `exportToMLIR(blocks, hatId, {spriteName, lookupVariable}) → string`. `blocks` needs `getBlock(id)`. `lookupVariable(id)` returns `{name, value}` or `undefined`.
  - `MLIRExportError` has `.message`, `.blockId`, and `.name === 'MLIRExportError'`.
  - Internals that later tasks extend:
    - **Values:** `constant(type, value)` → `{type, constant}`; `isConstant(value)`.
    - **Qubit references:** `{register, index, negated, blockId}`, where `index` is a JS number (constant) or an `index`-typed SSA name.
    - **Registers:** `{name, size, ssa, type}`.
    - **Exporter fields:** `emit`, `registers`, `controlStack`, `depth`, `variables`, `variableTypes`.
    - **Dispatchers:** `statement(block)` dispatches to `this['stmt_' + opcode]`; `number(id)` to `num_*`; `qubits(id, allowEmpty)` to `qubits_*`.
    - **Helpers:** `gate(targets, render, block)` where `render(names) → op text`; `load(ref) → name`; `measure(block) → [i1 names]`; `toIndex(f64 value) → index name`; `f64(value) → name`.
  - Test fixtures:
    - `ScriptBuilder`: a block-id-returning DSL. Numbers passed where a block is expected become `math_number` shadows.
    - `mlir-helpers`: `exportScript(builder, hatId)`; `shape(mlir)`; `expectLines(t, mlir, lines)`, where `lines` uses `%_` for every SSA name and the lines must appear contiguously; `expectExportError(t, builder, hatId, messageSubstring, blockId)`; `validateWithMqtCc(t, mlir, emits = ['qco-optimized', 'qir-adaptive'])`.

- [ ] **Step 1: Create the test fixtures**

Create `test/fixtures/quantum/script-builder.js`:

```js
/**
 * Builds Scratch block containers in the VM's runtime format for exporter tests.
 * Methods return block ids. Wherever a block id is expected, a JS number is accepted
 * and turned into a `math_number` shadow.
 */
class ScriptBuilder {
    constructor () {
        this.blocks = {};
        this.variables = {};
        this._next = 0;
    }

    create (opcode, {inputs = {}, fields = {}, shadow = false} = {}) {
        const id = `b${this._next++}`;
        const block = {id, opcode, inputs: {}, fields: {}, next: null, parent: null, shadow, topLevel: false};
        for (const [name, field] of Object.entries(fields)) {
            block.fields[name] = Object.assign({name}, field);
        }
        for (const [name, value] of Object.entries(inputs)) {
            if (value === null) continue;
            const childId = typeof value === 'number' ? this.num(value) : value;
            const child = this.blocks[childId];
            child.parent = id;
            block.inputs[name] = {name, block: childId, shadow: child.shadow ? childId : null};
        }
        this.blocks[id] = block;
        return id;
    }

    num (value) {
        return this.create('math_number', {fields: {NUM: {value: String(value)}}, shadow: true});
    }

    text (value) {
        return this.create('text', {fields: {TEXT: {value}}, shadow: true});
    }

    menu (opcode, field, value) {
        return this.create(opcode, {fields: {[field]: {value}}, shadow: true});
    }

    stack (...ids) {
        for (let i = 0; i + 1 < ids.length; i++) {
            this.blocks[ids[i]].next = ids[i + 1];
            this.blocks[ids[i + 1]].parent = ids[i];
        }
        return ids.length > 0 ? ids[0] : null;
    }

    script (...statements) {
        const hat = this.create('quantum_quantumEvaluate');
        this.blocks[hat].topLevel = true;
        const first = this.stack(...statements);
        if (first) {
            this.blocks[hat].next = first;
            this.blocks[first].parent = hat;
        }
        return hat;
    }

    container () {
        return {getBlock: id => this.blocks[id]};
    }

    // ---- quantum blocks ----

    createRegister (name, size) {
        return this.create('quantum_createRegister', {inputs: {NAME: this.text(name), NUM: size}});
    }

    qubit (index, register = 'q') {
        return this.create('quantum_getQubit', {inputs: {QUBIT: index, NAME: this.text(register)}});
    }

    qubits (register = 'q') {
        return this.create('quantum_getQubits', {inputs: {NAME: this.text(register)}});
    }

    and (a, b) {
        return this.create('quantum_and', {inputs: {QUBIT1: a, QUBIT2: b}});
    }

    negated (qubit) {
        return this.create('quantum_negated', {inputs: {QUBIT: qubit}});
    }

    gate (name, qubit) {
        return this.create('quantum_applyGate', {
            inputs: {GATE: this.menu('quantum_menu_gates', 'gates', name), QUBIT: qubit}
        });
    }

    swap (a, b) {
        return this.create('quantum_swapGate', {inputs: {QUBIT1: a, QUBIT2: b}});
    }

    rotate (qubit, angle, axis) {
        return this.create('quantum_rotateAxis', {
            inputs: {QUBIT: qubit, ANGLE: angle, AXIS: this.menu('quantum_menu_axes', 'axes', axis)}
        });
    }

    u3 (qubit, theta, phi, lambda) {
        return this.create('quantum_u3', {inputs: {QUBIT: qubit, THETA: theta, PHI: phi, LAMBDA: lambda}});
    }

    measure (qubit) {
        return this.create('quantum_measure', {inputs: {QUBIT: qubit}});
    }

    controlled (qubit, ...body) {
        return this.create('quantum_controlled', {inputs: {QUBIT: qubit, SUBSTACK: this.stack(...body)}});
    }

    // ---- Scratch blocks ----

    repeat (times, ...body) {
        return this.create('control_repeat', {inputs: {TIMES: times, SUBSTACK: this.stack(...body)}});
    }

    if (condition, ...body) {
        return this.create('control_if', {inputs: {CONDITION: condition, SUBSTACK: this.stack(...body)}});
    }

    ifElse (condition, thenBody, elseBody) {
        return this.create('control_if_else', {inputs: {
            CONDITION: condition,
            SUBSTACK: this.stack(...thenBody),
            SUBSTACK2: this.stack(...elseBody)
        }});
    }

    variable (name, value) {
        const id = `var_${name}`;
        this.variables[id] = {id, name, value};
        return id;
    }

    getVar (id) {
        return this.create('data_variable', {fields: {VARIABLE: {value: this.variables[id].name, id}}});
    }

    setVar (id, value) {
        return this.create('data_setvariableto', {
            inputs: {VALUE: typeof value === 'number' ? this.text(String(value)) : value},
            fields: {VARIABLE: {value: this.variables[id].name, id}}
        });
    }

    changeVar (id, value) {
        return this.create('data_changevariableby', {
            inputs: {VALUE: value},
            fields: {VARIABLE: {value: this.variables[id].name, id}}
        });
    }

    arith (opcode, a, b) {
        return this.create(opcode, {inputs: {NUM1: a, NUM2: b}});
    }

    compare (opcode, a, b) {
        return this.create(opcode, {inputs: {OPERAND1: a, OPERAND2: b}});
    }

    not (operand) {
        return this.create('operator_not', {inputs: {OPERAND: operand}});
    }

    say (message) {
        return this.create('looks_say', {inputs: {MESSAGE: message}});
    }
}

module.exports = ScriptBuilder;
```

Create `test/fixtures/quantum/mlir-helpers.js`:

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const {exportToMLIR} = require('../../../src/extensions/mqt_quantum/exporter');

const exportScript = (builder, hatId) => exportToMLIR(builder.container(), hatId, {
    spriteName: 'Sprite1',
    lookupVariable: id => builder.variables[id]
});

// Trimmed, non-empty lines with every SSA name replaced by '%_', so assertions don't depend on numbering.
const shape = mlir => mlir.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('// Exported'))
    .map(line => line.replace(/%[A-Za-z0-9_]+/g, '%_'));

// Assert that `expected` appears as a contiguous run of lines in the shaped output.
const expectLines = (t, mlir, expected, message = 'contains the expected lines') => {
    const lines = shape(mlir);
    const found = lines.some((_, start) => expected.every((line, i) => lines[start + i] === line));
    t.ok(found, message, {found: lines, wanted: expected});
};

// Assert that exporting throws an MLIRExportError with this message and block id.
const expectExportError = (t, builder, hatId, message, blockId) => {
    try {
        exportScript(builder, hatId);
        t.fail(`expected export to fail with: ${message}`);
    } catch (e) {
        t.equal(e.name, 'MLIRExportError', 'throws an MLIRExportError');
        t.match(e.message, message, 'with the expected message');
        t.equal(e.blockId, blockId, 'pointing at the offending block');
    }
};

// If MQT_CC points to an mqt-cc binary, assert it accepts `mlir` for every --emit checkpoint.
const validateWithMqtCc = (t, mlir, emits = ['qco-optimized', 'qir-adaptive']) => {
    const mqtCc = process.env.MQT_CC;
    if (!mqtCc) return;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mlir-export-'));
    const file = path.join(dir, 'circuit.mlir');
    fs.writeFileSync(file, mlir);
    for (const emit of emits) {
        const result = spawnSync(mqtCc, [`--emit=${emit}`, file], {encoding: 'utf8'});
        t.equal(result.status, 0, `mqt-cc --emit=${emit} accepts the export`, {stderr: result.stderr, mlir});
    }
    fs.rmSync(dir, {recursive: true, force: true});
};

module.exports = {exportScript, shape, expectLines, expectExportError, validateWithMqtCc};
```

- [ ] **Step 2: Write the failing test**

Create `test/unit/extension_quantum_mlir_gates.js`:

```js
const test = require('tap').test;
const ScriptBuilder = require('../fixtures/quantum/script-builder');
const {exportScript, expectLines, expectExportError, validateWithMqtCc} = require('../fixtures/quantum/mlir-helpers');

test('registers and gates, broadcast over all qubits of a register', t => {
    const b = new ScriptBuilder();
    const hat = b.script(b.createRegister('q', 2), b.gate('H', b.qubit(0)), b.gate('X', b.qubits('q')));
    const mlir = exportScript(b, hat);
    t.match(mlir, /^\/\/ Exported from Scratch sprite "Sprite1" by the MQT quantum extension\nmodule \{\n/);
    expectLines(t, mlir, [
        'func.func @main() attributes {mqt.entry_point} {',
        '%_ = memref.alloc() {mqt.register_name = "q"} : memref<2x!qc.qubit>',
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<2x!qc.qubit>',
        'qc.h %_ : !qc.qubit',
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<2x!qc.qubit>',
        'qc.x %_ : !qc.qubit',
        '%_ = arith.constant 1 : index',
        '%_ = memref.load %_[%_] : memref<2x!qc.qubit>',
        'qc.x %_ : !qc.qubit',
        'memref.dealloc %_ : memref<2x!qc.qubit>',
        'return'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('qubits typed as text and combined with "and"', t => {
    const b = new ScriptBuilder();
    const hat = b.script(
        b.createRegister('a', 1),
        b.createRegister('b', 2),
        b.gate('Z', b.and(b.text('b[1]'), b.qubit(0, 'a')))
    );
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = arith.constant 1 : index',
        '%_ = memref.load %_[%_] : memref<2x!qc.qubit>',
        'qc.z %_ : !qc.qubit',
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<1x!qc.qubit>',
        'qc.z %_ : !qc.qubit',
        'memref.dealloc %_ : memref<2x!qc.qubit>',
        'memref.dealloc %_ : memref<1x!qc.qubit>'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('skipped blocks leave a comment but keep their measurements', t => {
    const b = new ScriptBuilder();
    const hat = b.script(b.createRegister('q', 1), b.say(b.measure(b.qubit(0))));
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '// skipped: looks_say',
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<1x!qc.qubit>',
        '%_ = qc.measure %_ : !qc.qubit -> i1'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('export errors point at the offending block', t => {
    let b = new ScriptBuilder();
    const flag = b.create('event_whenflagclicked');
    expectExportError(t, b, flag, 'inside a \'Quantum Circuit\' script', flag);

    b = new ScriptBuilder();
    const list = b.create('data_addtolist');
    expectExportError(t, b, b.script(list), 'The block \'data_addtolist\' can\'t be exported to MLIR.', list);

    b = new ScriptBuilder();
    let qubit = b.qubit(0, 'r');
    expectExportError(t, b, b.script(b.gate('H', qubit)), 'The register \'r\' does not exist yet', qubit);

    b = new ScriptBuilder();
    qubit = b.qubit(2);
    expectExportError(t, b, b.script(b.createRegister('q', 2), b.gate('H', qubit)),
        'Qubit index 2 is out of range: register \'q\' has 2 qubits (0-1).', qubit);

    b = new ScriptBuilder();
    let register = b.createRegister('2q', 2);
    expectExportError(t, b, b.script(register), '\'2q\' is not a valid register name', register);

    b = new ScriptBuilder();
    register = b.createRegister('q', 1);
    expectExportError(t, b, b.script(b.createRegister('q', 1), register), 'created twice', register);

    b = new ScriptBuilder();
    register = b.createRegister('q', 1.5);
    expectExportError(t, b, b.script(register), 'fixed whole number of at least 1', register);

    b = new ScriptBuilder();
    qubit = b.negated(b.qubit(0));
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.gate('X', qubit)),
        '\'negated control\' can only be used in \'controlled on\'', qubit);

    b = new ScriptBuilder();
    qubit = b.text('/');
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.gate('X', qubit)), 'No qubit selected.', qubit);

    b = new ScriptBuilder();
    qubit = b.text('q0');
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.gate('X', qubit)), 'is not a valid qubit', qubit);
    t.end();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_gates.js`
Expected: FAIL. The untracked draft `exporter.js` exports no `exportToMLIR`, so the result is `exportToMLIR is not a function`.

- [ ] **Step 4: Implement the exporter core**

Replace the entire contents of `src/extensions/mqt_quantum/exporter.js`:

```js
const {AST} = require('./qubit-expression');
const {MLIREmitter} = require('./mlir-emitter');

const QUBIT = '!qc.qubit';
const GATES = {X: 'x', Y: 'y', Z: 'z', H: 'h', S: 's', T: 't'};
const REGISTER_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SKIPPED_PREFIXES = ['looks_', 'motion_', 'sound_', 'pen_'];
const SKIPPED_OPCODES = [
    'control_wait',
    'quantum_toMLIR',
    'quantum_setSimulator',
    'quantum_enableDisableSwapDecomposition',
    'quantum_enableDisableNegativeControlTranslation',
    'quantum_enableDisableToffoliDecomposition'
];

class MLIRExportError extends Error {
    constructor (message, blockId) {
        super(message);
        this.name = 'MLIRExportError';
        this.blockId = blockId;
    }
}

// A value is either a constant known at export time or an SSA value; `type` is 'f64', 'i1' or 'index'.
const constant = (type, value) => ({type, constant: value});
const isConstant = value => Object.prototype.hasOwnProperty.call(value, 'constant');

const lookup = (table, key) => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null);
const isSkipped = opcode => SKIPPED_PREFIXES.some(prefix => opcode.startsWith(prefix)) ||
    SKIPPED_OPCODES.includes(opcode);

/**
 * Translates one 'Quantum Circuit' script into a `qc` MLIR module.
 *
 * Handlers are looked up by opcode: `stmt_<opcode>` for stack blocks, `num_<opcode>` for reporters
 * used as numbers, `bool_<opcode>` for conditions and `qubits_<opcode>` for qubit inputs.
 */
class Exporter {
    constructor (blocks, options) {
        this.blocks = blocks;
        this.spriteName = options.spriteName;
        this.lookupVariable = options.lookupVariable;
        this.emit = new MLIREmitter();
        this.registers = new Map(); // register name -> {name, size, ssa, type}
        this.controlStack = []; // one array of qubit references per enclosing 'controlled on'
        this.depth = 0; // nesting depth of 'repeat', 'if' and 'controlled on'
        this.variables = new Map(); // variable id -> current value
        this.variableTypes = new Map(); // variable id -> 'f64' | 'i1'
    }

    run (hatId) {
        const hat = this.block(hatId);
        if (!hat || hat.opcode !== 'quantum_quantumEvaluate') {
            throw new MLIRExportError('Place the export block inside a \'Quantum Circuit\' script.', hatId);
        }
        this.statements(hat.next);
        for (const register of [...this.registers.values()].reverse()) {
            this.emit.line(`memref.dealloc ${register.ssa} : ${register.type}`);
        }
        return this.emit.toModule(`Exported from Scratch sprite "${this.spriteName}" by the MQT quantum extension`);
    }

    // ---- block access ------------------------------------------------------------------------

    block (id) {
        return this.blocks.getBlock(id);
    }

    input (block, name) {
        const input = block.inputs[name];
        return input && input.block ? input.block : null;
    }

    requireInput (block, name) {
        const id = this.input(block, name);
        if (!id) {
            throw new MLIRExportError(`The block '${block.opcode}' is missing its '${name}' input.`, block.id);
        }
        return id;
    }

    literal (id) {
        const block = this.block(id);
        const fieldName = Object.keys(block.fields)[0];
        if (!block.shadow || !fieldName) {
            throw new MLIRExportError(
                `MLIR export needs a fixed value here, not the block '${block.opcode}'.`, block.id);
        }
        return String(block.fields[fieldName].value);
    }

    // ---- statements --------------------------------------------------------------------------

    statements (firstId) {
        for (let id = firstId; id; id = this.block(id).next) {
            this.statement(this.block(id));
        }
    }

    statement (block) {
        const handler = this[`stmt_${block.opcode}`];
        if (handler) {
            handler.call(this, block);
            return;
        }
        if (isSkipped(block.opcode)) {
            this.emit.comment(`skipped: ${block.opcode}`);
            this.measurementsIn(block);
            return;
        }
        throw new MLIRExportError(`The block '${block.opcode}' can't be exported to MLIR.`, block.id);
    }

    measurementsIn (block) {
        for (const name of Object.keys(block.inputs)) {
            const id = this.input(block, name);
            if (!id) continue;
            const child = this.block(id);
            if (child.opcode === 'quantum_measure') {
                this.measure(child);
            } else {
                this.measurementsIn(child);
            }
        }
    }

    stmt_quantum_createRegister (block) {
        if (this.depth > 0) {
            throw new MLIRExportError(
                'Registers must be created outside of \'repeat\', \'if\' and \'controlled on\'.', block.id);
        }
        const name = this.literal(this.requireInput(block, 'NAME'));
        if (!REGISTER_NAME.test(name)) {
            throw new MLIRExportError(`'${name}' is not a valid register name. Use letters, digits and '_', ` +
                'starting with a letter or \'_\'.', block.id);
        }
        if (this.registers.has(name)) {
            throw new MLIRExportError(`The register '${name}' is created twice.`, block.id);
        }
        const size = this.number(this.requireInput(block, 'NUM'));
        if (!isConstant(size) || !Number.isInteger(size.constant) || size.constant < 1) {
            throw new MLIRExportError('The number of qubits must be a fixed whole number of at least 1.', block.id);
        }
        const register = {
            name,
            size: size.constant,
            ssa: this.emit.fresh(name),
            type: `memref<${size.constant}x${QUBIT}>`
        };
        this.emit.line(`${register.ssa} = memref.alloc() {mqt.register_name = "${name}"} : ${register.type}`);
        this.registers.set(name, register);
    }

    stmt_quantum_applyGate (block) {
        const gate = lookup(GATES, this.literal(this.requireInput(block, 'GATE')));
        if (!gate) {
            throw new MLIRExportError('Unknown gate.', block.id);
        }
        for (const target of this.targets(this.requireInput(block, 'QUBIT'))) {
            this.gate([target], args => `qc.${gate} ${args[0]} : ${QUBIT}`, block);
        }
    }

    // ---- quantum operations ------------------------------------------------------------------

    gate (targets, render, block) {
        this.checkDistinct(targets, block);
        this.emit.line(render(targets.map(ref => this.load(ref))));
    }

    checkDistinct (refs, block) {
        const seen = new Set();
        for (const ref of refs) {
            if (typeof ref.index !== 'number') continue;
            const key = `${ref.register.name}[${ref.index}]`;
            if (seen.has(key)) {
                throw new MLIRExportError(`The qubit ${key} is used more than once in the same gate ` +
                    '(for example as control and target).', block.id);
            }
            seen.add(key);
        }
    }

    measure (block) {
        if (this.controlStack.length > 0) {
            throw new MLIRExportError('Qubits can\'t be measured inside \'controlled on\'.', block.id);
        }
        return this.targets(this.requireInput(block, 'QUBIT')).map(ref => {
            const qubit = this.load(ref);
            const result = this.emit.fresh();
            this.emit.line(`${result} = qc.measure ${qubit} : ${QUBIT} -> i1`);
            return result;
        });
    }

    load (ref) {
        const index = typeof ref.index === 'number' ? this.emit.constIndex(ref.index) : ref.index;
        const name = this.emit.fresh();
        this.emit.line(`${name} = memref.load ${ref.register.ssa}[${index}] : ${ref.register.type}`);
        return name;
    }

    // ---- qubit expressions -------------------------------------------------------------------

    qubits (id, allowEmpty = false) {
        const block = this.block(id);
        const handler = this[`qubits_${block.opcode}`];
        if (!handler) {
            throw new MLIRExportError(`The block '${block.opcode}' can't be used as a qubit in MLIR export.`, block.id);
        }
        const refs = handler.call(this, block);
        if (refs.length === 0 && !allowEmpty) {
            throw new MLIRExportError('No qubit selected.', block.id);
        }
        return refs;
    }

    targets (id) {
        const refs = this.qubits(id);
        if (refs.some(ref => ref.negated)) {
            throw new MLIRExportError('\'negated control\' can only be used in \'controlled on\'.', id);
        }
        return refs;
    }

    register (name, blockId) {
        const register = this.registers.get(name);
        if (!register) {
            throw new MLIRExportError(`The register '${name}' does not exist yet. Create it before using it.`, blockId);
        }
        return register;
    }

    qubitRef (register, index, blockId) {
        if (typeof index === 'number' && (!Number.isInteger(index) || index < 0 || index >= register.size)) {
            throw new MLIRExportError(`Qubit index ${index} is out of range: register '${register.name}' has ` +
                `${register.size} qubits (0-${register.size - 1}).`, blockId);
        }
        return {register, index, negated: false, blockId};
    }

    qubits_quantum_getQubit (block) {
        const register = this.register(this.literal(this.requireInput(block, 'NAME')), block.id);
        const index = this.number(this.requireInput(block, 'QUBIT'));
        if (isConstant(index)) {
            return [this.qubitRef(register, Math.trunc(index.constant), block.id)];
        }
        return [this.qubitRef(register, this.toIndex(index), block.id)];
    }

    qubits_quantum_getQubits (block) {
        const register = this.register(this.literal(this.requireInput(block, 'NAME')), block.id);
        return Array.from({length: register.size}, (_, i) => this.qubitRef(register, i, block.id));
    }

    qubits_quantum_and (block) {
        return [
            ...this.qubits(this.requireInput(block, 'QUBIT1'), true),
            ...this.qubits(this.requireInput(block, 'QUBIT2'), true)
        ];
    }

    qubits_quantum_negated (block) {
        return this.qubits(this.requireInput(block, 'QUBIT'), true)
            .map(ref => Object.assign({}, ref, {negated: !ref.negated}));
    }

    qubits_text (block) {
        const text = String(block.fields.TEXT.value).trim();
        if (text === '' || text === '/') {
            return [];
        }
        const [positive, negative] = AST.parse(text).getPositiveNegative();
        const toRef = (leaf, negated) => {
            if (typeof leaf.register !== 'string' || typeof leaf.index !== 'number') {
                throw new MLIRExportError(`'${text}' is not a valid qubit. Expected something like 'q[0]'.`, block.id);
            }
            const ref = this.qubitRef(this.register(leaf.register, block.id), leaf.index, block.id);
            return Object.assign(ref, {negated});
        };
        return [...positive.map(leaf => toRef(leaf, false)), ...negative.map(leaf => toRef(leaf, true))];
    }

    // ---- numbers -----------------------------------------------------------------------------

    number (id) {
        const block = this.block(id);
        const handler = this[`num_${block.opcode}`];
        if (!handler) {
            throw new MLIRExportError(
                `The block '${block.opcode}' can't be used as a number in MLIR export.`, block.id);
        }
        return handler.call(this, block);
    }

    literalNumber (block, raw) {
        const text = String(raw).trim();
        const value = text === '' ? 0 : Number(text);
        if (!Number.isFinite(value)) {
            throw new MLIRExportError(`'${raw}' is not a number.`, block.id);
        }
        return constant('f64', value);
    }

    num_math_number (block) {
        return this.literalNumber(block, block.fields.NUM.value);
    }

    num_text (block) {
        return this.literalNumber(block, block.fields.TEXT.value);
    }

    toIndex (value) {
        const integer = this.emit.fresh();
        this.emit.line(`${integer} = arith.fptosi ${this.f64(value)} : f64 to i64`);
        const index = this.emit.fresh();
        this.emit.line(`${index} = arith.index_cast ${integer} : i64 to index`);
        return index;
    }

    f64 (value) {
        return isConstant(value) ? this.emit.constF64(value.constant) : value.ssa;
    }
}

// Scratch has several number shadow blocks; they all carry their value in the NUM field.
for (const opcode of ['math_positive_number', 'math_whole_number', 'math_integer', 'math_angle']) {
    Exporter.prototype[`num_${opcode}`] = Exporter.prototype.num_math_number;
}

/**
 * Export the 'Quantum Circuit' script starting at `hatId` to the MQT `qc` MLIR dialect.
 * @param {{getBlock: function(string): object}} blocks The block container of the sprite.
 * @param {string} hatId ID of the script's 'Quantum Circuit' hat block.
 * @param {{spriteName: string, lookupVariable: function(string): ?object}} options Sprite name for the
 *     header comment and a lookup from variable ID to the Scratch variable ({name, value}).
 * @return {string} The MLIR module.
 */
const exportToMLIR = function (blocks, hatId, options) {
    return new Exporter(blocks, options).run(hatId);
};

module.exports = {exportToMLIR, MLIRExportError};
```

- [ ] **Step 5: Run the tests (with mqt-cc validation) and lint**

Run: `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc npx tap --no-coverage test/unit/extension_quantum_mlir_gates.js && npx eslint src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_gates.js test/fixtures/quantum/*.js`
Expected: PASS (4 subtests, including the `mqt-cc --emit=… accepts the export` assertions), no lint errors. AST parse errors printed by `console.error` for the `q0` case are expected noise.

- [ ] **Step 6: Commit**

```bash
git add src/extensions/mqt_quantum/exporter.js test/fixtures/quantum/script-builder.js test/fixtures/quantum/mlir-helpers.js test/unit/extension_quantum_mlir_gates.js
git commit -m "feat: :sparkles: export registers, gates and measurements to MLIR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Parameterized gates, SWAP and number operators

**Files:**
- Modify: `src/extensions/mqt_quantum/exporter.js`
- Test: `test/unit/extension_quantum_mlir_parameters.js`

**Interfaces:**
- Consumes: Task 3 internals (`gate`, `targets`, `number`, `f64`, `constant`, `isConstant`, `lookup`).
- Produces:
  - `ssa(type, name)` → `{type, ssa}`.
  - `binaryF64(a, b, op, fold, block) → value`: folds constants and throws for non-finite results; otherwise emits `arith.<op>`. Used by Task 6 for `change by`.
  - `radians(value) → f64 SSA name`.
  - Handlers `stmt_quantum_swapGate`, `stmt_quantum_rotateAxis`, `stmt_quantum_u3`, and `num_operator_add` / `subtract` / `multiply` / `divide`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/extension_quantum_mlir_parameters.js`:

```js
const test = require('tap').test;
const ScriptBuilder = require('../fixtures/quantum/script-builder');
const {exportScript, expectLines, expectExportError, validateWithMqtCc} = require('../fixtures/quantum/mlir-helpers');

test('rotations and U3 convert degrees to radians', t => {
    const b = new ScriptBuilder();
    const hat = b.script(
        b.createRegister('q', 1),
        b.rotate(b.qubit(0), 90, 'Y'),
        b.u3(b.qubit(0), 180, 0, b.arith('operator_divide', 90, 2))
    );
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = arith.constant 1.5707963267948966 : f64',
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<1x!qc.qubit>',
        'qc.ry(%_) %_ : !qc.qubit',
        '%_ = arith.constant 3.141592653589793 : f64',
        '%_ = arith.constant 0.0 : f64',
        '%_ = arith.constant 0.7853981633974483 : f64',
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<1x!qc.qubit>',
        'qc.u(%_, %_, %_) %_ : !qc.qubit'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('number operators on constants are folded, so qubit indices stay static', t => {
    const b = new ScriptBuilder();
    const index = b.arith('operator_subtract', b.arith('operator_multiply', 2, 3), b.arith('operator_add', 1, 4));
    const hat = b.script(b.createRegister('q', 2), b.gate('H', b.qubit(index)));
    expectLines(t, exportScript(b, hat), [
        '%_ = arith.constant 1 : index',
        '%_ = memref.load %_[%_] : memref<2x!qc.qubit>',
        'qc.h %_ : !qc.qubit'
    ]);
    t.end();
});

test('SWAP', t => {
    const b = new ScriptBuilder();
    const hat = b.script(b.createRegister('q', 2), b.swap(b.qubit(0), b.qubit(1)));
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<2x!qc.qubit>',
        '%_ = arith.constant 1 : index',
        '%_ = memref.load %_[%_] : memref<2x!qc.qubit>',
        'qc.swap %_, %_ : !qc.qubit, !qc.qubit'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('parameter errors', t => {
    let b = new ScriptBuilder();
    let swap = b.swap(b.qubits('q'), b.qubit(0));
    expectExportError(t, b, b.script(b.createRegister('q', 2), swap), 'exactly one qubit on each side', swap);

    b = new ScriptBuilder();
    swap = b.swap(b.qubit(1), b.qubit(1));
    expectExportError(t, b, b.script(b.createRegister('q', 2), swap), 'q[1] is used more than once', swap);

    b = new ScriptBuilder();
    const division = b.arith('operator_divide', 1, 0);
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.rotate(b.qubit(0), division, 'X')),
        'no finite result', division);

    b = new ScriptBuilder();
    const angle = b.text('abc');
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.rotate(b.qubit(0), angle, 'X')),
        '\'abc\' is not a number.', angle);
    t.end();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_parameters.js`
Expected: FAIL with `The block 'quantum_rotateAxis' can't be exported to MLIR.`

- [ ] **Step 3: Implement**

In `src/extensions/mqt_quantum/exporter.js`:

After `const GATES = …;` add:

```js
const AXES = {X: 'rx', Y: 'ry', Z: 'rz'};
const DEG_TO_RAD = Math.PI / 180;
```

After `const constant = …;` add:

```js
const ssa = (type, name) => ({type, ssa: name});
```

Add these statement handlers to the `Exporter` class, after `stmt_quantum_applyGate`:

```js
    stmt_quantum_swapGate (block) {
        const first = this.targets(this.requireInput(block, 'QUBIT1'));
        const second = this.targets(this.requireInput(block, 'QUBIT2'));
        if (first.length !== 1 || second.length !== 1) {
            throw new MLIRExportError('SWAP needs exactly one qubit on each side.', block.id);
        }
        this.gate([first[0], second[0]], args => `qc.swap ${args[0]}, ${args[1]} : ${QUBIT}, ${QUBIT}`, block);
    }

    stmt_quantum_rotateAxis (block) {
        const gate = lookup(AXES, this.literal(this.requireInput(block, 'AXIS')));
        if (!gate) {
            throw new MLIRExportError('Unknown rotation axis.', block.id);
        }
        const targets = this.targets(this.requireInput(block, 'QUBIT'));
        const angle = this.radians(this.number(this.requireInput(block, 'ANGLE')));
        for (const target of targets) {
            this.gate([target], args => `qc.${gate}(${angle}) ${args[0]} : ${QUBIT}`, block);
        }
    }

    stmt_quantum_u3 (block) {
        const targets = this.targets(this.requireInput(block, 'QUBIT'));
        const [theta, phi, lambda] = ['THETA', 'PHI', 'LAMBDA']
            .map(name => this.radians(this.number(this.requireInput(block, name))));
        for (const target of targets) {
            this.gate([target], args => `qc.u(${theta}, ${phi}, ${lambda}) ${args[0]} : ${QUBIT}`, block);
        }
    }
```

Add these number handlers to the class, after `num_text`:

```js
    num_operator_add (block) {
        return this.arithmetic(block, 'addf', (a, b) => a + b);
    }

    num_operator_subtract (block) {
        return this.arithmetic(block, 'subf', (a, b) => a - b);
    }

    num_operator_multiply (block) {
        return this.arithmetic(block, 'mulf', (a, b) => a * b);
    }

    num_operator_divide (block) {
        return this.arithmetic(block, 'divf', (a, b) => a / b);
    }

    arithmetic (block, op, fold) {
        const a = this.number(this.requireInput(block, 'NUM1'));
        const b = this.number(this.requireInput(block, 'NUM2'));
        return this.binaryF64(a, b, op, fold, block);
    }

    binaryF64 (a, b, op, fold, block) {
        if (isConstant(a) && isConstant(b)) {
            const value = fold(a.constant, b.constant);
            if (!Number.isFinite(value)) {
                throw new MLIRExportError('This calculation has no finite result (division by zero?).', block.id);
            }
            return constant('f64', value);
        }
        const lhs = this.f64(a);
        const rhs = this.f64(b);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.${op} ${lhs}, ${rhs} : f64`);
        return ssa('f64', name);
    }

    radians (value) {
        if (isConstant(value)) {
            return this.emit.constF64(value.constant * DEG_TO_RAD);
        }
        const factor = this.emit.constF64(DEG_TO_RAD);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.mulf ${value.ssa}, ${factor} : f64`);
        return name;
    }
```

- [ ] **Step 4: Run all exporter tests and lint**

Run: `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc npx tap --no-coverage test/unit/extension_quantum_mlir_*.js && npx eslint src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_parameters.js`
Expected: PASS, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_parameters.js
git commit -m "feat: :sparkles: export rotations, U3, SWAP and number operators to MLIR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `controlled on`

**Files:**
- Modify: `src/extensions/mqt_quantum/exporter.js`
- Test: `test/unit/extension_quantum_mlir_controls.js`

**Interfaces:**
- Consumes: `controlStack`, `depth`, `qubits`, `load`, `checkDistinct` (Task 3).
- Produces:
  - `nested(firstId)`: translates a substack with `depth + 1`. Used by Task 7.
  - The final `gate(targets, render, block)`: wraps every gate in `qc.ctrl` with all stacked controls, and adds X sandwiches around negative controls.

- [ ] **Step 1: Write the failing test**

Create `test/unit/extension_quantum_mlir_controls.js`:

```js
const test = require('tap').test;
const ScriptBuilder = require('../fixtures/quantum/script-builder');
const {exportScript, expectLines, expectExportError, validateWithMqtCc} = require('../fixtures/quantum/mlir-helpers');

test('each controlled gate becomes a qc.ctrl; negative controls are wrapped in X gates', t => {
    const b = new ScriptBuilder();
    const hat = b.script(
        b.createRegister('q', 3),
        b.controlled(b.and(b.qubit(0), b.negated(b.qubit(1))), b.gate('X', b.qubit(2)))
    );
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<3x!qc.qubit>',
        '%_ = arith.constant 1 : index',
        '%_ = memref.load %_[%_] : memref<3x!qc.qubit>',
        '%_ = arith.constant 2 : index',
        '%_ = memref.load %_[%_] : memref<3x!qc.qubit>',
        'qc.x %_ : !qc.qubit',
        'qc.ctrl(%_, %_) targets (%_ = %_) {',
        'qc.x %_ : !qc.qubit',
        'qc.yield',
        '} : {!qc.qubit, !qc.qubit}, {!qc.qubit}',
        'qc.x %_ : !qc.qubit'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('nested controls are flattened and apply to every gate in the body', t => {
    const b = new ScriptBuilder();
    const hat = b.script(
        b.createRegister('q', 4),
        b.controlled(b.qubit(0),
            b.controlled(b.text('q[1]'), b.rotate(b.qubit(2), 45, 'Z'), b.swap(b.qubit(2), b.qubit(3))))
    );
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        'qc.ctrl(%_, %_) targets (%_ = %_) {',
        'qc.rz(%_) %_ : !qc.qubit',
        'qc.yield',
        '} : {!qc.qubit, !qc.qubit}, {!qc.qubit}'
    ]);
    expectLines(t, mlir, [
        'qc.ctrl(%_, %_) targets (%_ = %_, %_ = %_) {',
        'qc.swap %_, %_ : !qc.qubit, !qc.qubit',
        'qc.yield',
        '} : {!qc.qubit, !qc.qubit}, {!qc.qubit, !qc.qubit}'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('control errors', t => {
    let b = new ScriptBuilder();
    let gate = b.gate('X', b.qubit(0));
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.controlled(b.qubit(0), gate)),
        'q[0] is used more than once', gate);

    b = new ScriptBuilder();
    const measure = b.measure(b.qubit(1));
    expectExportError(t, b, b.script(b.createRegister('q', 2), b.controlled(b.qubit(0), b.say(measure))),
        'can\'t be measured inside \'controlled on\'', measure);

    b = new ScriptBuilder();
    const register = b.createRegister('r', 1);
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.controlled(b.qubit(0), register)),
        'Registers must be created outside', register);

    b = new ScriptBuilder();
    gate = b.controlled(b.text('/'), b.gate('X', b.qubit(0)));
    expectExportError(t, b, b.script(b.createRegister('q', 1), gate), 'No qubit selected.',
        b.blocks[gate].inputs.QUBIT.block);
    t.end();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_controls.js`
Expected: FAIL with `The block 'quantum_controlled' can't be exported to MLIR.`

- [ ] **Step 3: Implement**

In the `Exporter` class, add after `statements (firstId) { … }`:

```js
    nested (firstId) {
        this.depth++;
        this.statements(firstId);
        this.depth--;
    }
```

Add after `stmt_quantum_u3`:

```js
    stmt_quantum_controlled (block) {
        this.controlStack.push(this.qubits(this.requireInput(block, 'QUBIT')));
        this.nested(this.input(block, 'SUBSTACK'));
        this.controlStack.pop();
    }
```

Replace the whole `gate` method with:

```js
    gate (targets, render, block) {
        const controls = [].concat(...this.controlStack);
        this.checkDistinct([...controls, ...targets], block);
        const controlNames = controls.map(ref => this.load(ref));
        const targetNames = targets.map(ref => this.load(ref));
        if (controls.length === 0) {
            this.emit.line(render(targetNames));
            return;
        }
        const negated = controlNames.filter((_, i) => controls[i].negated);
        negated.forEach(name => this.emit.line(`qc.x ${name} : ${QUBIT}`));
        const args = targetNames.map(() => this.emit.fresh('t'));
        const bindings = args.map((arg, i) => `${arg} = ${targetNames[i]}`).join(', ');
        this.emit.open(`qc.ctrl(${controlNames.join(', ')}) targets (${bindings})`);
        this.emit.line(render(args));
        this.emit.line('qc.yield');
        this.emit.close(` : {${controls.map(() => QUBIT).join(', ')}}, {${targets.map(() => QUBIT).join(', ')}}`);
        negated.forEach(name => this.emit.line(`qc.x ${name} : ${QUBIT}`));
    }
```

- [ ] **Step 4: Run all exporter tests and lint**

Run: `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc npx tap --no-coverage test/unit/extension_quantum_mlir_*.js && npx eslint src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_controls.js`
Expected: PASS, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_controls.js
git commit -m "feat: :sparkles: export controlled gates to MLIR

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Variables (straight-line)

**Files:**
- Modify: `src/extensions/mqt_quantum/exporter.js`
- Test: `test/unit/extension_quantum_mlir_variables.js`

**Interfaces:**
- Consumes: `binaryF64` (Task 4); `measure`, `number` (Task 3).
- Produces:
  - `variableId(block)`, `forEachStatement(firstId, visit)`, `bool(id)` (dispatches to `bool_*`), `bool_quantum_measure`, `bool_data_variable`, `num_data_variable`.
  - `variableType(id, block) → 'f64' | 'i1'`; `currentValue(id, block) → value`, initialized from the Scratch value on first use.
  - `inferVariableTypes(firstId)`, called from `run`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/extension_quantum_mlir_variables.js`:

```js
const test = require('tap').test;
const ScriptBuilder = require('../fixtures/quantum/script-builder');
const {exportScript, expectLines, expectExportError, validateWithMqtCc} = require('../fixtures/quantum/mlir-helpers');

test('number variables start with their Scratch value and are folded while constant', t => {
    const b = new ScriptBuilder();
    const i = b.variable('i', '1');
    const hat = b.script(
        b.createRegister('q', 3),
        b.gate('H', b.qubit(b.getVar(i))),
        b.changeVar(i, 1),
        b.gate('X', b.qubit(b.getVar(i))),
        b.setVar(i, 0),
        b.gate('Z', b.qubit(b.getVar(i)))
    );
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = arith.constant 1 : index',
        '%_ = memref.load %_[%_] : memref<3x!qc.qubit>',
        'qc.h %_ : !qc.qubit'
    ]);
    expectLines(t, mlir, [
        '%_ = arith.constant 2 : index',
        '%_ = memref.load %_[%_] : memref<3x!qc.qubit>',
        'qc.x %_ : !qc.qubit'
    ]);
    expectLines(t, mlir, [
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<3x!qc.qubit>',
        'qc.z %_ : !qc.qubit'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('a measurement stored in a variable is an i1 value', t => {
    const b = new ScriptBuilder();
    const m = b.variable('m', 0);
    const hat = b.script(b.createRegister('q', 1), b.setVar(m, b.measure(b.qubit(0))));
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<1x!qc.qubit>',
        '%_ = qc.measure %_ : !qc.qubit -> i1',
        'memref.dealloc %_ : memref<1x!qc.qubit>'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('variable errors', t => {
    let b = new ScriptBuilder();
    let m = b.variable('m', 0);
    let use = b.getVar(m);
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.setVar(m, b.measure(b.qubit(0))),
        b.gate('X', b.qubit(use))), 'holds a measurement result and can\'t be used as a number', use);

    b = new ScriptBuilder();
    m = b.variable('m', 0);
    const second = b.setVar(m, 1);
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.setVar(m, b.measure(b.qubit(0))), second),
        'The variable \'m\' is used for both numbers and measurement results.', second);

    b = new ScriptBuilder();
    const name = b.variable('name', 'Alice');
    use = b.getVar(name);
    expectExportError(t, b, b.script(b.createRegister('q', 1), b.rotate(b.qubit(0), use, 'X')),
        'The variable \'name\' holds \'Alice\', which is not a number.', use);

    b = new ScriptBuilder();
    m = b.variable('m', 0);
    const measure = b.measure(b.qubits('q'));
    expectExportError(t, b, b.script(b.createRegister('q', 2), b.setVar(m, measure)),
        'Only a single qubit can be measured here.', measure);
    t.end();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_variables.js`
Expected: FAIL with `The block 'data_variable' can't be used as a number in MLIR export.`

- [ ] **Step 3: Implement**

In `src/extensions/mqt_quantum/exporter.js`:

After `SKIPPED_OPCODES` add:

```js
const BOOLEAN_OPCODES = [
    'quantum_measure', 'operator_lt', 'operator_gt', 'operator_equals', 'operator_not', 'operator_and', 'operator_or'
];
```

After `const isSkipped = …;` add:

```js
const variableId = block => block.fields.VARIABLE.id;
```

In `run`, insert `this.inferVariableTypes(hat.next);` directly before `this.statements(hat.next);`.

Add to the class after `literal (id) { … }`:

```js
    forEachStatement (firstId, visit) {
        for (let id = firstId; id; id = this.block(id).next) {
            const block = this.block(id);
            visit(block);
            for (const name of Object.keys(block.inputs)) {
                if (name.startsWith('SUBSTACK')) {
                    this.forEachStatement(this.input(block, name), visit);
                }
            }
        }
    }
```

Add after `stmt_quantum_controlled`:

```js
    stmt_data_setvariableto (block) {
        const id = variableId(block);
        const valueId = this.requireInput(block, 'VALUE');
        const value = this.variableType(id, block) === 'i1' ? this.bool(valueId) : this.number(valueId);
        this.variables.set(id, value);
    }

    stmt_data_changevariableby (block) {
        const current = this.num_data_variable(block);
        const delta = this.number(this.requireInput(block, 'VALUE'));
        this.variables.set(variableId(block), this.binaryF64(current, delta, 'addf', (a, b) => a + b, block));
    }
```

Add after `num_operator_divide`:

```js
    num_data_variable (block) {
        const value = this.currentValue(variableId(block), block);
        if (value.type !== 'f64') {
            throw new MLIRExportError(`The variable '${block.fields.VARIABLE.value}' holds a measurement result ` +
                'and can\'t be used as a number.', block.id);
        }
        return value;
    }
```

Add at the end of the class body (after `f64`):

```js
    // ---- conditions --------------------------------------------------------------------------

    bool (id) {
        const block = this.block(id);
        const handler = this[`bool_${block.opcode}`];
        if (!handler) {
            throw new MLIRExportError(
                `The block '${block.opcode}' can't be used as a condition in MLIR export.`, block.id);
        }
        return handler.call(this, block);
    }

    bool_quantum_measure (block) {
        const results = this.measure(block);
        if (results.length !== 1) {
            throw new MLIRExportError('Only a single qubit can be measured here.', block.id);
        }
        return ssa('i1', results[0]);
    }

    bool_data_variable (block) {
        const value = this.currentValue(variableId(block), block);
        if (value.type !== 'i1') {
            throw new MLIRExportError(`The variable '${block.fields.VARIABLE.value}' holds a number ` +
                'and can\'t be used as a condition.', block.id);
        }
        return value;
    }

    // ---- variables ---------------------------------------------------------------------------

    variableInfo (id, block) {
        const variable = this.lookupVariable(id);
        if (!variable) {
            throw new MLIRExportError('This variable does not exist.', block.id);
        }
        return variable;
    }

    inferVariableTypes (firstId) {
        const copies = [];
        this.forEachStatement(firstId, block => {
            if (block.opcode === 'data_changevariableby') {
                this.assignType(variableId(block), 'f64', block);
            }
            if (block.opcode !== 'data_setvariableto') return;
            const valueId = this.input(block, 'VALUE');
            const source = valueId ? this.block(valueId) : null;
            if (source && source.opcode === 'data_variable') {
                copies.push([block, source]);
            } else {
                const type = source && BOOLEAN_OPCODES.includes(source.opcode) ? 'i1' : 'f64';
                this.assignType(variableId(block), type, block);
            }
        });
        for (const [block, source] of copies) {
            this.assignType(variableId(block), this.variableType(variableId(source), source), block);
        }
    }

    assignType (id, type, block) {
        const known = this.variableTypes.get(id);
        if (known && known !== type) {
            throw new MLIRExportError(`The variable '${this.variableInfo(id, block).name}' is used for both ` +
                'numbers and measurement results.', block.id);
        }
        this.variableTypes.set(id, type);
    }

    variableType (id, block) {
        if (!this.variableTypes.has(id)) {
            const value = this.variableInfo(id, block).value;
            const isBoolean = value === true || value === false || value === 'true' || value === 'false';
            this.variableTypes.set(id, isBoolean ? 'i1' : 'f64');
        }
        return this.variableTypes.get(id);
    }

    currentValue (id, block) {
        if (!this.variables.has(id)) {
            this.variables.set(id, this.initialValue(id, block));
        }
        return this.variables.get(id);
    }

    initialValue (id, block) {
        const variable = this.variableInfo(id, block);
        const raw = variable.value;
        if (this.variableType(id, block) === 'i1') {
            if ([true, 'true', 1, '1'].includes(raw)) return constant('i1', true);
            if ([false, 'false', 0, '0', ''].includes(raw)) return constant('i1', false);
            throw new MLIRExportError(`The variable '${variable.name}' holds '${raw}', ` +
                'which is not a measurement result (0 or 1).', block.id);
        }
        const text = String(raw).trim();
        const value = text === '' ? 0 : Number(text);
        if (!Number.isFinite(value)) {
            throw new MLIRExportError(
                `The variable '${variable.name}' holds '${raw}', which is not a number.`, block.id);
        }
        return constant('f64', value);
    }
```

- [ ] **Step 4: Run all exporter tests and lint**

Run: `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc npx tap --no-coverage test/unit/extension_quantum_mlir_*.js && npx eslint src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_variables.js`
Expected: PASS, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_variables.js
git commit -m "feat: :sparkles: export Scratch variables as SSA values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Control flow — `repeat`, `if`, `if/else` and conditions

**Files:**
- Modify: `src/extensions/mqt_quantum/exporter.js`
- Test: `test/unit/extension_quantum_mlir_control_flow.js`

**Interfaces:**
- Consumes: `nested` (Task 5); `bool`, `currentValue`, `variableType`, `forEachStatement`, `variableId` (Task 6); `toIndex`, `f64` (Task 3).
- Produces: `stmt_control_repeat`, `stmt_control_if`, `stmt_control_if_else`; `bool_operator_not` / `and` / `or` / `lt` / `gt` / `equals`; `i1(value)`, `materialize(value)`. Variables assigned inside a region are carried through `iter_args` or `scf.if` results.

- [ ] **Step 1: Write the failing test**

Create `test/unit/extension_quantum_mlir_control_flow.js`:

```js
const test = require('tap').test;
const ScriptBuilder = require('../fixtures/quantum/script-builder');
const {exportScript, expectLines, expectExportError, validateWithMqtCc} = require('../fixtures/quantum/mlir-helpers');

test('repeat becomes scf.for', t => {
    const b = new ScriptBuilder();
    const hat = b.script(b.createRegister('q', 1), b.repeat(2.6, b.gate('H', b.qubit(0))));
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = arith.constant 3 : index',
        '%_ = arith.constant 0 : index',
        '%_ = arith.constant 1 : index',
        'scf.for %_ = %_ to %_ step %_ {',
        '%_ = arith.constant 0 : index',
        '%_ = memref.load %_[%_] : memref<1x!qc.qubit>',
        'qc.h %_ : !qc.qubit',
        '}'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('variables changed in a loop are loop-carried', t => {
    const b = new ScriptBuilder();
    const i = b.variable('i', 0);
    const hat = b.script(
        b.createRegister('q', 3),
        b.setVar(i, 0),
        b.repeat(3,
            b.controlled(b.qubit(b.getVar(i)),
                b.rotate(b.qubit(2), b.arith('operator_multiply', b.getVar(i), 90), 'X')),
            b.changeVar(i, 1)),
        b.gate('H', b.qubit(b.arith('operator_subtract', b.getVar(i), 1)))
    );
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = arith.constant 0.0 : f64',
        '%_ = scf.for %_ = %_ to %_ step %_ iter_args(%_ = %_) -> (f64) {',
        '%_ = arith.fptosi %_ : f64 to i64',
        '%_ = arith.index_cast %_ : i64 to index',
        '%_ = arith.constant 90.0 : f64',
        '%_ = arith.mulf %_, %_ : f64',
        '%_ = arith.constant 0.017453292519943295 : f64',
        '%_ = arith.mulf %_, %_ : f64',
        '%_ = memref.load %_[%_] : memref<3x!qc.qubit>',
        '%_ = arith.constant 2 : index',
        '%_ = memref.load %_[%_] : memref<3x!qc.qubit>',
        'qc.ctrl(%_) targets (%_ = %_) {',
        'qc.rx(%_) %_ : !qc.qubit',
        'qc.yield',
        '} : {!qc.qubit}, {!qc.qubit}',
        '%_ = arith.constant 1.0 : f64',
        '%_ = arith.addf %_, %_ : f64',
        'scf.yield %_ : f64',
        '}',
        '%_ = arith.constant 1.0 : f64',
        '%_ = arith.subf %_, %_ : f64'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('if/else on a measurement becomes scf.if', t => {
    const b = new ScriptBuilder();
    const hat = b.script(
        b.createRegister('q', 2),
        b.ifElse(b.not(b.measure(b.qubit(0))), [b.gate('X', b.qubit(1))], [b.gate('Z', b.qubit(1))])
    );
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = qc.measure %_ : !qc.qubit -> i1',
        '%_ = arith.constant true',
        '%_ = arith.xori %_, %_ : i1',
        'scf.if %_ {',
        '%_ = arith.constant 1 : index',
        '%_ = memref.load %_[%_] : memref<2x!qc.qubit>',
        'qc.x %_ : !qc.qubit',
        '} else {',
        '%_ = arith.constant 1 : index',
        '%_ = memref.load %_[%_] : memref<2x!qc.qubit>',
        'qc.z %_ : !qc.qubit',
        '}'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('variables assigned in a branch become scf.if results', t => {
    const b = new ScriptBuilder();
    const angle = b.variable('angle', 0);
    const hat = b.script(
        b.createRegister('q', 2),
        b.if(b.measure(b.qubit(0)), b.setVar(angle, 90)),
        b.rotate(b.qubit(1), b.getVar(angle), 'Y')
    );
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_ = scf.if %_ -> (f64) {',
        '%_ = arith.constant 90.0 : f64',
        'scf.yield %_ : f64',
        '} else {',
        '%_ = arith.constant 0.0 : f64',
        'scf.yield %_ : f64',
        '}',
        '%_ = arith.constant 0.017453292519943295 : f64',
        '%_ = arith.mulf %_, %_ : f64'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('conditions on numbers and booleans', t => {
    const b = new ScriptBuilder();
    const i = b.variable('i', 0);
    const m = b.variable('m', 'false');
    const hat = b.script(
        b.createRegister('q', 2),
        b.repeat(2,
            b.if(b.compare('operator_and', b.compare('operator_lt', b.getVar(i), 1), b.not(b.getVar(m))),
                b.setVar(m, b.measure(b.qubit(0)))),
            b.changeVar(i, 1)),
        b.if(b.compare('operator_equals', 1, 1), b.gate('X', b.qubit(1))),
        b.if(b.getVar(m), b.gate('H', b.qubit(1)))
    );
    const mlir = exportScript(b, hat);
    expectLines(t, mlir, [
        '%_:2 = scf.for %_ = %_ to %_ step %_ iter_args(%_ = %_, %_ = %_) -> (i1, f64) {',
        '%_ = arith.constant 1.0 : f64',
        '%_ = arith.cmpf olt, %_, %_ : f64',
        '%_ = arith.constant true',
        '%_ = arith.xori %_, %_ : i1',
        '%_ = arith.andi %_, %_ : i1',
        '%_ = scf.if %_ -> (i1) {'
    ]);
    expectLines(t, mlir, ['%_ = arith.constant true', 'scf.if %_ {']);
    expectLines(t, mlir, ['scf.if %_#0 {']);
    // mqt-cc can't lower an i1 carried out of a loop to QIR (ub.poison), so only check up to QCO here.
    validateWithMqtCc(t, mlir, ['qco-optimized']);
    t.end();
});

test('control flow errors', t => {
    let b = new ScriptBuilder();
    const register = b.createRegister('q', 1);
    expectExportError(t, b, b.script(b.repeat(2, register)), 'Registers must be created outside', register);

    b = new ScriptBuilder();
    const i = b.variable('i', 0);
    const use = b.getVar(i);
    expectExportError(t, b, b.script(b.if(use)), 'holds a number and can\'t be used as a condition', use);

    b = new ScriptBuilder();
    const condition = b.create('sensing_mousedown');
    expectExportError(t, b, b.script(b.if(condition)), 'can\'t be used as a condition', condition);

    b = new ScriptBuilder();
    const ifBlock = b.if(null);
    expectExportError(t, b, b.script(ifBlock), 'missing its \'CONDITION\' input', ifBlock);
    t.end();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_control_flow.js`
Expected: FAIL with `The block 'control_repeat' can't be exported to MLIR.`

- [ ] **Step 3: Implement**

Add to the `Exporter` class after `stmt_data_changevariableby`:

```js
    stmt_control_repeat (block) {
        const times = this.number(this.requireInput(block, 'TIMES'));
        const upper = isConstant(times) ?
            this.emit.constIndex(Math.max(0, Math.round(times.constant))) :
            this.toIndex(times);
        const lower = this.emit.constIndex(0);
        const step = this.emit.constIndex(1);
        const iv = this.emit.fresh('iv');
        const loop = `scf.for ${iv} = ${lower} to ${upper} step ${step}`;
        const body = this.input(block, 'SUBSTACK');
        const carried = this.assignedVariables(body);
        if (carried.length === 0) {
            this.emit.open(loop);
            this.nested(body);
            this.emit.close();
            return;
        }
        const types = carried.map(id => this.variableType(id, block));
        const initial = carried.map(id => this.materialize(this.currentValue(id, block)));
        const args = carried.map(() => this.emit.fresh('arg'));
        const results = this.results(carried.length);
        const iterArgs = args.map((arg, i) => `${arg} = ${initial[i]}`).join(', ');
        this.emit.open(`${results.definition} = ${loop} iter_args(${iterArgs}) -> (${types.join(', ')})`);
        carried.forEach((id, i) => this.variables.set(id, ssa(types[i], args[i])));
        this.nested(body);
        this.yieldVariables(carried, types);
        this.emit.close();
        carried.forEach((id, i) => this.variables.set(id, ssa(types[i], results.names[i])));
    }

    stmt_control_if (block) {
        this.conditional(block, this.input(block, 'SUBSTACK'), null);
    }

    stmt_control_if_else (block) {
        this.conditional(block, this.input(block, 'SUBSTACK'), this.input(block, 'SUBSTACK2'));
    }

    conditional (block, thenId, elseId) {
        const condition = this.i1(this.bool(this.requireInput(block, 'CONDITION')));
        const carried = [...new Set([...this.assignedVariables(thenId), ...this.assignedVariables(elseId)])];
        if (carried.length === 0) {
            this.emit.open(`scf.if ${condition}`);
            this.nested(thenId);
            if (elseId) {
                this.emit.reopen('else');
                this.nested(elseId);
            }
            this.emit.close();
            return;
        }
        const types = carried.map(id => this.variableType(id, block));
        const before = carried.map(id => this.currentValue(id, block));
        const results = this.results(carried.length);
        this.emit.open(`${results.definition} = scf.if ${condition} -> (${types.join(', ')})`);
        this.nested(thenId);
        this.yieldVariables(carried, types);
        carried.forEach((id, i) => this.variables.set(id, before[i]));
        this.emit.reopen('else');
        this.nested(elseId);
        this.yieldVariables(carried, types);
        this.emit.close();
        carried.forEach((id, i) => this.variables.set(id, ssa(types[i], results.names[i])));
    }

    results (count) {
        const base = this.emit.fresh();
        if (count === 1) {
            return {definition: base, names: [base]};
        }
        return {definition: `${base}:${count}`, names: Array.from({length: count}, (_, i) => `${base}#${i}`)};
    }

    yieldVariables (carried, types) {
        const values = carried.map(id => this.materialize(this.variables.get(id)));
        this.emit.line(`scf.yield ${values.join(', ')} : ${types.join(', ')}`);
    }
```

Add after `f64 (value) { … }`:

```js
    i1 (value) {
        return isConstant(value) ? this.emit.constBool(value.constant) : value.ssa;
    }

    materialize (value) {
        return value.type === 'i1' ? this.i1(value) : this.f64(value);
    }
```

Add after `bool_data_variable`:

```js
    bool_operator_not (block) {
        const value = this.bool(this.requireInput(block, 'OPERAND'));
        if (isConstant(value)) {
            return constant('i1', !value.constant);
        }
        const one = this.emit.constBool(true);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.xori ${value.ssa}, ${one} : i1`);
        return ssa('i1', name);
    }

    bool_operator_and (block) {
        return this.logical(block, 'andi', (a, b) => a && b);
    }

    bool_operator_or (block) {
        return this.logical(block, 'ori', (a, b) => a || b);
    }

    bool_operator_lt (block) {
        return this.compare(block, 'olt', (a, b) => a < b);
    }

    bool_operator_gt (block) {
        return this.compare(block, 'ogt', (a, b) => a > b);
    }

    bool_operator_equals (block) {
        return this.compare(block, 'oeq', (a, b) => a === b);
    }

    logical (block, op, fold) {
        const a = this.bool(this.requireInput(block, 'OPERAND1'));
        const b = this.bool(this.requireInput(block, 'OPERAND2'));
        if (isConstant(a) && isConstant(b)) {
            return constant('i1', fold(a.constant, b.constant));
        }
        const lhs = this.i1(a);
        const rhs = this.i1(b);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.${op} ${lhs}, ${rhs} : i1`);
        return ssa('i1', name);
    }

    compare (block, predicate, fold) {
        const a = this.number(this.requireInput(block, 'OPERAND1'));
        const b = this.number(this.requireInput(block, 'OPERAND2'));
        if (isConstant(a) && isConstant(b)) {
            return constant('i1', fold(a.constant, b.constant));
        }
        const lhs = this.f64(a);
        const rhs = this.f64(b);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.cmpf ${predicate}, ${lhs}, ${rhs} : f64`);
        return ssa('i1', name);
    }
```

Add at the end of the class body (after `initialValue`):

```js
    assignedVariables (firstId) {
        const ids = new Set();
        this.forEachStatement(firstId, block => {
            if (block.opcode === 'data_setvariableto' || block.opcode === 'data_changevariableby') {
                ids.add(variableId(block));
            }
        });
        return [...ids];
    }
```

- [ ] **Step 4: Run all exporter tests and lint**

Run: `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc npx tap --no-coverage test/unit/extension_quantum_mlir_*.js && npx eslint src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_control_flow.js`
Expected: PASS, no lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_control_flow.js
git commit -m "feat: :sparkles: export repeat and if/else as scf.for and scf.if

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Wire the export block — download and error reporting

**Files:**
- Create: `src/extensions/mqt_quantum/download.js`
- Modify: `src/extensions/mqt_quantum/index.js` (imports; `toMLIR`; remove `_traverseThread`)
- Test: `test/unit/extension_quantum_mlir_block.js`

**Interfaces:**
- Consumes: `exportToMLIR`, `MLIRExportError` (Task 3).
- Produces:
  - `downloadTextFile(fileName, text)`.
  - `QuantumExtension.prototype.toMLIR(args, util)`, which uses `util.target` (`blocks`, `getName()`, `lookupVariableById(id)`) and `util.thread.topBlock`.
  - The overridable seams `_download(fileName, text)` and `_notify(message)`.

- [ ] **Step 1: Write the failing test**

Create `test/unit/extension_quantum_mlir_block.js`:

```js
const test = require('tap').test;
const QuantumExtension = require('../../src/extensions/mqt_quantum/index.js');
const ScriptBuilder = require('../fixtures/quantum/script-builder');

const setup = (builder, hatId) => {
    const reports = [];
    const extension = new QuantumExtension({visualReport: (blockId, value) => reports.push({blockId, value})});
    const downloads = [];
    const notes = [];
    extension._download = (name, text) => downloads.push({name, text});
    extension._notify = message => notes.push(message);
    const util = {
        thread: {topBlock: hatId},
        target: {
            blocks: builder.container(),
            getName: () => 'Sprite1',
            lookupVariableById: id => builder.variables[id]
        }
    };
    return {extension, util, reports, downloads, notes};
};

test('the export block downloads the circuit it is placed in', t => {
    const b = new ScriptBuilder();
    const hat = b.script(b.createRegister('q', 1), b.gate('H', b.qubit(0)), b.create('quantum_toMLIR'));
    const {extension, util, reports, downloads, notes} = setup(b, hat);
    extension.toMLIR({}, util);
    t.equal(downloads.length, 1);
    t.equal(downloads[0].name, 'Sprite1_circuit.mlir');
    t.match(downloads[0].text, 'qc.h');
    t.match(downloads[0].text, '// skipped: quantum_toMLIR');
    t.same(notes, ['Exported circuit to Sprite1_circuit.mlir']);
    t.same(reports, []);
    t.end();
});

test('export errors are shown on the offending block and nothing is downloaded', t => {
    const b = new ScriptBuilder();
    const qubit = b.qubit(5);
    const hat = b.script(b.createRegister('q', 1), b.gate('H', qubit));
    const {extension, util, reports, downloads, notes} = setup(b, hat);
    extension.toMLIR({}, util);
    t.same(downloads, []);
    t.equal(reports.length, 1);
    t.equal(reports[0].blockId, qubit);
    t.match(reports[0].value, 'out of range');
    t.match(notes[0], /^MLIR export failed: Qubit index 5 is out of range/);
    t.end();
});

test('internal errors are reported without crashing the thread', t => {
    const b = new ScriptBuilder();
    const hat = b.script(b.createRegister('q', 1));
    const {extension, util, reports, downloads, notes} = setup(b, hat);
    util.target.blocks = {getBlock: () => {
        throw new TypeError('boom');
    }};
    t.doesNotThrow(() => extension.toMLIR({}, util));
    t.same(downloads, []);
    t.same(reports, []);
    t.same(notes, ['MLIR export failed (internal error), see console']);
    t.end();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_block.js`
Expected: FAIL. The draft `toMLIR` calls `alert`, which is not defined in Node, so the result is `ReferenceError: alert is not defined`.

- [ ] **Step 3: Create the download helper**

Create `src/extensions/mqt_quantum/download.js`:

```js
/**
 * Offer `text` to the user as a file download. Does nothing outside a browser (e.g. in Node tests).
 * @param {string} fileName Suggested name of the downloaded file.
 * @param {string} text File contents.
 */
const downloadTextFile = function (fileName, text) {
    if (typeof document === 'undefined') return;
    const url = URL.createObjectURL(new Blob([text], {type: 'text/plain'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

module.exports = {downloadTextFile};
```

- [ ] **Step 4: Wire `toMLIR` in `index.js`**

In `src/extensions/mqt_quantum/index.js`, add below the `require('./qubit-expression')` import from Task 1:

```js
const {exportToMLIR, MLIRExportError} = require('./exporter');
const {downloadTextFile} = require('./download');
```

Replace the whole draft `toMLIR (_args, util) { … }` method, the last method of `QuantumExtension`, with:

```js
    toMLIR (_args, util) {
        const target = util.target;
        const fileName = `${target.getName()}_circuit.mlir`;
        let mlir;
        try {
            mlir = exportToMLIR(target.blocks, util.thread.topBlock, {
                spriteName: target.getName(),
                lookupVariable: id => target.lookupVariableById(id)
            });
        } catch (e) {
            if (e instanceof MLIRExportError) {
                console.error(`MLIR export failed at block ${e.blockId}: ${e.message}`);
                if (e.blockId) {
                    this.runtime.visualReport(e.blockId, e.message);
                }
                this._notify(`MLIR export failed: ${e.message}`);
            } else {
                console.error(e);
                this._notify('MLIR export failed (internal error), see console');
            }
            return;
        }
        this._download(fileName, mlir);
        this._notify(`Exported circuit to ${fileName}`);
    }

    _download (fileName, text) {
        downloadTextFile(fileName, text);
    }

    _notify (message) {
        if (typeof alert === 'function') {
            alert(message); // eslint-disable-line no-alert
        }
    }
```

Delete the draft helper `const _traverseThread = function (blocks, hat) { … };` near the end of the file.

- [ ] **Step 5: Run the tests and lint the new files**

Run: `npx tap --no-coverage test/unit/extension_quantum_*.js && npx eslint src/extensions/mqt_quantum/download.js test/unit/extension_quantum_mlir_block.js`
Expected: PASS. The `MLIR export failed at block …` line on stderr is expected. No lint errors. `index.js` has many pre-existing lint errors, so don't lint it as a whole; make sure the new lines follow the surrounding style.

- [ ] **Step 6: Commit**

```bash
git add src/extensions/mqt_quantum/download.js src/extensions/mqt_quantum/index.js test/unit/extension_quantum_mlir_block.js
git commit -m "feat: :sparkles: download MLIR export and report errors on the block

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Integration test on the exercise projects, full suite, manual smoke test

**Files:**
- Copy: `../exercises-2/02-circuits.sb3`, `03-verification.sb3`, `04-resource-estimation.sb3`, `05-compilation.sb3` into `test/fixtures/quantum/`
- Create: `test/integration/quantum_mlir_export.js`
- Create (generated): `tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs`

**Interfaces:**
- Consumes: `exportToMLIR` (Task 3), `validateWithMqtCc` (Task 3); the Node-loadable extension (Task 1).

- [ ] **Step 1: Copy the fixtures and write the test**

```bash
cp ../exercises-2/02-circuits.sb3 ../exercises-2/03-verification.sb3 ../exercises-2/04-resource-estimation.sb3 ../exercises-2/05-compilation.sb3 test/fixtures/quantum/
```

Create `test/integration/quantum_mlir_export.js`:

```js
const path = require('path');
const test = require('tap').test;
const makeTestStorage = require('../fixtures/make-test-storage');
const readFileToBuffer = require('../fixtures/readProjectFile').readFileToBuffer;
const VirtualMachine = require('../../src/index');
const {exportToMLIR} = require('../../src/extensions/mqt_quantum/exporter');
const {validateWithMqtCc} = require('../fixtures/quantum/mlir-helpers');

const PROJECTS = ['02-circuits', '03-verification', '04-resource-estimation', '05-compilation'];

for (const project of PROJECTS) {
    test(`exports every circuit of the ${project} exercise`, async t => {
        if (!process.env.MQT_CC) {
            t.comment('MQT_CC is not set: skipping validation with mqt-cc');
        }
        const vm = new VirtualMachine();
        vm.attachStorage(makeTestStorage());
        await vm.loadProject(readFileToBuffer(path.resolve(__dirname, `../fixtures/quantum/${project}.sb3`)));
        let circuits = 0;
        for (const target of vm.runtime.targets) {
            for (const hatId of target.blocks.getScripts()) {
                if (target.blocks.getBlock(hatId).opcode !== 'quantum_quantumEvaluate') continue;
                const mlir = exportToMLIR(target.blocks, hatId, {
                    spriteName: target.getName(),
                    lookupVariable: id => target.lookupVariableById(id)
                });
                circuits++;
                t.matchSnapshot(mlir, `${target.getName()} circuit ${circuits}`);
                validateWithMqtCc(t, mlir);
            }
        }
        t.ok(circuits > 0, 'the project contains circuits');
        vm.quit();
    });
}
```

- [ ] **Step 2: Generate the snapshots with mqt-cc validation on**

Run: `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc npx tap --no-coverage --snapshot test/integration/quantum_mlir_export.js`
Expected: PASS (4 subtests). This creates `tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs`.

- [ ] **Step 3: Review the snapshots against the exercises**

Open the snapshot file and check one circuit by hand. For `03-verification`, `Sprite1 circuit 1` must be: alloc `q` (2 qubits), `qc.h` on `q[0]`, a `qc.ctrl` with control `q[0]` and an X on `q[1]`, a `qc.measure` of `q[0]`, then dealloc. That matches the exercise's first circuit, which stores the measurement in `result-left`.

- [ ] **Step 4: Re-run without `--snapshot` to confirm the snapshots match, then lint**

Run: `npx tap --no-coverage test/integration/quantum_mlir_export.js && npx eslint test/integration/quantum_mlir_export.js`
Expected: PASS, including the comment `MQT_CC is not set: skipping validation with mqt-cc`. No lint errors.

- [ ] **Step 5: Run the VM's whole unit suite**

Run: `npx tap --no-coverage -j4 test/unit/*.js`
Expected: all suites pass. The prototype for this plan ran 65 suites with 2265 assertions, all passing. Moving the parser and adding `.js` to the imports must not break any existing extension tests.

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/quantum/*.sb3 test/integration/quantum_mlir_export.js tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs
git commit -m "test: :white_check_mark: export all exercise circuits to MLIR and validate with mqt-cc

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Manual smoke test in the GUI (needs the user)**

`scratch-gui/node_modules/scratch-vm` symlinks to this repo and serves `dist/web`, so the VM has to be rebuilt first:

```bash
npm run build
```

Then, in `../scratch-gui`:

```bash
npm start
```

Open `http://localhost:8601`, load `exercises-2/03-verification.sb3`, and append `Export Circuits to MLIR` to a `Quantum Circuit` script. Click the script, then check:
1. `Sprite1_circuit.mlir` downloads, and the alert says `Exported circuit to Sprite1_circuit.mlir`.
2. The file passes `mqt-cc --emit=qco-optimized <file>`.
3. Changing a `qubit [0] of register q` to index `7` and clicking again shows a report bubble on that reporter block with the out-of-range message, and nothing is downloaded.

Ask the user to confirm the bubble appears on non-top-level blocks: scratch-gui's `workspace.reportValue` behavior for nested blocks can't be checked in Node.

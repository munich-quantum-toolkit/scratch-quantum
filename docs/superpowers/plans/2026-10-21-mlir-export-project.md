# Project-wide MLIR Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `Export Circuits to MLIR` into a project-level command block. It exports every `Quantum Circuit` script into one `qc` module (`quantum_circuits.mlir`): a single circuit becomes `@main`'s body, and several circuits become `@circuit_<k>` functions that `@main` calls.

**Architecture:** The per-circuit translator (`Exporter`) is unchanged except for a register-name prefix. The emitter produces functions instead of whole modules. A new `exportProjectToMLIR(circuits)` assembles the module. `index.js` collects circuits via `runtime.allScriptsByOpcodeDo` (the same order `Run Quantum Circuits` uses).

**Tech Stack:** JavaScript (scratch-vm, CommonJS for the touched files), `tap` 16, ESLint (`eslint-config-scratch`), `mqt-cc` for validation.

**Spec:** `docs/superpowers/specs/2026-10-21-mlir-export-design.md` (sections "Module shape" and "Error handling").

## Global Constraints

- Work in `/home/damian/01_research/scratch-quantum/scratch-vm` on branch `feat/mlir-export-project`. Do not touch `git stash`.
- Edited/new files must pass `npx eslint <file>`. Exception: `src/extensions/mqt_quantum/index.js` has pre-existing lint errors, so don't lint it as a whole or fix unrelated code, and make new lines follow the surrounding style.
- Run tests with `npx tap --no-coverage <files>`. Validate with `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc` (validation is skipped when it is unset).
- Module header: `// Exported from Scratch by the MQT quantum extension`. Circuit function comment: `// 'Quantum Circuit' script of sprite "<name>"`. Entry point: `func.func @main() attributes {mqt.entry_point}`. Circuit functions: `func.func private @circuit_<k>()`, k from 1. Calls: `func.call @circuit_<k>() : () -> ()`. With several circuits, register names get the prefix `circuit_<k>_`. File name: `quantum_circuits.mlir`. Success alert: `Exported circuits to quantum_circuits.mlir`.
- Commit messages use the repo's gitmoji style and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Project-level exporter (emitter functions, register prefix, `exportProjectToMLIR`)

**Files:**
- Modify: `src/extensions/mqt_quantum/mlir-emitter.js` (replace `toModule`; add `buildModule`)
- Modify: `src/extensions/mqt_quantum/exporter.js` (import; constructor; `run`; `stmt_quantum_createRegister`; replace `exportToMLIR` block at the end)
- Modify: `test/unit/extension_quantum_mlir_emitter.js`, `test/unit/extension_quantum_mlir_gates.js`
- Create: `test/unit/extension_quantum_mlir_project.js`

**Interfaces:**
- Produces:
  - `mlir-emitter.js` exports `{MLIREmitter, buildModule, formatF64}`.
    - `MLIREmitter#toFunction(signature, comment?) → string` replaces `toModule`.
    - `buildModule(header, functions) → string`.
  - `exporter.js` exports `{exportProjectToMLIR, exportToMLIR, MLIRExportError}`.
    - `exportProjectToMLIR(circuits)`: each circuit is `{blocks, hatId, spriteName, lookupVariable}`.
    - `exportToMLIR(blocks, hatId, {spriteName, lookupVariable})` keeps its old signature. It wraps the single-circuit case.
    - An `MLIRExportError` thrown while translating a circuit gets a `spriteName` property.
    - The no-circuit error has `blockId === null`.

- [ ] **Step 1: Write the failing tests**

Create `test/unit/extension_quantum_mlir_project.js`:

```js
const test = require('tap').test;
const ScriptBuilder = require('../fixtures/quantum/script-builder');
const {exportProjectToMLIR} = require('../../src/extensions/mqt_quantum/exporter');
const {expectLines, shape, validateWithMqtCc} = require('../fixtures/quantum/mlir-helpers');

const circuit = (builder, hatId, spriteName) => ({
    blocks: builder.container(),
    hatId,
    spriteName,
    lookupVariable: id => builder.variables[id]
});

test('a single circuit is the body of @main', t => {
    const b = new ScriptBuilder();
    const hat = b.script(b.createRegister('q', 1), b.gate('H', b.qubit(0)));
    const mlir = exportProjectToMLIR([circuit(b, hat, 'Sprite1')]);
    t.notMatch(mlir, 'func.call', 'no calls');
    t.equal(shape(mlir).filter(line => line.startsWith('func.func')).length, 1, 'exactly one function');
    expectLines(t, mlir, [
        'module {',
        '// \'Quantum Circuit\' script of sprite "Sprite1"',
        'func.func @main() attributes {mqt.entry_point} {',
        '%_ = memref.alloc() {mqt.register_name = "q"} : memref<1x!qc.qubit>'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('several circuits become private functions that @main calls in order', t => {
    const first = new ScriptBuilder();
    const second = new ScriptBuilder();
    const mlir = exportProjectToMLIR([
        circuit(first, first.script(first.createRegister('q', 2), first.gate('H', first.qubit(1))), 'Sprite1'),
        circuit(second, second.script(second.createRegister('q', 1), second.gate('X', second.qubit(0))), 'Sprite2')
    ]);
    expectLines(t, mlir, [
        '// \'Quantum Circuit\' script of sprite "Sprite1"',
        'func.func private @circuit_1() {',
        '%_ = memref.alloc() {mqt.register_name = "circuit_1_q"} : memref<2x!qc.qubit>'
    ]);
    expectLines(t, mlir, [
        '// \'Quantum Circuit\' script of sprite "Sprite2"',
        'func.func private @circuit_2() {',
        '%_ = memref.alloc() {mqt.register_name = "circuit_2_q"} : memref<1x!qc.qubit>'
    ]);
    expectLines(t, mlir, [
        'func.func @main() attributes {mqt.entry_point} {',
        'func.call @circuit_1() : () -> ()',
        'func.call @circuit_2() : () -> ()',
        'return',
        '}',
        '}'
    ]);
    validateWithMqtCc(t, mlir);
    t.end();
});

test('export errors name the sprite of the failing circuit', t => {
    const good = new ScriptBuilder();
    const bad = new ScriptBuilder();
    const list = bad.create('data_addtolist');
    try {
        exportProjectToMLIR([
            circuit(good, good.script(good.createRegister('q', 1)), 'Sprite1'),
            circuit(bad, bad.script(list), 'Sprite2')
        ]);
        t.fail('expected the export to fail');
    } catch (e) {
        t.equal(e.name, 'MLIRExportError');
        t.equal(e.blockId, list);
        t.equal(e.spriteName, 'Sprite2');
    }
    t.end();
});

test('exporting without circuits is an error without a block', t => {
    try {
        exportProjectToMLIR([]);
        t.fail('expected the export to fail');
    } catch (e) {
        t.equal(e.name, 'MLIRExportError');
        t.match(e.message, 'There are no \'Quantum Circuit\' scripts to export.');
        t.equal(e.blockId, null);
    }
    t.end();
});
```

In `test/unit/extension_quantum_mlir_emitter.js`, change the import line to:

```js
const {MLIREmitter, buildModule, formatF64} = require('../../src/extensions/mqt_quantum/mlir-emitter');
```

and replace the whole last test (`test('constants and nested regions are emitted into a module', …)`) with:

```js
test('constants and nested regions are emitted into a function inside a module', t => {
    const emitter = new MLIREmitter();
    emitter.constF64(0.5);
    const condition = emitter.constBool(true);
    emitter.open(`scf.if ${condition}`);
    emitter.line('qc.x %q : !qc.qubit');
    emitter.reopen('else');
    emitter.comment('nothing');
    emitter.close();
    const other = new MLIREmitter();
    other.line('qc.h %q : !qc.qubit');
    t.equal(buildModule('header', [emitter.toFunction('@main() attributes {mqt.entry_point}'),
        other.toFunction('private @circuit_1()', 'a comment')]), [
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
        '  // a comment',
        '  func.func private @circuit_1() {',
        '    qc.h %q : !qc.qubit',
        '    return',
        '  }',
        '}',
        ''
    ].join('\n'));
    t.end();
});
```

In `test/unit/extension_quantum_mlir_gates.js` make three edits:
1. Replace `t.match(mlir, /^\/\/ Exported from Scratch sprite "Sprite1" by the MQT quantum extension\nmodule \{\n/);` with `t.match(mlir, /^\/\/ Exported from Scratch by the MQT quantum extension\nmodule \{\n/);`.
2. In the first test's `expectLines` list, insert `'// \'Quantum Circuit\' script of sprite "Sprite1"',` as the first element, before `'func.func @main() attributes {mqt.entry_point} {',`.
3. Replace `expectExportError(t, b, flag, 'inside a \'Quantum Circuit\' script', flag);` with `expectExportError(t, b, flag, 'Only \'Quantum Circuit\' scripts can be exported to MLIR.', flag);`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_project.js test/unit/extension_quantum_mlir_emitter.js test/unit/extension_quantum_mlir_gates.js`
Expected: FAIL. `exportProjectToMLIR is not a function` (project test); `buildModule is not a function` (emitter test); header/message mismatches (gates test).

- [ ] **Step 3: Emitter — replace `toModule`**

In `src/extensions/mqt_quantum/mlir-emitter.js`, replace the JSDoc + `toModule (header) { … }` method, the closing `}` of the class, and everything up to `module.exports`, with:

```js
    /**
     * Wrap the emitted lines into a `func.func` definition.
     * @param {string} signature Everything between `func.func` and the body, e.g. `private @circuit_1()`.
     * @param {string=} comment Optional comment line emitted above the function.
     * @return {string} The function's text, indented for a module body.
     */
    toFunction (signature, comment) {
        return [
            ...(comment ? [`  // ${comment}`] : []),
            `  func.func ${signature} {`,
            ...this._lines,
            '    return',
            '  }'
        ].join('\n');
    }
}

/**
 * Assemble function definitions into an MLIR module.
 * @param {string} header Text of the leading comment line.
 * @param {Array.<string>} functions Function texts from `MLIREmitter.toFunction`.
 * @return {string} The complete MLIR module.
 */
const buildModule = function (header, functions) {
    return [`// ${header}`, 'module {', ...functions, '}', ''].join('\n');
};

```

and change the export line to `module.exports = {MLIREmitter, buildModule, formatF64};`.

- [ ] **Step 4: Exporter — prefix, `run`, project export**

In `src/extensions/mqt_quantum/exporter.js`:

1. Change `const {MLIREmitter} = require('./mlir-emitter');` to `const {MLIREmitter, buildModule} = require('./mlir-emitter');`.
2. In the `Exporter` constructor, directly after `this.lookupVariable = options.lookupVariable;`, add:
   ```js
        this.registerPrefix = options.registerPrefix || ''; // keeps register names unique across circuits
   ```
3. In `run`, change the hat error message to `'Only \'Quantum Circuit\' scripts can be exported to MLIR.'`, and replace the final `return this.emit.toModule(…);` with `return this.emit;`.
4. In `stmt_quantum_createRegister`, replace the line ``this.emit.line(`${register.ssa} = memref.alloc() {mqt.register_name = "${name}"} : ${register.type}`);`` with:
   ```js
        const registerName = `${this.registerPrefix}${name}`;
        this.emit.line(`${register.ssa} = memref.alloc() {mqt.register_name = "${registerName}"} : ${register.type}`);
   ```
5. Replace everything from the JSDoc `/**\n * Export the 'Quantum Circuit' script starting at` to the end of the file with:

```js
const MODULE_HEADER = 'Exported from Scratch by the MQT quantum extension';
const ENTRY_POINT = '@main() attributes {mqt.entry_point}';

/**
 * Translate one circuit into a function.
 * @param {object} circuit The circuit ({blocks, hatId, spriteName, lookupVariable}).
 * @param {string} signature The function signature, e.g. `private @circuit_1()`.
 * @param {string} registerPrefix Prefix for register names, so they stay unique in the module.
 * @return {string} The function's text.
 */
const translateCircuit = function (circuit, signature, registerPrefix) {
    try {
        const body = new Exporter(circuit.blocks, Object.assign({}, circuit, {registerPrefix})).run(circuit.hatId);
        return body.toFunction(signature, `'Quantum Circuit' script of sprite "${circuit.spriteName}"`);
    } catch (e) {
        if (e instanceof MLIRExportError) {
            e.spriteName = circuit.spriteName;
        }
        throw e;
    }
};

/**
 * Export 'Quantum Circuit' scripts to one MQT `qc` MLIR module. A single circuit becomes the body of the
 * `@main` entry point; several circuits become private functions `@circuit_<k>` that `@main` calls in order.
 * @param {Array.<{blocks: {getBlock: function(string): object}, hatId: string, spriteName: string,
 *     lookupVariable: function(string): ?object}>} circuits The circuits, each with the block container of its
 *     sprite, the ID of its 'Quantum Circuit' hat, the sprite name and a lookup from variable ID to the Scratch
 *     variable ({name, value}).
 * @return {string} The MLIR module.
 */
const exportProjectToMLIR = function (circuits) {
    if (circuits.length === 0) {
        throw new MLIRExportError('There are no \'Quantum Circuit\' scripts to export.', null);
    }
    if (circuits.length === 1) {
        return buildModule(MODULE_HEADER, [translateCircuit(circuits[0], ENTRY_POINT, '')]);
    }
    const functions = circuits.map((circuit, i) => translateCircuit(circuit, `private @circuit_${i + 1}()`,
        `circuit_${i + 1}_`));
    const main = new MLIREmitter();
    circuits.forEach((_, i) => main.line(`func.call @circuit_${i + 1}() : () -> ()`));
    return buildModule(MODULE_HEADER, [...functions, main.toFunction(ENTRY_POINT)]);
};

/**
 * Export a single 'Quantum Circuit' script; see `exportProjectToMLIR`.
 * @param {{getBlock: function(string): object}} blocks The block container of the sprite.
 * @param {string} hatId ID of the script's 'Quantum Circuit' hat block.
 * @param {{spriteName: string, lookupVariable: function(string): ?object}} options Sprite name and variable lookup.
 * @return {string} The MLIR module.
 */
const exportToMLIR = function (blocks, hatId, options) {
    return exportProjectToMLIR([Object.assign({blocks, hatId}, options)]);
};

module.exports = {exportProjectToMLIR, exportToMLIR, MLIRExportError};
```

- [ ] **Step 5: Run the exporter tests and lint**

Run: `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc npx tap --no-coverage test/unit/extension_quantum_mlir_emitter.js test/unit/extension_quantum_mlir_gates.js test/unit/extension_quantum_mlir_parameters.js test/unit/extension_quantum_mlir_controls.js test/unit/extension_quantum_mlir_variables.js test/unit/extension_quantum_mlir_control_flow.js test/unit/extension_quantum_mlir_project.js && npx eslint src/extensions/mqt_quantum/exporter.js src/extensions/mqt_quantum/mlir-emitter.js test/unit/extension_quantum_mlir_project.js test/unit/extension_quantum_mlir_emitter.js test/unit/extension_quantum_mlir_gates.js`
Expected: PASS, including the mqt-cc assertions in the project test, and no lint errors. Also run `npx tap --no-coverage test/unit/extension_quantum_mlir_block.js`: it must still pass unchanged, because `index.js` still calls `exportToMLIR`, whose signature is kept.

- [ ] **Step 6: Commit**

```bash
git add src/extensions/mqt_quantum/mlir-emitter.js src/extensions/mqt_quantum/exporter.js test/unit/extension_quantum_mlir_emitter.js test/unit/extension_quantum_mlir_gates.js test/unit/extension_quantum_mlir_project.js
git commit -m "feat: :sparkles: export several circuits as functions called from @main

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Export block collects every circuit of the project

**Files:**
- Modify: `src/extensions/mqt_quantum/index.js` (exporter import; `toMLIR`; new `_collectCircuits`)
- Replace: `test/unit/extension_quantum_mlir_block.js`

**Interfaces:**
- Consumes: `exportProjectToMLIR`, `MLIRExportError` with `.blockId` (may be `null`) and `.spriteName` (Task 1).
- Produces:
  - `QuantumExtension#toMLIR(args, util)` uses `util.thread.peekStack()` and `this.runtime.allScriptsByOpcodeDo`.
  - `QuantumExtension#_collectCircuits() → [{blocks, hatId, spriteName, lookupVariable}]`.

- [ ] **Step 1: Write the failing test**

Replace the whole contents of `test/unit/extension_quantum_mlir_block.js` with:

```js
const test = require('tap').test;
const QuantumExtension = require('../../src/extensions/mqt_quantum/index.js');
const ScriptBuilder = require('../fixtures/quantum/script-builder');

const EXPORT_BLOCK = 'export-block';

// `sprites` is a list of {name, builder, isOriginal}; every top-level hat in a builder is a script.
const setup = sprites => {
    const reports = [];
    const runtime = {
        visualReport: (blockId, value) => reports.push({blockId, value}),
        allScriptsByOpcodeDo: (opcode, visit) => {
            for (const sprite of sprites) {
                const target = {
                    blocks: sprite.builder.container(),
                    isOriginal: sprite.isOriginal !== false,
                    getName: () => sprite.name,
                    lookupVariableById: id => sprite.builder.variables[id]
                };
                for (const block of Object.values(sprite.builder.blocks)) {
                    if (block.topLevel && block.opcode === opcode) visit({blockId: block.id}, target);
                }
            }
        }
    };
    const extension = new QuantumExtension(runtime);
    const downloads = [];
    const notes = [];
    extension._download = (name, text) => downloads.push({name, text});
    extension._notify = message => notes.push(message);
    const util = {thread: {peekStack: () => EXPORT_BLOCK}};
    return {extension, util, reports, downloads, notes};
};

test('the export block downloads every circuit of the project, skipping clones', t => {
    const first = new ScriptBuilder();
    first.script(first.createRegister('q', 1), first.gate('H', first.qubit(0)));
    const second = new ScriptBuilder();
    second.script(second.createRegister('r', 1), second.gate('X', second.qubit(0, 'r')));
    const clone = new ScriptBuilder();
    clone.script(clone.createRegister('c', 1));
    const {extension, util, reports, downloads, notes} = setup([
        {name: 'Sprite1', builder: first},
        {name: 'Sprite2', builder: second},
        {name: 'Sprite2', builder: clone, isOriginal: false}
    ]);
    extension.toMLIR({}, util);
    t.equal(downloads.length, 1);
    t.equal(downloads[0].name, 'quantum_circuits.mlir');
    t.match(downloads[0].text, 'func.call @circuit_1() : () -> ()');
    t.match(downloads[0].text, 'func.call @circuit_2() : () -> ()');
    t.notMatch(downloads[0].text, '@circuit_3', 'clones are not exported');
    t.notMatch(downloads[0].text, '"circuit_3_c"', 'the clone register does not appear');
    t.same(notes, ['Exported circuits to quantum_circuits.mlir']);
    t.same(reports, []);
    t.end();
});

test('export errors are shown on the offending block and name its sprite', t => {
    const b = new ScriptBuilder();
    const qubit = b.qubit(5);
    b.script(b.createRegister('q', 1), b.gate('H', qubit));
    const {extension, util, reports, downloads, notes} = setup([{name: 'Sprite2', builder: b}]);
    extension.toMLIR({}, util);
    t.same(downloads, []);
    t.equal(reports.length, 1);
    t.equal(reports[0].blockId, qubit);
    t.match(reports[0].value, 'out of range');
    t.match(notes[0], /^MLIR export failed in sprite "Sprite2": Qubit index 5 is out of range/);
    t.end();
});

test('without circuits the error is shown on the export block itself', t => {
    const {extension, util, reports, downloads, notes} = setup([]);
    extension.toMLIR({}, util);
    t.same(downloads, []);
    t.same(reports.map(report => report.blockId), [EXPORT_BLOCK]);
    t.same(notes, ['MLIR export failed: There are no \'Quantum Circuit\' scripts to export.']);
    t.end();
});

test('internal errors are reported without crashing the thread', t => {
    const b = new ScriptBuilder();
    b.script(b.createRegister('q', 1));
    const {extension, util, reports, downloads, notes} = setup([{name: 'Sprite1', builder: b}]);
    b.container = () => ({getBlock: () => {
        throw new TypeError('boom');
    }});
    t.doesNotThrow(() => extension.toMLIR({}, util));
    t.same(downloads, []);
    t.same(reports, []);
    t.same(notes, ['MLIR export failed (internal error), see console']);
    t.end();
});

test('a failing download is reported without crashing the thread', t => {
    const b = new ScriptBuilder();
    b.script(b.createRegister('q', 1), b.gate('H', b.qubit(0)));
    const {extension, util, reports, notes} = setup([{name: 'Sprite1', builder: b}]);
    extension._download = () => {
        throw new Error('download failed');
    };
    t.doesNotThrow(() => extension.toMLIR({}, util));
    t.same(notes, ['MLIR export failed (internal error), see console']);
    t.same(reports, []);
    t.end();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tap --no-coverage test/unit/extension_quantum_mlir_block.js`
Expected: FAIL. `index.js` still imports the removed single-circuit flow and reads `util.target`. Record the actual failure.

- [ ] **Step 3: Implement**

In `src/extensions/mqt_quantum/index.js`:

1. Change `const {exportToMLIR, MLIRExportError} = require('./exporter');` to `const {exportProjectToMLIR, MLIRExportError} = require('./exporter');`.
2. Replace the beginning of `toMLIR`, from `    toMLIR (_args, util) {` up to but not including the `        try {\n            this._download(fileName, mlir);` block, with:

```js
    toMLIR (_args, util) {
        const fileName = 'quantum_circuits.mlir';
        let mlir;
        try {
            mlir = exportProjectToMLIR(this._collectCircuits());
        } catch (e) {
            if (e instanceof MLIRExportError) {
                const blockId = e.blockId || util.thread.peekStack();
                const where = e.spriteName ? ` in sprite "${e.spriteName}"` : '';
                console.error(`MLIR export failed${where} at block ${blockId}: ${e.message}`);
                if (blockId) {
                    this.runtime.visualReport(blockId, e.message);
                }
                this._notify(`MLIR export failed${where}: ${e.message}`);
            } else {
                console.error(e);
                this._notify('MLIR export failed (internal error), see console');
            }
            return;
        }
```

3. In the same method, change ``this._notify(`Exported circuit to ${fileName}`);`` to ``this._notify(`Exported circuits to ${fileName}`);``.
4. Directly after `toMLIR`, before `_download (fileName, text) {`, add:

```js
    // All 'Quantum Circuit' scripts of the project (clones excluded), in the order 'Run Quantum Circuits' uses.
    _collectCircuits () {
        const circuits = [];
        this.runtime.allScriptsByOpcodeDo('quantum_quantumEvaluate', (script, target) => {
            if (!target.isOriginal) return;
            circuits.push({
                blocks: target.blocks,
                hatId: script.blockId,
                spriteName: target.getName(),
                lookupVariable: id => target.lookupVariableById(id)
            });
        });
        return circuits;
    }

```

- [ ] **Step 4: Run the tests**

Run: `npx tap --no-coverage test/unit/extension_quantum_*.js` and once `npx tap --no-coverage -j4 test/unit/*.js`. Also lint the test: `npx eslint test/unit/extension_quantum_mlir_block.js`.
Expected: all pass. Two exceptions: `test/unit/io_clock.js` is a known wall-clock flake under `-j4` and unrelated; if it fails, rerun once. The integration test is not run here because its snapshots are updated in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/extensions/mqt_quantum/index.js test/unit/extension_quantum_mlir_block.js
git commit -m "feat: :sparkles: export all Quantum Circuit scripts of the project from one block

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Integration test per project and spec status

**Files:**
- Replace: `test/integration/quantum_mlir_export.js`
- Regenerate: `tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs`
- Modify: `docs/superpowers/specs/2026-10-21-mlir-export-design.md` (status line only)

**Interfaces:**
- Consumes: `QuantumExtension#toMLIR`, `_download`, `_notify` (Task 2); `validateWithMqtCc` (existing fixture).

- [ ] **Step 1: Replace the integration test**

Replace the whole contents of `test/integration/quantum_mlir_export.js` with:

```js
const path = require('path');
const test = require('tap').test;
const makeTestStorage = require('../fixtures/make-test-storage');
const readFileToBuffer = require('../fixtures/readProjectFile').readFileToBuffer;
const VirtualMachine = require('../../src/index');
const QuantumExtension = require('../../src/extensions/mqt_quantum/index.js');
const {validateWithMqtCc} = require('../fixtures/quantum/mlir-helpers');

const PROJECTS = ['02-circuits', '03-verification', '04-resource-estimation', '05-compilation'];

for (const project of PROJECTS) {
    test(`exports all circuits of the ${project} exercise`, async t => {
        if (!process.env.MQT_CC) {
            t.comment('MQT_CC is not set: skipping validation with mqt-cc');
        }
        const vm = new VirtualMachine();
        vm.attachStorage(makeTestStorage());
        await vm.loadProject(readFileToBuffer(path.resolve(__dirname, `../fixtures/quantum/${project}.sb3`)));
        const extension = new QuantumExtension(vm.runtime);
        const downloads = [];
        const notes = [];
        extension._download = (name, text) => downloads.push(text);
        extension._notify = message => notes.push(message);
        extension.toMLIR({}, {thread: {peekStack: () => null}});
        t.same(notes, ['Exported circuits to quantum_circuits.mlir']);
        t.equal(downloads.length, 1);
        t.matchSnapshot(downloads[0], 'quantum_circuits.mlir');
        validateWithMqtCc(t, downloads[0]);
        vm.quit();
    });
}
```

- [ ] **Step 2: Regenerate snapshots with mqt-cc validation on**

First delete the old snapshot file: `git rm -q tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs`. Its entry names no longer match.
Then run `MQT_CC=/home/damian/01_research/core/cmake-build-llvm23/mlir/tools/mqt-cc/mqt-cc npx tap --no-coverage --snapshot test/integration/quantum_mlir_export.js`.
Expected: PASS, 4 subtests, with `mqt-cc --emit=qco-optimized` and `--emit=qir-adaptive` assertions ok for each project.

- [ ] **Step 3: Review the snapshots**

Open the regenerated snapshot file and check:
- `02-circuits` and `04-resource-estimation` contain one circuit each, as `@main`'s body with no `func.call`.
- `03-verification` and `05-compilation` each contain `private @circuit_1`, `private @circuit_2` and a `@main` that calls both.
- The register names are `circuit_1_q` and `circuit_2_q`.

Report what you saw.

- [ ] **Step 4: Re-run without `--snapshot`, then the full suites, then lint**

Run:
- `npx tap --no-coverage test/integration/quantum_mlir_export.js`
- `npx tap --no-coverage -j4 test/unit/*.js test/integration/*.js`
- `npx eslint test/integration/quantum_mlir_export.js`

Expected: all pass. The `io_clock.js` flake may need one rerun.

- [ ] **Step 5: Spec status**

In `docs/superpowers/specs/2026-10-21-mlir-export-design.md`, change the line `Status: Implemented; project-wide export revision in progress` to `Status: Implemented (including project-wide export)`.

- [ ] **Step 6: Commit**

```bash
git add test/integration/quantum_mlir_export.js tap-snapshots/test/integration/quantum_mlir_export.js.test.cjs docs/superpowers/specs/2026-10-21-mlir-export-design.md
git commit -m "test: :white_check_mark: export each exercise project as one MLIR module

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Manual smoke test (needs the user)**

Run `npm run build`, then `npm start` in `../scratch-gui`. Put `Export Circuits to MLIR` under "when green flag clicked" in exercise 03 and click the flag. Check:
1. `quantum_circuits.mlir` downloads, with two circuit functions and `@main`.
2. A broken qubit index in one circuit shows a bubble on that block, plus an alert naming the sprite.
3. In a project without circuits, the bubble appears on the export block.

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
    t.match(downloads[0].text, 'func.call @circuit_1(%circuit_1_q) : (memref<1x!qc.qubit>) -> ()');
    t.match(downloads[0].text, 'func.call @circuit_2(%circuit_2_r) : (memref<1x!qc.qubit>) -> ()');
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

test('a block outside the edited sprite cannot freeze the thread: the alert is shown without the bubble', t => {
    const b = new ScriptBuilder();
    b.script(b.createRegister('q', 1), b.gate('H', b.qubit(5)));
    const {extension, util, downloads, notes} = setup([{name: 'Sprite2', builder: b}]);
    extension.runtime.visualReport = () => {
        throw 'Tried to report value on block that does not exist.'; // eslint-disable-line no-throw-literal
    };
    t.doesNotThrow(() => extension.toMLIR({}, util));
    t.match(notes[0], /^MLIR export failed in sprite "Sprite2": Qubit index 5 is out of range/);
    t.equal(notes.length, 1);
    t.same(downloads, []);
    t.end();
});

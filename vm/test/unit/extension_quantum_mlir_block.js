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

test('download failures are reported without crashing the thread', t => {
    const b = new ScriptBuilder();
    const hat = b.script(b.createRegister('q', 1), b.gate('H', b.qubit(0)), b.create('quantum_toMLIR'));
    const {extension, util, reports, notes} = setup(b, hat);
    extension._download = () => {
        throw new Error('blob failed');
    };
    t.doesNotThrow(() => extension.toMLIR({}, util));
    t.same(notes, ['MLIR export failed (internal error), see console']);
    t.same(reports, []);
    t.end();
});

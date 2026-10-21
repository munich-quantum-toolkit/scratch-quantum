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

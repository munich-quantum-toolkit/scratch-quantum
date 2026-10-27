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

test('several circuits become private functions that @main calls with registers it allocates', t => {
    const first = new ScriptBuilder();
    const second = new ScriptBuilder();
    const mlir = exportProjectToMLIR([
        circuit(first, first.script(first.createRegister('q', 2), first.gate('H', first.qubit(1))), 'Sprite1'),
        circuit(second, second.script(second.createRegister('q', 1), second.gate('X', second.qubit(0))), 'Sprite2')
    ]);
    t.equal(mlir, [
        '// Exported from Scratch by the MQT quantum extension',
        'module {',
        '  // \'Quantum Circuit\' script of sprite "Sprite1"',
        '  func.func private @circuit_1(%q: memref<2x!qc.qubit>) {',
        '    %c1 = arith.constant 1 : index',
        '    %0 = memref.load %q[%c1] : memref<2x!qc.qubit>',
        '    qc.h %0 : !qc.qubit',
        '    return',
        '  }',
        '  // \'Quantum Circuit\' script of sprite "Sprite2"',
        '  func.func private @circuit_2(%q: memref<1x!qc.qubit>) {',
        '    %c0 = arith.constant 0 : index',
        '    %0 = memref.load %q[%c0] : memref<1x!qc.qubit>',
        '    qc.x %0 : !qc.qubit',
        '    return',
        '  }',
        '  func.func @main() attributes {mqt.entry_point} {',
        '    %circuit_1_q = memref.alloc() {mqt.register_name = "circuit_1_q"} : memref<2x!qc.qubit>',
        '    func.call @circuit_1(%circuit_1_q) : (memref<2x!qc.qubit>) -> ()',
        '    memref.dealloc %circuit_1_q : memref<2x!qc.qubit>',
        '    %circuit_2_q = memref.alloc() {mqt.register_name = "circuit_2_q"} : memref<1x!qc.qubit>',
        '    func.call @circuit_2(%circuit_2_q) : (memref<1x!qc.qubit>) -> ()',
        '    memref.dealloc %circuit_2_q : memref<1x!qc.qubit>',
        '    return',
        '  }',
        '}',
        ''
    ].join('\n'));
    validateWithMqtCc(t, mlir);
    t.end();
});

test('registers are passed in creation order and deallocated in reverse order', t => {
    const first = new ScriptBuilder();
    const second = new ScriptBuilder();
    const mlir = exportProjectToMLIR([
        circuit(first, first.script(
            first.createRegister('a', 1),
            first.createRegister('b', 2),
            first.gate('H', first.qubit(1, 'b'))
        ), 'Sprite1'),
        circuit(second, second.script(second.createRegister('q', 1)), 'Sprite2')
    ]);
    expectLines(t, mlir, ['func.func private @circuit_1(%_: memref<1x!qc.qubit>, %_: memref<2x!qc.qubit>) {']);
    t.match(mlir, '@circuit_1(%a: memref<1x!qc.qubit>, %b: memref<2x!qc.qubit>)', 'arguments are named by register');
    const helpers = mlir.slice(0, mlir.indexOf('func.func @main()'));
    t.notMatch(helpers, /memref\.(alloc|dealloc)/, 'helpers neither allocate nor deallocate');
    expectLines(t, mlir, [
        'func.func @main() attributes {mqt.entry_point} {',
        '%_ = memref.alloc() {mqt.register_name = "circuit_1_a"} : memref<1x!qc.qubit>',
        '%_ = memref.alloc() {mqt.register_name = "circuit_1_b"} : memref<2x!qc.qubit>',
        'func.call @circuit_1(%_, %_) : (memref<1x!qc.qubit>, memref<2x!qc.qubit>) -> ()',
        'memref.dealloc %_ : memref<2x!qc.qubit>',
        'memref.dealloc %_ : memref<1x!qc.qubit>',
        '%_ = memref.alloc() {mqt.register_name = "circuit_2_q"} : memref<1x!qc.qubit>'
    ]);
    t.match(mlir, 'func.call @circuit_1(%circuit_1_a, %circuit_1_b)');
    t.match(mlir, 'memref.dealloc %circuit_1_b : memref<2x!qc.qubit>\n    memref.dealloc %circuit_1_a');
    validateWithMqtCc(t, mlir);
    t.end();
});

test('a circuit without registers gets a function without arguments', t => {
    const first = new ScriptBuilder();
    const second = new ScriptBuilder();
    const mlir = exportProjectToMLIR([
        circuit(first, first.script(), 'Sprite1'),
        circuit(second, second.script(second.createRegister('q', 1)), 'Sprite2')
    ]);
    expectLines(t, mlir, ['func.func private @circuit_1() {', 'return', '}']);
    expectLines(t, mlir, [
        'func.func @main() attributes {mqt.entry_point} {',
        'func.call @circuit_1() : () -> ()',
        '%_ = memref.alloc() {mqt.register_name = "circuit_2_q"} : memref<1x!qc.qubit>',
        'func.call @circuit_2(%_) : (memref<1x!qc.qubit>) -> ()',
        'memref.dealloc %_ : memref<1x!qc.qubit>',
        'return'
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

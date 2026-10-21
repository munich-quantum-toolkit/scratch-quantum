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

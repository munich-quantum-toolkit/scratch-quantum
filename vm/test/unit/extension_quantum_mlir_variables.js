const test = require('tap').test;
const ScriptBuilder = require('../fixtures/quantum/script-builder');
const {exportScript, expectLines, expectExportError, validateWithMQTCC} = require('../fixtures/quantum/mlir-helpers');

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
    validateWithMQTCC(t, mlir);
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
    validateWithMQTCC(t, mlir);
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

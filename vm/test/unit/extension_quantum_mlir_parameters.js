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

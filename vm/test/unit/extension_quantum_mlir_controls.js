const test = require('tap').test;
const ScriptBuilder = require('../fixtures/quantum/script-builder');
const {exportScript, expectLines, expectExportError, validateWithMQTCC} = require('../fixtures/quantum/mlir-helpers');

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
    validateWithMQTCC(t, mlir);
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
    validateWithMQTCC(t, mlir);
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

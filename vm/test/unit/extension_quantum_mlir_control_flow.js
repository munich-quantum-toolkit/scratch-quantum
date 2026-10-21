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

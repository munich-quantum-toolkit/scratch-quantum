const test = require('tap').test;
const {MLIREmitter, formatF64} = require('../../src/extensions/mqt_quantum/mlir-emitter');

test('formatF64 always produces an MLIR float literal', t => {
    t.equal(formatF64(1), '1.0');
    t.equal(formatF64(-0.5), '-0.5');
    t.equal(formatF64(1e-7), '1.0e-7');
    t.equal(formatF64(1e21), '1.0e+21');
    t.throws(() => formatF64(Infinity));
    t.end();
});

test('fresh names are unique', t => {
    const emitter = new MLIREmitter();
    t.equal(emitter.fresh('q'), '%q');
    t.equal(emitter.fresh('q'), '%q_1');
    t.equal(emitter.fresh(), '%0');
    t.equal(emitter.fresh(), '%1');
    t.equal(emitter.constIndex(0), '%c0');
    t.equal(emitter.constIndex(0), '%c0_1');
    t.end();
});

test('constants and nested regions are emitted into a module', t => {
    const emitter = new MLIREmitter();
    emitter.constF64(0.5);
    const condition = emitter.constBool(true);
    emitter.open(`scf.if ${condition}`);
    emitter.line('qc.x %q : !qc.qubit');
    emitter.reopen('else');
    emitter.comment('nothing');
    emitter.close();
    t.equal(emitter.toModule('header'), [
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
        '}',
        ''
    ].join('\n'));
    t.end();
});

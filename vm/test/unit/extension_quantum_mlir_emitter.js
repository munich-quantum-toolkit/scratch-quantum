const test = require('tap').test;
const {MLIREmitter, buildModule, formatF64} = require('../../src/extensions/mqt_quantum/mlir-emitter');

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

test('constants and nested regions are emitted into a function inside a module', t => {
    const emitter = new MLIREmitter();
    emitter.constF64(0.5);
    const condition = emitter.constBool(true);
    emitter.open(`scf.if ${condition}`);
    emitter.line('qc.x %q : !qc.qubit');
    emitter.reopen('else');
    emitter.comment('nothing');
    emitter.close();
    const other = new MLIREmitter();
    other.line('qc.h %q : !qc.qubit');
    t.equal(buildModule('header', [emitter.toFunction('@main() attributes {mqt.entry_point}'),
        other.toFunction('private @circuit_1()', 'a comment')]), [
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
        '  // a comment',
        '  func.func private @circuit_1() {',
        '    qc.h %q : !qc.qubit',
        '    return',
        '  }',
        '}',
        ''
    ].join('\n'));
    t.end();
});

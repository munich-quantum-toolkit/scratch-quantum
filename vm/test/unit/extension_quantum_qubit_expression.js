const test = require('tap').test;
const {AST} = require('../../src/extensions/mqt_quantum/qubit-expression');
const QuantumExtension = require('../../src/extensions/mqt_quantum/index.js');

test('qubit expressions split into positive and negated register accesses', t => {
    const [positive, negative] = AST.parse('q[0] and not r[2]').getPositiveNegative();
    t.same(positive.map(leaf => [leaf.register, leaf.index]), [['q', 0]]);
    t.same(negative.map(leaf => [leaf.register, leaf.index]), [['r', 2]]);
    t.end();
});

test('the quantum extension loads in Node', t => {
    t.equal(new QuantumExtension(null).getInfo().id, 'quantum');
    t.end();
});

test('the quantum extension still creates per-thread circuit state', t => {
    const extension = new QuantumExtension(null);
    t.ok(extension.getCurrentExecutionInformation({thread: {}}).simulationState);
    t.end();
});

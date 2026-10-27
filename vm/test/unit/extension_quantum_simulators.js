const test = require('tap').test;
const StatevectorSimulator = require('../../src/extensions/mqt_quantum/statevector-simulator.js').default;
const {ResourceEstimator, ResourceEstimatorSettings} =
    require('../../src/extensions/mqt_quantum/resource-estimator.js');

const q = index => ({register: 'q', index});
const EPSILON = 1e-9;

// Amplitudes of a 2-qubit register `q`; qubit 0 is the least significant bit of the basis index.
const amplitudes = simulator => Array.from({length: simulator.statevector.n}, (_, i) => {
    const amplitude = simulator.statevector.getElement(i);
    return [amplitude.real, amplitude.imag];
});

const simulatorWithRegister = () => {
    const simulator = new StatevectorSimulator(0);
    simulator.createRegister('q', 2);
    return simulator;
};

const close = (t, actual, expected, message) => {
    t.ok(Math.abs(actual - expected) < EPSILON, message, {actual, expected});
};

test('RX(180°) maps |0> to |1> up to global phase', t => {
    const simulator = simulatorWithRegister();
    simulator.applyRotation('X', Math.PI, [q(0)], [], []);
    const [[re0, im0], [re1, im1]] = amplitudes(simulator);
    close(t, Math.hypot(re0, im0), 0, '|0> amplitude vanishes');
    close(t, Math.hypot(re1, im1), 1, '|1> amplitude has magnitude 1');
    t.end();
});

test('a controlled RY(180°) acts only when the control is |1>', t => {
    const simulator = simulatorWithRegister();
    simulator.applyGate('X', [q(0)], [], []);
    simulator.applyRotation('Y', Math.PI, [q(1)], [q(0)], []);
    const state = amplitudes(simulator);
    close(t, Math.hypot(...state[3]), 1, 'state is |11>');

    const untouched = simulatorWithRegister();
    untouched.applyRotation('Y', Math.PI, [q(1)], [q(0)], []);
    close(t, Math.hypot(...amplitudes(untouched)[0]), 1, 'control |0> leaves |00>');
    t.end();
});

test('RZ is diagonal: RZ(90°)|+> equals S|+> up to global phase', t => {
    const simulator = simulatorWithRegister();
    simulator.applyGate('H', [q(0)], [], []);
    simulator.applyRotation('Z', Math.PI / 2, [q(0)], [], []);
    const [[re0, im0], [re1, im1]] = amplitudes(simulator);
    close(t, Math.hypot(re0, im0), Math.SQRT1_2, '|0> keeps its magnitude');
    close(t, Math.hypot(re1, im1), Math.SQRT1_2, '|1> keeps its magnitude');
    // relative phase a1/a0 must be i
    const ratioRe = ((re1 * re0) + (im1 * im0)) / ((re0 * re0) + (im0 * im0));
    const ratioIm = ((im1 * re0) - (re1 * im0)) / ((re0 * re0) + (im0 * im0));
    close(t, ratioRe, 0, 'relative phase is i (real part)');
    close(t, ratioIm, 1, 'relative phase is i (imaginary part)');
    t.end();
});

test('T applied twice equals S', t => {
    const viaT = simulatorWithRegister();
    viaT.applyGate('H', [q(0)], [], []);
    viaT.applyGate('T', [q(0)], [], []);
    viaT.applyGate('T', [q(0)], [], []);
    const viaS = simulatorWithRegister();
    viaS.applyGate('H', [q(0)], [], []);
    viaS.applyGate('S', [q(0)], [], []);
    const [a, b] = [amplitudes(viaT), amplitudes(viaS)];
    for (let i = 0; i < a.length; i++) {
        close(t, a[i][0], b[i][0], `amplitude ${i} (real)`);
        close(t, a[i][1], b[i][1], `amplitude ${i} (imaginary)`);
    }
    t.end();
});

test('the resource estimator tracks X flips as 0/1 values', t => {
    const estimator = new ResourceEstimator(new ResourceEstimatorSettings(false, false, false));
    estimator.createRegister('q', 2);
    estimator.applyGate('X', [q(0)], [], []);
    t.equal(estimator.measure(q(0)), 1, 'X flips a known |0> to 1');
    estimator.applyGate('X', [q(0)], [], []);
    t.equal(estimator.measure(q(0)), 0, 'a second X flips it back to 0');
    estimator.applyGate('X', [q(1)], [], [q(0)]);
    t.equal(estimator.measure(q(1)), 1, 'a negative control on a known 0 lets the X act');
    t.end();
});

test('the resource estimator keeps unknown qubits unknown under X', t => {
    const estimator = new ResourceEstimator(new ResourceEstimatorSettings(false, false, false));
    estimator.createRegister('q', 1);
    estimator.applyGate('H', [q(0)], [], []);
    estimator.applyGate('X', [q(0)], [], []);
    t.equal(estimator.qubits[0], null, 'X on an unknown qubit stays unknown');
    t.end();
});

const {QubitLimitError} = require('../../src/extensions/mqt_quantum/statevector-simulator.js');

// Measures every qubit of a register, qubit 0 first (like `measure (qubits of register ...)`).
const measureRegister = (simulator, register) => {
    let result = '';
    for (let i = 0; i < simulator.getRegisterSize(register); i++) {
        result += simulator.measure({register, index: i});
    }
    return result;
};

test('starting state 1 sets the first qubit of a 3-qubit register', t => {
    const simulator = new StatevectorSimulator(1);
    simulator.createRegister('q', 3);
    t.equal(measureRegister(simulator, 'q'), '100');
    t.end();
});

test('starting state 6 sets the second and third qubits', t => {
    const simulator = new StatevectorSimulator(6);
    simulator.createRegister('q', 3);
    t.equal(measureRegister(simulator, 'q'), '011');
    t.end();
});

test('starting state digits continue across registers in creation order', t => {
    const simulator = new StatevectorSimulator(5);
    simulator.createRegister('a', 1);
    simulator.createRegister('b', 2);
    t.equal(measureRegister(simulator, 'a'), '1');
    t.equal(measureRegister(simulator, 'b'), '01');
    t.end();
});

test('starting state digits beyond the last qubit are ignored', t => {
    const simulator = new StatevectorSimulator(13); // 1101
    simulator.createRegister('q', 2);
    t.equal(simulator.statevector.n, 4, 'no hidden qubits are added');
    t.equal(simulator.registers.length, 1, 'no hidden register is added');
    t.equal(measureRegister(simulator, 'q'), '10');
    t.end();
});

test('starting state 0 behaves like no starting state', t => {
    const simulator = new StatevectorSimulator(0);
    simulator.createRegister('q', 3);
    t.same(amplitudes(simulator), [[1, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]);
    t.same(simulator.registers.map(r => [r.name, r.size]), [['q', 3]]);
    t.end();
});

test('qubits keep their state when a later register is created', t => {
    const simulator = new StatevectorSimulator(0);
    simulator.createRegister('a', 1);
    simulator.applyGate('X', [{register: 'a', index: 0}], [], []);
    simulator.createRegister('b', 2);
    t.equal(measureRegister(simulator, 'a'), '1');
    t.equal(measureRegister(simulator, 'b'), '00');
    t.end();
});

test('the statevector simulator handles 10 qubits across registers', t => {
    const simulator = new StatevectorSimulator(0);
    simulator.createRegister('a', 4);
    simulator.createRegister('b', 6);
    t.equal(simulator.statevector.n, 2 ** 10);
    t.same(simulator.registers.map(r => [r.name, r.size]), [['a', 4], ['b', 6]]);
    t.end();
});

test('a register that would exceed 10 qubits throws and changes nothing', t => {
    const simulator = new StatevectorSimulator(0);
    simulator.createRegister('a', 4);
    simulator.applyGate('H', [{register: 'a', index: 0}], [], []);
    const before = amplitudes(simulator);
    t.throws(() => simulator.createRegister('b', 7), QubitLimitError);
    try {
        simulator.createRegister('b', 7);
    } catch (e) {
        t.equal(e.message, 'The simulator supports at most 10 qubits. This circuit needs 11.');
    }
    t.same(amplitudes(simulator), before, 'statevector unchanged');
    t.same(simulator.registers.map(r => [r.name, r.size]), [['a', 4]], 'registers unchanged');
    t.end();
});

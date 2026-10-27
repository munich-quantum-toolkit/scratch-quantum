const test = require('tap').test;
const QuantumExtension = require('../../src/extensions/mqt_quantum/index.js');

const BLOCK_ID = 'block-1';

const setup = ({visualReportThrows = false} = {}) => {
    const reports = [];
    const runtime = {
        threads: [],
        visualReport: (blockId, value) => {
            if (visualReportThrows) throw new Error('block is not in the edited sprite');
            reports.push({blockId, value});
        }
    };
    const extension = new QuantumExtension(runtime);
    const makeThread = () => {
        const thread = {stopped: 0, peekStack: () => BLOCK_ID};
        thread.stopThisScript = () => {
            thread.stopped++;
        };
        return thread;
    };
    // Mirrors BlockUtility: stopThisScript delegates to the thread.
    const makeUtil = thread => ({
        thread,
        stackFrame: {},
        startedHats: [],
        yield: () => {},
        stopThisScript () {
            this.thread.stopThisScript();
        }
    });
    return {extension, runtime, reports, makeThread, makeUtil};
};

const silenceConsoleError = t => {
    const original = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args.join(' '));
    t.teardown(() => {
        console.error = original;
    });
    return logged;
};

test('creating a register above 10 qubits reports on the block and stops the script', t => {
    const logged = silenceConsoleError(t);
    const {extension, reports, makeThread, makeUtil} = setup();
    const util = makeUtil(makeThread());
    extension.createRegister({NAME: 'a', NUM: '6'}, util);
    t.doesNotThrow(() => extension.createRegister({NAME: 'b', NUM: '5'}, util));
    const message = 'The simulator supports at most 10 qubits. This circuit needs 11.';
    t.equal(util.thread.stopped, 1, 'the script is stopped');
    t.same(reports, [{blockId: BLOCK_ID, value: message}]);
    t.ok(logged.includes(message), 'the message is logged');
    t.equal(extension.getCurrentExecutionInformation(util).simulationState.getRegisterSize('b'), 0);
    t.end();
});

test('a failing visualReport does not escape the handler', t => {
    silenceConsoleError(t);
    const {extension, makeThread, makeUtil} = setup({visualReportThrows: true});
    const util = makeUtil(makeThread());
    t.doesNotThrow(() => extension.createRegister({NAME: 'q', NUM: '11'}, util));
    t.equal(util.thread.stopped, 1, 'the script is still stopped');
    t.end();
});

test('10 qubits are created without stopping the script', t => {
    const {extension, reports, makeThread, makeUtil} = setup();
    const util = makeUtil(makeThread());
    extension.createRegister({NAME: 'q', NUM: '10'}, util);
    t.equal(util.thread.stopped, 0);
    t.same(reports, []);
    t.end();
});

const runFromState = (state, options) => {
    const ctx = setup(options);
    const circuitThread = ctx.makeThread();
    const util = ctx.makeUtil(ctx.makeThread());
    util.startHats = opcode => {
        util.startedHats.push(opcode);
        return [circuitThread];
    };
    ctx.extension.runCircuitsState({STATE: state}, util);
    return {...ctx, util, circuitThread};
};

test('runCircuitsState casts a typed string to a number', t => {
    const {extension, util, circuitThread, makeUtil} = runFromState('3');
    t.same(util.startedHats, ['quantum_quantumEvaluate'], 'circuits are started');
    const simulator = extension.circuits.get(circuitThread).simulationState;
    t.equal(simulator.startingState, 3);
    const circuitUtil = makeUtil(circuitThread);
    extension.createRegister({NAME: 'q', NUM: '3'}, circuitUtil);
    t.equal(extension.measure({QUBIT: 'q[0] and q[1] and q[2]'}, circuitUtil), '110');
    t.end();
});

test('runCircuitsState with 0 starts from all zeros', t => {
    const {extension, circuitThread} = runFromState('0');
    t.equal(extension.circuits.get(circuitThread).simulationState.startingState, 0);
    t.end();
});

for (const invalid of ['-1', '1.5', 'abc', -2, NaN]) {
    test(`runCircuitsState rejects STATE=${invalid} (${typeof invalid}) without starting circuits`, t => {
        const logged = silenceConsoleError(t);
        const {util, reports} = runFromState(invalid);
        const message = 'The starting state must be a whole number of at least 0.';
        t.same(util.startedHats, [], 'no circuits are started');
        t.same(reports, [{blockId: BLOCK_ID, value: message}]);
        t.ok(logged.includes(message), 'the message is logged');
        t.end();
    });
}

test('runCircuitsState reports invalid input even when visualReport throws', t => {
    silenceConsoleError(t);
    t.doesNotThrow(() => runFromState('x', {visualReportThrows: true}));
    t.end();
});

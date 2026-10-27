const test = require('tap').test;
const QuantumExtension = require('../../src/extensions/mqt_quantum/index.js');
const Thread = require('../../src/engine/thread.js');
const Sequencer = require('../../src/engine/sequencer.js');

const BLOCK_ID = 'block-1';
const PROCEDURE_CALL_ID = 'call-1';

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
    const sequencer = new Sequencer(runtime);
    const blocks = {
        [PROCEDURE_CALL_ID]: {id: PROCEDURE_CALL_ID, opcode: 'procedures_call'},
        [BLOCK_ID]: {id: BLOCK_ID, opcode: 'quantum_createRegister'}
    };
    // A real thread whose stack holds the given block ids (the running block last).
    const makeThread = (stack = [BLOCK_ID]) => {
        const thread = new Thread(stack[0]);
        thread.target = {blocks: {getBlock: id => blocks[id]}};
        stack.forEach(id => thread.pushStack(id));
        return thread;
    };
    // Mirrors BlockUtility.
    const makeUtil = thread => ({
        thread,
        sequencer,
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

const assertEnded = (t, thread, message) => {
    t.equal(thread.status, Thread.STATUS_DONE, `${message}: thread is done`);
    t.same(thread.stack, [], `${message}: stack is empty`);
};

test('creating a register above 10 qubits reports on the block and stops the circuit', t => {
    const logged = silenceConsoleError(t);
    const {extension, reports, makeThread, makeUtil} = setup();
    const util = makeUtil(makeThread());
    extension.createRegister({NAME: 'a', NUM: '6'}, util);
    t.doesNotThrow(() => extension.createRegister({NAME: 'b', NUM: '5'}, util));
    const message = 'The simulator supports at most 10 qubits. This circuit needs 11.';
    assertEnded(t, util.thread, 'over the limit');
    t.same(reports, [{blockId: BLOCK_ID, value: message}]);
    t.ok(logged.includes(message), 'the message is logged');
    t.equal(extension.getCurrentExecutionInformation(util).simulationState.getRegisterSize('b'), 0);
    t.end();
});

test('a register above 10 qubits inside a custom block stops the whole circuit', t => {
    silenceConsoleError(t);
    const {extension, reports, makeThread, makeUtil} = setup();
    const util = makeUtil(makeThread([BLOCK_ID, PROCEDURE_CALL_ID, BLOCK_ID]));
    extension.createRegister({NAME: 'q', NUM: '11'}, util);
    assertEnded(t, util.thread, 'inside a procedure');
    t.equal(reports.length, 1, 'reported once');
    t.end();
});

test('a failing visualReport does not escape the handler', t => {
    silenceConsoleError(t);
    const {extension, makeThread, makeUtil} = setup({visualReportThrows: true});
    const util = makeUtil(makeThread());
    t.doesNotThrow(() => extension.createRegister({NAME: 'q', NUM: '11'}, util));
    assertEnded(t, util.thread, 'after a failed report');
    t.end();
});

test('10 qubits are created without stopping the circuit', t => {
    const {extension, reports, makeThread, makeUtil} = setup();
    const util = makeUtil(makeThread());
    extension.createRegister({NAME: 'q', NUM: '10'}, util);
    t.equal(util.thread.status, Thread.STATUS_RUNNING);
    t.same(util.thread.stack, [BLOCK_ID]);
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

for (const [typed, expected] of [['', 0], [' 3 ', 3], ['1e2', 100]]) {
    test(`runCircuitsState accepts ${JSON.stringify(typed)} as ${expected}`, t => {
        const {extension, util, circuitThread, reports} = runFromState(typed);
        t.same(util.startedHats, ['quantum_quantumEvaluate'], 'circuits are started');
        t.equal(extension.circuits.get(circuitThread).simulationState.startingState, expected);
        t.same(reports, []);
        t.end();
    });
}

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

test('resource estimation keeps the previous result while the circuits are still running', t => {
    const {extension, runtime, makeThread, makeUtil} = setup();
    const previous = [{qubits: 1, gates: {}}];
    runtime.lastResourceEstimate = previous;
    const circuit = makeThread();
    const util = makeUtil(makeThread());
    util.startHats = () => [circuit];
    // First call starts the circuits and yields.
    extension.estimateCircuitsResources({}, util);
    t.equal(runtime.lastResourceEstimate, previous, 'the running estimate does not overwrite the previous one');
    // The circuit is still running.
    runtime.threads = [circuit];
    extension.estimateCircuitsResources({}, util);
    t.equal(runtime.lastResourceEstimate, previous, 'still running: previous result kept');
    // The circuit has finished: the new result is stored.
    runtime.threads = [];
    extension.estimateCircuitsResources({}, util);
    t.ok(Array.isArray(runtime.lastResourceEstimate), 'finished: the new result is an array');
    t.not(runtime.lastResourceEstimate, previous, 'finished: the new result replaces the previous one');
    t.equal(runtime.lastResourceEstimate.length, 1, 'one result per circuit');
    t.end();
});

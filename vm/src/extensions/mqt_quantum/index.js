const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const StatevectorSimulator = require('./statevector-simulator').default;
const {QubitLimitError} = require('./statevector-simulator');
const {ResourceEstimator, ResourceEstimatorSettings} = require('./resource-estimator');
const {AST, LeafNode, NegatedNode, AndNode, validateRegisterName, validateQubitIndex} =
    require('./qubit-expression');
const {exportToMLIR, MLIRExportError} = require('./exporter');
const {downloadTextFile} = require('./download');

const error = function (message) {
    console.error(message);
};

/*
TODOS

- test initial state when changes happen
*/

class CircuitExecutionInformation {
    constructor (simulationState) {
        this.simulationState = simulationState;
        this.controlStack = [];
    }
}

const ResourceType = {
    ALL: 'all',
    QUBITS: 'qubits',
    GATES: 'nq', // append the number of qubits
    SWAP: 'swap'
};

class QuantumExtension {
    constructor (runtime) {
        this.runtime = runtime;
        this.name = 'Quantum';
        this.version = '1.0.0';
        this.description = 'An extension for quantum computing simulations.';
        this.circuits = new WeakMap();
    }

    getInfo () {
        return {
            id: 'quantum',
            name: this.name,
            color1: '#0065bd',
            color2: '#005293',
            blocks: [
                {
                    opcode: 'createRegister',
                    blockType: BlockType.COMMAND,
                    color: '#003359',
                    text: 'create quantum register [NAME] with [NUM] qubits',
                    arguments: {
                        NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: 'q'
                        },
                        NUM: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 2
                        }
                    }
                },
                {
                    opcode: 'getQubit',
                    blockType: BlockType.REPORTER,
                    color: '#003359',
                    text: 'qubit [QUBIT] of register [NAME]',
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: 'q'
                        }
                    }
                },
                {
                    opcode: 'getQubits',
                    blockType: BlockType.REPORTER,
                    color: '#003359',
                    text: 'qubits of register [NAME]',
                    arguments: {
                        NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: 'q'
                        }
                    }
                },
                "---",
                {
                    opcode: 'applyGate',
                    blockType: BlockType.COMMAND,
                    text: 'apply [GATE] gate to [QUBIT]',
                    arguments: {
                        GATE: {
                            type: ArgumentType.STRING,
                            menu: 'gates',
                            defaultValue: 'X'
                        },
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        }
                    }
                },
                {
                    opcode: 'swapGate',
                    blockType: BlockType.COMMAND,
                    text: 'apply SWAP gate to [QUBIT1] and [QUBIT2]',
                    arguments: {
                        QUBIT1: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        },
                        QUBIT2: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        }
                    }
                },
                "---",
                {
                    opcode: 'controlled',
                    blockType: BlockType.CONDITIONAL,
                    branchCount: 1,
                    color: '#64a0c8',
                    text: 'controlled on [QUBIT]',
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        }
                    }
                },
                {
                    opcode: 'and',
                    blockType: BlockType.REPORTER,
                    color: '#98c6ea',
                    text: '[QUBIT1] and [QUBIT2]',
                    arguments: {
                        QUBIT1: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        },
                        QUBIT2: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        }
                    }
                },
                {
                    opcode: 'negated',
                    blockType: BlockType.REPORTER,
                    color: '#98c6ea',
                    text: 'negated control [QUBIT]',
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        }
                    }
                },
                "---",
                {
                    opcode: 'rotateAxis',
                    blockType: BlockType.COMMAND,
                    text: 'rotate [QUBIT] by [ANGLE] degrees around [AXIS] axis',
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        },
                        ANGLE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 180
                        },
                        AXIS: {
                            type: ArgumentType.STRING,
                            menu: 'axes',
                            defaultValue: 'X'
                        }
                    }
                },
                {
                    opcode: 'u3',
                    blockType: BlockType.COMMAND,
                    text: 'apply U3 gate to [QUBIT] with angles [THETA] [PHI] [LAMBDA]',
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        },
                        THETA: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        PHI: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        LAMBDA: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    }
                },
                "---",
                {
                    opcode: 'measure',
                    blockType: BlockType.BOOLEAN,
                    text: 'measure [QUBIT]',
                    color: '#59c059',
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        }
                    }
                },
                {
                    opcode: 'evaluateLabel',
                    blockType: BlockType.BUTTON,
                    text: 'Circuit Execution'
                },

                {
                    opcode: 'quantumEvaluate',
                    blockType: BlockType.HAT,
                    text: 'Quantum Circuit',
                    color: '#64a0c8',
                    isEdgeActivated: false
                },
                {
                    opcode: 'runCircuits',
                    blockType: BlockType.COMMAND,
                    color: '#64a0c8',
                    text: 'Run Quantum Circuits'
                },
                {
                    opcode: 'runCircuitsState',
                    blockType: BlockType.COMMAND,
                    color: '#64a0c8',
                    text: 'Run Quantum Circuits starting from [STATE]',
                    arguments: {
                        STATE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        }
                    }
                },
                {
                    opcode: 'setSimulator',
                    blockType: BlockType.COMMAND,
                    text: 'Set Simulator to [SIMULATOR]',
                    color: '#64a0c8',
                    arguments: {
                        SIMULATOR: {
                            type: ArgumentType.STRING,
                            defaultValue: 'Statevector Simulator',
                            menu: 'simulator'
                        }
                    }
                },
                {
                    opcode: 'resourceEstimationLabel',
                    blockType: BlockType.BUTTON,
                    color: '#64a0c8',
                    text: 'Resource Estimation'
                },
                {
                    opcode: 'estimateCircuitsResources',
                    blockType: BlockType.COMMAND,
                    color: '#64a0c8',
                    text: 'Perform Quantum Resource Estimation'
                },
                {
                    opcode: 'estimatedCircuitsResources',
                    blockType: BlockType.REPORTER,
                    color: '#64a0c8',
                    text: 'Estimated Quantum Resources'
                },
                {
                    opcode: 'estimatedCircuitsResourcesOf',
                    blockType: BlockType.REPORTER,
                    color: '#64a0c8',
                    text: 'Estimated Quantum Resources of Circuit #[CIRCUIT]',
                    arguments: {
                        CIRCUIT: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1',
                        }
                    }
                },
                {
                    opcode: 'reQubits',
                    blockType: BlockType.REPORTER,
                    color: '#64a0c8',
                    text: 'Estimated Qubit Requirements of Circuit  #[CIRCUIT]',
                    arguments: {
                        CIRCUIT: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1',
                        }
                    }
                },
                {
                    opcode: 'reGates',
                    blockType: BlockType.REPORTER,
                    color: '#64a0c8',
                    text: 'Estimated [COUNT] Qubit Gates in Circuit  #[CIRCUIT]',
                    arguments: {
                        CIRCUIT: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1',
                        },
                        COUNT: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '2',
                        }
                    }
                },
                {
                    opcode: 'reSwaps',
                    blockType: BlockType.REPORTER,
                    color: '#64a0c8',
                    text: 'Estimated SWAP Gates in Circuit  #[CIRCUIT]',
                    arguments: {
                        CIRCUIT: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1',
                        }
                    }
                },
                {
                    opcode: 'enableDisableSwapDecomposition',
                    blockType: BlockType.COMMAND,
                    text: '[ENABLED] SWAP decomposition',
                    color: '#64a0c8',
                    arguments: {
                        ENABLED: {
                            type: ArgumentType.BOOLEAN,
                            defaultValue: 'true',
                            menu: 'enable'
                        }
                    }
                },
                {
                    opcode: 'enableDisableNegativeControlTranslation',
                    blockType: BlockType.COMMAND,
                    text: '[ENABLED] substitute negative control lines',
                    color: '#64a0c8',
                    arguments: {
                        ENABLED: {
                            type: ArgumentType.BOOLEAN,
                            defaultValue: 'true',
                            menu: 'enable'
                        }
                    }
                },
                {
                    opcode: 'enableDisableToffoliDecomposition',
                    blockType: BlockType.COMMAND,
                    text: '[ENABLED] Toffoli decomposition',
                    color: '#64a0c8',
                    arguments: {
                        ENABLED: {
                            type: ArgumentType.BOOLEAN,
                            defaultValue: 'true',
                            menu: 'enable'
                        }
                    }
                },
                {
                    opcode: 'compatibilityLabel',
                    blockType: BlockType.BUTTON,
                    color: '#64a0c8',
                    text: 'Compatibility'
                },
                {
                    opcode: 'toMLIR',
                    blockType: BlockType.COMMAND,
                    color: '#1c466c',
                    text: 'Export Circuits to MLIR'
                }
            ],
            menus: {
                gates: {
                    acceptReporters: true,
                    items: [
                        {text: 'X', value: 'X'},
                        {text: 'Y', value: 'Y'},
                        {text: 'Z', value: 'Z'},
                        {text: 'H', value: 'H'},
                        {text: 'S', value: 'S'},
                        {text: 'T', value: 'T'}
                    ]
                },
                axes: {
                    acceptReporters: true,
                    items: [
                        {text: 'X', value: 'X'},
                        {text: 'Y', value: 'Y'},
                        {text: 'Z', value: 'Z'}
                    ]
                },
                enable: {
                    items: [
                        {text: 'Enable', value: 'true'},
                        {text: 'Disable', value: 'false'}
                    ]
                },
                simulator: {
                    acceptReporters: true,
                    items: [
                        {text: 'Statevector Simulator', value: 'Statevector Simulator'},
                    ]
                }
            }
        };
    }

    createRegister (args, util) {
        const registerName = args.NAME;
        const numQubits = parseInt(args.NUM, 10);
        validateRegisterName(registerName);
        if (numQubits === 0) {
            return error('Number of qubits must be greater than 0');
        }
        validateQubitIndex(numQubits);
        try {
            this.getCurrentExecutionInformation(util).simulationState.createRegister(registerName, numQubits);
        } catch (e) {
            if (!(e instanceof QubitLimitError)) throw e;
            this._reportOnBlock(util, e.message);
            // end the whole circuit, also when called inside a custom block (stopThisScript would only leave that)
            util.sequencer.retireThread(util.thread);
        }
    }

    /**
     * Show an error to the user: log it and put a bubble on the block that is running.
     * Never throws: in the GUI, visualReport throws for blocks of sprites that are not being edited.
     * @param {object} util - block utility of the running block.
     * @param {string} message - student-facing message.
     */
    _reportOnBlock (util, message) {
        error(message);
        try {
            this.runtime.visualReport(util.thread.peekStack(), message);
        } catch (e) {
            error(e);
        }
    }

    getQubit (args) {
        const qubit = parseInt(args.QUBIT, 10);
        const registerName = args.NAME;
        return `${registerName}[${qubit}]`;
    }

    getQubits (args, util) {
        const registerName = args.NAME;
        const executionInfo = this.getCurrentExecutionInformation(util);
        const numQubits = executionInfo.simulationState.getRegisterSize(registerName);
        const qubits = Array.from({length: numQubits}, (_, i) => `${registerName}[${i}]`).join(' and ');
        return qubits;
    }

    and (args) {
        const left = args.QUBIT1;
        const right = args.QUBIT2;
        if (left === '/') {
            return right;
        }
        if (right === '/') {
            return left;
        }
        return `${left} and ${right}`;
    }

    negated (args) {
        const qubit = args.QUBIT;
        if (qubit === '/') {
            return '/';
        }
        const child = AST.parse(qubit).root;
        if (child instanceof LeafNode) {
            return `not ${qubit}`;
        }
        if (child instanceof NegatedNode) {
            return child.value.value;
        }
        if (child instanceof AndNode) {
            return error('Invalid negated expression');
        }
        return `not ${qubit}`;
    }

    getCurrentControls (controlStack) {
        const pos = [];
        const neg = [];
        for (const control of controlStack) {
            const [p, n] = control.getPositiveNegative();
            pos.push(...p);
            neg.push(...n);
        }
        return [pos, neg];
    }

    applyGate (args, util) {
        const gate = args.GATE;
        const qubit = args.QUBIT;
        if (qubit === '/') {
            return error('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        const targets = parsedQubit.toQubitList();

        const [posControls, negControls] = this.getCurrentControls(
            this.getCurrentExecutionInformation(util).controlStack
        );

        for (const target of targets) {
            this.getCurrentExecutionInformation(util).simulationState.applyGate(
                gate, [target], posControls, negControls
            );
        }

    }

    swapGate (args, util) {
        const qubit1 = args.QUBIT1;
        const qubit2 = args.QUBIT2;
        if (qubit1 === '/' || qubit2 === '/') {
            return error('Invalid qubit value');
        }
        const parsedQubit1 = AST.parse(qubit1).root;
        const parsedQubit2 = AST.parse(qubit2).root;

        if (!(parsedQubit1 instanceof LeafNode) || !(parsedQubit2 instanceof LeafNode)) {
            return error('Invalid qubit value');
        }

        const [posControls, negControls] = this.getCurrentControls(
            this.getCurrentExecutionInformation(util).controlStack
        );
        this.getCurrentExecutionInformation(util).simulationState.applyGate(
            'SWAP', [parsedQubit1, parsedQubit2], posControls, negControls
        );
    }

    rotateAxis (args, util) {
        const qubit = args.QUBIT;
        const angle = parseFloat(args.ANGLE);
        const axis = args.AXIS;
        if (qubit === '/') {
            return error('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        const angleInRadians = angle * (Math.PI / 180);

        const targets = parsedQubit.toQubitList();

        const [posControls, negControls] = this.getCurrentControls(
            this.getCurrentExecutionInformation(util).controlStack
        );

        for (const target of targets) {
            this.getCurrentExecutionInformation(util).simulationState.applyRotation(
                axis, angleInRadians, [target], posControls, negControls
            );
        }

    }

    u3 (args, util) {
        const qubit = args.QUBIT;
        const angleTheta = parseFloat(args.THETA);
        const anglePhi = parseFloat(args.PHI);
        const angleLambda = parseFloat(args.LAMBDA);
        if (qubit === '/') {
            return error('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        const angleThetaInRadians = angleTheta * (Math.PI / 180);
        const anglePhiInRadians = anglePhi * (Math.PI / 180);
        const angleLambdaInRadians = angleLambda * (Math.PI / 180);

        const targets = parsedQubit.toQubitList();
        const [posControls, negControls] = this.getCurrentControls(
            this.getCurrentExecutionInformation(util).controlStack
        );

        for (const target of targets) {
            this.getCurrentExecutionInformation(util).simulationState.applyRotation(
                'Z', angleLambdaInRadians, [target], posControls, negControls
            );
            this.getCurrentExecutionInformation(util).simulationState.applyRotation(
                'Y', angleThetaInRadians, [target], posControls, negControls
            );
            this.getCurrentExecutionInformation(util).simulationState.applyRotation(
                'Z', anglePhiInRadians, [target], posControls, negControls
            );
        }

    }

    measure (args, util) {
        const qubit = args.QUBIT;
        if (qubit === '/') {
            return error('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        
        const targets = parsedQubit.toQubitList();

        let result = "";

        for (const target of targets) {
            result += this.getCurrentExecutionInformation(util).simulationState.measure(target);
        }
        return result;
        //return this.getCurrentExecutionInformation(util).simulationState.measure(parsedQubit);

    }

    controlled (args, util) {
        if (util.stackFrame.executedChild) {
            delete util.stackFrame.executedChild;
            this.getCurrentExecutionInformation(util).controlStack.pop();
        } else {
            util.stackFrame.executedChild = true;
            const qubit = args.QUBIT;
            if (qubit === '/') {
                return error('Invalid qubit value');
            }
            const parsedQubit = AST.parse(qubit);
            this.getCurrentExecutionInformation(util).controlStack.push(parsedQubit);
            util.startBranch(1, true);
        }
    }

    quantumEvaluate () {
        return true;
    }

    runCircuits (_args, util) {
        this.genericRunCircuits(util, StatevectorSimulator, 0);
    }

    runCircuitsState (args, util) {
        // Scratch passes typed values as strings; only the first call (before the circuits start) uses it
        const startingState = Number(args.STATE);
        if (!util.stackFrame.executed && (!Number.isInteger(startingState) || startingState < 0)) {
            this._reportOnBlock(util, 'The starting state must be a whole number of at least 0.');
            return;
        }
        this.genericRunCircuits(util, StatevectorSimulator, startingState);
    }

    _sanitizeREResults(circuit) {
        if (!this.runtime) {
            return 'No Runtime';
        }
        if (!this.runtime.lastResourceEstimate) {
            return 'No Resource Estimate computed yet';
        }
        if (circuit <= 0) {
            return 'Please Select a Valid Circuit Index (Starting from 1)';
        }
        return '';
    }

    estimatedCircuitsResources () {
        const error = this._sanitizeREResults(1);
        if (error !== '') {
            return Promise.resolve(error);
        }
        let result = "";
        console.log(this.runtime);

        for (let i = 0; i < this.runtime.lastResourceEstimate.length; i++) {
            result += _getResourceEstimateOfCircuit(this.runtime.lastResourceEstimate, i, ResourceType.ALL);
            if (i < this.runtime.lastResourceEstimate.length - 1) {
                result += '\n\n';
            }
        }
        return Promise.resolve(result);
    }

    estimatedCircuitsResourcesOf (args) {
        const error = this._sanitizeREResults(args.CIRCUIT);
        if (error !== '') {
            return Promise.resolve(error);
        }
        return Promise.resolve(_getResourceEstimateOfCircuit(this.runtime.lastResourceEstimate, args.CIRCUIT - 1, ResourceType.ALL));
    }

    reQubits (args) {
        const error = this._sanitizeREResults(args.CIRCUIT);
        if (error !== '') {
            return Promise.resolve(error);
        }
        return Promise.resolve(_getResourceEstimateOfCircuit(this.runtime.lastResourceEstimate, args.CIRCUIT - 1, ResourceType.QUBITS));
    }

    reSwaps (args) {
        const error = this._sanitizeREResults(args.CIRCUIT);
        if (error !== '') {
            return Promise.resolve(error);
        }
        return Promise.resolve(_getResourceEstimateOfCircuit(this.runtime.lastResourceEstimate, args.CIRCUIT - 1, ResourceType.SWAP));
    }

    reGates (args) {
        const error = this._sanitizeREResults(args.CIRCUIT);
        if (error !== '') {
            return Promise.resolve(error);
        }
        const count = parseInt(args.COUNT);
        if (count === NaN || count < 1) {
            return Promise.resolve("Please Select a Valid Qubit Count");
        }

        return Promise.resolve(_getResourceEstimateOfCircuit(this.runtime.lastResourceEstimate, args.CIRCUIT - 1, ResourceType.GATES + count));
    }

    

    estimateCircuitsResources (_args, util) {
        const result = this.genericRunCircuits(util, ResourceEstimator, new ResourceEstimatorSettings(
            this.getRENegativeControlTranslationEnabled(util),
            this.getREToffoliDecompositionEnabled(util),
            this.getRESwapDecompositionEnabled(util)
        ));
        if (result != {}) {
            this.runtime.lastResourceEstimate = result;
            console.log(this.runtime);
        }
    }

    // eslint-disable-next-line no-unused-vars
    genericRunCircuits (util, simulatorClass, simulatorArgs) {
        if (!util.stackFrame.executed) {
            const startedThreads = util.startHats('quantum_quantumEvaluate');
            util.stackFrame.startedThreads = startedThreads;
            util.stackFrame.startedThreads.forEach(thread => {
                this.circuits.set(thread, new CircuitExecutionInformation(new simulatorClass(simulatorArgs)));
            });
            util.stackFrame.executed = true;
            util.yield();
            return '';
        }


        const allFinished = util.stackFrame.startedThreads.every(t => this.runtime.threads.indexOf(t) === -1);
        if (allFinished) {
            const result = util.stackFrame.startedThreads
                .map(t => this.circuits.get(t).simulationState.getResults());
            delete util.stackFrame.startedThreads;
            delete util.stackFrame.executed;
            return result;
        }
        util.yield();
        return '';

    }

    enableDisableNegativeControlTranslation (args, util) {
        const enabled = args.ENABLED === 'true';
        this.setRENegativeControlTranslationEnabled(util, enabled);
    }

    enableDisableToffoliDecomposition (args, util) {
        const enabled = args.ENABLED === 'true';
        this.setREToffoliDecompositionEnabled(util, enabled);
    }

    enableDisableSwapDecomposition (args, util) {
        const enabled = args.ENABLED === 'true';
        this.setRESwapDecompositionEnabled(util, enabled);
    }

    getRENegativeControlTranslationEnabled (util) {
        return util.thread.reEnagleNegativeControlTranslation;
    }

    getREToffoliDecompositionEnabled (util) {
        return util.thread.reEnagleToffoliDecomposition;
    }

    setRENegativeControlTranslationEnabled (util, value) {
        util.thread.reEnagleNegativeControlTranslation = value;
    }

    setREToffoliDecompositionEnabled (util, value) {
        util.thread.reEnagleToffoliDecomposition = value;
    }

    getRESwapDecompositionEnabled (util) {
        return util.thread.reEnagleSwapDecomposition;
    }

    setRESwapDecompositionEnabled (util, value) {
        util.thread.reEnagleSwapDecomposition = value;
    }

    getCurrentExecutionInformation (util) {
        const thread = util.thread;
        if (!this.circuits.get(thread)) {
            this.circuits.set(thread, new CircuitExecutionInformation(new StatevectorSimulator(0)));
        }
        return this.circuits.get(thread);
    }

    setSimulator (args, util) {
        // TODO: once there are multiple simulators, set the current simulator based on the argument
    }

    toMLIR (_args, util) {
        const target = util.target;
        const fileName = `${target.getName()}_circuit.mlir`;
        let mlir;
        try {
            mlir = exportToMLIR(target.blocks, util.thread.topBlock, {
                spriteName: target.getName(),
                lookupVariable: id => target.lookupVariableById(id)
            });
        } catch (e) {
            if (e instanceof MLIRExportError) {
                console.error(`MLIR export failed at block ${e.blockId}: ${e.message}`);
                if (e.blockId) {
                    this.runtime.visualReport(e.blockId, e.message);
                }
                this._notify(`MLIR export failed: ${e.message}`);
            } else {
                console.error(e);
                this._notify('MLIR export failed (internal error), see console');
            }
            return;
        }
        try {
            this._download(fileName, mlir);
        } catch (e) {
            console.error(e);
            this._notify('MLIR export failed (internal error), see console');
            return;
        }
        this._notify(`Exported circuit to ${fileName}`);
    }

    _download (fileName, text) {
        downloadTextFile(fileName, text);
    }

    _notify (message) {
        if (typeof alert === 'function') {
            alert(message); // eslint-disable-line no-alert
        }
    }
}

const _getResourceEstimateOfCircuit = function (estimatesByCircuit, circuitNumber, resourceType) {
    if (!(circuitNumber in estimatesByCircuit)) {
        return "";
    }

    const estimate = estimatesByCircuit[circuitNumber];
    const qubits = estimate.qubits;


    if (resourceType === ResourceType.ALL) {
        const estimate = estimatesByCircuit[circuitNumber];
        console.log(estimate.gates);
        let result = "";
        result += `Total Qubits: ${qubits}\n\n`;
        for (const count of Object.keys(estimate.gates)) {
            result += `${count} Qubit Gates:\n`;
            for (const [gate, num] of Object.entries(estimate.gates[count])) {
                result += `${gate}: ${num}\n`;
            }
            result += '\n';
        }
        return result;
    }
    if (resourceType == ResourceType.QUBITS) {
        return qubits;
    }
    if (resourceType == ResourceType.SWAP) {
        const gates = estimate.gates[2];
        if (gates === undefined) {
            return 0;
        }
        const swaps = gates["SWAP"];
        if (swaps === undefined) {
            return 0;
        }
        return swaps;
    }
    if (resourceType.startsWith("nq")) {
        const n = parseInt(resourceType.substring(2));
        const gates = estimate.gates[n];
        if (gates === undefined) {
            return 0;
        }
        let res = 0;
        for (const num of Object.values(gates)) {
            res += parseInt(num);
        }
        return res;
    }
    return "";
}

module.exports = QuantumExtension;

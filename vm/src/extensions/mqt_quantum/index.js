const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Simulator = require('./statevector-simulator').default;

const doError = function (message) {
    console.error(message);
};

const validateRegisterName = function (name) {
    if (name.length === 0) {
        return doError('Register name cannot be empty');
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return doError(
            'Register name can only contain letters, numbers,' +
           'and underscores, and must start with a letter or underscore'
        );
    }
};

const validateQubitIndex = function (index) {
    index = parseInt(`${index}`, 10);
    if (isNaN(index) || index < 0) {
        return doError('Qubit index must be a non-negative integer');
    }
    return index;
};

class CircuitExecutionInformation {
    constructor (simulationState) {
        this.simulationState = simulationState;
        this.controlStack = [];
    }
}

class AST {
    constructor (root) {
        this.root = root;
    }

    getPositiveNegative () {
        return this.root.getPositiveNegative();
    }
}

class AndNode {
    constructor (left, right) {
        this.left = left;
        this.right = right;
    }

    static parse (s) {
        const index = s.indexOf(' and ');
        const left = s.substring(0, index).trim();
        const right = s.substring(index + 5).trim();
        return new AndNode(AST.parse(left), AST.parse(right));
    }

    getPositiveNegative () {
        const [posL, negL] = this.left.getPositiveNegative();
        const [posR, negR] = this.right.getPositiveNegative();
        return [
            [...posL, ...posR],
            [...negL, ...negR]
        ];
    }
}

class NegatedNode {
    constructor (value) {
        this.value = value;
    }

    static parse (s) {
        const index = s.indexOf('not ');
        const child = s.substring(index + 4).trim();
        return new NegatedNode(AST.parse(child));
    }

    getPositiveNegative () {
        const [pos, neg] = this.value.getPositiveNegative();
        return [neg, pos];
    }
}

class LeafNode {
    constructor (value) {
        this.value = value;
        this.validate();
    }

    static parse (s) {
        const result = new LeafNode(s);
        return result;
    }

    validate () {
        const qubit = this.value;
        if (qubit === null || typeof qubit !== 'string') {
            return doError('Invalid qubit value');
        }
        const parts = qubit.split('[');
        if (parts.length !== 2) {
            return doError('Invalid qubit format, expected "register[index]"');
        }
        const register = parts[0].trim();
        const index = parts[1].trim().replace(']', '');
        validateRegisterName(register);
        this.register = register;
        this.index = validateQubitIndex(index);
    }

    getPositiveNegative () {
        return [[this], []];
    }
}

AST.parse = function (s) {
    if (s.includes(' and ')) {
        return new AST(AndNode.parse(s));
    }
    if (s.includes('not ')) {
        return new AST(NegatedNode.parse(s));
    }
    return new AST(LeafNode.parse(s));
};

class QuantumExtension {
    constructor (runtime) {
        this.runtime = runtime;
        this.name = 'Quantum';
        this.version = '1.0.0';
        this.description = 'An extension for quantum computing simulations.';
        this.circuits = {};
    }

    getInfo () {
        return {
            id: 'quantum',
            name: this.name,
            blocks: [
                {
                    opcode: 'createRegister',
                    blockType: BlockType.COMMAND,
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
                    opcode: 'controlled',
                    blockType: BlockType.CONDITIONAL,
                    branchCount: 1,
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
                    text: 'negated control [QUBIT]',
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: '/'
                        }
                    }
                },
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
                {
                    opcode: 'measure',
                    blockType: BlockType.BOOLEAN,
                    text: 'measure [QUBIT]',
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
                    text: 'Circuit Evaluation'
                },

                {
                    opcode: 'quantumEvaluate',
                    blockType: BlockType.HAT,
                    text: 'Quantum Circuit',
                    isEdgeActivated: false
                },
                {
                    opcode: 'evaluateCircuits',
                    blockType: BlockType.COMMAND,
                    text: 'Evaluate Quantum Circuits'
                },
                {
                    opcode: 'evaluateCircuitsState',
                    blockType: BlockType.COMMAND,
                    text: 'Evaluate Quantum Circuits starting from [STATE]',
                    arguments: {
                        STATE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '0'
                        }
                    }
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
                }
            }
        };
    }

    createRegister (args, util) {
        const registerName = args.NAME;
        const numQubits = parseInt(args.NUM, 10);
        validateRegisterName(registerName);
        if (numQubits === 0) {
            return doError('Number of qubits must be greater than 0');
        }
        validateQubitIndex(numQubits);
        this.getCurrentExecutionInformation(util).simulationState.createRegister(registerName, numQubits);
    }

    getQubit (args) {
        const qubit = parseInt(args.QUBIT, 10);
        const registerName = args.NAME;
        return `${registerName}[${qubit}]`;
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
            return doError('Invalid negated expression');
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
            return doError('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;

        if (!(parsedQubit instanceof LeafNode)) {
            return doError('Invalid qubit value');
        }
        const [posControls, negControls] = this.getCurrentControls(
            this.getCurrentExecutionInformation(util).controlStack
        );
        this.getCurrentExecutionInformation(util).simulationState.applyGate(
            gate, [parsedQubit], posControls, negControls
        );

    }

    rotateAxis (args, util) {
        const qubit = args.QUBIT;
        const angle = parseFloat(args.ANGLE);
        const axis = args.AXIS;
        if (qubit === '/') {
            return doError('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        const angleInRadians = angle * (Math.PI / 180);

        if (!(parsedQubit instanceof LeafNode)) {
            return doError('Invalid qubit value');
        }
        const [posControls, negControls] = this.getCurrentControls(
            this.getCurrentExecutionInformation(util).controlStack
        );
        this.getCurrentExecutionInformation(util).simulationState.applyRotation(
            axis, angleInRadians, posControls, negControls
        );

    }

    u3 (args, util) {
        const qubit = args.QUBIT;
        const angleTheta = parseFloat(args.THETA);
        const anglePhi = parseFloat(args.PHI);
        const angleLambda = parseFloat(args.LAMBDA);
        if (qubit === '/') {
            return doError('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        const angleThetaInRadians = angleTheta * (Math.PI / 180);
        const anglePhiInRadians = anglePhi * (Math.PI / 180);
        const angleLambdaInRadians = angleLambda * (Math.PI / 180);

        if (!(parsedQubit instanceof LeafNode)) {
            return doError('Invalid qubit value');
        }
        this.getCurrentExecutionInformation(util).simulationState.applyRotation(
            'Z', angleLambdaInRadians, [parsedQubit], []
        ); // TODO: controls
        this.getCurrentExecutionInformation(util).simulationState.applyRotation(
            'Y', angleThetaInRadians, [parsedQubit], []
        ); // TODO: controls
        this.getCurrentExecutionInformation(util).simulationState.applyRotation(
            'Z', anglePhiInRadians, [parsedQubit], []
        ); // TODO: controls

    }

    measure (args, util) {
        const qubit = args.QUBIT;
        if (qubit === '/') {
            return doError('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        if (!(parsedQubit instanceof LeafNode)) {
            return doError('Invalid qubit value');
        }
        return this.getCurrentExecutionInformation(util).simulationState.measure(parsedQubit);

    }

    controlled (args, util) {
        if (util.stackFrame.executedChild) {
            delete util.stackFrame.executedChild;
            this.getCurrentExecutionInformation(util).controlStack.pop();
        } else {
            util.stackFrame.executedChild = true;
            const qubit = args.QUBIT;
            if (qubit === '/') {
                return doError('Invalid qubit value');
            }
            const parsedQubit = AST.parse(qubit);
            this.getCurrentExecutionInformation(util).controlStack.push(parsedQubit);
            util.startBranch(1, true);
        }
    }

    quantumEvaluate () {
        return true;
    }

    evaluateCircuits (_args, util) {
        this.genericEvaluateCircuits(0, util);
    }

    evaluateCircuitsState (args, util) {
        this.genericEvaluateCircuits(args.STATE, util);
    }

    // eslint-disable-next-line no-unused-vars
    genericEvaluateCircuits (startingState, util) {
        if (!util.stackFrame.executed) {
            const startedThreads = util.startHats('quantum_quantumEvaluate');
            util.stackFrame.startedThreads = startedThreads;
            util.stackFrame.startedThreads.forEach(thread => {
                const hatId = thread.topBlock;
                this.circuits[hatId] = new CircuitExecutionInformation(new Simulator(startingState));
            });
            util.stackFrame.executed = true;
            util.yield();
            return;
        }


        const allFinished = util.stackFrame.startedThreads.every(t => this.runtime.threads.indexOf(t) === -1);
        if (allFinished) {
            delete util.stackFrame.startedThreads;
            delete util.stackFrame.executed;
        } else {
            util.yield();
        }
    }

    getCurrentExecutionInformation (util) {
        const hatId = util.thread.topBlock;
        return this.circuits[hatId];
    }
}

module.exports = QuantumExtension;

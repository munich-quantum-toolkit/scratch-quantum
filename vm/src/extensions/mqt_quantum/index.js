const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Simulator = require('./statevector-simulator');

function doError(message) {
    console.error(message);
}

function validateRegisterName(name) {
    if (name.length === 0) {
        return doError('Register name cannot be empty');
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return doError('Register name can only contain letters, numbers, and underscores, and must start with a letter or underscore');
    }
}

function validateQubitIndex(index) {
    index = parseInt(index + "", 10);
    if (isNaN(index) || index < 0) {
        return doError('Qubit index must be a non-negative integer');
    }
    return index;
}

class AndNode {
    constructor(left, right) {
        this.left = left;
        this.right = right;
    }

    static parse(s) {
        const index = s.indexOf(' and ');
        const left = s.substring(0, index).trim();
        const right = s.substring(index + 5).trim();
        return new AndNode(AST.parse(left), AST.parse(right));
    }

    getPositiveNegative() {
        const [posL, negL] = this.left.getPositiveNegative();
        const [posR, negR] = this.right.getPositiveNegative();
        return [
            [...posL, ...posR],
            [...negL, ...negR]
        ];
    }
}

class NegatedNode {
    constructor(value) {
        this.value = value;
    }

    static parse(s) {
        const index = s.indexOf('not ');
        const child = s.substring(index + 4).trim();
        return new NegatedNode(AST.parse(child));
    }

    getPositiveNegative() {
        const [pos, neg] = this.value.getPositiveNegative();
        return [neg, pos];
    }
}

class LeafNode {
    constructor(value) {
        this.value = value;
        this.validate();
    }

    static parse(s) {
        const result = new LeafNode(s);
        return result;
    }

    validate() {
        const qubit = this.value;
        if (qubit === null || qubit === undefined || typeof qubit !== 'string') {
            return doError('Invalid qubit value');
        }
        const parts = qubit.split('[');
        if (parts.length !== 2) {
            return doError('Invalid qubit format, expected "register[index]"');
        }
        const register = parts[0].trim();
        const index = parts[1].trim().replace(']', '');
        validateRegisterName(register);
        validateQubitIndex(index);
        this.register = register;
        this.index = index;
    }

    getPositiveNegative() {
        return [[this], []];
    }
}

class AST {
    constructor(root) {
        this.root = root;
    }

    static parse(s) {
        if (s.includes(' and ')) {
            return new AST(AndNode.parse(s));
        }
        if (s.includes('not ')) {
            return new AST(NegatedNode.parse(s));
        }
        return new AST(LeafNode.parse(s));
    }

    getPositiveNegative() {
        return this.root.getPositiveNegative();
    }
}

class EvaluationSettings {
    static SimulatorType = {
        STATEVECTOR: 'Statevector Simulator',
        DECISION_DIAGRAM: 'Decision Diagram Simulator',
        RESOURCE_ESTIMATOR: 'Resource Estimator'
    };
    static ArchitectureType = {
        ALL_TO_ALL: 'All-to-All',
        LINEAR: 'Linear Nearest Neighbor',
        HEAVY_HEAVY: 'Heavy-Hex'
    };
    static NoiseModel = {
        IDEAL: 'Ideal',
        IID: 'i.i.d. Noise',
    }
}

class QuantumExtension {
    constructor(runtime) {
        this.runtime = runtime;
        this.name = 'Quantum';
        this.version = '1.0.0';
        this.description = 'An extension for quantum computing simulations.';
        this.runtime.simulationState = new Simulator();
        this.runtime.simulationState.controlStack = [];
    }

    getInfo() {
        return {
            id: 'quantum',
            name: this.name,
            blocks: [
                {
                    opcode: 'createRegister',
                    blockType: BlockType.COMMAND,
                    text: "create quantum register [NAME] with [NUM] qubits",
                    arguments: {
                        NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: 'q'
                        },
                        NUM: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 2
                        }
                    },
                },
                {
                    opcode: 'getQubit',
                    blockType: BlockType.REPORTER,
                    text: "qubit [QUBIT] of register [NAME]",
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        NAME: {
                            type: ArgumentType.STRING,
                            defaultValue: 'q'
                        }
                    },
                },
                {
                    opcode: 'applyGate',
                    blockType: BlockType.COMMAND,
                    text: "apply [GATE] gate to [QUBIT]",
                    arguments: {
                        GATE: {
                            type: ArgumentType.STRING,
                            menu: 'gates',
                            defaultValue: 'X'
                        },
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: "/"
                        }
                    },
                },
                {
                    opcode: 'controlled',
                    blockType: BlockType.CONDITIONAL,
                    branchCount: 1,
                    text: "controlled on [QUBIT]",
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: "/"
                        }
                    },
                },
                {
                    opcode: 'and',
                    blockType: BlockType.REPORTER,
                    text: "[QUBIT1] and [QUBIT2]",
                    arguments: {
                        QUBIT1: {
                            type: ArgumentType.STRING,
                            defaultValue: "/"
                        },
                        QUBIT2: {
                            type: ArgumentType.STRING,
                            defaultValue: "/"
                        }
                    },
                },
                {
                    opcode: 'negated',
                    blockType: BlockType.REPORTER,
                    text: "negated control [QUBIT]",
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: "/"
                        },
                    },
                },
                {
                    opcode: 'rotateAxis',
                    blockType: BlockType.COMMAND,
                    text: "rotate [QUBIT] by [ANGLE] degrees around [AXIS] axis",
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: "/"
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
                    },
                },
                {
                    opcode: 'u3',
                    blockType: BlockType.COMMAND,
                    text: "apply U3 gate to [QUBIT] with angles [X] [Y] [Z]",
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: "/"
                        },
                        X: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        Y: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        Z: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    },
                },
                {
                    opcode: 'measure',
                    blockType: BlockType.BOOLEAN,
                    text: "measure [QUBIT]",
                    arguments: {
                        QUBIT: {
                            type: ArgumentType.STRING,
                            defaultValue: "/"
                        },
                    },
                },
                {
                    opcode: 'evaluateLabel',
                    blockType: BlockType.BUTTON,
                    text: 'Circuit Evaluation'
                },
                
                {
                    opcode: 'quantumEvaluate',
                    blockType: BlockType.HAT,
                    text: "Quantum Circuit",
                    isEdgeActivated: false
                },
                {
                    opcode: 'evaluateCircuits',
                    blockType: BlockType.COMMAND,
                    text: "Evaluate Quantum Circuits",
                },
                {
                    opcode: 'evaluateCircuitsSimulator',
                    blockType: BlockType.COMMAND,
                    text: "Evaluate Quantum Circuits using [SIMULATOR]",
                    arguments: {
                        SIMULATOR: {
                            type: ArgumentType.STRING,
                            menu: 'simulators',
                            defaultValue: 'Statevector Simulator'
                        }
                    },
                },
                {
                    opcode: 'evaluateCircuitsNoise',
                    blockType: BlockType.COMMAND,
                    text: "Evaluate Quantum Circuits with [NOISE_MODEL]",
                    arguments: {
                        NOISE_MODEL: {
                            type: ArgumentType.STRING,
                            menu: 'noiseModels',
                            defaultValue: 'Ideal'
                        }
                    },
                },
                {
                    opcode: 'evaluateCircuitsSimulatorNoise',
                    blockType: BlockType.COMMAND,
                    text: "Evaluate Quantum Circuits with [SIMULATOR] and [NOISE_MODEL]",
                    arguments: {
                        SIMULATOR: {
                            type: ArgumentType.STRING,
                            menu: 'simulators',
                            defaultValue: 'Statevector Simulator'
                        },
                        NOISE_MODEL: {
                            type: ArgumentType.STRING,
                            menu: 'noiseModels',
                            defaultValue: 'Ideal'
                        }
                    },
                }
            ],
            menus: {
                gates: {
                    acceptReporters: true,
                    items: [
                        { text: 'X', value: 'X' },
                        { text: 'Y', value: 'Y' },
                        { text: 'Z', value: 'Z' },
                        { text: 'H', value: 'H' },
                        { text: 'S', value: 'S' },
                        { text: 'T', value: 'T' },
                    ]
                },
                axes: {
                    acceptReporters: true,
                    items: [
                        { text: 'X', value: 'X' },
                        { text: 'Y', value: 'Y' },
                        { text: 'Z', value: 'Z' },
                    ]
                },
                simulators: {
                    acceptReporters: true,
                    items: [
                        { text: EvaluationSettings.SimulatorType.STATEVECTOR, value: EvaluationSettings.SimulatorType.STATEVECTOR },
                        { text: EvaluationSettings.SimulatorType.DECISION_DIAGRAM, value: EvaluationSettings.SimulatorType.DECISION_DIAGRAM },
                        { text: EvaluationSettings.SimulatorType.RESOURCE_ESTIMATOR, value: EvaluationSettings.SimulatorType.RESOURCE_ESTIMATOR },
                    ]
                },
                noiseModels: {
                    acceptReporters: true,
                    items: [
                        { text: EvaluationSettings.NoiseModel.IDEAL, value: EvaluationSettings.NoiseModel.IDEAL },
                        { text: EvaluationSettings.NoiseModel.IID, value: EvaluationSettings.NoiseModel.IID },
                    ]
                }
            }
        };
    }

    createRegister(args) {
        const registerName = args.NAME;
        const numQubits = parseInt(args.NUM, 10);
        validateRegisterName(registerName);
        if (numQubits == 0) {
            return doError('Number of qubits must be greater than 0');
        }
        validateQubitIndex(numQubits);
        this.runtime.simulationState.createRegister(registerName, numQubits);
    }

    getQubit(args) {
        const qubit = parseInt(args.QUBIT, 10);
        const registerName = args.NAME;
        return `${registerName}[${qubit}]`;
    }

    and(args) {
        const left = args.QUBIT1;
        const right = args.QUBIT2;
        if(left === "/") {
            return right;
        }
        if(right === "/") {
            return left;
        }
        return `${left} and ${right}`;
    }

    negated(args) {
        const qubit = args.QUBIT;
        if(qubit === "/") {
            return "/";
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

    getCurrentControls() {
        const pos = [];
        const neg = [];
        for (const control of this.runtime.simulationState.controlStack) {
            const [p, n] = control.getPositiveNegative();
            pos.push(...p);
            neg.push(...n);
        }
        return [pos, neg];
    }
    
    applyGate(args) {
        const gate = args.GATE;
        const qubit = args.QUBIT;
        if (qubit === "/") {
            return doError('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        
        if (!(parsedQubit instanceof LeafNode)) {
            return doError('Invalid qubit value');
        } else {
            const [posControls, negControls] = this.getCurrentControls();
            this.runtime.simulationState.applyGate(gate, [parsedQubit], posControls, negControls);
        }
    }

    rotateAxis(args) {
        const qubit = args.QUBIT;
        const angle = parseFloat(args.ANGLE);
        const axis = args.AXIS;
        if (qubit === "/") {
            return doError('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        const angleInRadians = angle * (Math.PI / 180);
        
        if (!(parsedQubit instanceof LeafNode)) {
            return doError('Invalid qubit value');
        } else {
            const [posControls, negControls] = this.getCurrentControls();
            this.runtime.simulationState.applyRotation(axis, angleInRadians, posControls, negControls);
        }
    }

    u3(args) {
        const qubit = args.QUBIT;
        const angleX = parseFloat(args.X);
        const angleY = parseFloat(args.Y);
        const angleZ = parseFloat(args.Z);
        if (qubit === "/") {
            return doError('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        const angleXInRadians = angleX * (Math.PI / 180);
        const angleYInRadians = angleY * (Math.PI / 180);
        const angleZInRadians = angleZ * (Math.PI / 180);
        
        if (!(parsedQubit instanceof LeafNode)) {
            return doError('Invalid qubit value');
        } else {
            this.runtime.simulationState.applyRotation(axis, angleXInRadians, [parsedQubit], []); // TODO: controls
            this.runtime.simulationState.applyRotation(axis, angleYInRadians, [parsedQubit], []); // TODO: controls
            this.runtime.simulationState.applyRotation(axis, angleZInRadians, [parsedQubit], []); // TODO: controls
        }
    }

    measure(args) {
        const qubit = args.QUBIT;
        if (qubit === "/") {
            return doError('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit).root;
        if (!(parsedQubit instanceof LeafNode)) {
            return doError('Invalid qubit value');
        } else {
            return this.runtime.simulationState.measure(parsedQubit);
        }
    }

    controlled(args, util) {
        const qubit = args.QUBIT;
        if (qubit === "/") {
            return doError('Invalid qubit value');
        }
        const parsedQubit = AST.parse(qubit);
        this.runtime.simulationState.controlStack.push(parsedQubit);
        util.startBranch(1, false);
        this.runtime.simulationState.controlStack.pop();
    }

    quantumEvaluate() {
        return true;
    }

    evaluateCircuits() {
        this.genericEvaluateCircuits(EvaluationSettings.SimulatorType.STATEVECTOR, EvaluationSettings.NoiseModel.IDEAL);
    }

    evaluateCircuitsSimulator(args) {
        this.genericEvaluateCircuits(args.SIMULATOR, EvaluationSettings.NoiseModel.IDEAL);
    }

    evaluateCircuitsNoise(args) {
        this.genericEvaluateCircuits(EvaluationSettings.SimulatorType.STATEVECTOR, args.NOISE_MODEL);
    }

    evaluateCircuitsSimulatorNoise(args) {
        this.genericEvaluateCircuits(args.SIMULATOR, args.NOISE_MODEL);
    }

    genericEvaluateCircuits(simulator, noiseModel) {
        this.runtime.startHats('quantum_quantumEvaluate');
    }
}

module.exports = QuantumExtension;
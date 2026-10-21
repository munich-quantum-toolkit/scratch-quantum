const {AST} = require('./qubit-expression');
const {MLIREmitter} = require('./mlir-emitter');

const QUBIT = '!qc.qubit';
const GATES = {X: 'x', Y: 'y', Z: 'z', H: 'h', S: 's', T: 't'};
const AXES = {X: 'rx', Y: 'ry', Z: 'rz'};
const DEG_TO_RAD = Math.PI / 180;
const REGISTER_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SKIPPED_PREFIXES = ['looks_', 'motion_', 'sound_', 'pen_'];
const SKIPPED_OPCODES = [
    'control_wait',
    'quantum_toMLIR',
    'quantum_setSimulator',
    'quantum_enableDisableSwapDecomposition',
    'quantum_enableDisableNegativeControlTranslation',
    'quantum_enableDisableToffoliDecomposition'
];

class MLIRExportError extends Error {
    constructor (message, blockId) {
        super(message);
        this.name = 'MLIRExportError';
        this.blockId = blockId;
    }
}

// A value is either a constant known at export time or an SSA value; `type` is 'f64', 'i1' or 'index'.
const constant = (type, value) => ({type, constant: value});
const isConstant = value => Object.prototype.hasOwnProperty.call(value, 'constant');

const ssa = (type, name) => ({type, ssa: name});

const lookup = (table, key) => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null);
const isSkipped = opcode => SKIPPED_PREFIXES.some(prefix => opcode.startsWith(prefix)) ||
    SKIPPED_OPCODES.includes(opcode);

/**
 * Translates one 'Quantum Circuit' script into a `qc` MLIR module.
 *
 * Handlers are looked up by opcode: `stmt_<opcode>` for stack blocks, `num_<opcode>` for reporters
 * used as numbers, `bool_<opcode>` for conditions and `qubits_<opcode>` for qubit inputs.
 */
class Exporter {
    constructor (blocks, options) {
        this.blocks = blocks;
        this.spriteName = options.spriteName;
        this.lookupVariable = options.lookupVariable;
        this.emit = new MLIREmitter();
        this.registers = new Map(); // register name -> {name, size, ssa, type}
        this.controlStack = []; // one array of qubit references per enclosing 'controlled on'
        this.depth = 0; // nesting depth of 'repeat', 'if' and 'controlled on'
        this.variables = new Map(); // variable id -> current value
        this.variableTypes = new Map(); // variable id -> 'f64' | 'i1'
    }

    run (hatId) {
        const hat = this.block(hatId);
        if (!hat || hat.opcode !== 'quantum_quantumEvaluate') {
            throw new MLIRExportError('Place the export block inside a \'Quantum Circuit\' script.', hatId);
        }
        this.statements(hat.next);
        for (const register of [...this.registers.values()].reverse()) {
            this.emit.line(`memref.dealloc ${register.ssa} : ${register.type}`);
        }
        return this.emit.toModule(`Exported from Scratch sprite "${this.spriteName}" by the MQT quantum extension`);
    }

    // ---- block access ------------------------------------------------------------------------

    block (id) {
        return this.blocks.getBlock(id);
    }

    input (block, name) {
        const input = block.inputs[name];
        return input && input.block ? input.block : null;
    }

    requireInput (block, name) {
        const id = this.input(block, name);
        if (!id) {
            throw new MLIRExportError(`The block '${block.opcode}' is missing its '${name}' input.`, block.id);
        }
        return id;
    }

    literal (id) {
        const block = this.block(id);
        const fieldName = Object.keys(block.fields)[0];
        if (!block.shadow || !fieldName) {
            throw new MLIRExportError(
                `MLIR export needs a fixed value here, not the block '${block.opcode}'.`, block.id);
        }
        return String(block.fields[fieldName].value);
    }

    // ---- statements --------------------------------------------------------------------------

    statements (firstId) {
        for (let id = firstId; id; id = this.block(id).next) {
            this.statement(this.block(id));
        }
    }

    statement (block) {
        const handler = this[`stmt_${block.opcode}`];
        if (handler) {
            handler.call(this, block);
            return;
        }
        if (isSkipped(block.opcode)) {
            this.emit.comment(`skipped: ${block.opcode}`);
            this.measurementsIn(block);
            return;
        }
        throw new MLIRExportError(`The block '${block.opcode}' can't be exported to MLIR.`, block.id);
    }

    measurementsIn (block) {
        for (const name of Object.keys(block.inputs)) {
            const id = this.input(block, name);
            if (!id) continue;
            const child = this.block(id);
            if (child.opcode === 'quantum_measure') {
                this.measure(child);
            } else {
                this.measurementsIn(child);
            }
        }
    }

    stmt_quantum_createRegister (block) {
        if (this.depth > 0) {
            throw new MLIRExportError(
                'Registers must be created outside of \'repeat\', \'if\' and \'controlled on\'.', block.id);
        }
        const name = this.literal(this.requireInput(block, 'NAME'));
        if (!REGISTER_NAME.test(name)) {
            throw new MLIRExportError(`'${name}' is not a valid register name. Use letters, digits and '_', ` +
                'starting with a letter or \'_\'.', block.id);
        }
        if (this.registers.has(name)) {
            throw new MLIRExportError(`The register '${name}' is created twice.`, block.id);
        }
        const size = this.number(this.requireInput(block, 'NUM'));
        if (!isConstant(size) || !Number.isInteger(size.constant) || size.constant < 1) {
            throw new MLIRExportError('The number of qubits must be a fixed whole number of at least 1.', block.id);
        }
        const register = {
            name,
            size: size.constant,
            ssa: this.emit.fresh(name),
            type: `memref<${size.constant}x${QUBIT}>`
        };
        this.emit.line(`${register.ssa} = memref.alloc() {mqt.register_name = "${name}"} : ${register.type}`);
        this.registers.set(name, register);
    }

    stmt_quantum_applyGate (block) {
        const gate = lookup(GATES, this.literal(this.requireInput(block, 'GATE')));
        if (!gate) {
            throw new MLIRExportError('Unknown gate.', block.id);
        }
        for (const target of this.targets(this.requireInput(block, 'QUBIT'))) {
            this.gate([target], args => `qc.${gate} ${args[0]} : ${QUBIT}`, block);
        }
    }

    stmt_quantum_swapGate (block) {
        const first = this.targets(this.requireInput(block, 'QUBIT1'));
        const second = this.targets(this.requireInput(block, 'QUBIT2'));
        if (first.length !== 1 || second.length !== 1) {
            throw new MLIRExportError('SWAP needs exactly one qubit on each side.', block.id);
        }
        this.gate([first[0], second[0]], args => `qc.swap ${args[0]}, ${args[1]} : ${QUBIT}, ${QUBIT}`, block);
    }

    stmt_quantum_rotateAxis (block) {
        const gate = lookup(AXES, this.literal(this.requireInput(block, 'AXIS')));
        if (!gate) {
            throw new MLIRExportError('Unknown rotation axis.', block.id);
        }
        const targets = this.targets(this.requireInput(block, 'QUBIT'));
        const angle = this.radians(this.number(this.requireInput(block, 'ANGLE')));
        for (const target of targets) {
            this.gate([target], args => `qc.${gate}(${angle}) ${args[0]} : ${QUBIT}`, block);
        }
    }

    stmt_quantum_u3 (block) {
        const targets = this.targets(this.requireInput(block, 'QUBIT'));
        const [theta, phi, lambda] = ['THETA', 'PHI', 'LAMBDA']
            .map(name => this.radians(this.number(this.requireInput(block, name))));
        for (const target of targets) {
            this.gate([target], args => `qc.u(${theta}, ${phi}, ${lambda}) ${args[0]} : ${QUBIT}`, block);
        }
    }

    // ---- quantum operations ------------------------------------------------------------------

    gate (targets, render, block) {
        this.checkDistinct(targets, block);
        this.emit.line(render(targets.map(ref => this.load(ref))));
    }

    checkDistinct (refs, block) {
        const seen = new Set();
        for (const ref of refs) {
            if (typeof ref.index !== 'number') continue;
            const key = `${ref.register.name}[${ref.index}]`;
            if (seen.has(key)) {
                throw new MLIRExportError(`The qubit ${key} is used more than once in the same gate ` +
                    '(for example as control and target).', block.id);
            }
            seen.add(key);
        }
    }

    measure (block) {
        if (this.controlStack.length > 0) {
            throw new MLIRExportError('Qubits can\'t be measured inside \'controlled on\'.', block.id);
        }
        return this.targets(this.requireInput(block, 'QUBIT')).map(ref => {
            const qubit = this.load(ref);
            const result = this.emit.fresh();
            this.emit.line(`${result} = qc.measure ${qubit} : ${QUBIT} -> i1`);
            return result;
        });
    }

    load (ref) {
        const index = typeof ref.index === 'number' ? this.emit.constIndex(ref.index) : ref.index;
        const name = this.emit.fresh();
        this.emit.line(`${name} = memref.load ${ref.register.ssa}[${index}] : ${ref.register.type}`);
        return name;
    }

    // ---- qubit expressions -------------------------------------------------------------------

    qubits (id, allowEmpty = false) {
        const block = this.block(id);
        const handler = this[`qubits_${block.opcode}`];
        if (!handler) {
            throw new MLIRExportError(`The block '${block.opcode}' can't be used as a qubit in MLIR export.`, block.id);
        }
        const refs = handler.call(this, block);
        if (refs.length === 0 && !allowEmpty) {
            throw new MLIRExportError('No qubit selected.', block.id);
        }
        return refs;
    }

    targets (id) {
        const refs = this.qubits(id);
        if (refs.some(ref => ref.negated)) {
            throw new MLIRExportError('\'negated control\' can only be used in \'controlled on\'.', id);
        }
        return refs;
    }

    register (name, blockId) {
        const register = this.registers.get(name);
        if (!register) {
            throw new MLIRExportError(`The register '${name}' does not exist yet. Create it before using it.`, blockId);
        }
        return register;
    }

    qubitRef (register, index, blockId) {
        if (typeof index === 'number' && (!Number.isInteger(index) || index < 0 || index >= register.size)) {
            throw new MLIRExportError(`Qubit index ${index} is out of range: register '${register.name}' has ` +
                `${register.size} qubits (0-${register.size - 1}).`, blockId);
        }
        return {register, index, negated: false, blockId};
    }

    qubits_quantum_getQubit (block) {
        const register = this.register(this.literal(this.requireInput(block, 'NAME')), block.id);
        const index = this.number(this.requireInput(block, 'QUBIT'));
        if (isConstant(index)) {
            return [this.qubitRef(register, Math.trunc(index.constant), block.id)];
        }
        return [this.qubitRef(register, this.toIndex(index), block.id)];
    }

    qubits_quantum_getQubits (block) {
        const register = this.register(this.literal(this.requireInput(block, 'NAME')), block.id);
        return Array.from({length: register.size}, (_, i) => this.qubitRef(register, i, block.id));
    }

    qubits_quantum_and (block) {
        return [
            ...this.qubits(this.requireInput(block, 'QUBIT1'), true),
            ...this.qubits(this.requireInput(block, 'QUBIT2'), true)
        ];
    }

    qubits_quantum_negated (block) {
        return this.qubits(this.requireInput(block, 'QUBIT'), true)
            .map(ref => Object.assign({}, ref, {negated: !ref.negated}));
    }

    qubits_text (block) {
        const text = String(block.fields.TEXT.value).trim();
        if (text === '' || text === '/') {
            return [];
        }
        const [positive, negative] = AST.parse(text).getPositiveNegative();
        const toRef = (leaf, negated) => {
            if (typeof leaf.register !== 'string' || typeof leaf.index !== 'number') {
                throw new MLIRExportError(`'${text}' is not a valid qubit. Expected something like 'q[0]'.`, block.id);
            }
            const ref = this.qubitRef(this.register(leaf.register, block.id), leaf.index, block.id);
            return Object.assign(ref, {negated});
        };
        return [...positive.map(leaf => toRef(leaf, false)), ...negative.map(leaf => toRef(leaf, true))];
    }

    // ---- numbers -----------------------------------------------------------------------------

    number (id) {
        const block = this.block(id);
        const handler = this[`num_${block.opcode}`];
        if (!handler) {
            throw new MLIRExportError(
                `The block '${block.opcode}' can't be used as a number in MLIR export.`, block.id);
        }
        return handler.call(this, block);
    }

    literalNumber (block, raw) {
        const text = String(raw).trim();
        const value = text === '' ? 0 : Number(text);
        if (!Number.isFinite(value)) {
            throw new MLIRExportError(`'${raw}' is not a number.`, block.id);
        }
        return constant('f64', value);
    }

    num_math_number (block) {
        return this.literalNumber(block, block.fields.NUM.value);
    }

    num_text (block) {
        return this.literalNumber(block, block.fields.TEXT.value);
    }

    num_operator_add (block) {
        return this.arithmetic(block, 'addf', (a, b) => a + b);
    }

    num_operator_subtract (block) {
        return this.arithmetic(block, 'subf', (a, b) => a - b);
    }

    num_operator_multiply (block) {
        return this.arithmetic(block, 'mulf', (a, b) => a * b);
    }

    num_operator_divide (block) {
        return this.arithmetic(block, 'divf', (a, b) => a / b);
    }

    arithmetic (block, op, fold) {
        const a = this.number(this.requireInput(block, 'NUM1'));
        const b = this.number(this.requireInput(block, 'NUM2'));
        return this.binaryF64(a, b, op, fold, block);
    }

    binaryF64 (a, b, op, fold, block) {
        if (isConstant(a) && isConstant(b)) {
            const value = fold(a.constant, b.constant);
            if (!Number.isFinite(value)) {
                throw new MLIRExportError('This calculation has no finite result (division by zero?).', block.id);
            }
            return constant('f64', value);
        }
        const lhs = this.f64(a);
        const rhs = this.f64(b);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.${op} ${lhs}, ${rhs} : f64`);
        return ssa('f64', name);
    }

    radians (value) {
        if (isConstant(value)) {
            return this.emit.constF64(value.constant * DEG_TO_RAD);
        }
        const factor = this.emit.constF64(DEG_TO_RAD);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.mulf ${value.ssa}, ${factor} : f64`);
        return name;
    }

    toIndex (value) {
        const integer = this.emit.fresh();
        this.emit.line(`${integer} = arith.fptosi ${this.f64(value)} : f64 to i64`);
        const index = this.emit.fresh();
        this.emit.line(`${index} = arith.index_cast ${integer} : i64 to index`);
        return index;
    }

    f64 (value) {
        return isConstant(value) ? this.emit.constF64(value.constant) : value.ssa;
    }
}

// Scratch has several number shadow blocks; they all carry their value in the NUM field.
for (const opcode of ['math_positive_number', 'math_whole_number', 'math_integer', 'math_angle']) {
    Exporter.prototype[`num_${opcode}`] = Exporter.prototype.num_math_number;
}

/**
 * Export the 'Quantum Circuit' script starting at `hatId` to the MQT `qc` MLIR dialect.
 * @param {{getBlock: function(string): object}} blocks The block container of the sprite.
 * @param {string} hatId ID of the script's 'Quantum Circuit' hat block.
 * @param {{spriteName: string, lookupVariable: function(string): ?object}} options Sprite name for the
 *     header comment and a lookup from variable ID to the Scratch variable ({name, value}).
 * @return {string} The MLIR module.
 */
const exportToMLIR = function (blocks, hatId, options) {
    return new Exporter(blocks, options).run(hatId);
};

module.exports = {exportToMLIR, MLIRExportError};

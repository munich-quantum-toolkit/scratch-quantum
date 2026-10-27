const {AST} = require('./qubit-expression');
const {MLIREmitter, buildModule} = require('./mlir-emitter');

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

const BOOLEAN_OPCODES = [
    'quantum_measure', 'operator_lt', 'operator_gt', 'operator_equals', 'operator_not', 'operator_and', 'operator_or'
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

const variableId = block => block.fields.VARIABLE.id;

/**
 * Translates one 'Quantum Circuit' script into the body of a `qc` MLIR function (see `MLIREmitter.toFunction`).
 *
 * Handlers are looked up by opcode: `stmt_<opcode>` for stack blocks, `num_<opcode>` for reporters
 * used as numbers, `bool_<opcode>` for conditions and `qubits_<opcode>` for qubit inputs.
 */
class Exporter {
    constructor (blocks, options) {
        this.blocks = blocks;
        this.lookupVariable = options.lookupVariable;
        // Registers are function arguments: record them, but leave allocation to the caller.
        this.registersAsArguments = Boolean(options.registersAsArguments);
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
            throw new MLIRExportError('Only \'Quantum Circuit\' scripts can be exported to MLIR.', hatId);
        }
        this.inferVariableTypes(hat.next);
        this.statements(hat.next);
        if (this.registersAsArguments) {
            return this.emit;
        }
        for (const register of [...this.registers.values()].reverse()) {
            this.emit.line(`memref.dealloc ${register.ssa} : ${register.type}`);
        }
        return this.emit;
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

    forEachStatement (firstId, visit) {
        for (let id = firstId; id; id = this.block(id).next) {
            const block = this.block(id);
            visit(block);
            for (const name of Object.keys(block.inputs)) {
                if (name.startsWith('SUBSTACK')) {
                    this.forEachStatement(this.input(block, name), visit);
                }
            }
        }
    }

    // ---- statements --------------------------------------------------------------------------

    statements (firstId) {
        for (let id = firstId; id; id = this.block(id).next) {
            this.statement(this.block(id));
        }
    }

    nested (firstId) {
        this.depth++;
        this.statements(firstId);
        this.depth--;
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
        if (!this.registersAsArguments) {
            this.emit.line(`${register.ssa} = memref.alloc() {mqt.register_name = "${name}"} : ${register.type}`);
        }
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

    stmt_quantum_controlled (block) {
        this.controlStack.push(this.qubits(this.requireInput(block, 'QUBIT')));
        this.nested(this.input(block, 'SUBSTACK'));
        this.controlStack.pop();
    }

    stmt_data_setvariableto (block) {
        const id = variableId(block);
        const valueId = this.requireInput(block, 'VALUE');
        const value = this.variableType(id, block) === 'i1' ? this.bool(valueId) : this.number(valueId);
        this.variables.set(id, value);
    }

    stmt_data_changevariableby (block) {
        const current = this.num_data_variable(block);
        const delta = this.number(this.requireInput(block, 'VALUE'));
        this.variables.set(variableId(block), this.binaryF64(current, delta, 'addf', (a, b) => a + b, block));
    }

    stmt_control_repeat (block) {
        const times = this.number(this.requireInput(block, 'TIMES'));
        const upper = isConstant(times) ?
            this.emit.constIndex(Math.max(0, Math.round(times.constant))) :
            this.toIndex(times);
        const lower = this.emit.constIndex(0);
        const step = this.emit.constIndex(1);
        const iv = this.emit.fresh('iv');
        const loop = `scf.for ${iv} = ${lower} to ${upper} step ${step}`;
        const body = this.input(block, 'SUBSTACK');
        const carried = this.assignedVariables(body);
        if (carried.length === 0) {
            this.emit.open(loop);
            this.nested(body);
            this.emit.close();
            return;
        }
        const types = carried.map(id => this.variableType(id, block));
        const initial = carried.map(id => this.materialize(this.currentValue(id, block)));
        const args = carried.map(() => this.emit.fresh('arg'));
        const results = this.results(carried.length);
        const iterArgs = args.map((arg, i) => `${arg} = ${initial[i]}`).join(', ');
        this.emit.open(`${results.definition} = ${loop} iter_args(${iterArgs}) -> (${types.join(', ')})`);
        carried.forEach((id, i) => this.variables.set(id, ssa(types[i], args[i])));
        this.nested(body);
        this.yieldVariables(carried, types);
        this.emit.close();
        carried.forEach((id, i) => this.variables.set(id, ssa(types[i], results.names[i])));
    }

    stmt_control_if (block) {
        this.conditional(block, this.input(block, 'SUBSTACK'), null);
    }

    stmt_control_if_else (block) {
        this.conditional(block, this.input(block, 'SUBSTACK'), this.input(block, 'SUBSTACK2'));
    }

    conditional (block, thenId, elseId) {
        const condition = this.i1(this.bool(this.requireInput(block, 'CONDITION')));
        const carried = [...new Set([...this.assignedVariables(thenId), ...this.assignedVariables(elseId)])];
        if (carried.length === 0) {
            this.emit.open(`scf.if ${condition}`);
            this.nested(thenId);
            if (elseId) {
                this.emit.reopen('else');
                this.nested(elseId);
            }
            this.emit.close();
            return;
        }
        const types = carried.map(id => this.variableType(id, block));
        const before = carried.map(id => this.currentValue(id, block));
        const results = this.results(carried.length);
        this.emit.open(`${results.definition} = scf.if ${condition} -> (${types.join(', ')})`);
        this.nested(thenId);
        this.yieldVariables(carried, types);
        carried.forEach((id, i) => this.variables.set(id, before[i]));
        this.emit.reopen('else');
        this.nested(elseId);
        this.yieldVariables(carried, types);
        this.emit.close();
        carried.forEach((id, i) => this.variables.set(id, ssa(types[i], results.names[i])));
    }

    results (count) {
        const base = this.emit.fresh();
        if (count === 1) {
            return {definition: base, names: [base]};
        }
        return {definition: `${base}:${count}`, names: Array.from({length: count}, (_, i) => `${base}#${i}`)};
    }

    yieldVariables (carried, types) {
        const values = carried.map(id => this.materialize(this.variables.get(id)));
        this.emit.line(`scf.yield ${values.join(', ')} : ${types.join(', ')}`);
    }

    // ---- quantum operations ------------------------------------------------------------------

    gate (targets, render, block) {
        const controls = [].concat(...this.controlStack);
        this.checkDistinct([...controls, ...targets], block);
        const controlNames = controls.map(ref => this.load(ref));
        const targetNames = targets.map(ref => this.load(ref));
        if (controls.length === 0) {
            this.emit.line(render(targetNames));
            return;
        }
        const negated = controlNames.filter((_, i) => controls[i].negated);
        negated.forEach(name => this.emit.line(`qc.x ${name} : ${QUBIT}`));
        const args = targetNames.map(() => this.emit.fresh('t'));
        const bindings = args.map((arg, i) => `${arg} = ${targetNames[i]}`).join(', ');
        this.emit.open(`qc.ctrl(${controlNames.join(', ')}) targets (${bindings})`);
        this.emit.line(render(args));
        this.emit.line('qc.yield');
        this.emit.close(` : {${controls.map(() => QUBIT).join(', ')}}, {${targets.map(() => QUBIT).join(', ')}}`);
        negated.forEach(name => this.emit.line(`qc.x ${name} : ${QUBIT}`));
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

    num_data_variable (block) {
        const value = this.currentValue(variableId(block), block);
        if (value.type !== 'f64') {
            throw new MLIRExportError(`The variable '${block.fields.VARIABLE.value}' holds a measurement result ` +
                'and can\'t be used as a number.', block.id);
        }
        return value;
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

    i1 (value) {
        return isConstant(value) ? this.emit.constBool(value.constant) : value.ssa;
    }

    materialize (value) {
        return value.type === 'i1' ? this.i1(value) : this.f64(value);
    }

    // ---- conditions --------------------------------------------------------------------------

    bool (id) {
        const block = this.block(id);
        const handler = this[`bool_${block.opcode}`];
        if (!handler) {
            throw new MLIRExportError(
                `The block '${block.opcode}' can't be used as a condition in MLIR export.`, block.id);
        }
        return handler.call(this, block);
    }

    bool_quantum_measure (block) {
        const results = this.measure(block);
        if (results.length !== 1) {
            throw new MLIRExportError('Only a single qubit can be measured here.', block.id);
        }
        return ssa('i1', results[0]);
    }

    bool_data_variable (block) {
        const value = this.currentValue(variableId(block), block);
        if (value.type !== 'i1') {
            throw new MLIRExportError(`The variable '${block.fields.VARIABLE.value}' holds a number ` +
                'and can\'t be used as a condition.', block.id);
        }
        return value;
    }

    bool_operator_not (block) {
        const value = this.bool(this.requireInput(block, 'OPERAND'));
        if (isConstant(value)) {
            return constant('i1', !value.constant);
        }
        const one = this.emit.constBool(true);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.xori ${value.ssa}, ${one} : i1`);
        return ssa('i1', name);
    }

    bool_operator_and (block) {
        return this.logical(block, 'andi', (a, b) => a && b);
    }

    bool_operator_or (block) {
        return this.logical(block, 'ori', (a, b) => a || b);
    }

    bool_operator_lt (block) {
        return this.compare(block, 'olt', (a, b) => a < b);
    }

    bool_operator_gt (block) {
        return this.compare(block, 'ogt', (a, b) => a > b);
    }

    bool_operator_equals (block) {
        return this.compare(block, 'oeq', (a, b) => a === b);
    }

    logical (block, op, fold) {
        const a = this.bool(this.requireInput(block, 'OPERAND1'));
        const b = this.bool(this.requireInput(block, 'OPERAND2'));
        if (isConstant(a) && isConstant(b)) {
            return constant('i1', fold(a.constant, b.constant));
        }
        const lhs = this.i1(a);
        const rhs = this.i1(b);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.${op} ${lhs}, ${rhs} : i1`);
        return ssa('i1', name);
    }

    compare (block, predicate, fold) {
        const a = this.number(this.requireInput(block, 'OPERAND1'));
        const b = this.number(this.requireInput(block, 'OPERAND2'));
        if (isConstant(a) && isConstant(b)) {
            return constant('i1', fold(a.constant, b.constant));
        }
        const lhs = this.f64(a);
        const rhs = this.f64(b);
        const name = this.emit.fresh();
        this.emit.line(`${name} = arith.cmpf ${predicate}, ${lhs}, ${rhs} : f64`);
        return ssa('i1', name);
    }

    // ---- variables ---------------------------------------------------------------------------

    variableInfo (id, block) {
        const variable = this.lookupVariable(id);
        if (!variable) {
            throw new MLIRExportError('This variable does not exist.', block.id);
        }
        return variable;
    }

    inferVariableTypes (firstId) {
        const copies = [];
        this.forEachStatement(firstId, block => {
            if (block.opcode === 'data_changevariableby') {
                this.assignType(variableId(block), 'f64', block);
            }
            if (block.opcode !== 'data_setvariableto') return;
            const valueId = this.input(block, 'VALUE');
            const source = valueId ? this.block(valueId) : null;
            if (source && source.opcode === 'data_variable') {
                copies.push([block, source]);
            } else {
                const type = source && BOOLEAN_OPCODES.includes(source.opcode) ? 'i1' : 'f64';
                this.assignType(variableId(block), type, block);
            }
        });
        for (const [block, source] of copies) {
            this.assignType(variableId(block), this.variableType(variableId(source), source), block);
        }
    }

    assignType (id, type, block) {
        const known = this.variableTypes.get(id);
        if (known && known !== type) {
            throw new MLIRExportError(`The variable '${this.variableInfo(id, block).name}' is used for both ` +
                'numbers and measurement results.', block.id);
        }
        this.variableTypes.set(id, type);
    }

    variableType (id, block) {
        if (!this.variableTypes.has(id)) {
            const value = this.variableInfo(id, block).value;
            const isBoolean = value === true || value === false || value === 'true' || value === 'false';
            this.variableTypes.set(id, isBoolean ? 'i1' : 'f64');
        }
        return this.variableTypes.get(id);
    }

    currentValue (id, block) {
        if (!this.variables.has(id)) {
            this.variables.set(id, this.initialValue(id, block));
        }
        return this.variables.get(id);
    }

    initialValue (id, block) {
        const variable = this.variableInfo(id, block);
        const raw = variable.value;
        if (this.variableType(id, block) === 'i1') {
            if ([true, 'true', 1, '1'].includes(raw)) return constant('i1', true);
            if ([false, 'false', 0, '0', ''].includes(raw)) return constant('i1', false);
            throw new MLIRExportError(`The variable '${variable.name}' holds '${raw}', ` +
                'which is not a measurement result (0 or 1).', block.id);
        }
        const text = String(raw).trim();
        const value = text === '' ? 0 : Number(text);
        if (!Number.isFinite(value)) {
            throw new MLIRExportError(
                `The variable '${variable.name}' holds '${raw}', which is not a number.`, block.id);
        }
        return constant('f64', value);
    }

    assignedVariables (firstId) {
        const ids = new Set();
        this.forEachStatement(firstId, block => {
            if (block.opcode === 'data_setvariableto' || block.opcode === 'data_changevariableby') {
                ids.add(variableId(block));
            }
        });
        return [...ids];
    }
}

// Scratch has several number shadow blocks; they all carry their value in the NUM field.
for (const opcode of ['math_positive_number', 'math_whole_number', 'math_integer', 'math_angle']) {
    Exporter.prototype[`num_${opcode}`] = Exporter.prototype.num_math_number;
}

const MODULE_HEADER = 'Exported from Scratch by the MQT quantum extension';
const ENTRY_POINT = '@main() attributes {mqt.entry_point}';

/**
 * Translate one circuit into a function.
 * @param {object} circuit The circuit ({blocks, hatId, spriteName, lookupVariable}).
 * @param {function(Array.<object>): string} signature Builds the function signature (e.g. `private @circuit_1()`)
 *     from the circuit's registers.
 * @param {boolean} registersAsArguments Whether the registers are function arguments instead of being allocated.
 * @return {{text: string, registers: Array.<{name: string, size: number, ssa: string, type: string}>}} The
 *     function's text and the circuit's registers in creation order.
 */
const translateCircuit = function (circuit, signature, registersAsArguments) {
    try {
        const exporter = new Exporter(circuit.blocks, Object.assign({}, circuit, {registersAsArguments}));
        const body = exporter.run(circuit.hatId);
        const registers = [...exporter.registers.values()];
        const spriteName = String(circuit.spriteName).replace(/[\r\n]+/g, ' '); // keep the comment on one line
        const comment = `'Quantum Circuit' script of sprite "${spriteName}"`;
        return {text: body.toFunction(signature(registers), comment), registers};
    } catch (e) {
        if (e instanceof MLIRExportError) {
            e.spriteName = circuit.spriteName;
        }
        throw e;
    }
};

/**
 * Export 'Quantum Circuit' scripts to one MQT `qc` MLIR module. A single circuit becomes the body of the
 * `@main` entry point. Several circuits become private functions `@circuit_<k>` that take their registers as
 * arguments, because only the entry point may allocate qubits: `@main` allocates each circuit's registers, calls
 * the circuit and deallocates them again, circuit by circuit.
 * @param {Array.<{blocks: {getBlock: function(string): object}, hatId: string, spriteName: string,
 *     lookupVariable: function(string): ?object}>} circuits The circuits, each with the block container of its
 *     sprite, the ID of its 'Quantum Circuit' hat, the sprite name and a lookup from variable ID to the Scratch
 *     variable ({name, value}).
 * @return {string} The MLIR module.
 */
const exportProjectToMLIR = function (circuits) {
    if (circuits.length === 0) {
        throw new MLIRExportError('There are no \'Quantum Circuit\' scripts to export.', null);
    }
    if (circuits.length === 1) {
        return buildModule(MODULE_HEADER, [translateCircuit(circuits[0], () => ENTRY_POINT, false).text]);
    }
    const translated = circuits.map((circuit, i) => translateCircuit(circuit, registers => {
        const params = registers.map(register => `${register.ssa}: ${register.type}`);
        return `private @circuit_${i + 1}(${params.join(', ')})`;
    }, true));
    const main = new MLIREmitter();
    translated.forEach(({registers}, i) => {
        const values = registers.map(register => {
            const name = `circuit_${i + 1}_${register.name}`;
            const value = main.fresh(name);
            main.line(`${value} = memref.alloc() {mqt.register_name = "${name}"} : ${register.type}`);
            return value;
        });
        const types = registers.map(register => register.type);
        main.line(`func.call @circuit_${i + 1}(${values.join(', ')}) : (${types.join(', ')}) -> ()`);
        for (let j = registers.length - 1; j >= 0; j--) {
            main.line(`memref.dealloc ${values[j]} : ${types[j]}`);
        }
    });
    return buildModule(MODULE_HEADER, [...translated.map(circuit => circuit.text), main.toFunction(ENTRY_POINT)]);
};

/**
 * Export a single 'Quantum Circuit' script; see `exportProjectToMLIR`.
 * @param {{getBlock: function(string): object}} blocks The block container of the sprite.
 * @param {string} hatId ID of the script's 'Quantum Circuit' hat block.
 * @param {{spriteName: string, lookupVariable: function(string): ?object}} options Sprite name and variable lookup.
 * @return {string} The MLIR module.
 */
const exportToMLIR = function (blocks, hatId, options) {
    return exportProjectToMLIR([Object.assign({blocks, hatId}, options)]);
};

module.exports = {exportProjectToMLIR, exportToMLIR, MLIRExportError};

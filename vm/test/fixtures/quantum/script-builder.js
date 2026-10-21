/**
 * Builds Scratch block containers in the VM's runtime format for exporter tests.
 * Methods return block ids. Wherever a block id is expected, a JS number is accepted
 * and turned into a `math_number` shadow.
 */
class ScriptBuilder {
    constructor () {
        this.blocks = {};
        this.variables = {};
        this._next = 0;
    }

    create (opcode, {inputs = {}, fields = {}, shadow = false} = {}) {
        const id = `b${this._next++}`;
        const block = {id, opcode, inputs: {}, fields: {}, next: null, parent: null, shadow, topLevel: false};
        for (const [name, field] of Object.entries(fields)) {
            block.fields[name] = Object.assign({name}, field);
        }
        for (const [name, value] of Object.entries(inputs)) {
            if (value === null) continue;
            const childId = typeof value === 'number' ? this.num(value) : value;
            const child = this.blocks[childId];
            child.parent = id;
            block.inputs[name] = {name, block: childId, shadow: child.shadow ? childId : null};
        }
        this.blocks[id] = block;
        return id;
    }

    num (value) {
        return this.create('math_number', {fields: {NUM: {value: String(value)}}, shadow: true});
    }

    text (value) {
        return this.create('text', {fields: {TEXT: {value}}, shadow: true});
    }

    menu (opcode, field, value) {
        return this.create(opcode, {fields: {[field]: {value}}, shadow: true});
    }

    stack (...ids) {
        for (let i = 0; i + 1 < ids.length; i++) {
            this.blocks[ids[i]].next = ids[i + 1];
            this.blocks[ids[i + 1]].parent = ids[i];
        }
        return ids.length > 0 ? ids[0] : null;
    }

    script (...statements) {
        const hat = this.create('quantum_quantumEvaluate');
        this.blocks[hat].topLevel = true;
        const first = this.stack(...statements);
        if (first) {
            this.blocks[hat].next = first;
            this.blocks[first].parent = hat;
        }
        return hat;
    }

    container () {
        return {getBlock: id => this.blocks[id]};
    }

    // ---- quantum blocks ----

    createRegister (name, size) {
        return this.create('quantum_createRegister', {inputs: {NAME: this.text(name), NUM: size}});
    }

    qubit (index, register = 'q') {
        return this.create('quantum_getQubit', {inputs: {QUBIT: index, NAME: this.text(register)}});
    }

    qubits (register = 'q') {
        return this.create('quantum_getQubits', {inputs: {NAME: this.text(register)}});
    }

    and (a, b) {
        return this.create('quantum_and', {inputs: {QUBIT1: a, QUBIT2: b}});
    }

    negated (qubit) {
        return this.create('quantum_negated', {inputs: {QUBIT: qubit}});
    }

    gate (name, qubit) {
        return this.create('quantum_applyGate', {
            inputs: {GATE: this.menu('quantum_menu_gates', 'gates', name), QUBIT: qubit}
        });
    }

    swap (a, b) {
        return this.create('quantum_swapGate', {inputs: {QUBIT1: a, QUBIT2: b}});
    }

    rotate (qubit, angle, axis) {
        return this.create('quantum_rotateAxis', {
            inputs: {QUBIT: qubit, ANGLE: angle, AXIS: this.menu('quantum_menu_axes', 'axes', axis)}
        });
    }

    u3 (qubit, theta, phi, lambda) {
        return this.create('quantum_u3', {inputs: {QUBIT: qubit, THETA: theta, PHI: phi, LAMBDA: lambda}});
    }

    measure (qubit) {
        return this.create('quantum_measure', {inputs: {QUBIT: qubit}});
    }

    controlled (qubit, ...body) {
        return this.create('quantum_controlled', {inputs: {QUBIT: qubit, SUBSTACK: this.stack(...body)}});
    }

    // ---- Scratch blocks ----

    repeat (times, ...body) {
        return this.create('control_repeat', {inputs: {TIMES: times, SUBSTACK: this.stack(...body)}});
    }

    if (condition, ...body) {
        return this.create('control_if', {inputs: {CONDITION: condition, SUBSTACK: this.stack(...body)}});
    }

    ifElse (condition, thenBody, elseBody) {
        return this.create('control_if_else', {inputs: {
            CONDITION: condition,
            SUBSTACK: this.stack(...thenBody),
            SUBSTACK2: this.stack(...elseBody)
        }});
    }

    variable (name, value) {
        const id = `var_${name}`;
        this.variables[id] = {id, name, value};
        return id;
    }

    getVar (id) {
        return this.create('data_variable', {fields: {VARIABLE: {value: this.variables[id].name, id}}});
    }

    setVar (id, value) {
        return this.create('data_setvariableto', {
            inputs: {VALUE: typeof value === 'number' ? this.text(String(value)) : value},
            fields: {VARIABLE: {value: this.variables[id].name, id}}
        });
    }

    changeVar (id, value) {
        return this.create('data_changevariableby', {
            inputs: {VALUE: value},
            fields: {VARIABLE: {value: this.variables[id].name, id}}
        });
    }

    arith (opcode, a, b) {
        return this.create(opcode, {inputs: {NUM1: a, NUM2: b}});
    }

    compare (opcode, a, b) {
        return this.create(opcode, {inputs: {OPERAND1: a, OPERAND2: b}});
    }

    not (operand) {
        return this.create('operator_not', {inputs: {OPERAND: operand}});
    }

    say (message) {
        return this.create('looks_say', {inputs: {MESSAGE: message}});
    }
}

module.exports = ScriptBuilder;

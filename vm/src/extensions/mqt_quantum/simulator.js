class Control {
    constructor (qubit, negated) {
        this.qubit = qubit;
        this.negated = negated;
    }
}

class Simulator {
    constructor (startingState) {
        this.startingState = startingState;
        this.registers = [];
    }

    // eslint-disable-next-line no-unused-vars
    createRegister (name, size) {
        throw new Error('createRegister method not implemented');
    }

    // eslint-disable-next-line no-unused-vars
    applyGate (gate, targets, controls) {
        throw new Error('applyGate method not implemented');
    }

    // eslint-disable-next-line no-unused-vars
    applyRotation (axis, angle, targets, controls) {
        throw new Error('applyRotation method not implemented');
    }

    // eslint-disable-next-line no-unused-vars
    measure (qubit) {
        throw new Error('measure method not implemented');
    }

    getResults () {
        return '';
    }

    _accessToIndex (access) {
        let index = 0;
        for (const reg of this.registers) {
            if (reg.name === access.register) {
                index += access.index;
                break;
            }
            index += reg.size;
        }
        return index;
    }

    _getNumQubits () {
        return this.registers.reduce((sum, reg) => sum + reg.size, 0);
    }
}

export {Simulator, Control};

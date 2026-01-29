class Control {
    constructor (qubit, negated) {
        this.qubit = qubit;
        this.negated = negated;
    }
}

class Simulator {
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
}

export {Simulator, Control};

class Control {
    constructor(qubit, negated) {
        this.qubit = qubit;
        this.negated = negated;
    }
}

class Simulator {
    createRegister(name, size) {
        throw new Error('createRegister method not implemented');
    }

    applyGate(gate, targets, controls) {
        throw new Error('applyGate method not implemented');
    }

    applyRotation(axis, angle, targets, controls) {
        throw new Error('applyRotation method not implemented');
    }

    measure(qubit) {
        throw new Error('measure method not implemented');
    }
}

module.exports = { Simulator, Control };
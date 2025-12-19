const { Simulator, Control } = require('./simulator');

function error(message) {
    console.error(message);
}

class BitString {
    constructor(size) {
        this.vector = Array(size).fill(0);
    }

    next() {
        for (let i = this.vector.length - 1; i >= 0; i--) {
            if (this.vector[i] === 0) {
                this.vector[i] = 1;
                return false;
            }
            this.vector[i] = 0;
        }
        return true; // Overflow
    }

    int() {
        let x = 0;
        for (let i = 0; i < this.vector.length; i++) {
            x += this.vector[this.vector.length - 1 - i] * (1 << i);
        }
        return x;
    }

    element(index) {
        return this.vector[this.vector.length - 1 - index];
    }
    
    setElement(index, value) {
        this.vector[this.vector.length - 1 - index] = value;
    }


}

class StatevectorSimulatorPerRegister {
    constructor(name, size) {
        this.name = name;
        this.size = size;
        this.statevector = new Array(2 ** size).fill(0);
        this.statevector[0] = 1; // Initialize to |0...0>
    }

    applyRule(rule) {
        const newStatevector = new Array(2 ** this.size).fill(0);
        const bitVector = new BitString(this.size);
        for (let i = 0; i < this.statevector.length; i++) {
            newStatevector[i] = rule(this.statevector, bitVector, i);
            bitVector.next(); 
        }
        this.statevector = newStatevector;
    }

    applyGate(gate, targets, positiveControls, negativeControls) { 
        const checkControls = (bitVector) => {
            for (const contr of positiveControls) {
                if (bitVector.element(contr) !== 1) {
                    console.log(`Control ${contr} not satisfied`);
                    return false;
                }
            }
            for (const contr of negativeControls) {
                if (bitVector.element(contr) !== 0) {
                    console.log(`Control ${contr} not satisfied`);
                    return false;
                }
            }
            return true;
        }


        switch (gate) {
            case 'X':
                this.applyRule((statevector, bitVector, i) => {
                    if(!checkControls(bitVector)) {
                        return statevector[i];
                    }
                    const target = targets[0];
                    bitVector.setElement(target, 1 - bitVector.element(target));
                    const other = bitVector.int();
                    bitVector.setElement(target, 1 - bitVector.element(target));
                    return statevector[other];
                });
                break;
            case 'Z':
                this.applyRule((statevector, bitVector, i) => {
                    if(!checkControls(bitVector)) {
                        return statevector[i];
                    }
                    const target = targets[0];
                    if(bigVector.vector[target] === 0) {
                        return statevector[i];
                    }
                    return -1 * statevector[i];
                });
                break;
            case 'Y':
                this.applyRule((statevector, bitVector, i) => {
                    if(!checkControls(bitVector)) {
                        return statevector[i];
                    }
                    const target = targets[0];
                    bitVector.setElement(target, 1 - bitVector.element(target));
                    const other = bitVector.int();
                    bitVector.setElement(target, 1 - bitVector.element(target));
                    return statevector[other]; // TODO add i/-i factor
                });
                break;
            case 'H':
                this.applyRule((statevector, bitVector, i) => {
                    if(!checkControls(bitVector)) {
                        return statevector[i];
                    }
                    const target = targets[0];
                    bitVector.setElement(target, 1 - bitVector.element(target));
                    const other = bitVector.int();
                    bitVector.setElement(target, 1 - bitVector.element(target));
                    const otherVal = statevector[other];
                    const factor = bitVector.element(target) === 1 ? 1 : -1;
                    return (statevector[i] + otherVal * factor) / Math.sqrt(2);
                });
                break;
            case 'S':
                this.applyRule((statevector, bitVector, i) => {
                    if(!checkControls(bitVector)) {
                        return statevector[i];
                    }
                    const target = targets[0];
                    if(bigVector.vector[target] === 0) {
                        return statevector[i];
                    }
                    return -1 * statevector[i]; // TODO correct factor (i)
                });
                break;
            case 'T':
                this.applyRule((statevector, bitVector, i) => {
                    if(!checkControls(bitVector)) {
                        return statevector[i];
                    }
                    const target = targets[0];
                    if(bigVector.vector[target] === 0) {
                        return statevector[i];
                    }
                    return -1 * statevector[i]; // TODO correct factor (exp(i * Math.PI / 4))
                });
                break;
            default:
                error(`Unknown gate: ${gate}`);
        }
        console.log(gate, this.statevector);
    }

    applyRotation(axis, angle, targets, controls) {
        error('applyRotation method not implemented');
    }

    measure(qubit) {
        let probability = 0;
        let bitVector = new BitString(this.size);
        for (let i = 0; i < this.statevector.length; i++) {
            if (bitVector.element(qubit) === 1) {
                probability += this.statevector[bitVector.int()] ** 2;
            }
            bitVector.next(); 
        }
        const randomValue = Math.random();
        const result = randomValue < probability ? 1 : 0;

        this.applyRule((statevector, bitVector, i) => {
            if (bitVector.element(qubit) === result) {
                return statevector[i];
            } else {
                return 0; // Collapse the state to the measured value
            }
        });
        this.normalizeStatevector();
        return result;
    }

    normalizeStatevector() {
        const norm = Math.sqrt(this.statevector.reduce((sum, amplitude) => sum + amplitude ** 2, 0));
        if (norm === 0) {
            error('Cannot normalize a zero statevector');
        }
        this.statevector = this.statevector.map(amplitude => amplitude / norm);
    }
}

class QubitAccess {
    constructor(register, index) {
        this.register = register;
        this.index = index;
    }
}

function targetAccess(target) {
    return new QubitAccess(target.register, target.index);
}

class StatevectorSimulator extends Simulator {
    constructor() {
        super();
        this.registers = new Map();
    }

    createRegister(name, size) {
        this.registers.set(name, new StatevectorSimulatorPerRegister(name, size));
    }                                                                           

    applyGate(gate, targets, positiveControls, negativeControls) {
        const accesses = targets.map((x) => targetAccess(x));
        if(!accesses.every(x => x.register == accesses[0].register)) {
            error('All targets must be in the same register');
        }
        const positiveControlAccesses = positiveControls.map((x) => targetAccess(x));
        if(!positiveControlAccesses.every(x => x.register == positiveControlAccesses[0].register)) {
            error('All controls must be in the same register');
        }
        const negativeControlAccesses = negativeControls.map((x) => targetAccess(x));
        if(!negativeControlAccesses.every(x => x.register == negativeControlAccesses[0].register)) {
            error('All controls must be in the same register');
        }
        if (positiveControlAccesses.length > 0 && negativeControlAccesses.length > 0 && positiveControlAccesses[0].register !== negativeControlAccesses[0].register) {
            error('All controls must be in the same register');
        }

        const register = accesses[0].register;
        const registerObj = this.registers.get(register);
        if (!registerObj) {
            error(`Register ${register} not found`);
        }
        const targetIndices = accesses.map((x) => x.index);
        const positiveControlIndices = positiveControlAccesses.map((x) => x.index);
        const negativeControlIndices = negativeControlAccesses.map((x) => x.index);
        registerObj.applyGate(gate, targetIndices, positiveControlIndices, negativeControlIndices);
    }

    applyRotation(axis, angle, targets, controls) {
        const accesses = targets.map((x) => targetAccess(x));
        if(!accesses.every(x => x.register == accesses[0].register)) {
            error('All targets must be in the same register');
        }
        const positiveControlAccesses = positiveControls.map((x) => targetAccess(x));
        if(!positiveControlAccesses.every(x => x.register == positiveControlAccesses[0].register)) {
            error('All controls must be in the same register');
        }
        const negativeControlAccesses = negativeControls.map((x) => targetAccess(x));
        if(!negativeControlAccesses.every(x => x.register == negativeControlAccesses[0].register)) {
            error('All controls must be in the same register');
        }
        if (positiveControlAccesses.length > 0 && negativeControlAccesses.length > 0 && positiveControlAccesses[0].register !== negativeControlAccesses[0].register) {
            error('All controls must be in the same register');
        }

        const register = accesses[0].register;
        const registerObj = this.registers.get(register);
        if (!registerObj) {
            error(`Register ${register} not found`);
        }
        const targetIndices = accesses.map((x) => x.index);
        const positiveControlIndices = positiveControlAccesses.map((x) => x.index);
        const negativeControlIndices = negativeControlAccesses.map((x) => x.index);
        registerObj.applyRotation(axis, angle, targetIndices, positiveControlIndices, negativeControlIndices);
    }

    measure(qubit) {
        const access = targetAccess(qubit);
        const register = access.register;
        const registerObj = this.registers.get(register);
        if (!registerObj) {
            error(`Register ${register} not found`);
        }
        const index = access.index;
        return registerObj.measure(index);
    }
}

module.exports = StatevectorSimulator;
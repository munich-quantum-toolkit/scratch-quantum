import {Simulator} from './simulator';
import {Register, targetAccess, error} from './utils';
import {Vector, Matrix, Complex} from './complex-math';

const INTERNAL_STARTING_REGISTER = '~~internal_init';
const MAX_QUBITS = 10;

class StatevectorSimulator extends Simulator {
    constructor (startingState) {
        super(startingState);
        this.statevector = new Vector(1);
        this.statevector.setElement(0, new Complex(1, 0));
        if (startingState !== 0) {
            this._setupStartingState();
        }
    }

    _setupStartingState () {
        const numQubits = Math.ceil(Math.log2(this.startingState + 1));
        this.createRegister(INTERNAL_STARTING_REGISTER, numQubits);
        this.statevector.setElement(0, new Complex(0, 0));
        this.statevector.setElement(this.startingState, new Complex(1, 0));
    }

    _reduceStartingState (name, size) {
        const internalRegIndex = this.registers.findIndex(reg => reg.name === INTERNAL_STARTING_REGISTER);
        if (internalRegIndex === -1) return false;
        const internalReg = this.registers[internalRegIndex];

        if (internalReg.size > size) {
            // insert new register before internal register
            this.registers.splice(internalRegIndex, 0, new Register(name, size));
            // reduce internal register size
            internalReg.size -= size;
            return true;
        }

        // rename internal register
        internalReg.name = name;
        if (internalReg.size < size) {
            // increase internal register size
            const res = this._addQubits(size - internalReg.size);
            internalReg.size += res;
        }
        return true;
    }

    createRegister (name, size) {
        if (!this._reduceStartingState(name, size)) {
            const reg = new Register(name, size);
            reg.size = this._addQubits(size);
            this.registers.push(reg);
        }
    }

    applyGate (gate, targets, positiveControls, negativeControls) {
        const accesses = targets.map(x => this._accessToIndex(targetAccess(x)))
            .filter(v => v < this._getNumQubits());
        if (accesses.length === 0) return;

        const positiveControlAccesses = positiveControls.map(x =>
            this._accessToIndex(targetAccess(x))
        ).filter(v => v < this._getNumQubits());
        const negativeControlAccesses = negativeControls.map(x =>
            this._accessToIndex(targetAccess(x))
        ).filter(v => v < this._getNumQubits());

        let matrix = this._getGateMatrix(gate);
        matrix = this._addControlsToMatrix(
            matrix,
            positiveControlAccesses,
            negativeControlAccesses
        );
        this._applyMatrixToQubits(matrix, [
            ...positiveControlAccesses,
            ...negativeControlAccesses,
            ...accesses
        ]);
    }

    applyRotation (axis, angle, targets, positiveControls, negativeControls) {
        const accesses = targets.map(x => this._accessToIndex(targetAccess(x)))
            .filter(v => v < this._getNumQubits());
        if (accesses.length === 0) return;

        const positiveControlAccesses = positiveControls.map(x =>
            this._accessToIndex(targetAccess(x))
        ).filter(v => v < this._getNumQubits());
        const negativeControlAccesses = negativeControls.map(x =>
            this._accessToIndex(targetAccess(x))
        ).filter(v => v < this._getNumQubits());

        let matrix = this._getParametrizedGateMatrix(`r${axis}`, angle);
        matrix = this._addControlsToMatrix(
            matrix,
            positiveControlAccesses.length,
            negativeControlAccesses.length
        );
        this._applyMatrixToQubits(matrix, [
            ...positiveControlAccesses,
            ...negativeControlAccesses,
            ...accesses
        ]);
    }

    measure (qubit) {
        const access = this._accessToIndex(targetAccess(qubit));
        if (access >= this._getNumQubits()) return;
        let probability = 0;
        for (let i = 0; i < this.statevector.n; i++) {
            const bits = i
                .toString(2)
                .padStart(this._getNumQubits(), '0')
                .split('')
                .reverse()
                .map(Number);
            if (bits[access] === 0) continue; // Skip if qubit is not in the state we want to measure
            const amplitude = this.statevector.getElement(i);
            probability += amplitude.squaredMagnitude();
        }

        const randomValue = Math.random();
        const outcome = randomValue < probability ? 1 : 0;

        for (let i = 0; i < this.statevector.n; i++) {
            const bits = i
                .toString(2)
                .padStart(this._getNumQubits(), '0')
                .split('')
                .reverse()
                .map(Number);
            if (bits[access] === outcome) continue; // Skip if qubit is in the measure outcome state
            this.statevector.setElement(i, new Complex(0, 0)); // Collapse the statevector
        }

        this.statevector.normalize();

        return outcome;
    }

    _getGateMatrix (gate) {
        switch (gate) {
        case 'H':
            return new Matrix(2, 2)
                .set(0, 0, new Complex(1 / Math.sqrt(2), 0))
                .set(0, 1, new Complex(1 / Math.sqrt(2), 0))
                .set(1, 0, new Complex(1 / Math.sqrt(2), 0))
                .set(1, 1, new Complex(-1 / Math.sqrt(2), 0));
        case 'X':
            return new Matrix(2, 2)
                .set(0, 0, new Complex(0, 0))
                .set(0, 1, new Complex(1, 0))
                .set(1, 0, new Complex(1, 0))
                .set(1, 1, new Complex(0, 0));
        case 'Y':
            return new Matrix(2, 2)
                .set(0, 0, new Complex(0, 0))
                .set(0, 1, new Complex(0, -1))
                .set(1, 0, new Complex(0, 1))
                .set(1, 1, new Complex(0, 0));
        case 'Z':
            return new Matrix(2, 2)
                .set(0, 0, new Complex(1, 0))
                .set(0, 1, new Complex(0, 0))
                .set(1, 0, new Complex(0, 0))
                .set(1, 1, new Complex(-1, 0));
        case 'S':
            return new Matrix(2, 2)
                .set(0, 0, new Complex(1, 0))
                .set(0, 1, new Complex(0, 0))
                .set(1, 0, new Complex(0, 0))
                .set(1, 1, new Complex(0, 1));
        case 'T':
            return new Matrix(2, 2)
                .set(0, 0, new Complex(1, 0))
                .set(0, 1, new Complex(0, 0))
                .set(1, 0, new Complex(0, 0))
                .set(1, 1, new Complex(Math.cos(Math.PI / 8), Math.sin(Math.PI / 8)));
        case 'SWAP':
            return new Matrix(4, 4)
                .set(0, 0, new Complex(1, 0))
                .set(1, 2, new Complex(1, 0))
                .set(2, 1, new Complex(1, 0))
                .set(3, 3, new Complex(1, 0));
        default:
            error(`Unknown gate: ${gate}`);
            return null;
        }
    }

    _getParametrizedGateMatrix (gate, params) {
        switch (gate) {
        case 'RX': {
            const cos = Math.cos(params / 2);
            const sin = Math.sin(params / 2);
            return new Matrix(2, 2)
                .set(0, 0, new Complex(cos, 0))
                .set(0, 1, new Complex(0, -sin))
                .set(1, 0, new Complex(0, sin))
                .set(1, 1, new Complex(cos, 0));
        }
        case 'RY': {
            const cosY = Math.cos(params / 2);
            const sinY = Math.sin(params / 2);
            return new Matrix(2, 2)
                .set(0, 0, new Complex(cosY, 0))
                .set(0, 1, new Complex(-sinY, 0))
                .set(1, 0, new Complex(sinY, 0))
                .set(1, 1, new Complex(cosY, 0));
        }
        case 'RZ': {
            const cosZ = Math.cos(params / 2);
            const sinZ = Math.sin(params / 2);
            return new Matrix(2, 2)
                .set(0, 0, new Complex(cosZ, -sinZ))
                .set(0, 1, new Complex(0, -sinZ))
                .set(1, 0, new Complex(0, sinZ))
                .set(1, 1, new Complex(cosZ, sinZ));
        }
        default:
            error(`Unknown parametrized gate: ${gate}`);
            return null;
        }
    }

    _addControlsToMatrix (matrix, positiveControls, negativeControls) {
        const numQubits = positiveControls.length + negativeControls.length + Math.log2(matrix.m);
        const matrixSize = 2 ** numQubits;
        const newMatrix = new Matrix(matrixSize, matrixSize);
        newMatrix.makeIdentity();
        let currentColumn = 0;
        for (let i = 0; i < newMatrix.m; i++) {
            const bits = i.toString(2).padStart(numQubits, '0')
                .split('')
                .reverse()
                .map(Number);
            let ignore = false;
            for (let posI = 0; posI < positiveControls.length; posI++) {
                if (bits[posI] === 0) {
                    ignore = true;
                    break;
                }
            }
            for (let negI = 0; negI < negativeControls.length; negI++) {
                if (bits[negI + positiveControls.length] === 1) {
                    ignore = true;
                    break;
                }
            }
            if (ignore) continue;
            let currentRow = 0;
            for (let j = 0; j < newMatrix.n; j++) {
                const newBits = j.toString(2).padStart(numQubits, '0')
                    .split('')
                    .reverse()
                    .map(Number);
                ignore = false;
                for (let posI = 0; posI < positiveControls.length; posI++) {
                    if (newBits[posI] === 0) {
                        newMatrix.set(j, i, new Complex(0, 0));
                        ignore = true;
                        break;
                    }
                }
                for (let negI = 0; negI < negativeControls.length; negI++) {
                    if (newBits[negI + positiveControls.length] === 1) {
                        newMatrix.set(j, i, new Complex(0, 0));
                        ignore = true;
                        break;
                    }
                }
                if (ignore) continue;
                newMatrix.set(
                    j,
                    i,
                    matrix.get(currentRow, currentColumn)
                );
                currentRow++;
            }
            currentColumn++;
        }
        return newMatrix;
    }

    _applyMatrixToQubits (matrix, targetQubits) {
        const missingQubits = this._getNumQubits() - targetQubits.length;
        const expandingMatrix = new Matrix(2 ** missingQubits, 2 ** missingQubits);
        expandingMatrix.makeIdentity();
        const fullMatrix = expandingMatrix.tensorProduct(matrix);

        const indexList = new Array(this._getNumQubits()).fill(0)
            .map((_, i) => i);
        const indexOfQubit = Object.fromEntries(indexList.map((q, i) => [q, i]));

        for (let i = 0; i < targetQubits.length; i++) {
            const qubitIndex = indexOfQubit[targetQubits[i]];
            indexOfQubit[indexList[i]] = qubitIndex;
            indexOfQubit[targetQubits[i]] = i;
            [indexList[i], indexList[qubitIndex]] = [
                indexList[qubitIndex],
                indexList[i]
            ];
        }

        const getIndex = i => {
            const bits = i
                .toString(2)
                .padStart(this._getNumQubits(), '0')
                .split('')
                .reverse()
                .map(Number);
            let newIndex = 0;
            for (let j = 0; j < indexList.length; j++) {
                newIndex += bits[indexList[j]] * (2 ** j);
            }
            return newIndex;
        };

        const currentLayout = Object.fromEntries(fullMatrix.data.map((_, i) => [i, i]));
        const desiredIndices = {};
        for (let i = 0; i < fullMatrix.m; i++) {
            const newIndex = getIndex(i);
            desiredIndices[newIndex] = i;
        }
        for (let i = 0; i < fullMatrix.m; i++) {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const originalId = currentLayout[i];
                const targetIndex = desiredIndices[originalId];
                if (targetIndex === i) break;
                fullMatrix.swapColumns(i, targetIndex);
                fullMatrix.swapRows(i, targetIndex);
                currentLayout[i] = currentLayout[targetIndex];
                currentLayout[targetIndex] = originalId;
            }

        }

        this._applyMatrix(fullMatrix);
    }

    _applyMatrix (matrix) {
        this.statevector = matrix.matrixProduct(this.statevector);
        this._stateVectorToVector();
    }

    _addQubits (size) {
        const numQubits = Math.log2(this.statevector.n);
        if (numQubits + size > MAX_QUBITS + 1) {
            error('Statevector too large to simulate');
            size = MAX_QUBITS - numQubits;
            if (size <= 0) return 0;
        }
        const newQubit = new Vector(2 ** size);
        newQubit.setElement(0, new Complex(1, 0));
        this.statevector = this.statevector.tensorProduct(newQubit);
        this._stateVectorToVector();
        return size;
    }

    _stateVectorToVector () {
        const vector = new Vector(this.statevector.n);
        for (let i = 0; i < this.statevector.n; i++) {
            vector.setElement(i, this.statevector.get(i, 0));
        }
        this.statevector = vector;
    }
}

export default StatevectorSimulator;

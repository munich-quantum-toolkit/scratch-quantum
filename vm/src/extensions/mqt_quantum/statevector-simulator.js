import {Simulator} from './simulator.js';
import {Register, targetAccess, error} from './utils.js';
import {Vector, Matrix, Complex} from './complex-math.js';

const MAX_QUBITS = 10;

/**
 * Thrown by `createRegister` when a circuit would need more qubits than the simulator supports.
 */
class QubitLimitError extends Error {
    constructor (requestedQubits) {
        super(`The simulator supports at most ${MAX_QUBITS} qubits. This circuit needs ${requestedQubits}.`);
        this.name = 'QubitLimitError';
        this.requestedQubits = requestedQubits;
    }
}

class StatevectorSimulator extends Simulator {
    /**
     * @param {number} startingState non-negative integer; bit j gives the initial value of global qubit j
     *  (qubit 0 = first qubit of the first register). Bits beyond the circuit's last qubit are ignored.
     */
    constructor (startingState = 0) {
        super(startingState);
        this.statevector = new Vector(1);
        this.statevector.setElement(0, new Complex(1, 0));
    }

    createRegister (name, size) {
        const firstNewQubit = this._getNumQubits();
        const totalQubits = firstNewQubit + size;
        if (totalQubits > MAX_QUBITS) {
            throw new QubitLimitError(totalQubits);
        }
        this._addQubits(firstNewQubit, size);
        this.registers.push(new Register(name, size));
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

        let matrix = this._getParametrizedGateMatrix(`R${axis}`, angle);
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
                .set(1, 1, new Complex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)));
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
                .set(0, 1, new Complex(0, 0))
                .set(1, 0, new Complex(0, 0))
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

    _addQubits (firstNewQubit, size) {
        // New qubits get the next (more significant) global indices, so the existing qubits keep theirs.
        // They start in the basis state given by their digits of the starting state.
        const newQubits = new Vector(2 ** size);
        const startingBits = Math.floor(this.startingState / (2 ** firstNewQubit)) % (2 ** size);
        newQubits.setElement(startingBits, new Complex(1, 0));
        this.statevector = newQubits.tensorProduct(this.statevector);
        this._stateVectorToVector();
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
export {QubitLimitError, MAX_QUBITS};

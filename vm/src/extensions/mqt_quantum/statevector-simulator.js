import {Simulator} from './simulator';

const error = function (message) {
    console.error(message);
};

class Complex {
    constructor (real, imag) {
        this.real = real;
        this.imag = imag;
    }

    add (other) {
        return new Complex(this.real + other.real, this.imag + other.imag);
    }

    subtract (other) {
        return new Complex(this.real - other.real, this.imag - other.imag);
    }

    multiply (other) {
        return new Complex(
            (this.real * other.real) - (this.imag * other.imag),
            (this.real * other.imag) + (this.imag * other.real)
        );
    }

    scalarProduct (scalar) {
        return new Complex(this.real * scalar, this.imag * scalar);
    }

    magnitude () {
        return Math.sqrt((this.real ** 2) + (this.imag ** 2));
    }

    squaredMagnitude () {
        return (this.real ** 2) + (this.imag ** 2);
    }

    conjugate () {
        return new Complex(this.real, -this.imag);
    }

    toString () {
        return `${this.real} + ${this.imag}i`;
    }
}

class Matrix {
    constructor (n, m) {
        this.n = n;
        this.m = m;
        this.data = Array.from({length: n}, () =>
            Array(m).fill(new Complex(0, 0))
        );
    }

    set (i, j, value) {
        this.data[i][j] = value instanceof Complex ? value : new Complex(value, 0);
        return this;
    }

    get (i, j) {
        return this.data[i][j];
    }

    tensorProduct (other) {
        if (this.n === 0) {
            return other;
        }
        const result = new Matrix(this.n * other.n, this.m * other.m);
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.m; j++) {
                for (let k = 0; k < other.n; k++) {
                    for (let l = 0; l < other.m; l++) {
                        result.set(
                            (i * other.n) + k,
                            (j * other.m) + l,
                            this.get(i, j).multiply(other.get(k, l))
                        );
                    }
                }
            }
        }
        return result;
    }

    matrixProduct (other) {
        if (this.m !== other.n) {
            throw new Error('Matrix dimensions do not match for multiplication');
        }
        const result = new Matrix(this.n, other.m);
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < other.m; j++) {
                let sum = new Complex(0, 0);
                for (let k = 0; k < this.m; k++) {
                    sum = sum.add(this.get(i, k).multiply(other.get(k, j)));
                }
                result.set(i, j, sum);
            }
        }
        return result;
    }

    matrixSum (other) {
        if (this.n !== other.n || this.m !== other.m) {
            throw new Error('Matrix dimensions do not match for addition');
        }
        const result = new Matrix(this.n, this.m);
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.m; j++) {
                result.set(i, j, this.get(i, j).add(other.get(i, j)));
            }
        }
        return result;
    }

    scalarProduct (scalar) {
        const scalarComplex =
      scalar instanceof Complex ? scalar : new Complex(scalar, 0);
        const result = new Matrix(this.n, this.m);
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.m; j++) {
                result.set(i, j, this.get(i, j).multiply(scalarComplex));
            }
        }
        return result;
    }

    toString () {
        return this.data
            .map(row => row.map(cell => cell.toString()).join(' '))
            .join('\n');
    }

    swapColumns (i, j) {
        for (let k = 0; k < this.n; k++) {
            const temp = this.get(k, i);
            this.set(k, i, this.get(k, j));
            this.set(k, j, temp);
        }
    }

    makeIdentity () {
        for (let i = 0; i < this.n; i++) {
            this.set(i, i, new Complex(1, 0));
        }
    }
}

class Vector extends Matrix {
    constructor (size) {
        super(size, 1);
    }

    setElement (index, value) {
        super.set(index, 0, value);
    }

    getElement (index) {
        return super.get(index, 0);
    }

    normalize () {
        const norm = Math.sqrt(
            this.data.reduce((sum, row) => sum + row[0].squaredMagnitude(), 0)
        );
        if (norm === 0) {
            throw new Error('Cannot normalize a zero vector');
        }
        for (let i = 0; i < this.n; i++) {
            this.setElement(i, this.getElement(i).scalarProduct(1 / norm));
        }
    }
}

class QubitAccess {
    constructor (register, index) {
        this.register = register;
        this.index = index;
    }
}

class Register {
    constructor (name, size) {
        this.name = name;
        this.size = size;
    }
}

const targetAccess = function (target) {
    return new QubitAccess(target.register, target.index);
};

class StatevectorSimulator extends Simulator {
    constructor (startingState) {
        super(startingState);
        this.statevector = new Vector(1);
        this.statevector.setElement(0, new Complex(1, 0));
        this.registers = [];
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

    createRegister (name, size) {
        this.registers.push(new Register(name, size));
        this._addQubits(size);
    }

    applyGate (gate, targets, positiveControls, negativeControls) {
        const accesses = targets.map(x => this._accessToIndex(targetAccess(x)));
        const positiveControlAccesses = positiveControls.map(x =>
            this._accessToIndex(targetAccess(x))
        );
        const negativeControlAccesses = negativeControls.map(x =>
            this._accessToIndex(targetAccess(x))
        );

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
        const accesses = targets.map(x => this._accessToIndex(targetAccess(x)));
        const positiveControlAccesses = positiveControls.map(x =>
            this._accessToIndex(targetAccess(x))
        );
        const negativeControlAccesses = negativeControls.map(x =>
            this._accessToIndex(targetAccess(x))
        );

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

        const indexOfColumn = Object.fromEntries(fullMatrix.data.map((_, i) => [i, i]));
        for (let i = 0; i < fullMatrix.m; i++) {
            const newIndex = getIndex(i);
            const currentIndex = indexOfColumn[i];
            indexOfColumn[i] = newIndex;
            indexOfColumn[indexOfColumn[newIndex]] = currentIndex;

            if (newIndex === i) continue;
            fullMatrix.swapColumns(currentIndex, newIndex);
        }

        this._applyMatrix(fullMatrix);
    }

    _applyMatrix (matrix) {
        this.statevector = matrix.matrixProduct(this.statevector);
        this._stateVectorToVector();
    }

    _addQubits (size) {
        const numQubits = Math.log2(this.statevector.n);
        const qubitsMask = ((2 ** size) - 1) << numQubits;
        const expectedState = (this.startingState & qubitsMask) >> numQubits;
        const newQubit = new Vector(2 ** size);
        newQubit.setElement(expectedState, new Complex(1, 0));
        this.statevector = this.statevector.tensorProduct(newQubit);
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

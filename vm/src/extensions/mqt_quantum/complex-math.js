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

export {
    Matrix,
    Vector,
    Complex
};

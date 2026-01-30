const intToBits = function (integer, n) {
    return integer
        .toString(2)
        .padStart(n, '0')
        .split('')
        .reverse()
        .map(Number);
};

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

const error = function (message) {
    console.error(message);
};

export {intToBits, QubitAccess, Register, targetAccess, error};

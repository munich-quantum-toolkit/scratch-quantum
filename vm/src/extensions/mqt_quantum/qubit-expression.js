const error = function (message) {
    console.error(message);
};

const validateRegisterName = function (name) {
    if (name.length === 0) {
        return error('Register name cannot be empty');
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return error(
            'Register name can only contain letters, numbers,' +
           'and underscores, and must start with a letter or underscore'
        );
    }
};

const validateQubitIndex = function (index) {
    index = parseInt(`${index}`, 10);
    if (isNaN(index) || index < 0) {
        return error('Qubit index must be a non-negative integer');
    }
    return index;
};

class AST {
    constructor (root) {
        this.root = root;
    }

    getPositiveNegative () {
        return this.root.getPositiveNegative();
    }

    toQubitList () {
        return this.root.toQubitList();
    }
}

class AndNode {
    constructor (left, right) {
        this.left = left;
        this.right = right;
    }

    static parse (s) {
        const index = s.indexOf(' and ');
        const left = s.substring(0, index).trim();
        const right = s.substring(index + 5).trim();
        return new AndNode(AST.parse(left), AST.parse(right));
    }

    getPositiveNegative () {
        const [posL, negL] = this.left.getPositiveNegative();
        const [posR, negR] = this.right.getPositiveNegative();
        return [
            [...posL, ...posR],
            [...negL, ...negR]
        ];
    }

    toQubitList () {
        const leftList = this.left.toQubitList();
        const rightList = this.right.toQubitList();
        return [...leftList, ...rightList];
    }
}

class NegatedNode {
    constructor (value) {
        this.value = value;
    }

    static parse (s) {
        const index = s.indexOf('not ');
        const child = s.substring(index + 4).trim();
        return new NegatedNode(AST.parse(child));
    }

    getPositiveNegative () {
        const [pos, neg] = this.value.getPositiveNegative();
        return [neg, pos];
    }

    toQubitList () {
        return this.value.toQubitList();
    }
}

class LeafNode {
    constructor (value) {
        this.value = value;
        this.validate();
    }

    static parse (s) {
        const result = new LeafNode(s);
        return result;
    }

    validate () {
        const qubit = this.value;
        if (qubit === null || typeof qubit !== 'string') {
            return error('Invalid qubit value');
        }
        const parts = qubit.split('[');
        if (parts.length !== 2) {
            return error('Invalid qubit format, expected "register[index]", got ' + qubit);
        }
        const register = parts[0].trim();
        const index = parts[1].trim().replace(']', '');
        validateRegisterName(register);
        this.register = register;
        this.index = validateQubitIndex(index);
    }

    getPositiveNegative () {
        return [[this], []];
    }

    toQubitList () {
        return [this];
    }
}

AST.parse = function (s) {
    if (s.includes(' and ')) {
        return new AST(AndNode.parse(s));
    }
    if (s.includes('not ')) {
        return new AST(NegatedNode.parse(s));
    }
    return new AST(LeafNode.parse(s));
};

module.exports = {
    AST,
    AndNode,
    NegatedNode,
    LeafNode,
    validateRegisterName,
    validateQubitIndex
};

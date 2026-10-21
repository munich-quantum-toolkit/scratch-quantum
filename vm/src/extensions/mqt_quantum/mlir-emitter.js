/**
 * Format a JS number as an MLIR f64 literal. MLIR float literals need a decimal point,
 * so `1` becomes `1.0` and `1e-7` becomes `1.0e-7`.
 * @param {number} value The number to format.
 * @return {string} The MLIR literal.
 */
const formatF64 = function (value) {
    if (!Number.isFinite(value)) {
        throw new Error(`Cannot emit the non-finite f64 constant ${value}`);
    }
    const text = String(value);
    if (text.includes('.')) {
        return text;
    }
    if (text.includes('e')) {
        return text.replace('e', '.0e');
    }
    return `${text}.0`;
};

/**
 * Builds the text of an MLIR `func.func @main` body: fresh SSA names, indentation of nested
 * regions and constants. Knows nothing about Scratch.
 */
class MLIREmitter {
    constructor () {
        this._lines = [];
        this._depth = 2;
        this._used = new Set();
        this._counter = 0;
    }

    /**
     * Reserve a fresh SSA name.
     * @param {string=} base Name hint (e.g. 'q' gives '%q', then '%q_1'); numbered ('%0', '%1') if omitted.
     * @return {string} The SSA name including the leading '%'.
     */
    fresh (base) {
        let name;
        if (base) {
            name = `%${base}`;
            for (let suffix = 1; this._used.has(name); suffix++) {
                name = `%${base}_${suffix}`;
            }
        } else {
            do {
                name = `%${this._counter++}`;
            } while (this._used.has(name));
        }
        this._used.add(name);
        return name;
    }

    line (text) {
        this._lines.push(`${'  '.repeat(this._depth)}${text}`);
    }

    comment (text) {
        this.line(`// ${text}`);
    }

    /**
     * Emit `<text> {` and indent the following lines.
     * @param {string} text The operation that owns the region.
     */
    open (text) {
        this.line(`${text} {`);
        this._depth++;
    }

    /**
     * Emit `} <text> {` (e.g. `} else {`) at the enclosing indentation.
     * @param {string} text Keyword between the two regions.
     */
    reopen (text) {
        this._depth--;
        this.line(`} ${text} {`);
        this._depth++;
    }

    /**
     * Emit `}<suffix>` and dedent.
     * @param {string=} suffix Text after the closing brace, e.g. the type list of qc.ctrl.
     */
    close (suffix = '') {
        this._depth--;
        this.line(`}${suffix}`);
    }

    constIndex (value) {
        const name = this.fresh(`c${value}`);
        this.line(`${name} = arith.constant ${value} : index`);
        return name;
    }

    constF64 (value) {
        const literal = formatF64(value);
        const name = this.fresh('cst');
        this.line(`${name} = arith.constant ${literal} : f64`);
        return name;
    }

    constBool (value) {
        const name = this.fresh(value ? 'true' : 'false');
        this.line(`${name} = arith.constant ${value}`);
        return name;
    }

    /**
     * Wrap the emitted lines into a `func.func` definition.
     * @param {string} signature Everything between `func.func` and the body, e.g. `private @circuit_1()`.
     * @param {string=} comment Optional comment line emitted above the function.
     * @return {string} The function's text, indented for a module body.
     */
    toFunction (signature, comment) {
        return [
            ...(comment ? [`  // ${comment}`] : []),
            `  func.func ${signature} {`,
            ...this._lines,
            '    return',
            '  }'
        ].join('\n');
    }
}

/**
 * Assemble function definitions into an MLIR module.
 * @param {string} header Text of the leading comment line.
 * @param {Array.<string>} functions Function texts from `MLIREmitter.toFunction`.
 * @return {string} The complete MLIR module.
 */
const buildModule = function (header, functions) {
    return [`// ${header}`, 'module {', ...functions, '}', ''].join('\n');
};

module.exports = {MLIREmitter, buildModule, formatF64};

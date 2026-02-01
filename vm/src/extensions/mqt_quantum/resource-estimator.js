import {Simulator} from './simulator';
import {Register, targetAccess} from './utils';

class ResourceEstimatorSettings {
    constructor (negativeControlTranslation, toffoliDecomposition, swapDecomposition) {
        this.negativeControlTranslation = negativeControlTranslation;
        this.toffoliDecomposition = toffoliDecomposition;
        this.swapDecomposition = swapDecomposition;
    }
}

class ResourceEstimator extends Simulator {
    constructor (settings) {
        super(0);
        this.settings = settings;
        this.qubits = [];
        this.gateUses = {};
        this.ancillas = 0;
    }

    _logSimplifiedGateUse (gate, targets) {
        if (!this.gateUses[gate]) {
            this.gateUses[gate] = [];
        }
        this.gateUses[gate].push(targets);
    }

    _logDecomposedCCX (c1, c2, target) {
        this._logSimplifiedGateUse('H', [target]);
        this._logSimplifiedGateUse('CX', [c2, target]);
        this._logSimplifiedGateUse('T†', [target]);
        this._logSimplifiedGateUse('CX', [c1, target]);
        this._logSimplifiedGateUse('T', [target]);
        this._logSimplifiedGateUse('CX', [c2, target]);
        this._logSimplifiedGateUse('T†', [target]);
        this._logSimplifiedGateUse('CX', [c1, target]);
        this._logSimplifiedGateUse('T', [target]);
        this._logSimplifiedGateUse('T†', [c2]);
        this._logSimplifiedGateUse('H', [target]);
        this._logSimplifiedGateUse('CX', [c1, c2]);
        this._logSimplifiedGateUse('T†', [c2]);
        this._logSimplifiedGateUse('CX', [c1, c2]);
        this._logSimplifiedGateUse('T', [c1]);
        this._logSimplifiedGateUse('S', [c2]);
    }

    _logPosGateUse (gate, controls, targets) {
        if (this.settings.toffoliDecomposition && controls.length > 1) {
            const requiredAncillas = controls.length - 1;
            this.ancillas = Math.max(this.ancillas, requiredAncillas);
            for (let i = 0; i < requiredAncillas; i++) {
                this._logDecomposedCCX(controls[i], controls[i + 1], -i - 1);
                this._logDecomposedCCX(controls[i], controls[i + 1], -i - 1);
            }
            this._logPosGateUse(gate, [-requiredAncillas], targets);
        } else if (this.settings.swapDecomposition && gate === 'SWAP') {
            this._logPosGateUse('X', [...controls, targets[0]], [targets[1]]);
            this._logPosGateUse('X', [...controls, targets[1]], [targets[0]]);
            this._logPosGateUse('X', [...controls, targets[0]], [targets[1]]);
        } else {
            this._logSimplifiedGateUse('C'.repeat(controls.length) + gate, [...controls, ...targets]);
        }
    }

    _logGateUse (gate, positiveControls, negativeControls, targets) {
        if (this.settings.negativeControlTranslation) {
            for (const neg of negativeControls) {
                // Each negative control line needs an 'X'-gate.
                this._logSimplifiedGateUse('X', [neg]);
            }
        }
        this._logPosGateUse(gate, [...positiveControls, ...negativeControls], targets);
    }

    createRegister (name, size) {
        this.registers.push(new Register(name, size));
        for (let i = 0; i < size; i++) {
            this.qubits.push(0);
        }
    }

    _doGate (positiveControls, negativeControls, transformation) {
        let ok = true;
        for (const pos of positiveControls) {
            if (this.qubits[pos] === null) {
                ok = false;
            }
            if (this.qubits[pos] === 0) {
                return;
            }
        }
        for (const neg of negativeControls) {
            if (this.qubits[neg] === null) {
                ok = false;
            }
            if (this.qubits[neg] === 1) {
                return;
            }
        }
        transformation(ok);
    }

    applyGate (gate, targets, positiveControls, negativeControls) {
        const accesses = targets.map(x => this._accessToIndex(targetAccess(x)));
        const positiveControlAccesses = positiveControls.map(x =>
            this._accessToIndex(targetAccess(x))
        );
        const negativeControlAccesses = negativeControls.map(x =>
            this._accessToIndex(targetAccess(x))
        );
        this._logGateUse(gate, positiveControlAccesses, negativeControlAccesses, accesses);

        if (gate in ['Z', 'S', 'T']) {
            return; // Phase gates do nothing in our approximation.
        }
        if (gate in ['X', 'Y']) {
            this._doGate(positiveControlAccesses, negativeControlAccesses,
                ok => {
                    this.qubits[accesses[0]] = ok ? !this.qubits[accesses[0]] : null;
                });
        }
        if (gate === 'H') {
            this._doGate(positiveControlAccesses, negativeControlAccesses,
                // eslint-disable-next-line no-unused-vars
                _ok => {
                    this.qubits[accesses[0]] = null;
                });
        }
        if (gate === 'SWAP') {
            this._doGate(positiveControlAccesses, negativeControlAccesses,
                // eslint-disable-next-line no-unused-vars
                ok => {
                    if (ok === false) {
                        this.qubits[accesses[0]] = null;
                        this.qubits[accesses[1]] = null;
                        return;
                    }
                    const temp = this.qubits[accesses[0]];
                    this.qubits[accesses[0]] = this.qubits[accesses[1]];
                    this.qubits[accesses[1]] = temp;
                });
        }

    }

    applyRotation (axis, _angle, targets, positiveControls, negativeControls) {
        const accesses = targets.map(x => this._accessToIndex(targetAccess(x)));
        const positiveControlAccesses = positiveControls.map(x =>
            this._accessToIndex(targetAccess(x))
        );
        const negativeControlAccesses = negativeControls.map(x =>
            this._accessToIndex(targetAccess(x))
        );
        this._logGateUse(`R${axis}`, positiveControlAccesses, negativeControlAccesses, accesses);

        if (axis === 'Z') {
            return; // This is a phase gate, which does nothing in our approximation.
        }
        // eslint-disable-next-line no-unused-vars
        this._doGate(positiveControlAccesses, negativeControlAccesses,
            // eslint-disable-next-line no-unused-vars
            _ok => {
                this.qubits[accesses[0]] = null;
            });
    }

    measure (qubit) {
        const access = this._accessToIndex(targetAccess(qubit));
        this._logGateUse('measure', [], [], [access]);

        if (this.qubits[access] === null) {
            const result = Math.random() < 0.5 ? 0 : 1;
            this.qubits[access] = result;
            return result;
        }

        return this.qubits[access];
    }

    getResults () {
        const uses = this.gateUses;
        let result = `Total Qubits: ${this._getNumQubits() + this.ancillas}\n\n`;
        const gatesByTargetCount = Object.entries(uses).reduce((acc, [gate, targets]) => {
            if (targets.length === 0) {
                return acc;
            }
            const targetCount = targets[0].length;
            if (!acc[targetCount]) {
                acc[targetCount] = [];
            }
            acc[targetCount].push(gate);
            return acc;
        }, {});
        for (const count of Object.keys(gatesByTargetCount)) {
            result += `${count} Qubit Gates:\n`;
            for (const gate of gatesByTargetCount[count]) {
                result += `${gate}: ${this.gateUses[gate].length}\n`;
            }
            result += '\n';
        }
        return result;
    }
}

export {ResourceEstimator, ResourceEstimatorSettings};

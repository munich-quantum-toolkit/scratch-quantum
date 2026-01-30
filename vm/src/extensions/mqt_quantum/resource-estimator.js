import {Simulator} from './simulator';
import {Register, targetAccess} from './utils';

class ResourceEstimatorSettings {
    constructor (negativeControlTranslation, toffoliDecomposition) {
        this.negativeControlTranslation = negativeControlTranslation;
        this.toffoliDecomposition = toffoliDecomposition;
    }
}

class ResourceEstimator extends Simulator {
    constructor (settings) {
        super(0);
        this.settings = settings;
        this.qubits = [];
        this.gateUses = {};
    }

    _logSimplifiedGateUse (gate, targets) {
        if (!this.gateUses[gate]) {
            this.gateUses[gate] = [];
        }
        this.gateUses[gate].push(targets);
    }

    _logPosGateUse (gate, controls, targets) {
        this._logSimplifiedGateUse('C'.repeat(controls.length) + gate, [...controls, ...targets]);
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
        let result = `Total Qubits: ${this._getNumQubits()}\n\n`;
        const gatesByTargetCount = Object.entries(uses).reduce((acc, [gate, targets]) => {
            const targetCount = targets.length;
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

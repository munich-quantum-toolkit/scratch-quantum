const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const {exportToMLIR} = require('../../../src/extensions/mqt_quantum/exporter');

const exportScript = (builder, hatId) => exportToMLIR(builder.container(), hatId, {
    spriteName: 'Sprite1',
    lookupVariable: id => builder.variables[id]
});

// Trimmed, non-empty lines with every SSA name replaced by '%_', so assertions don't depend on numbering.
const shape = mlir => mlir.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('// Exported'))
    .map(line => line.replace(/%[A-Za-z0-9_]+/g, '%_'));

// Assert that `expected` appears as a contiguous run of lines in the shaped output.
const expectLines = (t, mlir, expected, message = 'contains the expected lines') => {
    const lines = shape(mlir);
    const found = lines.some((_, start) => expected.every((line, i) => lines[start + i] === line));
    t.ok(found, message, {found: lines, wanted: expected});
};

// Assert that exporting throws an MLIRExportError with this message and block id.
const expectExportError = (t, builder, hatId, message, blockId) => {
    try {
        exportScript(builder, hatId);
        t.fail(`expected export to fail with: ${message}`);
    } catch (e) {
        t.equal(e.name, 'MLIRExportError', 'throws an MLIRExportError');
        t.match(e.message, message, 'with the expected message');
        t.equal(e.blockId, blockId, 'pointing at the offending block');
    }
};

// If MQT_CC points to an mqt-cc binary, assert it accepts `mlir` for every --emit checkpoint.
const validateWithMqtCc = (t, mlir, emits = ['qco-optimized', 'qir-adaptive']) => {
    const mqtCc = process.env.MQT_CC;
    if (!mqtCc) return;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mlir-export-'));
    const file = path.join(dir, 'circuit.mlir');
    fs.writeFileSync(file, mlir);
    for (const emit of emits) {
        const result = spawnSync(mqtCc, [`--emit=${emit}`, file], {encoding: 'utf8'});
        t.equal(result.status, 0, `mqt-cc --emit=${emit} accepts the export`, {stderr: result.stderr, mlir});
    }
    fs.rmSync(dir, {recursive: true, force: true});
};

module.exports = {exportScript, shape, expectLines, expectExportError, validateWithMqtCc};

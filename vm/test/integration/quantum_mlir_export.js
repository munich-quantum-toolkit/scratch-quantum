const path = require('path');
const test = require('tap').test;
const makeTestStorage = require('../fixtures/make-test-storage');
const readFileToBuffer = require('../fixtures/readProjectFile').readFileToBuffer;
const VirtualMachine = require('../../src/index');
const {exportToMLIR} = require('../../src/extensions/mqt_quantum/exporter');
const {validateWithMqtCc} = require('../fixtures/quantum/mlir-helpers');

const PROJECTS = ['02-circuits', '03-verification', '04-resource-estimation', '05-compilation'];

for (const project of PROJECTS) {
    test(`exports every circuit of the ${project} exercise`, async t => {
        if (!process.env.MQT_CC) {
            t.comment('MQT_CC is not set: skipping validation with mqt-cc');
        }
        const vm = new VirtualMachine();
        vm.attachStorage(makeTestStorage());
        await vm.loadProject(readFileToBuffer(path.resolve(__dirname, `../fixtures/quantum/${project}.sb3`)));
        let circuits = 0;
        for (const target of vm.runtime.targets) {
            for (const hatId of target.blocks.getScripts()) {
                if (target.blocks.getBlock(hatId).opcode !== 'quantum_quantumEvaluate') continue;
                const mlir = exportToMLIR(target.blocks, hatId, {
                    spriteName: target.getName(),
                    lookupVariable: id => target.lookupVariableById(id)
                });
                circuits++;
                t.matchSnapshot(mlir, `${target.getName()} circuit ${circuits}`);
                validateWithMqtCc(t, mlir);
            }
        }
        t.ok(circuits > 0, 'the project contains circuits');
        vm.quit();
    });
}

const path = require('path');
const test = require('tap').test;
const makeTestStorage = require('../fixtures/make-test-storage');
const readFileToBuffer = require('../fixtures/readProjectFile').readFileToBuffer;
const VirtualMachine = require('../../src/index');
const QuantumExtension = require('../../src/extensions/mqt_quantum/index.js');
const {validateWithMQTCC} = require('../fixtures/quantum/mlir-helpers');

const PROJECTS = ['02-circuits', '03-verification', '04-resource-estimation', '05-compilation'];

for (const project of PROJECTS) {
    test(`exports all circuits of the ${project} exercise`, async t => {
        if (!process.env.MQT_CC) {
            t.comment('MQT_CC is not set: skipping validation with mqt-cc');
        }
        const vm = new VirtualMachine();
        vm.attachStorage(makeTestStorage());
        await vm.loadProject(readFileToBuffer(path.resolve(__dirname, `../fixtures/quantum/${project}.sb3`)));
        const extension = new QuantumExtension(vm.runtime);
        const downloads = [];
        const notes = [];
        extension._download = (name, text) => downloads.push(text);
        extension._notify = message => notes.push(message);
        extension.toMLIR({}, {thread: {peekStack: () => null}});
        t.same(notes, ['Exported circuits to quantum_circuits.mlir']);
        t.equal(downloads.length, 1);
        t.matchSnapshot(downloads[0], 'quantum_circuits.mlir');
        validateWithMQTCC(t, downloads[0]);
        vm.quit();
    });
}

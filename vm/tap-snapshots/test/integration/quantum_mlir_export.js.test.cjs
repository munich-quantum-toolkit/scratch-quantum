/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports[`test/integration/quantum_mlir_export.js TAP exports all circuits of the 02-circuits exercise > quantum_circuits.mlir 1`] = `
// Exported from Scratch by the MQT quantum extension
module {
  // 'Quantum Circuit' script of sprite "Sprite1"
  func.func @main() attributes {mqt.entry_point} {
    %q = memref.alloc() {mqt.register_name = "q"} : memref<1x!qc.qubit>
    // skipped: looks_sayforsecs
    %c0 = arith.constant 0 : index
    %0 = memref.load %q[%c0] : memref<1x!qc.qubit>
    %1 = qc.measure %0 : !qc.qubit -> i1
    memref.dealloc %q : memref<1x!qc.qubit>
    return
  }
}

`

exports[`test/integration/quantum_mlir_export.js TAP exports all circuits of the 03-verification exercise > quantum_circuits.mlir 1`] = `
// Exported from Scratch by the MQT quantum extension
module {
  // 'Quantum Circuit' script of sprite "Sprite1"
  func.func private @circuit_1(%q: memref<2x!qc.qubit>) {
    %c0 = arith.constant 0 : index
    %0 = memref.load %q[%c0] : memref<2x!qc.qubit>
    qc.h %0 : !qc.qubit
    %c0_1 = arith.constant 0 : index
    %1 = memref.load %q[%c0_1] : memref<2x!qc.qubit>
    %c1 = arith.constant 1 : index
    %2 = memref.load %q[%c1] : memref<2x!qc.qubit>
    qc.ctrl(%1) targets (%t = %2) {
      qc.x %t : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c0_2 = arith.constant 0 : index
    %3 = memref.load %q[%c0_2] : memref<2x!qc.qubit>
    %4 = qc.measure %3 : !qc.qubit -> i1
    return
  }
  // 'Quantum Circuit' script of sprite "Sprite1"
  func.func private @circuit_2(%q: memref<2x!qc.qubit>) {
    %c0 = arith.constant 0 : index
    %0 = memref.load %q[%c0] : memref<2x!qc.qubit>
    qc.h %0 : !qc.qubit
    %c1 = arith.constant 1 : index
    %1 = memref.load %q[%c1] : memref<2x!qc.qubit>
    qc.h %1 : !qc.qubit
    %c0_1 = arith.constant 0 : index
    %2 = memref.load %q[%c0_1] : memref<2x!qc.qubit>
    %c1_1 = arith.constant 1 : index
    %3 = memref.load %q[%c1_1] : memref<2x!qc.qubit>
    qc.ctrl(%2) targets (%t = %3) {
      qc.z %t : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c1_2 = arith.constant 1 : index
    %4 = memref.load %q[%c1_2] : memref<2x!qc.qubit>
    qc.h %4 : !qc.qubit
    %c0_2 = arith.constant 0 : index
    %5 = memref.load %q[%c0_2] : memref<2x!qc.qubit>
    %6 = qc.measure %5 : !qc.qubit -> i1
    return
  }
  func.func @main() attributes {mqt.entry_point} {
    %circuit_1_q = memref.alloc() {mqt.register_name = "circuit_1_q"} : memref<2x!qc.qubit>
    func.call @circuit_1(%circuit_1_q) : (memref<2x!qc.qubit>) -> ()
    memref.dealloc %circuit_1_q : memref<2x!qc.qubit>
    %circuit_2_q = memref.alloc() {mqt.register_name = "circuit_2_q"} : memref<2x!qc.qubit>
    func.call @circuit_2(%circuit_2_q) : (memref<2x!qc.qubit>) -> ()
    memref.dealloc %circuit_2_q : memref<2x!qc.qubit>
    return
  }
}

`

exports[`test/integration/quantum_mlir_export.js TAP exports all circuits of the 04-resource-estimation exercise > quantum_circuits.mlir 1`] = `
// Exported from Scratch by the MQT quantum extension
module {
  // 'Quantum Circuit' script of sprite "Sprite1"
  func.func @main() attributes {mqt.entry_point} {
    %q = memref.alloc() {mqt.register_name = "q"} : memref<15x!qc.qubit>
    %c0 = arith.constant 0 : index
    %0 = memref.load %q[%c0] : memref<15x!qc.qubit>
    qc.h %0 : !qc.qubit
    %c1 = arith.constant 1 : index
    %1 = memref.load %q[%c1] : memref<15x!qc.qubit>
    qc.h %1 : !qc.qubit
    %c2 = arith.constant 2 : index
    %2 = memref.load %q[%c2] : memref<15x!qc.qubit>
    qc.h %2 : !qc.qubit
    %c3 = arith.constant 3 : index
    %3 = memref.load %q[%c3] : memref<15x!qc.qubit>
    qc.h %3 : !qc.qubit
    %c4 = arith.constant 4 : index
    %4 = memref.load %q[%c4] : memref<15x!qc.qubit>
    qc.h %4 : !qc.qubit
    %c5 = arith.constant 5 : index
    %5 = memref.load %q[%c5] : memref<15x!qc.qubit>
    qc.h %5 : !qc.qubit
    %c6 = arith.constant 6 : index
    %6 = memref.load %q[%c6] : memref<15x!qc.qubit>
    qc.h %6 : !qc.qubit
    %c0_1 = arith.constant 0 : index
    %7 = memref.load %q[%c0_1] : memref<15x!qc.qubit>
    qc.h %7 : !qc.qubit
    %c8 = arith.constant 8 : index
    %8 = memref.load %q[%c8] : memref<15x!qc.qubit>
    qc.h %8 : !qc.qubit
    %c9 = arith.constant 9 : index
    %9 = memref.load %q[%c9] : memref<15x!qc.qubit>
    qc.h %9 : !qc.qubit
    %c10 = arith.constant 10 : index
    %10 = memref.load %q[%c10] : memref<15x!qc.qubit>
    qc.h %10 : !qc.qubit
    %c11 = arith.constant 11 : index
    %11 = memref.load %q[%c11] : memref<15x!qc.qubit>
    qc.h %11 : !qc.qubit
    %c12 = arith.constant 12 : index
    %12 = memref.load %q[%c12] : memref<15x!qc.qubit>
    qc.h %12 : !qc.qubit
    %c13 = arith.constant 13 : index
    %13 = memref.load %q[%c13] : memref<15x!qc.qubit>
    qc.h %13 : !qc.qubit
    %c0_2 = arith.constant 0 : index
    %14 = memref.load %q[%c0_2] : memref<15x!qc.qubit>
    %c1_1 = arith.constant 1 : index
    %15 = memref.load %q[%c1_1] : memref<15x!qc.qubit>
    %c2_1 = arith.constant 2 : index
    %16 = memref.load %q[%c2_1] : memref<15x!qc.qubit>
    %c3_1 = arith.constant 3 : index
    %17 = memref.load %q[%c3_1] : memref<15x!qc.qubit>
    %c14 = arith.constant 14 : index
    %18 = memref.load %q[%c14] : memref<15x!qc.qubit>
    qc.ctrl(%14, %15, %16, %17) targets (%t = %18) {
      qc.x %t : !qc.qubit
      qc.yield
    } : {!qc.qubit, !qc.qubit, !qc.qubit, !qc.qubit}, {!qc.qubit}
    memref.dealloc %q : memref<15x!qc.qubit>
    return
  }
}

`

exports[`test/integration/quantum_mlir_export.js TAP exports all circuits of the 05-compilation exercise > quantum_circuits.mlir 1`] = `
// Exported from Scratch by the MQT quantum extension
module {
  // 'Quantum Circuit' script of sprite "Sprite1"
  func.func private @circuit_1(%q: memref<5x!qc.qubit>) {
    %c0 = arith.constant 0 : index
    %0 = memref.load %q[%c0] : memref<5x!qc.qubit>
    qc.h %0 : !qc.qubit
    %c0_1 = arith.constant 0 : index
    %1 = memref.load %q[%c0_1] : memref<5x!qc.qubit>
    %c1 = arith.constant 1 : index
    %2 = memref.load %q[%c1] : memref<5x!qc.qubit>
    qc.ctrl(%1) targets (%t = %2) {
      qc.x %t : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c1_1 = arith.constant 1 : index
    %3 = memref.load %q[%c1_1] : memref<5x!qc.qubit>
    %c2 = arith.constant 2 : index
    %4 = memref.load %q[%c2] : memref<5x!qc.qubit>
    qc.swap %3, %4 : !qc.qubit, !qc.qubit
    %c0_2 = arith.constant 0 : index
    %5 = memref.load %q[%c0_2] : memref<5x!qc.qubit>
    %c1_2 = arith.constant 1 : index
    %6 = memref.load %q[%c1_2] : memref<5x!qc.qubit>
    qc.ctrl(%5) targets (%t_1 = %6) {
      qc.x %t_1 : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c1_3 = arith.constant 1 : index
    %7 = memref.load %q[%c1_3] : memref<5x!qc.qubit>
    %c3 = arith.constant 3 : index
    %8 = memref.load %q[%c3] : memref<5x!qc.qubit>
    qc.swap %7, %8 : !qc.qubit, !qc.qubit
    %c0_3 = arith.constant 0 : index
    %9 = memref.load %q[%c0_3] : memref<5x!qc.qubit>
    %c1_4 = arith.constant 1 : index
    %10 = memref.load %q[%c1_4] : memref<5x!qc.qubit>
    qc.ctrl(%9) targets (%t_2 = %10) {
      qc.x %t_2 : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c1_5 = arith.constant 1 : index
    %11 = memref.load %q[%c1_5] : memref<5x!qc.qubit>
    %c4 = arith.constant 4 : index
    %12 = memref.load %q[%c4] : memref<5x!qc.qubit>
    qc.swap %11, %12 : !qc.qubit, !qc.qubit
    %c0_4 = arith.constant 0 : index
    %13 = memref.load %q[%c0_4] : memref<5x!qc.qubit>
    %c1_6 = arith.constant 1 : index
    %14 = memref.load %q[%c1_6] : memref<5x!qc.qubit>
    qc.ctrl(%13) targets (%t_3 = %14) {
      qc.x %t_3 : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c1_7 = arith.constant 1 : index
    %15 = memref.load %q[%c1_7] : memref<5x!qc.qubit>
    %c2_1 = arith.constant 2 : index
    %16 = memref.load %q[%c2_1] : memref<5x!qc.qubit>
    qc.swap %15, %16 : !qc.qubit, !qc.qubit
    %c2_2 = arith.constant 2 : index
    %17 = memref.load %q[%c2_2] : memref<5x!qc.qubit>
    %c3_1 = arith.constant 3 : index
    %18 = memref.load %q[%c3_1] : memref<5x!qc.qubit>
    qc.swap %17, %18 : !qc.qubit, !qc.qubit
    %c3_2 = arith.constant 3 : index
    %19 = memref.load %q[%c3_2] : memref<5x!qc.qubit>
    %c4_1 = arith.constant 4 : index
    %20 = memref.load %q[%c4_1] : memref<5x!qc.qubit>
    qc.swap %19, %20 : !qc.qubit, !qc.qubit
    return
  }
  // 'Quantum Circuit' script of sprite "Sprite1"
  func.func private @circuit_2(%q: memref<5x!qc.qubit>) {
    %c0 = arith.constant 0 : index
    %0 = memref.load %q[%c0] : memref<5x!qc.qubit>
    qc.h %0 : !qc.qubit
    %c0_1 = arith.constant 0 : index
    %1 = memref.load %q[%c0_1] : memref<5x!qc.qubit>
    %c1 = arith.constant 1 : index
    %2 = memref.load %q[%c1] : memref<5x!qc.qubit>
    qc.ctrl(%1) targets (%t = %2) {
      qc.x %t : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c1_1 = arith.constant 1 : index
    %3 = memref.load %q[%c1_1] : memref<5x!qc.qubit>
    %c2 = arith.constant 2 : index
    %4 = memref.load %q[%c2] : memref<5x!qc.qubit>
    qc.swap %3, %4 : !qc.qubit, !qc.qubit
    %c0_2 = arith.constant 0 : index
    %5 = memref.load %q[%c0_2] : memref<5x!qc.qubit>
    %c1_2 = arith.constant 1 : index
    %6 = memref.load %q[%c1_2] : memref<5x!qc.qubit>
    qc.ctrl(%5) targets (%t_1 = %6) {
      qc.x %t_1 : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c1_3 = arith.constant 1 : index
    %7 = memref.load %q[%c1_3] : memref<5x!qc.qubit>
    %c3 = arith.constant 3 : index
    %8 = memref.load %q[%c3] : memref<5x!qc.qubit>
    qc.swap %7, %8 : !qc.qubit, !qc.qubit
    %c0_3 = arith.constant 0 : index
    %9 = memref.load %q[%c0_3] : memref<5x!qc.qubit>
    %c1_4 = arith.constant 1 : index
    %10 = memref.load %q[%c1_4] : memref<5x!qc.qubit>
    qc.ctrl(%9) targets (%t_2 = %10) {
      qc.x %t_2 : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c1_5 = arith.constant 1 : index
    %11 = memref.load %q[%c1_5] : memref<5x!qc.qubit>
    %c4 = arith.constant 4 : index
    %12 = memref.load %q[%c4] : memref<5x!qc.qubit>
    qc.swap %11, %12 : !qc.qubit, !qc.qubit
    %c0_4 = arith.constant 0 : index
    %13 = memref.load %q[%c0_4] : memref<5x!qc.qubit>
    %c1_6 = arith.constant 1 : index
    %14 = memref.load %q[%c1_6] : memref<5x!qc.qubit>
    qc.ctrl(%13) targets (%t_3 = %14) {
      qc.x %t_3 : !qc.qubit
      qc.yield
    } : {!qc.qubit}, {!qc.qubit}
    %c1_7 = arith.constant 1 : index
    %15 = memref.load %q[%c1_7] : memref<5x!qc.qubit>
    %c2_1 = arith.constant 2 : index
    %16 = memref.load %q[%c2_1] : memref<5x!qc.qubit>
    qc.swap %15, %16 : !qc.qubit, !qc.qubit
    %c2_2 = arith.constant 2 : index
    %17 = memref.load %q[%c2_2] : memref<5x!qc.qubit>
    %c3_1 = arith.constant 3 : index
    %18 = memref.load %q[%c3_1] : memref<5x!qc.qubit>
    qc.swap %17, %18 : !qc.qubit, !qc.qubit
    %c3_2 = arith.constant 3 : index
    %19 = memref.load %q[%c3_2] : memref<5x!qc.qubit>
    %c4_1 = arith.constant 4 : index
    %20 = memref.load %q[%c4_1] : memref<5x!qc.qubit>
    qc.swap %19, %20 : !qc.qubit, !qc.qubit
    return
  }
  func.func @main() attributes {mqt.entry_point} {
    %circuit_1_q = memref.alloc() {mqt.register_name = "circuit_1_q"} : memref<5x!qc.qubit>
    func.call @circuit_1(%circuit_1_q) : (memref<5x!qc.qubit>) -> ()
    memref.dealloc %circuit_1_q : memref<5x!qc.qubit>
    %circuit_2_q = memref.alloc() {mqt.register_name = "circuit_2_q"} : memref<5x!qc.qubit>
    func.call @circuit_2(%circuit_2_q) : (memref<5x!qc.qubit>) -> ()
    memref.dealloc %circuit_2_q : memref<5x!qc.qubit>
    return
  }
}

`

# Block reference

This page describes every block of the "Quantum" extension.
The blocks are grouped as in the block palette, from top to bottom.
The palette uses several shades of blue for the groups; these pages draw all quantum blocks in the main colour.

Several blocks take a qubit as input.
You fill such an input with the `qubit of register` reporter or with typed text such as `q[0]`; see {doc}`qubit-expressions` for the details.
Many blocks report problems by writing a message to the browser console (open it with F12) instead of showing them in the editor.
Where this page says "nothing happens", the block does not change the circuit and the script continues with the next block.

## Registers and qubits

A register is a named group of qubits.
You create a register first and then refer to its qubits.

### Create quantum register

```{scratchblocks}
create quantum register [q] with (2) qubits :: extension
```

Register name
: Text, default `q`.
  The name of the new register.

Number of qubits
: Number, default `2`.
  How many qubits the register has.

Behaviour
: Adds a register with the given number of qubits to the circuit that runs this block.
  All qubits start in the state $|0\rangle$, unless you start the circuits with [Run Quantum Circuits starting from a state](#run-quantum-circuits-starting-from-a-state).
  Every `Quantum Circuit` script has its own registers; put this block before all blocks that use the register.

Notes
: - A register name consists of letters, digits, and underscores and does not start with a digit.
    For any other name, including the empty name, the console shows an error message; use valid names only.
  - Use each register name only once per circuit.
  - The number of qubits must be a whole number greater than 0.
    For `0`, the console shows "Number of qubits must be greater than 0" and nothing happens.
    For a negative number or text, the console shows "Qubit index must be a non-negative integer" and the block fails with an error.
  - The simulator handles circuits with up to 10 qubits in total.
    If a register does not fit, the console shows "Statevector too large to simulate" and the register is created with fewer qubits than you asked for.

### Qubit of register

```{scratchblocks}
(qubit (0) of register [q] :: extension)
```

Qubit
: Number, default `0`.
  The index of the qubit; the first qubit has index 0.

Register name
: Text, default `q`.
  The name of the register.

Reports
: Text of the form `register[index]`, for example `q[0]`.

Notes
: - The block only builds the text.
    It does not check whether the register exists or how many qubits it has.
  - Decimal numbers are cut to a whole number: `1.7` gives `q[1]`.
  - An index beyond the end of a register is not detected.
    It addresses the qubits of the register created after it: with `a` and `b` of two qubits each, `a[3]` is `b[1]`.
    Only an index beyond the last qubit of the circuit, or a register name that does not exist, addresses no qubit, and blocks ignore it.
    Stay within 0 to the size of the register minus 1.

### Qubits of register

```{scratchblocks}
(qubits of register [q] :: extension)
```

Register name
: Text, default `q`.
  The name of the register.

Reports
: All qubits of the register, joined with `and`, from qubit 0 to the last qubit.
  For a register `q` with three qubits, the block reports `q[0] and q[1] and q[2]`.

Notes
: - The block reads the size of the register from the running circuit, so it must come after `create quantum register`.
  - For a register that does not exist, the block reports an empty text.
  - Use it wherever a qubit is expected to address all qubits at once: a gate is applied to each qubit, `controlled on` uses all qubits as controls, and `measure` reports one character per qubit.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [H v] gate to (qubits of register [q] :: extension) :: extension
say <measure (qubits of register [q] :: extension) :: extension>
```

## Gates

### Apply gate

```{scratchblocks}
apply [X v] gate to [/] :: extension
```

Gate
: Menu, default `X`.
  One of `X`, `Y`, `Z`, `H`, `S`, `T`.
  The menu also accepts a reporter that provides the gate name.

Qubit
: Qubit expression, default `/`.
  The qubit or qubits to apply the gate to.

Behaviour
: Applies the gate to the qubit.
  If the input holds several qubits, the gate is applied to each of them, one after the other.
  Inside `controlled on` blocks, the gate is applied only if the controls are met.
  {doc}`quantum-basics` describes the gates.

Notes
: - The default `/` means "no qubit".
    With it, the console shows "Invalid qubit value" and nothing happens.
  - If the input is not a qubit expression, such as `hello`, the console shows a message and nothing happens.
  - A qubit beyond the last qubit of the circuit is ignored; for an index beyond the end of a register, see [Qubit of register](#qubit-of-register).
  - `negated control` has no effect in the target input: the gate is applied to the qubit as if it were not negated.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
apply [S v] gate to (qubits of register [q] :: extension) :: extension
```

### Apply SWAP gate

```{scratchblocks}
apply SWAP gate to [/] and [/] :: extension
```

First qubit
: Qubit expression, default `/`.

Second qubit
: Qubit expression, default `/`.

Behaviour
: Exchanges the states of the two qubits.
  Inside `controlled on` blocks, the qubits are exchanged only if the controls are met.

Notes
: - Each input must hold exactly one qubit.
    If one input is `/`, holds several qubits joined with `and`, or is not a qubit expression, the console shows a message and nothing happens.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
apply [X v] gate to (qubit (0) of register [q] :: extension) :: extension
apply SWAP gate to (qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension
```

After this circuit, qubit 1 is 1 and qubit 0 is 0.

## Controls

Controls make gates conditional on other qubits.
A control is met when its qubit is 1, or when it is 0 for a negated control.
The three blocks of this group work together.

### Controlled on

```{scratchblocks}
controlled on [/] {
} :: extension
```

Qubit
: Qubit expression, default `/`.
  The control qubit or qubits.

Behaviour
: Runs the blocks inside with the given qubits as controls.
  Every gate, rotation, U3 gate, and SWAP gate inside is applied only if all controls are met.
  If you nest `controlled on` blocks, the controls of all enclosing blocks apply.
  For several controls in one block, combine them with `and`.

Notes
: - With the default `/`, the console shows "Invalid qubit value" and the blocks inside are skipped.
  - The `measure` block does not take controls into account.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [X v] gate to (qubit (0) of register [q] :: extension) :: extension
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
controlled on (qubit (0) of register [q] :: extension) {
controlled on (qubit (1) of register [q] :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
} :: extension
```

Both controls are 1, so the `X` gate flips qubit 2.

### And

```{scratchblocks}
([/] and [/] :: extension)
```

First qubit
: Qubit expression, default `/`.

Second qubit
: Qubit expression, default `/`.

Reports
: Both qubit expressions joined with `and`, for example `q[0] and q[1]`.

Notes
: - If one input is `/`, the block reports the other input.
    If both are `/`, it reports `/`.
  - Gates treat `and` as a list of targets; `controlled on` treats it as several controls.
    See {doc}`qubit-expressions`.

### Negated control

```{scratchblocks}
(negated control [/] :: extension)
```

Qubit
: Qubit expression, default `/`.
  The qubit that must be 0.

Reports
: The qubit with `not` in front, for example `not q[0]`.
  For `/`, it reports `/`.

Notes
: - Use it only for one qubit at a time.
    For a negated control on several qubits, negate each qubit and combine them with `and`.
  - For an input with `and`, the console shows "Invalid negated expression" and the block reports nothing.
  - Negating an already negated qubit also reports nothing, so do not nest `negated control` blocks.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
controlled on (negated control (qubit (0) of register [q] :: extension) :: extension) {
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
} :: extension
```

Qubit 0 is 0, so the `X` gate flips qubit 1.

## Rotations

### Rotate around axis

```{scratchblocks}
rotate [/] by (180) degrees around [X v] axis :: extension
```

Qubit
: Qubit expression, default `/`.

Angle
: Number, default `180`.
  The angle in degrees, not radians.

Axis
: Menu, default `X`.
  One of `X`, `Y`, `Z`.
  The menu also accepts a reporter that provides the axis name.

Behaviour
: Rotates each qubit of the input by the angle around the chosen axis.
  Inside `controlled on` blocks, the rotation is applied only if the controls are met.

Notes
: - The default qubit `/` means "no qubit": the console shows "Invalid qubit value" and nothing happens.
  - Negative angles and angles above 360 degrees are allowed.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (1) qubits :: extension
rotate (qubit (0) of register [q] :: extension) by (90) degrees around [Y v] axis :: extension
```

### Apply U3 gate

```{scratchblocks}
apply U3 gate to [/] with angles (0) (0) (0) :: extension
```

Qubit
: Qubit expression, default `/`.

Angles
: Three numbers, all default `0`, in degrees: $\theta$ (theta), $\varphi$ (phi), and $\lambda$ (lambda), in this order.

Behaviour
: For each qubit of the input, rotates by $\lambda$ around Z, then by $\theta$ around Y, and finally by $\varphi$ around Z.
  Inside `controlled on` blocks, the rotations are applied only if the controls are met.

Notes
: - With `/` as qubit, the console shows "Invalid qubit value" and nothing happens.
  - With all three angles 0, the gate does nothing.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (1) qubits :: extension
apply U3 gate to (qubit (0) of register [q] :: extension) with angles (90) (0) (180) :: extension
```

## Measurement

### Measure

```{scratchblocks}
<measure [/] :: extension>
```

Qubit
: Qubit expression, default `/`.
  The qubit or qubits to measure.

Behaviour
: Measures the qubits one after the other, in the order in which they are listed.
  The outcome of each measurement is random, with the probabilities given by the state of the qubit.
  After a measurement, the qubit stays in the measured state, so measuring it again gives the same result.

Reports
: A text with one character per measured qubit, `0` or `1`, in the order of the input.
  For `qubits of register`, qubit 0 comes first.
  For a single qubit, the text is `0` or `1`.

Notes
: - The block has the shape of a condition.
    In a condition, a single-qubit result counts as false for `0` and true for `1`, because Scratch treats the text `0` as false.
    For several qubits, use the text result instead.
  - With the default `/`, the console shows "Invalid qubit value" and the block reports nothing.
  - A qubit beyond the last qubit of the circuit adds the text `undefined` to the result.
  - Enclosing `controlled on` blocks do not affect the measurement.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
say <measure (qubits of register [q] :: extension) :: extension>
```

The sprite says `01`: qubit 0 is 0 and qubit 1 is 1.

## Circuit execution

The following blocks run circuits.
{doc}`quickstart` shows them in use, and {doc}`simulation` describes how circuits run and what the simulator can do.

### Quantum Circuit

```{scratchblocks}
Quantum Circuit :: hat extension
```

Behaviour
: This hat block marks the start of a circuit.
  The blocks below it are the circuit.
  Click the script to run just this circuit, or use `Run Quantum Circuits` to run all circuits of the project.
  Every run of a circuit starts with new, empty registers.

Notes
: - The green flag does not start `Quantum Circuit` scripts.
  - The script can contain regular Scratch blocks, for example to store a measurement in a variable or to let a sprite say it.

### Run Quantum Circuits

```{scratchblocks}
Run Quantum Circuits :: extension
```

Behaviour
: Starts all `Quantum Circuit` scripts of the project at the same time and waits until all of them have finished.
  The blocks below `Run Quantum Circuits` run afterwards.
  Every circuit starts with all qubits in the state $|0\rangle$.

Notes
: - Typically, you put this block below a `when green flag clicked` hat, as in the {doc}`quickstart`.

### Run Quantum Circuits starting from a state

```{scratchblocks}
Run Quantum Circuits starting from (0) :: extension
```

State
: Number, default `0`.
  The starting state of the qubits as a whole number.

Behaviour
: Works like `Run Quantum Circuits`, but the qubits start in the basis state given by the number instead of $|0\rangle$.
  The intended meaning is that the binary digits of the number give the initial state, with the lowest digit on the first qubit.

Notes
: - The state `0` gives the same result as `Run Quantum Circuits`.
  - The block currently has known issues and does not always give this result.
    To start in a particular state, use `Run Quantum Circuits` and apply `X` gates at the start of the circuit instead; see {doc}`simulation`.

### Set Simulator

```{scratchblocks}
Set Simulator to [Statevector Simulator v] :: extension
```

Simulator
: Menu, default `Statevector Simulator`.

Behaviour
: The menu has only one entry, the statevector simulator, which the extension always uses.
  Choosing it has no effect.

## Resource estimation

These blocks count the qubits and gates a circuit needs, instead of simulating it.
{doc}`resource-estimation` describes them in detail.

### Perform Quantum Resource Estimation

```{scratchblocks}
Perform Quantum Resource Estimation :: extension
```

Behaviour
: Starts all `Quantum Circuit` scripts like `Run Quantum Circuits`, but only counts qubits and gates instead of simulating them.
  The block waits until all circuits have finished and stores the counts for the reporters below.
  A new estimation replaces the previous one.

Notes
: - The three settings blocks below apply to the script that contains them.
    Put them above `Perform Quantum Resource Estimation` in the same script.
    Without them, all three settings are off.

### Estimated Quantum Resources

```{scratchblocks}
(Estimated Quantum Resources :: extension)
```

Reports
: A text with the resources of all circuits.
  For every circuit, it lists the total number of qubits and, for each number of qubits a gate acts on, the gates with their counts.
  The texts of several circuits are separated by a blank line.
  Before the first estimation, it reports "No Resource Estimate computed yet".

### Estimated Quantum Resources of Circuit

```{scratchblocks}
(Estimated Quantum Resources of Circuit #(1) :: extension)
```

Circuit
: Number, default `1`.
  The number of the circuit, starting at 1.

Reports
: The same text as `Estimated Quantum Resources`, but for one circuit.

Notes
: - For a number below 1, it reports "Please Select a Valid Circuit Index (Starting from 1)".
    For a number beyond the last circuit, it reports an empty text.

### Estimated Qubit Requirements of Circuit

```{scratchblocks}
(Estimated Qubit Requirements of Circuit #(1) :: extension)
```

Circuit
: Number, default `1`.

Reports
: The number of qubits of the circuit, including extra qubits (ancillas) that the Toffoli decomposition needs.

### Estimated Qubit Gates in Circuit

```{scratchblocks}
(Estimated (2) Qubit Gates in Circuit #(1) :: extension)
```

Number of qubits
: Number, default `2`.
  How many qubits the counted gates act on, controls included.

Circuit
: Number, default `1`.

Reports
: The number of gates that act on that many qubits.
  If there are none, it reports 0.
  Measurements count as one-qubit operations.

Notes
: - For a number of qubits below 1, it reports "Please Select a Valid Qubit Count".

### Estimated SWAP Gates in Circuit

```{scratchblocks}
(Estimated SWAP Gates in Circuit #(1) :: extension)
```

Circuit
: Number, default `1`.

Reports
: The number of `SWAP` gates in the circuit, or 0 if there are none.

Notes
: - With SWAP decomposition enabled, `SWAP` gates are replaced by other gates, so the number is 0.
  A `SWAP` gate with controls is counted as `CSWAP` and is not included.

### Enable or disable SWAP decomposition

```{scratchblocks}
[Enable v] SWAP decomposition :: extension
```

Setting
: Menu, default `Enable`.
  `Enable` or `Disable`.

Behaviour
: Sets whether the next estimation in this script replaces `SWAP` gates by three `X` gates.
  A `SWAP` gate without controls becomes three CNOT gates; controls of the `SWAP` gate are kept.

### Enable or disable negative control substitution

```{scratchblocks}
[Enable v] substitute negative control lines :: extension
```

Setting
: Menu, default `Enable`.
  `Enable` or `Disable`.

Behaviour
: Sets whether the next estimation in this script counts an extra `X` gate for every negated control.

### Enable or disable Toffoli decomposition

```{scratchblocks}
[Enable v] Toffoli decomposition :: extension
```

Setting
: Menu, default `Enable`.
  `Enable` or `Disable`.

Behaviour
: Sets whether the next estimation in this script breaks down gates with several controls into simpler gates.
  This needs extra (ancilla) qubits, which the estimation adds to the qubit count.

## Compatibility

### Export Circuits to MLIR

```{scratchblocks}
Export Circuits to MLIR :: extension
```

Behaviour
: Exports every `Quantum Circuit` script of the project, from all sprites, into one file named `quantum_circuits.mlir`.
  The browser downloads the file and shows a message.
  A separate page on the MLIR export will describe the file and the supported blocks.

Notes
: - If a circuit cannot be exported, no file is downloaded and a message with the reason is shown instead.
  - If the project has no `Quantum Circuit` script, there is nothing to export and a message says so.

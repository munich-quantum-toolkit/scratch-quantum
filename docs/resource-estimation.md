# Resource estimation

Resource estimation tells you how many qubits and how many gates a circuit needs, without simulating it.
You can use it to compare circuits, to see how much a circuit grows when it is broken down into simpler gates, and to look at circuits that are too large for the {doc}`simulator <simulation>`.

This page explains what the estimator counts, how you read the results, and how the three switches change the counts.
The {doc}`block reference <blocks>` lists all estimation blocks.

## Estimate a circuit

The `Perform Quantum Resource Estimation` block starts all `Quantum Circuit` scripts of the project, just like `Run Quantum Circuits`.
Instead of simulating the circuits, it only counts their qubits and gates.
The block waits until all circuits have finished.
Then the reporter blocks give you the counts.

Take this circuit with a controlled X gate and a Toffoli gate, which is an X gate with two controls:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
controlled on (qubit (0) of register [q] :: extension) {
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
} :: extension
controlled on ((qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
say <measure (qubits of register [q] :: extension) :: extension>
```

To estimate it, add a second script:

```{scratchblocks}
when green flag clicked
Perform Quantum Resource Estimation :: extension
say (Estimated Quantum Resources :: extension)
```

Click the green flag.
The sprite says the following text:

```text
Total Qubits: 3

1 Qubit Gates:
H: 1
measure: 3

2 Qubit Gates:
CX: 1

3 Qubit Gates:
CCX: 1

```

The estimator does not run the circuit; it only counts the blocks.
You get the same counts every time you run the estimation.
Only a script that branches on measurement results can change them, as described in [Measurements during estimation](#measurements-during-estimation).

## What is counted

Qubits
: The total number of qubits of all registers of the circuit, plus the extra qubits (ancillas) that the Toffoli decomposition adds.
  The simulator's limit of 10 qubits does not apply to the estimator.

Gates
: Every gate block that runs adds one gate, and a block that applies a gate to several qubits adds one gate per qubit.
  The gate is counted whether or not its controls are met.
  - The gate names are `H`, `X`, `Y`, `Z`, `S`, `T`, and `SWAP`, and `RX`, `RY`, `RZ` for rotations.
    A `U3` gate is counted as its three rotations: two `RZ` gates and one `RY` gate.
  - Each control adds a `C` in front of the name, so an `X` gate with one control is `CX` and one with two controls is `CCX`.
    A negated control counts like any other control, and the name does not show which controls are negated.
  - A controlled `SWAP` gate is called `CSWAP`, so it is not counted as a `SWAP` gate; see [SWAP decomposition](#swap-decomposition).

Measurements
: Every `measure` block that runs adds a gate called `measure` for every measured qubit.
  A measurement counts as a gate that acts on one qubit, and it ignores controls.

The estimator groups gates by the number of qubits they act on, including their controls.
`H` and `measure` act on one qubit, `CX` and `SWAP` on two, `CCX` and `CSWAP` on three.
The estimator counts how often blocks run, so a gate inside a `repeat` block is counted once for each repetition.
The estimator does not optimise the circuit: two `H` gates in a row on the same qubit count as two gates.

## Reading the results

The estimation stores the counts of every circuit until you run the next estimation.
Several reporter blocks read the counts:

| Block | Reports |
| :-- | :-- |
| `Estimated Quantum Resources` | The text for all circuits |
| `Estimated Quantum Resources of Circuit #` | The text for one circuit |
| `Estimated Qubit Requirements of Circuit #` | The number of qubits of one circuit |
| `Estimated (n) Qubit Gates in Circuit #` | The number of gates that act on `n` qubits in one circuit |
| `Estimated SWAP Gates in Circuit #` | The number of `SWAP` gates in one circuit |

The text has one section for the number of qubits and one section for each number of qubits that gates act on.
The sections are sorted by this number, and the gates within a section are listed in the order in which they first appear in the circuit.
Sections without gates are left out.
The text ends with an empty line.
For several circuits, `Estimated Quantum Resources` puts the texts one after another, separated by empty lines.
Before the first estimation, the block reports "No Resource Estimate computed yet".

Circuits are numbered from 1 in the order in which the estimation starts them.
Scratch starts the circuits of sprites that are further in front first and the circuits of the stage last.
With a single circuit, the number is always 1.
With several circuits, check which number belongs to which circuit, for example by comparing the qubit counts.

`Estimated (n) Qubit Gates in Circuit #` adds up all gates of the section for `n` qubits.
In the example above, `Estimated (1) Qubit Gates in Circuit #(1)` reports 4, because the circuit has one `H` gate and three measurements.
`Estimated (3) Qubit Gates in Circuit #(1)` reports 1, and a number without gates reports 0.

`Estimated SWAP Gates in Circuit #` reports the number of gates called `SWAP`, which are the `SWAP` gates without controls, or 0 if there are none.
For the messages that the reporters show for invalid numbers, see the {doc}`block reference <blocks>`.

## Switches

By default, the estimator counts the circuit exactly as you built it.
Three blocks switch on additional steps that break the circuit down into simpler gates, as a compiler would.
Each block has the menu entries `Enable` and `Disable`.

```{scratchblocks}
[Enable v] SWAP decomposition :: extension
[Enable v] substitute negative control lines :: extension
[Enable v] Toffoli decomposition :: extension
```

The switches apply to the estimation that the same script starts afterwards, so put them above `Perform Quantum Resource Estimation` in the same script.
Without a switch block, the step is off.
The switches only change the counts of the estimation; they do not change how circuits run.

### SWAP decomposition

With this switch on, each `SWAP` gate is replaced by three `X` gates.
For the SWAP of qubits `a` and `b`, these are an `X` on `b` controlled on `a`, an `X` on `a` controlled on `b`, and an `X` on `b` controlled on `a` again.
Every one of them keeps the controls of the `SWAP` gate in addition.

A `SWAP` gate without controls becomes three `CX` gates, and `Estimated SWAP Gates in Circuit #` reports 0 afterwards.
A `SWAP` gate with one control becomes three `CCX` gates.

### Substitute negative control lines

A negated control is met when its qubit is 0.
With this switch on, the estimator counts one additional `X` gate for every negated control of a gate, because a circuit that only uses regular controls needs an `X` gate on that qubit.
The negated control itself still counts as a control in the name of the gate.
For example, an `X` gate with one regular and one negated control is counted as one `CCX` gate and one `X` gate.

### Toffoli decomposition

With this switch on, the estimator breaks down every gate with more than one control, such as the `CCX` gate, into gates with at most one control.
This applies to all gates, not just `X`, and also to the gates that SWAP decomposition produces.

For a gate with $k$ controls, the estimator counts the following gates:

1. $k - 1$ ancilla qubits, which are added to the qubit count.
   The circuit needs as many ancillas as its gate with the most controls, so the ancillas are reused between gates.
2. For every pair of neighbouring controls, two decompositions of a `CCX` gate, whose target is an ancilla.
   There are $2(k-1)$ decompositions in total.
   Each decomposition consists of 16 gates: 2 `H`, 4 `T†`, 3 `T`, 1 `S`, and 6 `CX`.
   `T†` is the inverse of the `T` gate.
3. The original gate with only one control, the last ancilla.
   Its name has one `C`, so the original `X` gate is counted as one `CX` gate.

A `CCX` gate (`k = 2`) is therefore counted as 33 gates in total: 4 `H`, 8 `T†`, 6 `T`, 2 `S`, and 13 `CX`, and the circuit needs one additional qubit.
The decomposition is a way to count the cost of the gate; the estimator does not check the resulting circuit.

### Combining switches

The switches work together.
The estimator first adds the `X` gates for negated controls, then breaks down the gates with Toffoli decomposition and SWAP decomposition.
The gates that one of these steps produces are processed by the other as well.
A `SWAP` gate with one control, for example, becomes three `CCX` gates with SWAP decomposition, and each of them is broken down further when the Toffoli decomposition is on.

### Example

Enable the Toffoli decomposition for the circuit from [Estimate a circuit](#estimate-a-circuit):

```{scratchblocks}
when green flag clicked
[Enable v] Toffoli decomposition :: extension
Perform Quantum Resource Estimation :: extension
say (Estimated Quantum Resources :: extension)
```

The sprite now says the following text:

```text
Total Qubits: 4

1 Qubit Gates:
H: 5
T†: 8
T: 6
S: 2
measure: 3

2 Qubit Gates:
CX: 14

```

The `CCX` gate is replaced by the 33 gates from above.
The `H` gate of the circuit and the `CX` gate come on top of those, and the circuit needs one ancilla qubit, so `Estimated Qubit Requirements of Circuit #(1)` reports 4.

For SWAP decomposition, consider a circuit with two `SWAP` gates:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply SWAP gate to (qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension
apply SWAP gate to (qubit (1) of register [q] :: extension) and (qubit (2) of register [q] :: extension) :: extension
```

Without a switch, `Estimated SWAP Gates in Circuit #(1)` reports 2.
After `[Enable v] SWAP decomposition`, it reports 0, and `Estimated (2) Qubit Gates in Circuit #(1)` reports 6, because every `SWAP` gate is now three `CX` gates.

## Measurements during estimation

The estimator does not calculate the quantum state, but a `measure` block still has to report a value, which your script might use.
To do so, the estimator keeps a simple guess for every qubit: it is either known to be 0 or 1, or it is unknown.
All qubits start as 0.
The following rules update the guesses:

- `X` and `Y` flip a known qubit, as long as all controls are known to be met.
  If a control is known not to be met, nothing happens.
  If a control is unknown, the target becomes unknown.
  `Y` is treated like `X`.
- `H`, `RX`, and `RY` make the qubit unknown, whatever the angle is, unless a control is known not to be met.
- `Z`, `S`, `T`, and `RZ` do not change anything.
- `SWAP` exchanges the guesses of the two qubits.
  If a control is unknown, both qubits become unknown.
- `measure` reports the known value, or `0` or `1` with the same probability if the qubit is unknown.
  The qubit then keeps that value.

So a measurement is predictable for a circuit that only uses `X` gates and controls on known qubits, and random as soon as the qubit was touched by an `H` gate or an unknown control.
Because the estimator forgets correlations between qubits, the values are not the ones that the simulator would produce.
For example, measuring the two qubits of a Bell state can report `01` during estimation, but never in the simulator.

The estimator counts every gate block that runs, whether or not its controls are met.
Therefore, the counts do not depend on these measurement values, as long as the blocks that run do not depend on them.
If your script branches on a measurement, for example with an `if` block around a gate, the estimation can take a different branch than the simulation, and the counts can differ between runs.
The estimator also starts every qubit in the state 0; there is no counterpart to `Run Quantum Circuits starting from`.

## Next steps

- Try the exercises on resource estimation and compilation (see the {doc}`exercises <exercises/index>`) to see how the switches change the counts.
- Read about the estimation blocks in the {doc}`block reference <blocks>`.
- Read {doc}`simulation` for running circuits on the simulator.

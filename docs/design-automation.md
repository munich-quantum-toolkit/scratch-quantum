# Quantum design automation with Scratch

Quantum design automation covers the methods that turn a quantum circuit into something a quantum computer can run: compilation, resource estimation, and verification.
For real circuits, these tasks are far too large to do by hand, so software tools do them.
This page shows each step on one small circuit, inside a single Scratch project, following the workflow from the paper on the extension {cite:p}`qce_2026_01`.
You design the circuit, estimate its resources, optimize and compile it, and finally verify that the compiled circuit still does the same.

The page assumes that you know how to build and run a circuit; if not, start with the {doc}`quickstart`.

## Design the circuit

The running example is a circuit with three qubits.
It applies a Hadamard gate to qubit 0, then an `X` gate on qubit 2 with two controls (a Toffoli gate), and then an `X` gate on qubit 2 with one control (a `CX` gate).
Finally, it measures all qubits and adds the outcome to a list.

Create a list called `Results` with the "Make a List" button in the "Variables" category, then build the following script:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
controlled on ((qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
controlled on (qubit (0) of register [q] :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
add <measure (qubits of register [q] :: extension) :: extension> to [Results v]
```

The colours show the hand-over from the quantum part to the classical part of the program.
The blue blocks work on qubits.
The green `measure` block turns the qubits into a classical result, and the orange list block stores that result.

To run the circuit with the green flag, add a second script:

```{scratchblocks}
when green flag clicked
Run Quantum Circuits :: extension
```

Every click of the green flag runs the circuit once and adds one result to `Results`, so the list collects the results of all your runs.
The result is `000` or `101` (qubit 0 first), each in about half of the runs.
The Hadamard gate puts qubit 0 into a superposition, and the `CX` gate copies its value to qubit 2.

## Estimate its resources

Simulation tells you what a circuit computes, but not what it costs to run on hardware, and it stops working for circuits with more than 10 qubits ({doc}`simulation`).
Resource estimation counts the qubits and gates instead.
Replace `Run Quantum Circuits` in the green flag script by `Perform Quantum Resource Estimation` and let the sprite say the result:

```{scratchblocks}
when green flag clicked
Perform Quantum Resource Estimation :: extension
say (Estimated Quantum Resources :: extension)
```

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

The circuit needs 3 qubits and 3 gates: `H`, `CX`, and the Toffoli gate `CCX`.
The estimator lists each measured qubit as a one-qubit operation called `measure`; see {doc}`resource-estimation`.
The estimation also runs the list block, so it adds an entry to `Results`, with a value that the estimator guesses instead of simulating ([Measurements during estimation](resource-estimation.md#measurements-during-estimation)).

Most quantum computers cannot apply a gate with two controls directly.
Add `[Enable v] Toffoli decomposition` above `Perform Quantum Resource Estimation` to break the Toffoli gate down into gates with at most one control:

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

The circuit now needs 4 qubits, because the decomposition adds one helper qubit (an ancilla).
The 3 gates grow to 35 gates: 14 `T` and `T†` gates, 14 `CX` gates, 5 `H` gates, and 2 `S` gates.
Almost all of them come from the single Toffoli gate.

Now add more controls to the Toffoli gate and watch the counts grow.
For three controls, give the register 4 qubits, use qubit 3 as the target of both `X` gates, and nest a second `and` block:

```{scratchblocks}
controlled on (((qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension) and (qubit (2) of register [q] :: extension) :: extension) {
apply [X v] gate to (qubit (3) of register [q] :: extension) :: extension
} :: extension
```

With the Toffoli decomposition on, the estimator reports the following counts (gates without the measurements):

| Controls | Qubits | Gates |
| -------: | -----: | ----: |
|        2 |      4 |    35 |
|        3 |      6 |    67 |
|        4 |      8 |    99 |
|        5 |     10 |   131 |

Every additional control adds one qubit to the register, one ancilla, and 32 gates.
Without the decomposition, the circuit always has 3 gates, whatever the number of controls.

## Optimize and compile

Compilation prepares a circuit for a specific quantum computer.
Two typical steps are optimization, which removes unnecessary gates, and routing, which makes the circuit fit the connections between the qubits of the hardware.

Optimize
: Qubit 1 is never touched by a gate, so it stays in the state $|0\rangle$ the whole time.
The Toffoli gate is controlled on qubit 1, so it never acts, and you can remove it.

Route
: Assume a quantum computer whose qubits are connected in a line, 0–1–2 (a nearest-neighbour coupling map).
A two-qubit gate can only act on connected qubits, so the `CX` gate between qubits 0 and 2 is not allowed.
Swap qubits 0 and 1 first, apply the `CX` gate from qubit 1 to qubit 2, and swap them back.

Change your circuit into the following transformed circuit:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
apply SWAP gate to (qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension
controlled on (qubit (1) of register [q] :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
apply SWAP gate to (qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension
add <measure (qubits of register [q] :: extension) :: extension> to [Results v]
```

Run it with `Run Quantum Circuits`, and you again get `000` or `101`.
Estimate it again:

- Without switches, the circuit needs 3 qubits and 4 gates: one `H`, two `SWAP`, and one `CX` gate.
- With `[Enable v] SWAP decomposition`, every `SWAP` gate becomes three `CX` gates, so the circuit has 8 gates: one `H` and seven `CX` gates.
- The Toffoli decomposition changes nothing, because no gate has more than one control.

Compare this with the original circuit.
Removing the Toffoli gate saved the ancilla and 33 of the 35 decomposed gates, but the routing costs six `CX` gates for two `SWAP` gates.
On hardware, `CX` gates are typically more error-prone than one-qubit gates, so routing overhead matters, and compilers try to place qubits so that they need few `SWAP` gates.
The transformed circuit needs 3 qubits and 8 gates (7 of them `CX`), where the decomposed original needed 4 qubits and 35 gates (14 of them `CX`) and still did not fit the coupling map.

## Verify

Every compilation step can introduce an error, so you should check that the transformed circuit still does the same as the original.
One way is an equivalence check: run the transformed circuit, followed by the inverse of the original circuit.
If the two circuits are equivalent, the inverse undoes the transformed circuit, and the qubits return to their starting state.

The `H` gate, the Toffoli gate, and the `CX` gate are their own inverses.
The inverse of the original circuit is therefore the same blocks in reverse order: `CX`, Toffoli, `H`.
Remove the measurement from the transformed circuit, add the gates of the original in reverse order, and measure at the end:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
apply SWAP gate to (qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension
controlled on (qubit (1) of register [q] :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
apply SWAP gate to (qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension
controlled on (qubit (0) of register [q] :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
controlled on ((qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
add <measure (qubits of register [q] :: extension) :: extension> to [Results v]
```

Keep this circuit as the only `Quantum Circuit` script of the project, because `Run Quantum Circuits` starts every circuit, and each one would add its own entry to `Results`.
Put `Run Quantum Circuits` back into the green flag script and run the circuit several times.
Simulation is probabilistic in general, so a single run can hide a difference that only shows up in some runs.
Every result is `000`, so the circuits are equivalent for the starting state $|000\rangle$.

Equivalence must hold for every starting state, though.
Create a variable called `state` and loop over all eight basis states with `Run Quantum Circuits starting from`:

```{scratchblocks}
when green flag clicked
delete all of [Results v]
set [state v] to (0)
repeat (8)
Run Quantum Circuits starting from (state) :: extension
change [state v] by (1)
end
```

After one click, entry $k + 1$ of `Results` belongs to the state $k$.
The binary digits of the number set the qubits, with the lowest digit on qubit 0 ({doc}`simulation`), so the state `2` is $|010\rangle$.
If the circuits are equivalent, every run gives back its starting state.
We ran each state 1000 times:

| State | Starting state | Expected result | Results                                    |
| ----: | :------------- | :-------------- | :----------------------------------------- |
|     0 | $\|000\rangle$ | `000`           | always `000`                               |
|     1 | $\|100\rangle$ | `100`           | always `100`                               |
|     2 | $\|010\rangle$ | `010`           | `010`, `011`, `110`, `111`, each about 25% |
|     3 | $\|110\rangle$ | `110`           | `010`, `011`, `110`, `111`, each about 25% |
|     4 | $\|001\rangle$ | `001`           | always `001`                               |
|     5 | $\|101\rangle$ | `101`           | always `101`                               |
|     6 | $\|011\rangle$ | `011`           | `010`, `011`, `110`, `111`, each about 25% |
|     7 | $\|111\rangle$ | `111`           | `010`, `011`, `110`, `111`, each about 25% |

The check fails for every starting state in which qubit 1 is 1, such as $|010\rangle$.
In these states, the Toffoli gate of the original circuit acts, so removing it was wrong.
In about one run in four, such a state still gives back its starting state by chance, which is why you should click the green flag a few times.

The general lesson: an optimization can depend on assumptions about the input.
Removing the Toffoli gate is correct only as long as qubit 1 starts in $|0\rangle$, and testing a single starting state does not reveal this.

## Go further

The Scratch editor is a playground; real compilers and verification tools work on textual representations of circuits.
The `Export Circuits to MLIR` block translates your circuits into the MLIR format of the Munich Quantum Toolkit {cite:p}`mqt`, so you can continue with them in the compiler driver `mqt-cc`.
{doc}`mlir-export` explains the file and the `mqt-cc` commands.

The list block cannot be exported: the export stops with the message that the block `data_addtolist` can't be exported to MLIR.
Before you export, replace `add … to [Results v]` with a `say` block:

```{scratchblocks}
say <measure (qubits of register [q] :: extension) :: extension>
```

The export skips the `say` block but still translates the three measurements inside it.
Variables work too, but only with one qubit per variable: use one `set … to <measure …>` block for each qubit.
In the exported file, each `SWAP` block becomes a `qc.swap` operation and each `controlled on` block a `qc.ctrl` operation.

## Next steps

The {doc}`exercises <exercises/index>` follow the same workflow, with a template project for each step: you build circuits, verify them, estimate their resources, and compile and optimize them.

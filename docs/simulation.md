# Running circuits

This page explains how circuits run in the extension.
You learn what a circuit script is, how to start circuits, how measurement works, and where the built-in simulator reaches its limits.
The page uses the blocks from the {doc}`block reference <blocks>`; if you have not built a circuit yet, start with the {doc}`quickstart`.

## Circuit scripts

A circuit is a script that starts with the `Quantum Circuit` hat block.
The blocks below the hat are the circuit: they create registers, apply gates, and measure qubits.
Between the quantum blocks, you can use regular Scratch blocks, for example to store a measurement in a variable, to branch with `if`, or to let a sprite say something.

Every `Quantum Circuit` script has its own simulator that starts empty.
The registers and qubits of one circuit are invisible to all other circuits, so two circuits can both use a register called `q` without affecting each other.
A circuit also starts fresh every time it runs: a new run never continues with the qubit states of an earlier run.

The simulator calculates the full quantum state of the circuit exactly, as an ideal quantum computer without noise would produce it.
This is why it is limited to a small number of qubits; see [Size limit](#size-limit).

## Starting circuits

There are two ways to run circuits.

Click the script
: Clicking a `Quantum Circuit` script in the code area runs just that circuit.

Run Quantum Circuits
: The `Run Quantum Circuits` block starts every `Quantum Circuit` script of the project, in all sprites and in the stage, and runs them together.
  The script containing the block waits until all circuits have finished, and the blocks below it run afterwards.

The green flag does not start `Quantum Circuit` scripts.
To run your circuits with the green flag, put `Run Quantum Circuits` below a `when green flag clicked` hat, as in the {doc}`quickstart`:

```{scratchblocks}
when green flag clicked
Run Quantum Circuits :: extension
say [All circuits have finished.]
```

Because `Run Quantum Circuits` starts all circuits of the project, a project with several circuits runs all of them every time.
Their results do not depend on each other.

## Measuring

The `measure` block measures qubits and collapses their state.
The outcome is random, with the probabilities given by the current state of the qubit.
After the measurement, the qubit has the measured value, so measuring it again gives the same result, and the outcome also fixes the qubits it is entangled with.

For one qubit, `measure` reports `0` or `1`.
Because the block has the shape of a condition, you can use it directly in an `if` block: `0` counts as false and `1` as true.
The following circuit is a coin flip.
The Hadamard gate puts the qubit into an equal superposition, so the sprite says `Heads` or `Tails` with the same probability:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (1) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
if <measure (qubit (0) of register [q] :: extension) :: extension> then
say [Heads]
else
say [Tails]
end
```

Click the script a few times to see both outcomes.

For several qubits, `measure` reports one character per qubit, from the first qubit listed to the last, such as `01`.
Use this text in a variable or a `say` block, and do not use it as a condition: Scratch counts almost every text as true, even `00`.
To react to several qubits, measure them one by one.
You can also compare the text, as in `<(result) = [11]>`.

You can measure in the middle of a circuit and continue with more gates afterwards.
The qubits then continue from the collapsed state.

## Starting from a state

By default, all qubits of a circuit start in the state $|0\rangle$.
`Run Quantum Circuits starting from` starts all circuits with the qubits in a basis state that you choose by a number:

```{scratchblocks}
when green flag clicked
Run Quantum Circuits starting from (5) :: extension
```

The number is read in binary, and its digits are assigned to the qubits in the order in which the qubits are created, starting with the lowest digit.
The qubits of the first register you create come first, followed by the qubits of the next register, and so on.
The state `5` is `101` in binary, so the first qubit starts as 1, the second as 0, and the third as 1.
With a register `a` of one qubit followed by a register `b` of two qubits, this means that `a[0]` is 1, `b[0]` is 0, and `b[1]` is 1.

The following circuit has one register of two qubits and reads out the starting state:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
say <measure (qubits of register [q] :: extension) :: extension>
```

With `Run Quantum Circuits starting from (2)`, the sprite says `01`, because `2` is `10` in binary: qubit 0 starts as 0 and qubit 1 as 1.
The state `0` is the same as `Run Quantum Circuits`.

Some details to keep in mind:

- The starting state applies to every circuit of the project.
- If the number has more binary digits than the circuit has qubits, the remaining digits are not used by any register.
  The extra qubits still count towards the [size limit](#size-limit).
- Use a whole number that fits into the qubits of your circuit, which means a value below 1024 for the simulator.
- Type the number directly into the input of the block.
  Other ways of providing the number, such as a variable or a calculation, are not guaranteed to work.

## Size limit

The simulator handles circuits with up to 10 qubits in total, summed over all registers of the circuit.
The simulator keeps one value for every combination of qubit values, so the resources it needs grow exponentially with each additional qubit.

If a register does not fit, the console shows "Statevector too large to simulate" (open it with F12), and the register is created with fewer qubits than you asked for, possibly with none.
Gates ignore qubits beyond the last qubit of the circuit, and `measure` reports `undefined` for them.
The simulator does not stop the circuit.
Use circuits with at most 10 qubits.

The {doc}`resource estimation <resource-estimation>` has no such limit, because it does not simulate the state.
If you want to know how many qubits and gates a larger circuit needs, estimate it instead of running it.

## Choosing a simulator

The `Set Simulator` block has a menu for choosing the simulator.
Currently, the menu offers only the statevector simulator, which the extension always uses, so the block has no effect.

```{scratchblocks}
Set Simulator to [Statevector Simulator v] :: extension
```

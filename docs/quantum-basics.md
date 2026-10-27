# Quantum computing basics

This page explains just enough quantum computing to understand the circuits you build with the extension.
Each concept comes with the block that uses it.
If you want to dive deeper, see [Learn more](#learn-more).

## Qubits and registers

A qubit is the quantum version of a bit.
A bit is either 0 or 1; a qubit can also be in a combination of both, as described below.
A quantum computer works on many qubits at once, and a circuit starts with all qubits in the state $|0\rangle$.

In the extension, qubits live in registers.
A register is basically an array of individual qubits, which you create with the `create quantum register` block.
It has a name and a number of qubits, and you refer to a qubit by its index, starting at 0.
The `qubits of register` block refers to all qubits of a register at once.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
```

## Basis states and measurement

The states $|0\rangle$ and $|1\rangle$ are the basis states, the quantum counterparts of the classical values 0 and 1.
You can concatenate several qubits to form bigger basis states, such as $|00\rangle$, $|01\rangle$, $|10\rangle$, and $|11\rangle$.
In such a state, the first digit belongs to qubit 0, the second to qubit 1, and so on.

A qubit can only reveal a classical value through measurement.
Measurement is probabilistic: depending on the state, you get 0 or 1 with some probability.
Measurement also changes the state: after you measure a qubit, it stays in the state you measured, so measuring it again gives the same result.

The `measure` block measures a qubit and reports `0` or `1`.
For several qubits, it reports one character per qubit, from the first to the last.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
say <measure (qubits of register [q] :: extension) :: extension>
```

Here, the sprite says `01`, because qubit 1 was flipped to 1 and qubit 0 is still 0.

## Superposition

A qubit in superposition is in a combination of $|0\rangle$ and $|1\rangle$.
When you measure it, you get 0 or 1 with a probability that depends on the amplitudes of the combination.
The Hadamard gate `H` creates an equal superposition:

$$
H|0\rangle = \frac{|0\rangle + |1\rangle}{\sqrt{2}}
$$

Measuring this state gives 0 or 1 with probability one half each.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (1) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
say <measure (qubit (0) of register [q] :: extension) :: extension>
```

Run it several times: the sprite says `0` or `1` at random.

## Single-qubit gates

Gates change the state of qubits.
The `apply gate to` block offers six single-qubit gates:

- `X` is the bit flip: it swaps $|0\rangle$ and $|1\rangle$, like a quantum NOT.
- `Y` flips the qubit like `X` and also flips the phase like `Z`: it turns $|0\rangle$ into $i|1\rangle$ and $|1\rangle$ into $-i|0\rangle$.
  In other words, $Y = iXZ$.
  On its own, a measurement shows only the bit flip; the extra phase matters when the qubit interferes later, for example with an `H` gate.
- `Z` is the phase flip: it leaves $|0\rangle$ unchanged and flips the sign of $|1\rangle$, which means it multiplies $|1\rangle$ by $-1$.
- `H` is the Hadamard gate: it turns $|0\rangle$ into $(|0\rangle+|1\rangle)/\sqrt{2}$ and $|1\rangle$ into $(|0\rangle-|1\rangle)/\sqrt{2}$.
- `S` is a phase gate: it multiplies $|1\rangle$ by $i$, a quarter turn.
- `T` is a phase gate: it multiplies $|1\rangle$ by $e^{i\pi/4}$, an eighth of a turn.

A phase does not change the probability of measuring 0 or 1 right away, but it changes how states combine in later gates.
This is why `H`, `Z`, `H` on a qubit flips it like `X` does.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (1) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
apply [Z v] gate to (qubit (0) of register [q] :: extension) :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
say <measure (qubit (0) of register [q] :: extension) :: extension>
```

If you give the gate block `qubits of register`, it applies the gate to every qubit of the register.

## Controlled gates and entanglement

A controlled gate applies a gate to a target qubit only if a control qubit is 1.
In the extension, you place the gate inside a `controlled on` block.
With `X` as the gate, this is the controlled NOT (CNOT) gate:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
apply [X v] gate to (qubit (0) of register [q] :: extension) :: extension
controlled on (qubit (0) of register [q] :: extension) {
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
} :: extension
```

Both qubits are now 1.
If qubit 0 were left at 0, the controlled `X` would do nothing.

Controlled gates are what make qubits entangled in these circuits.
If the control is in superposition, the target follows it, and the two qubits are in a joint state $(|00\rangle+|11\rangle)/\sqrt{2}$ that you cannot describe qubit by qubit.
Measuring one of them determines the other one; the {doc}`quickstart` builds this circuit.

You can use several controls.
Combine them with the `and` block, or nest `controlled on` blocks; the gate is applied only if all controls are met.
A `negated control` block turns a control around: the gate is applied when that control qubit is 0 instead of 1.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [X v] gate to (qubit (0) of register [q] :: extension) :: extension
controlled on ((qubit (0) of register [q] :: extension) and (negated control (qubit (1) of register [q] :: extension) :: extension) :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
```

Here, qubit 2 is flipped because qubit 0 is 1 and qubit 1 is 0.

## Rotations and the U3 gate

The gates above are fixed.
Rotations let you choose how far to turn a qubit.
The `rotate by degrees around axis` block turns a qubit by an angle around the X, Y, or Z axis.
The angle is given in degrees, not radians.
A rotation by 180 degrees around the X axis flips a qubit, like `X` does.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (1) qubits :: extension
rotate (qubit (0) of register [q] :: extension) by (90) degrees around [Y v] axis :: extension
say <measure (qubit (0) of register [q] :: extension) :: extension>
```

A rotation by 90 degrees around the Y axis puts the qubit into an equal superposition, so the sprite says `0` or `1` at random.

The `U3` gate combines three rotations and can produce any single-qubit state.
It takes three angles in degrees, $\theta$, $\varphi$, and $\lambda$.
It first rotates by $\lambda$ around Z, then by $\theta$ around Y, and finally by $\varphi$ around Z.

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (1) qubits :: extension
apply U3 gate to (qubit (0) of register [q] :: extension) with angles (90) (0) (180) :: extension
```

## Learn more

- The [Munich Quantum Toolkit documentation](https://mqt.readthedocs.io) describes the tools around the extension.
- The textbook M. A. Nielsen and I. L. Chuang, _Quantum Computation and Quantum Information_ (Cambridge University Press), is a thorough introduction to the field.

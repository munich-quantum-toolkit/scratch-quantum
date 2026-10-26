# Quickstart

This page walks you through your first quantum circuit.
You build a circuit that creates an entangled pair of qubits, run it on the built-in simulator, and look at the result.
You do not need to know any quantum computing for this; {doc}`quantum-basics` explains the ideas behind each block when you want to know more.

## Open the editor

Open the editor in your browser: [{{ editor_url }}](https://munich-quantum-toolkit.github.io/scratch-quantum/).

The quantum blocks are in the "Quantum" category at the bottom of the block palette.
If you do not see this category, click the "Add Extension" button in the bottom-left corner of the editor and choose "Quantum".

## Build your first circuit

A quantum circuit is a script that starts with the `Quantum Circuit` hat block.
The circuit you build here is the "Bell state" circuit: it creates two qubits and entangles them.

First, create a variable called `result` with the "Make a Variable" button in the "Variables" category.
The circuit stores its measurement in this variable.

Then add the following blocks to the code area of your sprite, one below the other.

1. Drag a `Quantum Circuit` hat block into the code area.
   It marks the start of a circuit.

   ```{scratchblocks}
   Quantum Circuit :: hat extension
   ```

2. Add a quantum register with two qubits.
   A register is a named group of qubits; here it is called `q`.

   ```{scratchblocks}
   create quantum register [q] with (2) qubits :: extension
   ```

3. Put the first qubit into a superposition with the Hadamard gate `H`.
   Drop a `qubit (0) of register [q]` block into the input of the gate block.
   Qubits are numbered from 0.

   ```{scratchblocks}
   apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
   ```

4. Entangle the second qubit with the first.
   Add a `controlled on` block, put `qubit (0) of register [q]` into its input, and place an `X` gate on qubit 1 inside it.
   The `X` gate is now applied only when qubit 0 is 1.

   ```{scratchblocks}
   controlled on (qubit (0) of register [q] :: extension) {
   apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
   } :: extension
   ```

5. Measure both qubits and store the outcome.
   The `qubits of register [q]` block stands for all qubits of the register.
   The `measure` block returns one character per qubit, `0` or `1`, from qubit 0 to the last qubit.
   For two qubits, `result` is a text such as `00` or `11`.
   Finally, let the sprite say the result.

   ```{scratchblocks}
   set [result v] to <measure (qubits of register [q] :: extension) :: extension>
   say (result)
   ```

The complete script looks like this:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (2) qubits :: extension
apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
controlled on (qubit (0) of register [q] :: extension) {
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
} :: extension
set [result v] to <measure (qubits of register [q] :: extension) :: extension>
say (result)
```

## Run it

A `Quantum Circuit` script does not run when you click it.
The circuit is only simulated when you tell the extension to run all circuits.
Build this second script next to the circuit:

```{scratchblocks}
when green flag clicked
Run Quantum Circuits :: extension
```

Click the green flag.
The sprite says `00` or `11`.
Click the green flag a few more times: the outcome changes randomly between `00` and `11`, but you never get `01` or `10`.

This is entanglement.
The Hadamard gate puts qubit 0 into an equal superposition of 0 and 1, and the controlled `X` gate copies this choice to qubit 1.
The two qubits are then perfectly correlated: when you measure one, the other one always gives the same result.
Read {doc}`quantum-basics` for the details.

## What next

- Replace the `H` gate with a different gate, such as `X` or `Z`, and see how the outcome changes.
- Measure only one qubit by using `qubit (0) of register [q]` in the `measure` block instead of `qubits of register [q]`.
- Try the exercises, which guide you through circuits, verification, resource estimation, and compilation (see the exercises page).
- Read the block reference for all quantum blocks (see the blocks page).

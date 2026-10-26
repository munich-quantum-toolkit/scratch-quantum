# Quantum circuits with Scratch

*Estimated time: 5 minutes.*

{download}`Download the template <templates/02-circuits.sb3>`

Open the editor at [https://munich-quantum-toolkit.github.io/scratch-quantum/](https://munich-quantum-toolkit.github.io/scratch-quantum/), then choose *File → Load from your computer* and open the file `02-circuits.sb3`.
This file pre-loads the "Quantum" Scratch extension and contains the start of a quantum circuit: a quantum register with a single qubit, which a `say` block measures.
Extend the circuit so that it sets up a Bell state by:

- Creating a quantum register (set of qubits) consisting of 2 qubits.
- Applying a `H` gate to qubit 0.
- Applying a `CX` gate, controlled on qubit 0 and targeting qubit 1.

```{scratchblocks}
create quantum register [q] with (2) qubits :: extension

apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension

controlled on (qubit (0) of register [q] :: extension) {
apply [X v] gate to (qubit (1) of register [q] :: extension) :: extension
} :: extension
```

Note how the `CX` gate is represented by a parent block "controlled on qubit 0" containing the child block "apply `X` gate to qubit 1".

**(a)** Press the green flag (play) to start execution.
The block "Run Quantum Circuits" under "When [GREEN FLAG] clicked" causes the circuit under the "Quantum Circuit" event to be executed.
Notice how, if you remove the "Run Quantum Circuits" block, the circuit will not be executed anymore after pressing play.

```{scratchblocks}
when green flag clicked
Run Quantum Circuits :: extension
```

**(b)** Verify the entanglement by measuring qubit 1 as well.
Output both measurement results (either by using two "say" blocks, or by using the "join" operation from the "Operators" tab to concatenate them).
If the qubits are entangled, they should both output the same value.

```{scratchblocks}
<measure (qubit (1) of register [q] :: extension) :: extension>

(join [apple] [banana])
```

**(c)** Play around with the circuit.
Try adding more qubits, applying different gates, or measuring qubits multiple times.

To learn more about the blocks of this exercise, see the {doc}`block reference <../blocks>` and {doc}`../simulation`.
When you are ready, continue with {doc}`03-verification`.

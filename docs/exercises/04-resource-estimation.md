# Quantum resource estimation

*Estimated time: 10 minutes.*

{download}`Download the template <templates/04-resource-estimation.sb3>`

As programs get larger, simulation becomes impossible.
The Scratch "Quantum" extension can only simulate up to 10 qubits.
For larger circuits, **Resource Estimation** can still be used to reason about them.
Open the editor at [https://munich-quantum-toolkit.github.io/scratch-quantum/](https://munich-quantum-toolkit.github.io/scratch-quantum/), then choose *File → Load from your computer* and open the file `04-resource-estimation.sb3`.
It constructs a quantum circuit with 15 qubits that performs a Toffoli gate with 4 control qubits on a target.

**(a)** The "main" block now contains the instruction "Perform Quantum Resource Estimation" rather than "Run Quantum Circuits".
Running the program now only estimates gate and qubit counts and stores them in the "Estimated Quantum Resources" reporter.
Run the program to view the estimated resources.

```{scratchblocks}
when green flag clicked
Perform Quantum Resource Estimation :: extension
say (Estimated Quantum Resources :: extension)
```

**(b)** Quantum Circuits usually need to be compiled to a native gate set.
For instance, Toffoli gates have to be reduced to a set of simpler `CX` gates.
That usually requires both **a larger number of gates in the circuit** and **additional auxiliary qubits**.
To preview those resource increases, add the "Enable Toffoli decomposition" block right after "When [GREEN FLAG] clicked" and before "Perform Quantum Resource Estimation".

```{scratchblocks}
[Enable v] Toffoli decomposition :: extension
```

Run the program to check by how much the resource requirements have increased.

**(c)** Try to add additional control qubits to the Toffoli gate by adding further "controlled on [...]" blocks with different qubits inside the existing ones.

```{scratchblocks}
controlled on (qubit (0) of register [q] :: extension) {
controlled on (qubit (1) of register [q] :: extension) {
apply [X v] gate to (qubit (14) of register [q] :: extension) :: extension
} :: extension
} :: extension
```

Can you figure out by how much the number of required qubits and/or `CX` gates increases as you add further controls?

The {doc}`../resource-estimation` page explains what the estimator counts and how the Toffoli decomposition changes the counts.
The estimation blocks are listed in the {doc}`block reference <../blocks>`.
When you are ready, continue with {doc}`05-compilation`.

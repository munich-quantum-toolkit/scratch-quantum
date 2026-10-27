# Compilation & circuit optimization

_Estimated time: 10 minutes._

{download}`Download the template <templates/05-compilation.sb3>`

Open the editor at [https://munich-quantum-toolkit.github.io/scratch-quantum/](https://munich-quantum-toolkit.github.io/scratch-quantum/), then choose _File → Load from your computer_ and open the file `05-compilation.sb3`.
It contains two **equivalent** circuits that each have a lot of `SWAP` gates.
These gates have to be translated into several `CX` gates for most architectures.
Therefore, they can be quite expensive.

**(a)** Press play to perform resource estimation with `SWAP` decomposition enabled.
This tells you, how many `CX` gates you need for the full circuit.
The required resources will be shown for **both** circuits.

```{scratchblocks}
when green flag clicked
[Enable v] SWAP decomposition :: extension
Perform Quantum Resource Estimation :: extension
```

**(b)** Suddenly, you find out that your quantum computer actually supports all-to-all connectivity.
This means, that all `SWAP` gates can be removed (provided you change the indices of other gates appropriately).
Update one of the circuits to reduce the number of `SWAP` gates and then perform resource estimation again.

```{scratchblocks}
apply SWAP gate to (qubit (0) of register [q] :: extension) and (qubit (1) of register [q] :: extension) :: extension
```

**(c)** Verify that your circuit is still correct!
Use the unmodified circuit as an inverse by once again dragging its blocks to the end of the main circuit, bottom to top.
Then, add a measurement on all qubits.
Finally, **change the execution mode** from resource estimation to simulation ("Run Quantum Circuits").
Is your circuit still correct?

```{scratchblocks}
Run Quantum Circuits :: extension
```

The {doc}`../resource-estimation` page explains the `SWAP` decomposition and how circuits are numbered in the estimation.
To learn more about running circuits and measurements, see {doc}`../simulation`.
If you want to continue after the exercises, read about the {doc}`MLIR export <../mlir-export>`, which hands your circuits to the MQT compiler toolchain.

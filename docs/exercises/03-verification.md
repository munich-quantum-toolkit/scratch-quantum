# Quantum circuit verification

_Estimated time: 10 minutes._

{download}`Download the template <templates/03-verification.sb3>`

Open the editor at [https://munich-quantum-toolkit.github.io/scratch-quantum/](https://munich-quantum-toolkit.github.io/scratch-quantum/), then choose _File → Load from your computer_ and open the file `03-verification.sb3`.
This file contains two quantum circuits.
Both circuits should prepare a Bell state, as in the previous exercise.
While the left circuit is the same as earlier, the right circuit is a different (but equivalent) implementation.

**(a)** Press the green flag (play) to start execution.
Note how "Run Quantum Circuits" executes both circuits, stores their measurement outcomes in the `result-left` and `result-right` variables and finally outputs the results in the main block.

```{scratchblocks}
when green flag clicked
Run Quantum Circuits :: extension
say (join [Left: ] (result-left)) for (2) seconds
say (join [Right: ] (result-right)) for (2) seconds
```

**(b)** Verify the equivalence of the given circuits by checking whether the inverse of the right circuit is also the inverse of the left circuit.
This consists of the following steps:

- Remove the measurements from both circuits.
- Starting from the bottom of the right circuit, move the individual blocks from the right circuit to the end of the left circuit (excluding the "create quantum register" block).
- The "combined" circuit should now end with "apply `H` gate to qubit `0` of register `q`".

  ```{scratchblocks}
  apply [H v] gate to (qubit (0) of register [q] :: extension) :: extension
  ```

- At the end of the circuit, measure both qubits and output their results.
  - Are they both `0`? ⇒ the right circuit inverted the left circuit, returning the qubits to the $|00\rangle$ state. The circuits are equivalent.
  - Is at least one of them not `0`? ⇒ the circuits are not equivalent.

**(c)** Modify the starting circuit slightly and check if your program now correctly finds non-equivalence.
(It may be necessary to execute the program multiple times to receive a `1` output due to randomness).

To learn more about how circuits run and how measurements work, see {doc}`../simulation`.
The {doc}`block reference <../blocks>` lists all quantum blocks.
When you are ready, continue with {doc}`04-resource-estimation`.

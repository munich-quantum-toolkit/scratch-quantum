# Qubit expressions

Most quantum blocks take a qubit as input: the gates, `controlled on`, the rotations, and `measure`.
The input is not limited to one qubit.
It holds a qubit expression, a small piece of text that names one qubit, several qubits, or negated qubits.
This page explains how qubit expressions work, so that you can combine blocks and type qubits by hand.
All blocks are described in the {doc}`blocks`.

## Qubits are text

The `qubit of register` block does not hold a qubit.
It reports text of the form `register[index]`: the block `qubit (0) of register [q]` reports `q[0]`.
Every block that takes a qubit reads this text.

```{scratchblocks}
(qubit (1) of register [q] :: extension)
```

You do not need the reporter block.
You can type the text into the input of a gate block instead:

```{scratchblocks}
apply [H v] gate to [q\[0\]] :: extension
```

Both ways are equal.
The reporter is more convenient to build, and typing is shorter when you write many gates.

The text must follow these rules:

- The register name consists of letters, digits, and underscores and does not start with a digit.
- The index is a whole number, 0 or greater.
  The first qubit of a register has index 0.

If the text does not follow the rules, the console shows a message such as `Invalid qubit format, expected "register[index]"` or "Qubit index must be a non-negative integer".
Blocks report such problems only in the browser console, not in the editor.
For text without brackets, such as `hello`, nothing else happens.
Qubits that do not exist, such as `q[5]` in a register with two qubits, are ignored by gates.

The `qubit of register` reporter does not check its input: a negative index results in `q[-1]`, which causes the error message when a gate uses it.

## Several qubits with and

The `and` block joins two qubit expressions:

```{scratchblocks}
([/] and [/] :: extension)
```

Instead of the block, you can type the word `and` with a space on both sides: `q[0] and q[1]`.
Joining more than two qubits works the same way: `q[0] and q[1] and q[2]`.

A block treats such an expression as a list of qubits:

- A gate, a rotation, or a `U3` gate is applied to every qubit of the list, one after the other.
  The gate is broadcast: one gate per qubit.
- `measure` measures every qubit of the list in the order of the list and reports one character per qubit.
- `controlled on` uses all qubits of the list as controls.
  The blocks inside are applied only if all of them are met.
- `apply SWAP gate` needs exactly one qubit per input and does not accept a list.

The following circuit flips qubits 0 and 2, but not qubit 1:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [X v] gate to ((qubit (0) of register [q] :: extension) and (qubit (2) of register [q] :: extension) :: extension) :: extension
say <measure (qubits of register [q] :: extension) :: extension>
```

The sprite says `101`.

## All qubits of a register

The `qubits of register` block reports all qubits of a register joined with `and`, from qubit 0 to the last one.
For a register `q` with three qubits, it reports `q[0] and q[1] and q[2]`.
It is the short way to address a whole register:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [H v] gate to (qubits of register [q] :: extension) :: extension
```

This applies a Hadamard gate to each of the three qubits.
In `controlled on`, the same block makes all qubits of the register controls.

## Negated controls

A control is met if its qubit is 1.
A negated control is met if its qubit is 0.
The `negated control` block puts `not` in front of a qubit: it reports `not q[0]` for `q[0]`.
You can also type this text yourself.

You can combine normal and negated controls with `and`:

```{scratchblocks}
Quantum Circuit :: hat extension
create quantum register [q] with (3) qubits :: extension
apply [X v] gate to (qubit (0) of register [q] :: extension) :: extension
controlled on ((qubit (0) of register [q] :: extension) and (negated control (qubit (1) of register [q] :: extension) :: extension) :: extension) {
apply [X v] gate to (qubit (2) of register [q] :: extension) :: extension
} :: extension
```

Qubit 2 is flipped because qubit 0 is 1 and qubit 1 is 0.
The same control as typed text is `q[0] and not q[1]`.

Keep the following in mind:

- Negation applies to one qubit.
  `negated control` on an expression with `and` shows "Invalid negated expression" in the console and reports nothing.
  Negate each qubit on its own and join them with `and`.
- Negating an already negated qubit reports nothing either.
- Only controls can be negated.
  If you use a negated qubit as the target of a gate, the negation is ignored and the gate is applied to the qubit as if it were not negated.

## The placeholder /

The default value of every qubit input is `/`.
It means "no qubit" and makes the empty input visible.

- If a gate, a rotation, a `U3` gate, a `SWAP` gate, or `measure` gets `/`, the console shows "Invalid qubit value".
  A gate does nothing, and `measure` reports nothing.
- If `controlled on` gets `/`, the console shows the same message and the blocks inside are skipped.
- The `and` block ignores `/`: it reports the other input.
  Only if both inputs are `/`, it reports `/`.
- The `negated control` block reports `/` for `/`.

Fill in every qubit input of the blocks you use: an input that still shows `/` produces the message above.

Typing `/` inside a longer text, such as `q[0] and /`, is different: only the `and` block removes the `/`.
In typed text, the `/` causes an error message.

# Exercises

These five exercises introduce quantum computing with the quantum computing extension.
You work through them in the Scratch editor, with one template project per exercise.
Together, they follow one quantum design automation workflow: you build a circuit, verify it, estimate its resources, and compile and optimize it.
The guide {doc}`../design-automation` walks through the same workflow on a single circuit.
Basic knowledge of qubits and gates is assumed; the {doc}`../quantum-basics` page covers what you need.
You need no previous experience with Scratch or with design automation.

Each exercise page starts with a download link for its template.
Open the [editor](https://munich-quantum-toolkit.github.io/scratch-quantum/), then choose _File → Load from your computer_ to open the template.
The templates that contain quantum blocks load the quantum extension automatically.

## What you learn

The exercises build on each other, so do them in order.

1. {doc}`Warming up with Scratch <01-warmup>`: You learn how Scratch programs work.
   You can skip this exercise if you have used Scratch before.
2. {doc}`Quantum circuits with Scratch <02-circuits>`: You build and run a circuit that entangles two qubits, and you measure the result.
3. {doc}`Quantum circuit verification <03-verification>`: You check with the simulator whether two circuits are equivalent.
4. {doc}`Quantum resource estimation <04-resource-estimation>`: You count the qubits and gates of a circuit that is too large to simulate, and you see how much a gate decomposition costs.
5. {doc}`Compilation & circuit optimization <05-compilation>`: You reduce the number of `SWAP` gates of a circuit and check that the optimized circuit is still correct.

If you want to look up a block while you work, the {doc}`block reference <../blocks>` lists all quantum blocks.
The {doc}`quickstart <../quickstart>` shows you how to build a first circuit step by step.

## For educators

The exercises are designed for a short workshop or a single class session.
They were evaluated in a user study with 24 students in two formats, a supervised lab session and a take-home assignment, so both formats work {cite:p}`qce_2026_01`.

Prerequisites
: Basic knowledge of qubits and gates is assumed; the {doc}`../quantum-basics` page covers what is needed.
Previous experience with Scratch or with design automation is not needed, because exercise 1 introduces Scratch.
For the first circuits, point your students to the {doc}`../quickstart` page.

Pacing
: If a group takes longer on an exercise, it can move on to the next exercise without finishing.

Format
: We suggest that students work in pairs with one laptop per pair.
You can hand out the exercise sheets on paper or share the pages of this documentation.
Every student needs a browser; nothing has to be installed.

Materials
: Each exercise page links its template project.
You can download the files once and distribute them yourself.

Solutions
: There are no published solutions.

The exercises were developed at the Chair for Design Automation, Technical University of Munich.
If you use them in your classroom, we are happy to hear about your experience; see our {doc}`support page <../support>`.

```{toctree}
:maxdepth: 1

01-warmup
02-circuits
03-verification
04-resource-estimation
05-compilation
```

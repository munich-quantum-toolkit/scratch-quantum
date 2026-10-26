# Contributing

We welcome contributions to the quantum computing extension: bug reports, fixes, new features, exercises, and improvements to this documentation.
This page describes how to propose a change.
How to run the code and the tests is described in {doc}`development`.

## Before you start

For a bug or a small fix, you can directly open a pull request.
For a larger change, such as a new block or a new simulator, open an issue first and describe what you want to do.
We can then agree on the approach before you invest your time.
Issues for the editor and this documentation go to the [issue tracker](https://github.com/munich-quantum-toolkit/scratch-quantum/issues); see also the {doc}`support page <support>`.

Changes to the extension itself are made in the repositories of the virtual machine and the editor, which are currently private; see {doc}`development`.
Ask the maintainers for access before you start.

## Making a change

1. Create a branch from the default branch of the repository you work on.
2. Make your change.
3. Check that the tests and the linter pass; see {doc}`development`.
   New code needs tests.
4. Update the documentation if your change is visible to users: new or changed blocks, changed behavior, or new limitations.
   The {doc}`blocks` page and the other reference pages are the first places to look.
5. Open a pull request against the default branch of the repository: `main` in `scratch-quantum`, and `develop` in the repositories of the virtual machine and the editor.

## Commit messages

We use conventional commits with a gitmoji after the type.
The format is `type: :emoji: description`, for example:

```text
feat: :sparkles: add a block for the CZ gate
fix: :bug: report invalid register names
docs: :memo: describe the resource estimation settings
test: :white_check_mark: cover nested controlled blocks
```

Write the description in the imperative and keep it short.
The virtual machine checks the commit messages with `commitlint` when you commit.

## Documentation

Documentation changes are pull requests like any other change.
Build the documentation locally before you open the pull request; the build must finish without warnings.
{doc}`development` explains how to build the documentation and how to write blocks in it.

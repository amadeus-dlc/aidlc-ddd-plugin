# TypeScript module layout contract

English | [Japanese](typescript-module-layout.ja.md) | [User documentation](README.md)

Select one TypeScript layout in `.ddd.toml` at the application project root, alongside the `aidlc/` directory. The [language-neutral project settings](project-settings.md) own that document's format and define both layouts; this page describes how they are enforced. The setting applies to the `src` directory of every package in the project. Missing configuration blocks TypeScript approval; the checker never infers the team's choice from existing files.

```toml
schema_version = 2
languages = ["typescript"]

[typescript]
module_layout = "named-file"
code_representation = "class"
```

The rules `module-layout.configuration`, `module-layout.violation`, and `module-layout.unresolved` mean the same as in the [Rust module layout contract](rust-module-layout.md).

| Mode | Parent module | Leaf module |
|---|---|---|
| `named-file` | `src/invoice.ts` | `src/invoice/line.ts` |
| `index-file` | `src/invoice/index.ts` | `src/invoice/line.ts` |

A TypeScript module is its file, so no declaration makes a module a parent: a module is a parent when its directory `src/invoice/` holds TypeScript sources other than its own `index.ts`. A leaf is the named file in both layouts. `src/index.ts` is the package entry and is not a placed module.

## What is inspected

A package is a directory holding `package.json`, and its source root is the `src` directory directly beneath it. The checker walks the whole project, finds every package with such a `src`, and judges the placement of every TypeScript module there, regardless of layer, domain-modeling status, or source-manifest claims. TypeScript elsewhere — tests beside `src`, build scripts, configuration files, or a workspace root without `src` — is not a placed module. No source root other than `src` is handled.

Hidden entries and the directories aidlc, node_modules, vendor, target, and dist are excluded from discovery, the same as the Rust check. A project holds TypeScript when it has a `tsconfig.json` or a TypeScript source (`.ts`, `.tsx`, `.mts`, `.cts`) outside those trees; a `package.json` alone does not make it one.

These arrangements are reported as `module-layout.unresolved` and never pass:

| Arrangement | Where it is reported |
|---|---|
| A module placed in both `src/invoice.ts` and `src/invoice/index.ts` | both files |
| A module directory with children but neither module file | the directory |
| A symbolic link anywhere in the inspected project, including one pointing outside its package | the link |
| A TypeScript source in `src` whose name cannot be a module file, such as `*.test.ts`, `*.d.ts`, `.tsx`, `.mts`, or `.cts` | the file |
| A directory holding TypeScript whose name cannot be a module name | the directory |
| A package inside another package's `src` | its `package.json` |
| A directory that cannot be listed | the directory; the modules above it are not also judged |
| A project configured for TypeScript with no package holding `src` | the project root (`.`) |

A directory holding no TypeScript, such as one with data files only, is not a module directory and does not give its module children.

## Approval and CI

The blocking `ddd-typescript-module-layout` sensor runs at these normal approval gates:

| Stage | Trigger artifact |
|---|---|
| code-generation | code-summary.md |
| build-and-test | build-and-test-summary.md |
| ci-pipeline | quality-gates.md |

A project that neither holds TypeScript nor has `.ddd.toml` is not applicable, and a project whose settings do not name typescript and that holds no TypeScript is not applicable either, so a Rust-only project passes this sensor. A project that holds TypeScript but does not name typescript in `languages` is reported as `module-layout.configuration`.

For CI, run the installed command from any working directory, pointing it at the application project root:

```sh
bun /path/to/project/.codex/tools/ddd-check-typescript-module-layout.ts --project /path/to/project
```

For Claude Code, use `.claude/tools/`. The command prints JSON and returns 0 only when at least one package was inspected and there are no findings. Invalid arguments, zero packages, unresolved structure, or violations return nonzero. The sensor and this command call the same check, so on a project the check applies to they return the same findings and the same verdict. They differ only on a project that is not applicable (defined above): the sensor passes it, while this command returns nonzero because it inspected zero packages. The sensor entry point uses the framework's JSON verdict protocol and is not a substitute for this CI command. Neither needs a fact extractor: the check reads the directory tree only.

Run the command on every change, including package.json/configuration-only changes, renames, and deletions; do not filter it by claimed or changed files. Keep type checking and application tests. For standalone stage execution, require the same direct command to succeed before reporting completion. Standard AI-DLC 2.8.2 does not enforce general gate sensors on standalone completion.

## Findings and migration

| Rule | Action |
|---|---|
| module-layout.configuration | Set one valid project-root configuration that names typescript, and remove nested configuration. |
| module-layout.violation | Move the module file to the path named by the finding, then update the imports that name it. |
| module-layout.unresolved | Remove the duplicate or add the missing module file, move unplaceable sources out of `src`, replace links with real files, or separate nested packages. |

To switch a parent from `invoice/index.ts` to `invoice.ts`, keep its children under `invoice/` and remove the old file; both files cannot coexist for the same module. When a module loses its last child, move its `index.ts` to the named file. The check inspects file placement only; it does not check imports, exports, or compilation. Do not automatically move user code or rewrite the selected policy merely to make a check pass.

See the [coverage matrix](../developers/sensor-coverage.md) for executable normal, violation, and boundary cases.

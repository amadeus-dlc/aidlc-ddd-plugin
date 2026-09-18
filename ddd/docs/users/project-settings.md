# Language-neutral project settings

English | [Japanese](project-settings.ja.md) | [User documentation](README.md)

Declare the languages a project uses, and each language's choices, in `.ddd.toml` at the application project root, alongside the `aidlc/` directory. This page owns that document's format; the [Rust module layout contract](rust-module-layout.md) describes what its `rust.module_layout` axis means for Rust source. Nothing is inferred from existing sources, and a missing or invalid document is rejected rather than completed.

```toml
schema_version = 2
languages = ["rust", "typescript"]

[rust]
module_layout = "file"

[typescript]
module_layout = "named-file"
code_representation = "class"
```

List a language in `languages` only when the project uses it, and declare every axis that language requires. Do not write a table for a language that is absent from `languages`. Layout and code representation are separate axes: changing one never changes the other.

| Axis | Values | Meaning |
|---|---|---|
| `rust.module_layout` | `file` / `mod-rs` | parent `src/invoice.rs` / parent `src/invoice/mod.rs`; a leaf is `src/invoice/line.rs` either way |
| `typescript.module_layout` | `named-file` / `index-file` | parent `src/invoice.ts` / parent `src/invoice/index.ts`; a leaf is `src/invoice/line.ts` either way |
| `typescript.code_representation` | `class` / `companion` | a class, or a type with a same-name companion object |

The aggregate execution model and persistence method stay in `ddd-aggregate-mapping.md`. Writing `programming_model` or `persistence_method` here is rejected, and the `class` execution model of an aggregate is unrelated to the `class` code representation of TypeScript code.

## What the checks do with each format

The Rust module layout check reads this format through both of its entry points, `ddd-check-rust-module-layout.ts` and the `ddd-rust-module-layout` gate sensor. A document still in `schema_version = 1`, which named the Rust layout and nothing else, is reported as `module-layout.configuration` with a pointer to the migration.

Which languages the project names decides what the layout check has to do. A project that does not name `rust` and holds no Cargo manifest and no `.rs` file has no Rust layout to check, and the check reports nothing. A project that does not name `rust` but holds either is reported as `module-layout.configuration`: it holds Rust its settings do not account for.

Convert the whole project in one step with [`ddd-artifact-set migrate`](artifact-migration.md), which converts these settings together with the canonical model, the implementation mapping and the layer declarations of one record.

## Read and validate

```ts
import { readProjectSettings } from "/path/to/project/.codex/tools/ddd/lib/project-settings/index.ts";

const outcome = readProjectSettings("/path/to/project");
if (outcome.kind === "validated") console.log(outcome.selection);
else console.log(outcome.rejection.reason, outcome.rejection.subject, outcome.rejection.missing);
```

Reading never starts a gate sensor and never analyses project sources. A rejection names the file, the reason, and either the key at fault or the items that are absent. It carries no line or column, because the TOML reader reports no positions.

Only the project-root document configures the project. A `.ddd.toml` found in a searched subdirectory is rejected and listed by path in `rejectedDocuments`. The search skips hidden entries and the directories `node_modules`, `target`, `vendor`, `dist` and `aidlc`, and never descends into them, so a document placed inside one of those is neither adopted nor reported. This is not a way to find every `.ddd.toml` in the project.

## Preview, supplement, and apply a migration

Use the command for a Rust project that still holds `schema_version = 1`. Without `--apply` it only reports; it writes nothing.

```sh
bun /path/to/project/.codex/tools/ddd-project-settings.ts migrate --project /path/to/project
```

For Claude Code, use `.claude/tools/`. The command prints one JSON object whose `outcome` names the result, so you never have to read the exit status alone.

| `outcome` | Exit | Meaning |
|---|---|---|
| `candidate` | 0 | A preview that can be applied; `selection` holds it |
| `missing-information` | 0 preview, 1 with `--apply` | `missing` lists the values you still have to supply |
| `already-migrated` | 0 | The document is already in this format; nothing is rewritten |
| `applied` | 0 | The root document was replaced with `selection` |
| `rejected` | 1 | `reason` and `subject` or `missing` explain the refusal |
| `write-failed` | 3 | Validation held but the file could not be replaced |
| `invalid-arguments` | 2 | `detail` repeats the usage |

The Rust layout keeps its meaning across the migration. TypeScript is never invented from it: add both TypeScript values yourself when you want that language in use.

```sh
bun /path/to/project/.codex/tools/ddd-project-settings.ts migrate --project /path/to/project \
  --typescript-layout named-file --typescript-representation class --apply
```

Supplying only one of the two reports `missing-information` and applies nothing. Applying re-reads and re-validates the document, so an earlier successful preview never authorises a later invalid input. Running the same command again on an applied document reports `already-migrated` and leaves the bytes as they are.

Applying replaces the root `.ddd.toml` and nothing else: sources, generated code, canonical models, the aggregate mapping, and layer declarations keep their bytes. The replacement is staged beside the file and renamed into place, so a failed write leaves no partial document. A root `.ddd.toml` that is a symbolic link is refused with `write-failed`, because the rename would replace the link instead of the file it names. An edit made by someone else between the read and the rename is not detected; do not run a migration while another process is writing the same file.

## Fixing a refusal

| `reason` | Fix |
|---|---|
| `file-absent` | Create `.ddd.toml` at the project root with the block at the top of this page |
| `unreadable` | Make the path a readable regular file; a directory of that name is not a document |
| `malformed-syntax` | Repair the TOML; the message quotes the parser, and a key may not be defined twice |
| `nested-config-found` | Delete or move each path in `rejectedDocuments`; only the root document configures the project |
| `aggregate-mapping-leak` | Remove `programming_model` and `persistence_method`; they belong to `ddd-aggregate-mapping.md` |
| `version-missing` | Add `schema_version = 2` |
| `legacy-modern-mixed` | The document is `schema_version = 1`; migrate it with the command above instead of editing the version by hand |
| `version-unknown` | Set `schema_version` to the integer `2` |
| `duplicate-choice-on-axis` | `subject` names the axis holding several methods; keep exactly one |
| `unknown-key-or-value` | `subject` names a key, a table, or a value outside this contract; use the tables on this page |
| `type-mismatch` | `subject` names a value of the wrong kind; language names form an array and each axis takes one string |
| `required-choice-missing` | `missing` lists what to declare: `languages`, or an axis of a language in use |

## Passing the settings to the limited inspection

`bindInspectionInput` puts a validated selection into the inspection input, where it takes part in the request identity. Two different valid selections therefore produce two different requests over the same sources, and the same selection always produces the same one.

A selection that disagrees with the requested target is refused before a request exists: asking for `ts-class` while the settings choose `companion`, or for a language the settings do not put in use, returns `input-rejected`. No extractor substitutes a representation you did not choose. Settings that reach an extractor without passing through this binding are reported as `unsupported-syntax` rather than ignored. The chosen layout is carried but never steers extraction: the same sources yield the same evidence under either layout.

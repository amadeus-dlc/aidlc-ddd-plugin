# Operation-owned errors in the canonical model

English | [Japanese](domain-model-operation-errors.ja.md) | [User documentation](README.md)

`schema_version: 2` of `ddd-domain-model-yaml.md` closes each business error over the operation that declares it. A Command still owns its errors, and a FactoryRule — the `create`-style generation operation — now owns its own. This is the YAML data schema of the canonical model, and it is unrelated to the `schema_version` of `.ddd.toml`, which is a [project settings](project-settings.md) document with its own versioning.

Version 1 remains a valid format and is still what every production sensor reads. Nothing switches over on its own; see [what this format is for today](#what-this-format-is-for-today).

## What changes

Two keys, and nothing else. Element ids, references, condition texts and the language they are written in stay exactly as they were.

| Place | Version 1 | Version 2 |
|---|---|---|
| The owner a DomainError names | `command: command.invoice.issue` | `operation: command.invoice.issue` |
| A FactoryRule's error set | not part of the format | `domain_errors:` with at least one entry |

```yaml
schema_version: 2
bounded_contexts:
  - element_id: "bc.billing"
    name: "Billing"
    aggregates:
      - element_id: "aggregate.invoice"
        name: "Invoice"
        bounded_context: "bc.billing"
        root_element: "entity.invoice"
        states:
          - "draft"
          - "issued"
        elements:
          - element_id: "entity.invoice"
            kind: "entity"
            name: "Invoice"
            aggregate: "aggregate.invoice"
        commands:
          - element_id: "command.invoice.issue"
            name: "Issue"
            aggregate: "aggregate.invoice"
            effect: "transition"
            state_effect: "none"
            domain_errors:
              - element_id: "error.invoice.issue.already-issued"
                name: "AlreadyIssued"
                operation: "command.invoice.issue"
                condition: "The invoice is not in the draft state."
            idempotency:
              strategy: "none"
        factory_rules:
          - element_id: "factory.invoice.open"
            name: "Open"
            target_element: "entity.invoice"
            preconditions:
              - "invariant.invoice.total-positive"
            domain_errors:
              - element_id: "error.invoice.open.negative-amount"
                name: "NegativeAmount"
                operation: "factory.invoice.open"
                condition: "The requested amount is negative."
```

The two spellings never mix. Writing `operation` in a version 1 document, or `command` in a version 2 one, is rejected as an unknown key rather than read as the other format.

## What the loader checks

The element id grammar does not change. An error id is still `error.<aggregate>.<operation>.<name>`; the middle segment now names either a command or a factory rule.

| Check | Refusal |
|---|---|
| The declared `operation` is the containing operation | `schema.id-owner-mismatch` — naming another operation that exists is still a refusal, because resolving a reference and owning an error are separate questions |
| The error id's aggregate and operation segments match the operation containing it | `schema.id-owner-mismatch` |
| A factory rule's id carries its containing aggregate's name | `schema.id-owner-mismatch` |
| `operation` resolves to a current element of the right kind | `schema.ref-undefined`, `schema.ref-deprecated`, `schema.ref-kind` |
| No element id is declared twice, including across a command and a factory rule | `schema.id-duplicate` |
| Every FactoryRule declares at least one DomainError | `schema.factory-no-error` |

Two of these checks are new and also apply to version 1 documents, so a legacy model that used to load can now be refused with `schema.id-owner-mismatch`:

| Version 1 condition that is now refused | Repair |
|---|---|
| A DomainError's `command` key names an operation other than the command containing it | Change the key to name the containing command |
| A factory rule's id carries an aggregate name other than that of the aggregate containing it | Rename the id to `factory.<aggregate>.<operation>` using the containing aggregate's name |

Commands keep `schema.command-no-error`, and every other rule keeps its existing meaning.

## What this format is for today

The migrated document is read by the migration command on this page, by the reading entry point below, and by the [implementation mapping](implementation-mapping.md) loader and migration, which accept only this format. **The production sensors do not accept `schema_version: 2`.** Every path that loads the canonical model during a gate asks for version 1, and reports a load failure against a migrated document under its own rule:

| Path that loads the canonical model | Sensor | Load failure |
|---|---|---|
| Model completeness check | `ddd-model-completeness` | `model-completeness.schema` |
| Model presence check | `ddd-model-presence` | `model-presence.invalid` |
| Rule-evaluation context | `ddd-rust-domain`, `ddd-rust-use-case`, `ddd-rust-interface-adapter` | `model.invalid` |
| Domain package check | `ddd-rust-domain` | `domain-packaging.reference` |
| Declaration reader | `ddd-mapping-declarations` | `mapping-declarations.model` |
| Declaration reader | `ddd-reference-ids` | `reference-ids.model` |
| Declaration reader | `ddd-layer-structure` | `layer-structure.model` |

The generation instructions in `ddd-domain-modeling` still produce version 1.

Apply a migration only where you are prepared for those gates to report against the artifact, and keep the artifact your approval gates read on version 1 until a later release switches them over.

## Read a document in either format

The format is chosen by the caller, never guessed from the document — which is what keeps the production sensors on version 1 even when a version 2 document appears next to them.

```ts
import { loadDomainModel } from "/path/to/project/.codex/tools/ddd/lib/schema/loader.ts";

const legacy = loadDomainModel("/path/to/ddd-domain-model-yaml.md");
const migrated = loadDomainModel("/path/to/ddd-domain-model-yaml.md", 2);
```

For Claude Code, use `.claude/tools/`. Omitting the version reads version 1, so every existing caller keeps its behaviour. A document in the other format is refused with `schema.structure` rather than read.

On success the result carries the normalised model and the element index. Both formats normalise to the same shape: `DomainError.operation` holds the owner under either spelling, and `FactoryRule.domain_errors` is an empty list for a version 1 document.

## Preview and apply a migration

The command converts one `ddd-domain-model-yaml.md`. Without `--apply` it only reports; it writes nothing.

```sh
bun /path/to/project/.codex/tools/ddd-domain-model.ts migrate --model /path/to/ddd-domain-model-yaml.md
```

For Claude Code, use `.claude/tools/`. The command prints one JSON object whose `outcome` names the result, so you never have to read the exit status alone.

| `outcome` | Exit | Meaning |
|---|---|---|
| `candidate` | 0 | A preview that can be applied; `model` holds it |
| `missing-information` | 0 preview, 1 with `--apply` | `missing` lists the business definitions you still have to write |
| `already-migrated` | 0 | The document is already in this format; nothing is rewritten |
| `applied` | 0 | The YAML block was replaced with `model` |
| `rejected` | 1 | `findings` carry the loader's refusal |
| `write-failed` | 3 | Validation held but the file could not be written |
| `invalid-arguments` | 2 | `detail` repeats the usage |

Only the one registered artifact is accepted. A raw `.yaml` file is rejected: the reading entry point above accepts raw YAML, but that is a lower-level read, not a document this command rewrites.

## What a migration will not invent

Version 1 has no place to record a factory rule's business errors, so a model that declares any factory rule reports `missing-information` and writes nothing:

```json
{ "outcome": "missing-information", "missing": ["factory.invoice.open.domain_errors"] }
```

Write those errors yourself. The command never invents an error name, a condition or a generation operation to make a migration pass, and the applied document declares exactly the element ids the source declared.

Everything that can be carried over is carried over unchanged: element ids, every reference value, `name`, `condition`, `statement` and `rationale` texts, and the language they are written in. A condition recorded in Japanese stays in Japanese, and a condition whose text happens to spell `command:` is a business value, not a key — the conversion reads the structure rather than substituting text, so `transitions[].command` and a process manager's `steps[].command` and `compensations[].command` keep their key name too.

## What applying writes

Applying replaces the body of the one labelled YAML block and nothing else. The prose around it, the fence delimiters, any other fenced region, and every neighbouring file keep their bytes. Sibling artifacts — `ddd-domain-model.md`, `ddd-aggregate-mapping.md`, `.ddd.toml` — are never touched.

Applying re-reads and re-validates the document, so an earlier successful preview never authorises a later invalid one. Running the command again on an applied document reports `already-migrated` and leaves the bytes as they are. A write that fails reports `write-failed` and leaves the document as it was; the file is written in place, so do not run a migration while another process is writing the same file.

The rewritten block is generated from the normalised model, so its layout is the command's and not the original file's: every string is quoted, lists are written one entry per line, and an optional list the model leaves empty is omitted. `process_managers` under an aggregate is omitted as well, because the loader derives it from each process manager's aggregates. A list the loader requires is never omitted: it is written even when empty, so a process manager with no steps keeps `steps: []` and the applied document still reads back.

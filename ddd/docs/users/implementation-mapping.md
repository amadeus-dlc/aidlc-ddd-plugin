# Language-neutral implementation mapping

English | [Japanese](implementation-mapping.ja.md) | [User documentation](README.md)

`schema_version: 2` of `ddd-aggregate-mapping.md` records where the model is implemented without tying the record to one language. Business identity — model ids, business vocabulary, the execution model and the persistence method — stays at the top of every entry. Everything a language spells — the package, the module path, the type, the method and the error case — sits under `code`, together with the language it is written in. The same mapping also binds each command and factory rule to its method and each business error to its case.

Version 1, the Rust-only crate/module format, is still the one every production sensor reads. Nothing switches over automatically; see [what this format is for today](#what-this-format-is-for-today).

## What changes

| Subject | Version 1 | Version 2 |
|---|---|---|
| Package | `crate: billing-domain` | `code.package: billing-domain` with `code.language` |
| Module path | `module: crate::invoice::number` | `code.module: [invoice, number]`; the package root is `[]` |
| Aggregate type | not recorded | `code.type` |
| Ports and repository | `ports`, `repository` beside the business ids | `code.ports`, `code.repository` |
| Replay method | `{ method, event_ref }` | `{ event_ref, code: { method } }` |
| Command and factory rule | not recorded | `operations[]` with `operation_ref`, `code.method`, `code.error_type` |
| Business error | not recorded | `operations[].errors[]` with `error_ref` and `code.case` |
| Business vocabulary, execution model, persistence, reference ids | at the top of each entry | unchanged, at the top of each entry |

A module path is a list of segments, so no language's separator is built into the format. Rust segments keep their spelling, including a raw `r#type`; `r#type` and `type` name the same module.

## Rust and TypeScript examples

The canonical model must be in `schema_version: 2` (see [operation-owned errors](domain-model-operation-errors.md)), because only that format gives a factory rule its own business errors.

```yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: event-sourcing
    reference_ids: [entity.invoice]
    replay_methods:
      - event_ref: event.invoice.issued
        code: { method: apply_issued }
    code:
      language: rust
      package: billing-domain
      module: [invoice]
      type: Invoice
      ports: [InvoiceNumbering]
      repository: InvoiceRepository
    operations:
      - operation_ref: command.invoice.issue
        code: { method: issue, error_type: IssueInvoiceError }
        errors:
          - error_ref: error.invoice.issue.already-issued
            code: { case: AlreadyIssued }
      - operation_ref: factory.invoice.open
        code: { method: open, error_type: OpenInvoiceError }
        errors:
          - error_ref: error.invoice.open.negative-amount
            code: { case: NegativeAmount }
domain_packages:
  - term: Billing
    model_refs: [bc.billing]
    rationale: Owns the billing domain
    code: { language: rust, package: billing-domain, module: [] }
  - term: Invoice
    model_refs: [aggregate.invoice]
    rationale: Groups invoice state and operations
    code: { language: rust, package: billing-domain, module: [invoice] }
```

The TypeScript mapping of the same model differs only under `code`. Every business id, term and owner is the same:

```yaml
    replay_methods:
      - event_ref: event.invoice.issued
        code: { method: applyIssued }
    code:
      language: typescript
      package: "@acme/billing-domain"
      module: [invoice]
      type: Invoice
    operations:
      - operation_ref: command.invoice.issue
        code: { method: issue, error_type: IssueInvoiceError }
        errors:
          - error_ref: error.invoice.issue.already-issued
            code: { case: already-issued }
```

Ownership is read from the locations, so no extra key links an entry to its owner: an aggregate belongs to the package declared at its `code` location, a package's parent is the package one module segment up, an operation belongs to the aggregate it is listed under, and an error case to the operation it is listed under. Every aggregate names its own language, so one record can hold aggregates written in different languages; an aggregate and the package at its location must use the same language.

Every key listed in the examples is the whole key set. `replay_methods`, `code.ports` and `code.repository` may be left out; every other key is required, including `operations` and `errors`, and `reference_ids` and `model_refs` need at least one entry.

## Names each language accepts

| Name | Rust | TypeScript |
|---|---|---|
| `code.package` | `^[A-Za-z][A-Za-z0-9_-]*$` | an npm package name, optionally scoped: `^(?:@[a-z0-9][a-z0-9._~-]*/)?[a-z0-9][a-z0-9._~-]*$` |
| `code.module` segment | an identifier, optionally raw: `^(?:r#)?[A-Za-z_][A-Za-z0-9_]*$` | `^[A-Za-z_$][A-Za-z0-9_$-]*$` |
| `code.type`, `code.method`, `code.error_type` | `^[A-Za-z_][A-Za-z0-9_]*$` | `^[A-Za-z_$][A-Za-z0-9_$]*$` |
| `code.case` | a Rust identifier | any non-empty string |

A file name such as `invoice.rs` or `invoice.ts`, a source line, and a version such as `billing-domain@0.1.0` are not names and are refused. Method names share one namespace per Rust aggregate, so a command and a factory rule cannot both use `issue`; in TypeScript a factory rule is a static member and a command an instance member, so they may.

## What the loader refuses

The loader stops at the first stage that fails: the document, its version, its shape, the canonical model it names, and then the mapping against that model.

| Rule | Refused |
|---|---|
| `aggregate-mapping.document` | A path other than `<record>/inception/domain-design/ddd-aggregate-mapping.md`, a missing or unreadable file, no labelled YAML block, more than one, an unclosed block, YAML that does not parse, or a block that is not a mapping |
| `aggregate-mapping.version` | A `schema_version` other than the number `2`. A version 1 document is not read as this format; the finding points to the migration |
| `aggregate-mapping.unknown-key` | Any key outside the format: a `crate` or `module` beside the business ids, a compiler symbol or package id, a file, line or span, an export list |
| `aggregate-mapping.structure` | A missing or mistyped value, an unsupported language, a blank term or rationale, an empty `reference_ids` or `model_refs`, a programming model other than `actor`/`class`, a persistence method other than `state-sourcing`/`event-sourcing`, or a name the language does not accept |
| `aggregate-mapping.model` | A `model_ref` that does not load as a `schema_version: 2` canonical model, including a model still in version 1 |
| `aggregate-mapping.reference` | An `aggregate_ref`, `model_refs` entry, `reference_ids` entry, `event_ref`, `operation_ref` or `error_ref` that is undefined, retired, of the wrong kind, or not a model id — such as `src/invoice.rs:12` |
| `aggregate-mapping.owner-mismatch` | An operation of another aggregate, or an error that another operation declares, even though its id resolves |
| `aggregate-mapping.duplicate` | Two packages at one location, one aggregate mapped twice, two aggregates on one type, one operation or error mapped twice, two operations on one method, or two errors on one case |
| `aggregate-mapping.coverage` | A package in use without a root package, a package whose parent is not declared, an aggregate whose location has no package, a model aggregate without a mapping, an aggregate without `code.type`, and a command, factory rule or business error of the model without a mapping |
| `aggregate-mapping.technical-name` | A package or module segment named after a technical classification (`aggregate`, `impl`, `vo`, `entities`, `value_objects` and the rest of the [reserved names](domain-packaging-design.md#automated-technical-name-checks)), and a package named only `domain` |

Reserved names are matched against whole words: a Rust package name is split at `-` and `_`, a TypeScript package name drops its scope and is split at `-`, `_` and `.`, and a TypeScript module segment is compared with `-` read as `_`. `value-objects`, `ValueObjects` and `@acme/value-objects-domain` are refused; `identity` and `invoice-entities` are not. The meaning of a business term remains a review.

The loader checks the mapping against the canonical model only. Whether the named package, type, method and case exist in the source is a later inspection's job.

## What this format is for today

The migrated document is read by the reading entry point and the migration command on this page. **The production sensors do not accept `schema_version: 2` of the mapping.** Every path that reads the mapping during a gate asks for version 1, and treats a migrated mapping as unreadable:

| Path that reads the mapping | Sensor | Against a migrated mapping |
|---|---|---|
| Declaration reader at domain-design | `ddd-mapping-declarations` | `mapping-declarations.document` |
| Declaration reader at domain-design | `ddd-reference-ids` | `reference-ids.document` |
| Process Manager requirement at functional-design | `ddd-mapping-declarations` | Not evaluated; the verdict notes that the mapping is absent |
| Restoration path check | `ddd-layer-structure` | No aggregate crates are read, so every aggregate of the context is checked |
| Domain package check | `ddd-rust-domain` | `domain-packaging.declaration` |
| Replay method matching in the rule-evaluation context | `ddd-rust-domain`, `ddd-rust-use-case`, `ddd-rust-interface-adapter` | Disabled, with the note `replay.disabled: aggregate mapping is invalid` |

The generation instructions in `domain-design` still produce version 1. This format also needs the canonical model in version 2, which the production sensors do not accept either. Apply a migration only where you are prepared for those gates to report against the artifacts, and keep the artifacts your approval gates read on version 1 until a later release switches them over.

## Read a mapping

```ts
import { loadAggregateMapping, packageAt } from "/path/to/project/.codex/tools/ddd/lib/aggregate-mapping/index.ts";

const loaded = loadAggregateMapping("/path/to/record/inception/domain-design/ddd-aggregate-mapping.md");
if (loaded.ok) {
  const invoice = loaded.mapping.aggregate_mappings[0];
  const owner = packageAt(loaded.mapping, invoice.code);
}
```

For Claude Code, use `.claude/tools/`. On success the result carries the normalised mapping and the element index of the canonical model; otherwise it carries the findings. The normalised mapping always has `replay_methods` and `code.ports`, empty when the document leaves them out. `parentLocation(location)` returns the location one module segment up, or `undefined` for a package root.

## Preview and apply a migration

Migrate the canonical model first with `ddd-domain-model.ts migrate`; a legacy mapping whose model is still in version 1 is refused with `aggregate-mapping.model`.

```sh
bun /path/to/project/.codex/tools/ddd-aggregate-mapping.ts migrate \
  --mapping /path/to/record/inception/domain-design/ddd-aggregate-mapping.md \
  --supplement /path/to/mapping-supplement.yaml
```

For Claude Code, use `.claude/tools/`. Without `--apply` the command only reports; add `--apply` to rewrite the document. It prints one JSON object whose `outcome` names the result, so you never have to read the exit status alone.

| `outcome` | Exit | Meaning |
|---|---|---|
| `candidate` | 0 | A preview that can be applied; `mapping` holds it |
| `missing-information` | 0 preview, 1 with `--apply` | `missing` lists the names you still have to supply |
| `already-migrated` | 0 | The document is already in this format and loads; nothing is rewritten, and no supplement is read |
| `applied` | 0 | The YAML block was replaced with `mapping` |
| `rejected` | 1 | `findings` carry the refusal; a defect is reported ahead of anything still missing |
| `write-failed` | 3 | Validation held but the file could not be written |
| `invalid-arguments` | 2 | `detail` repeats the usage |

Only the registered artifact inside an intent record is accepted. The record is the directory that contains `inception/domain-design/ddd-aggregate-mapping.md`, and `model_ref` resolves against it.

### Supply what version 1 cannot say

Version 1 has no place for type names, operation mappings or error cases, and the migration never derives them from the model's names or ids. Without a supplement it lists them all:

```json
{
  "outcome": "missing-information",
  "missing": [
    "aggregate_mappings[aggregate.invoice].code.type",
    "aggregate_mappings[aggregate.invoice].operations[command.invoice.issue]",
    "aggregate_mappings[aggregate.invoice].operations[factory.invoice.open]"
  ]
}
```

Entries follow the document's aggregate order and, within an aggregate, the model's order: the type, then each command and factory rule, and for an operation that is mapped, each of its errors still missing (`...operations[<operation>].errors[<error>]`).

Write the names in a YAML file and pass it with `--supplement`:

```yaml
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    code: { type: Invoice }
    operations:
      - operation_ref: command.invoice.issue
        code: { method: issue, error_type: IssueInvoiceError }
        errors:
          - error_ref: error.invoice.issue.already-issued
            code: { case: AlreadyIssued }
```

The file is plain YAML, not Markdown. Its root must be a mapping (otherwise `aggregate-mapping.document`) whose only key is `aggregate_mappings`. Each row names an aggregate the legacy document maps, at most once, and may carry only `aggregate_ref`, `code.type` and `operations` in the version 2 shape; names are checked in the aggregate's language. Anything else — a programming model, a package, a module — is refused with `aggregate-mapping.unknown-key`, so a supplement adds to the legacy document and never overwrites it. A missing or unparsable file is refused with `aggregate-mapping.document`, and every finding about the supplement's own content names the supplement file.

## What a migration will not invent

The command never writes a type, method, error type or case that you did not supply, and never turns a command id or a model name into one. Everything the legacy document states is carried over unchanged: aggregate and reference ids, the programming model, the persistence method, ports, the repository, replay methods, and each package's term, model references and rationale, in the language they are written in. A term that happens to spell `crate::invoice` is a business value, not a key — the conversion reads the structure rather than substituting text.

A crate becomes `code.package` and a module path loses only its `::` separators and a leading `crate`: `crate` becomes `[]`, `crate::invoice` becomes `[invoice]`, `invoice::number` becomes `[invoice, number]`, and `r#type` stays `[r#type]`. A module that is not a Rust path — `invoice/number`, `::invoice`, `invoice::` or an empty string — is refused. So is anything the production reader would silently coerce or drop: a key it ignores, `ports` written as one string, a non-string reference id, repository or term, and a document without `domain_packages`.

## What applying writes

Applying replaces the body of the one labelled YAML block and nothing else. The prose around it, the fence delimiters, any other fenced region, and every neighbouring file keep their bytes. The canonical model, the review documents, notes and `.ddd.toml` are never touched.

Applying re-reads and re-validates both files, so an earlier successful preview never authorises a later change. Running the command again on an applied document reports `already-migrated` and leaves the bytes as they are. A write that fails reports `write-failed` and leaves the document as it was: the new document is written to an entry of the command's own beside it and renamed over it, so the registered path holds either the bytes it had or the whole new document, never a half-written one, and a failure leaves no entry of its own behind. A mapping document that is a symbolic link is refused with `write-failed`, so the link and the file it names keep their bytes; replace it with a regular file first. Applying rebuilds the whole document from what it read, so do not run a migration while another process is writing the same file — the other process's change would be lost.

The rewritten block is generated from the normalised mapping: every string is quoted, lists are written one entry per line, `code.module`, `operations`, `errors`, `aggregate_mappings` and `domain_packages` are written even when empty, and empty `ports`, empty `replay_methods` and an absent `repository` are omitted.

## No export table

The mapping names what the canonical model needs — packages, aggregate types, operations and error cases — and nothing more. It does not list every export of a package, and it has no key for one: a second hand-maintained copy of the public API would drift from the code. Checking the real public surface belongs to source inspection.

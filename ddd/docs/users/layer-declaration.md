# Language-neutral layer declaration

English | [Japanese](layer-declaration.ja.md) | [User documentation](README.md)

`schema_version: 2` of the `## DDD Layer Structure` section of `cicd-pipeline.md` records a bounded context's dependency regime without tying it to one language. Which side of CQRS a package is on, which package depends on which, the ports the context talks through, the repositories its aggregates are restored from and the backend behind them are business facts and stay as they are. The only thing a language spells is the identity of a package, and a package is the language that spells it together with its name.

Every gate reads this format. Version 1, the Rust-only crate format, is a format a record has to be migrated from: see [what the gates do with each format](#what-the-gates-do-with-each-format).

## What changes

| Subject | Version 1 | Version 2 |
|---|---|---|
| Command side | `command_side_crates: [billing-domain]` | `packages[]` with `role: command` |
| Query side | `query_side_crates: [billing-query]` | `packages[]` with `role: query` |
| Read-model updater | `rmu_crates: [billing-rmu]` | `packages[]` with `role: rmu` |
| Package | a crate name inside those lists | `code: { language, package }` |
| Dependencies | `crate_dependencies[] { crate, depends_on: [crate] }` | `dependencies[] { code, depends_on: [code] }` |
| Context, cqrs, ports, repositories, restoration paths, persistence backend | as declared | unchanged, as declared |

A package is never named on its own: `billing-domain` in Rust and `billing-domain` in TypeScript are two packages, and a `packages` entry or a dependency target written as a bare name is refused.

## Rust and TypeScript examples

The canonical model must be in `schema_version: 2` (see [operation-owned errors](domain-model-operation-errors.md)).

```yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
layer_structures:
  - context_ref: bc.billing
    cqrs: true
    packages:
      - role: command
        code: { language: rust, package: billing-domain }
      - role: query
        code: { language: rust, package: billing-query }
      - role: rmu
        code: { language: rust, package: billing-rmu }
    dependencies:
      - code: { language: rust, package: billing-domain }
        depends_on: []
      - code: { language: rust, package: billing-query }
        depends_on: []
      - code: { language: rust, package: billing-rmu }
        depends_on:
          - { language: rust, package: billing-domain }
          - { language: rust, package: billing-query }
    ports:
      - { name: InvoiceNumbering, kind: external-client, verbs: [next_number] }
    repositories:
      - name: InvoiceRepository
        aggregate_ref: aggregate.invoice
        io_unit: single
        verbs: [find_by_id, store, delete_by_id]
        store_semantics: upsert
    restoration_paths:
      - { aggregate_ref: aggregate.invoice, via: full-constructor }
    persistence_backend: postgres
```

The TypeScript declaration of the same context differs only in how the packages are spelled. Every business value — the context, the sides, the edges, the ports, the repositories, the restoration paths and the backend — is the same:

```yaml
    packages:
      - role: command
        code: { language: typescript, package: "@acme/billing-domain" }
      - role: query
        code: { language: typescript, package: "@acme/billing-query" }
```

Every key listed here is the whole key set. Only `restoration_paths[].note` may be left out; every other key is required, and a list the context has nothing to put in is written as `[]` rather than omitted.

| Key | Values |
|---|---|
| `packages[].role` | `command`, `query`, `rmu` |
| `code.language` | `rust`, `typescript` |
| `ports[].kind` | `repository`, `external-client`, `es-infrastructure` |
| `repositories[].io_unit` | `single`, `collection`, `partial` |
| `repositories[].store_semantics` | `upsert`, `insert-only`, `unknown` |
| `restoration_paths[].via` | `full-constructor`, `other` |

`code.package` is checked against the grammar of its language: `^[A-Za-z][A-Za-z0-9_-]*$` for Rust, and an npm package name, optionally scoped, for TypeScript. A version such as `billing-domain@0.1.0` is not a package name and is refused.

## What the loader refuses

The loader stops at the first stage that fails: the document, its version, its shape, the canonical model it names, the declaration against that model, and then whether the declaration states everything the format requires.

| Rule | Refused |
|---|---|
| `layer-declaration.document` | A path other than `<record>/construction/[<unit>/]infrastructure-design/cicd-pipeline.md`, a missing or unreadable file, no `## DDD Layer Structure` section or more than one — English and Japanese markers count together — no labelled YAML block inside that section, more than one, an unclosed block, YAML that does not parse, or a block that is not a mapping |
| `layer-declaration.version` | A `schema_version` other than the number `2`. A version 1 document is not read as this format; the finding points to the migration |
| `layer-declaration.unknown-key` | Any key outside the format, including `command_side_crates`, `query_side_crates`, `rmu_crates`, `crate_dependencies`, a `crate` beside a package's role, and a module path or version inside a package identity |
| `layer-declaration.structure` | A missing or mistyped value, a `cqrs` flag that is not a boolean, a role, port kind, io unit, store semantics or restoration route outside its set, a package identity written as a bare name or without its language, a name the language does not accept, and a value the document does not state at all |
| `layer-declaration.model` | A `model_ref` that does not load as a `schema_version: 2` canonical model, including a model still in version 1 |
| `layer-declaration.reference` | A `context_ref` that does not name a bounded context, or a repository's or restoration path's `aggregate_ref` that does not name an aggregate — undefined, retired by the lineage, of the wrong kind, or not a model id at all |
| `layer-declaration.duplicate` | Two structures for one context, one package identity declared twice, two dependency rows for one package, one package named twice inside one row, two ports under one name, two repositories under one name, or two restoration paths for one aggregate |
| `layer-declaration.coverage` | A dependency row for a package this context never declares. A row may depend on a package outside the context: that edge is kept as written, and `layer-declaration.query-domain-dependency` still judges it by the package's name |

A list is empty only when the document says so: `verbs: []` states an empty list, while leaving `verbs` out states nothing and is refused.

## Inspect the layering

Reading a declaration and judging its layering are separate entry points, so a declaration a migration has just produced can be read before anyone has judged it, and a team reviewing the layering does not need the document reread. The inspection returns findings and nothing else.

| Rule | Reported |
|---|---|
| `layer-declaration.required-items` | At least one of the context's dependencies, ports, repositories and restoration paths is empty |
| `layer-declaration.dependency-row` | A declared package has no dependency row |
| `layer-declaration.cqrs-sides` | The context is `cqrs: true` but declares no `role: query` package |
| `layer-declaration.side-dependency` | A command-side package depends on a query-side one, or the other way round |
| `layer-declaration.query-domain-dependency` | A query-side package depends on a package whose name carries the domain layer marker — a trailing `-domain` or `_domain`, read after a TypeScript scope is set aside, so `@acme/shared-domain` counts and `@acme/shared-read-models` does not |
| `layer-declaration.restoration-path` | An aggregate of the context has no `full-constructor` restoration path |

A `role: rmu` package is the one package meant to see both sides, so neither `layer-declaration.side-dependency` nor `layer-declaration.query-domain-dependency` is applied to its dependency rows. The other four rules apply to it like any other package. The repository naming rules (`layer-structure.m-name`, `layer-structure.m-media`) are not carried over and no longer exist on the gate: they are a spelling convention of one language, and a repository in this format has no language. Repository naming in Rust source is still checked, by the `m` rule of `ddd-rust-interface-adapter`.

## What the gates do with each format

Both gates that read the declaration read `schema_version: 2`, and a document still in version 1 is refused rather than read as the format it is not:

| Gate | Reads | Against a version 1 declaration |
|---|---|---|
| `ddd-layer-structure` | The declaration and the layer rules above | `layer-structure.item`, with the reader's rule id at the front of the message |
| `ddd-design-advisories` | The same declaration, for its advisories | `design-advisories.document` |

`ddd-layer-structure` transcribes each layer rule onto the rule id the approval contract declares: `required-items` as `layer-structure.item`, `dependency-row` as `layer-structure.dependencies-incomplete`, `cqrs-sides` as `layer-structure.cqrs-sides`, `side-dependency` as `layer-structure.k`, `query-domain-dependency` as `layer-structure.l` and `restoration-path` as `layer-structure.n`. A canonical model that did not load is `layer-structure.model`.

The stage writes this declaration below a Unit when the delivery plan produced Units, and straight under the stage when it did not; both are registered locations and both are read. A `cicd-pipeline.md` anywhere else is not a declaration.

This format needs the canonical model in version 2, and every gate reads that version too. Convert the whole record in one step with [`ddd-artifact-set migrate`](artifact-migration.md), which converts the settings, the model, the mapping and every layer declaration of the record together and checks them against each other before writing anything.

## Read and inspect a declaration

```ts
import {
  inspectLayerDeclaration,
  loadLayerDeclaration,
} from "/path/to/project/.codex/tools/ddd/lib/layer-declaration/index.ts";

const path = "/path/to/record/construction/u1/infrastructure-design/cicd-pipeline.md";
const loaded = loadLayerDeclaration(path);
if (loaded.ok) {
  const findings = inspectLayerDeclaration(loaded.declaration, loaded.model, path);
}
```

For Claude Code, use `.claude/tools/`. On success the result carries the normalised declaration, the canonical model and its element index; otherwise it carries the findings.

## Preview and apply a migration

Migrate the canonical model first with `ddd-domain-model.ts migrate`; a crate-fixed declaration whose model is still in version 1 is refused with `layer-declaration.model`.

```sh
bun /path/to/project/.codex/tools/ddd-layer-declaration.ts migrate \
  --declaration /path/to/record/construction/u1/infrastructure-design/cicd-pipeline.md
```

For Claude Code, use `.claude/tools/`. Without `--apply` the command only reports; add `--apply` to rewrite the block. It prints one JSON object whose `outcome` names the result, so you never have to read the exit status alone.

| `outcome` | Exit | Meaning |
|---|---|---|
| `candidate` | 0 | A preview that can be applied; `declaration` holds it |
| `missing-information` | 0 preview, 1 with `--apply` | `missing` lists the values you still have to state |
| `already-migrated` | 0 | The document is already in this format and loads; nothing is rewritten |
| `applied` | 0 | The YAML block was replaced with `declaration` |
| `rejected` | 1 | `findings` carry the refusal; a defect is reported ahead of anything still missing |
| `write-failed` | 3 | Validation held but the file could not be written |
| `invalid-arguments` | 2 | An unknown command or option, a missing value, or `--declaration` given more than once; `detail` repeats the usage |

Only the registered artifact inside an intent record is accepted. The record is the directory that contains `construction/[<unit>/]infrastructure-design/cicd-pipeline.md` — below a Unit, or straight under the stage when the delivery plan produced no Units — and `model_ref` resolves against it. A `functional-spec.md` and a copy of the pipeline document kept anywhere else are refused with `layer-declaration.document` and left as they are.

### State what version 1 supplied on its own

The crate-fixed reader fills in `false` for an absent `cqrs`, `""` for an absent port kind, `"unknown"` for absent store semantics and `[]` for absent verbs. The migration does not: where the document says nothing, it says so.

```json
{
  "outcome": "missing-information",
  "missing": [
    "layer_structures[bc.billing].cqrs",
    "layer_structures[bc.billing].ports[InvoiceNumbering].kind",
    "layer_structures[bc.billing].ports[InvoiceNumbering].verbs",
    "layer_structures[bc.billing].repositories[InvoiceRepository].io_unit",
    "layer_structures[bc.billing].repositories[InvoiceRepository].verbs",
    "layer_structures[bc.billing].repositories[InvoiceRepository].store_semantics",
    "layer_structures[bc.billing].restoration_paths[aggregate.invoice].via"
  ]
}
```

Entries follow the document's structure order and, within a structure, the order above. Write the missing values into the same version 1 block — every one of them is a key that format already has — and run the migration again.

## What a migration will not invent

The command never writes a flag, a port kind, an io unit, a store semantics or a restoration route you did not state. Everything the crate-fixed declaration states is carried over unchanged: the context reference, the crate names, the dependency edges, the port and repository names, the aggregate references, the restoration notes and the persistence backend, in the language they are written in. A `persistence_backend` whose own wording spells `crate: billing-domain` is a business value, not a key — the conversion reads the structure rather than substituting text, so the prose around the block and the legacy spellings inside other sections are never reached.

Anything the production reader would silently coerce or drop is refused instead: a key it ignores, a crate list written as one string, a `cqrs` flag written as `"true"`, a non-string crate name or dependency target, `verbs` written as one string, and non-string store semantics.

## What applying writes

Applying replaces the body of the one labelled YAML block below the section marker and nothing else. The pipeline prose, the CI configuration fence in the build section, the fence delimiters, the section marker in either language, and every neighbouring file keep their bytes. `.github/workflows/ci.yml`, the canonical model, `functional-spec.md`, the infrastructure specification, notes and `.ddd.toml` are never touched.

Applying re-reads and re-validates the document, so an earlier successful preview never authorises a later change. Running the command again on an applied document reports `already-migrated` and leaves the bytes as they are. A write that fails reports `write-failed` and leaves the document as it was: the new document is written to an entry of the command's own beside it and renamed over it, so the registered path holds either the bytes it had or the whole new document, never a half-written one, and a failure leaves no entry of its own behind. A declaration document that is a symbolic link is refused with `write-failed`, so the link and the file it names keep their bytes; replace it with a regular file first. A directory between the record and the document, such as `infrastructure-design`, that is a symbolic link is refused with `write-failed` too, and the file it leads to keeps its bytes; replace it with a regular directory first. Applying rebuilds the whole block from what it read, so do not run a migration while another process is writing the same file — the other process's change would be lost.

## The use-case declaration is already language-neutral

The `## DDD Use-case Declarations` section of `functional-spec.md` records use case ids, names, target aggregates, commands, the re-execution basis, the recovery policy, the multi-aggregate strategy and the read-model exposure. None of those is a name a language spells, so there is no format version to convert it to and no renaming to do. It reads through the same shared path — one labelled YAML block below its section marker, `model_ref` resolved against the record, references resolved through the canonical model's element index — and this change leaves it, and the gates that read it, exactly as they were.

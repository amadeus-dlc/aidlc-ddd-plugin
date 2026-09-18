# Migrate a project's DDD artifact set

English | [Japanese](artifact-migration.ja.md) | [User documentation](README.md)

`ddd-artifact-set migrate` converts one project's DDD artifacts in a single explicit step: the project settings, and the canonical model, the implementation mapping and every layer declaration of one intent record. Each of those artifacts also has a command of its own, but they cannot check each other: the mapping and the declarations are read against the canonical model, and while that model is still in the format it has to be migrated from, converting them one at a time means converting them against a model that is about to change. This command assesses the whole set against the model it is about to write, and writes nothing until every part of it is ready.

## What the set holds

| Artifact | Where | Reference |
|---|---|---|
| Project settings | `<project>/.ddd.toml` | [Project settings](project-settings.md) |
| Canonical model | `<record>/inception/ddd-domain-modeling/ddd-domain-model-yaml.md` | [Operation-owned errors](domain-model-operation-errors.md) |
| Implementation mapping | `<record>/inception/domain-design/ddd-aggregate-mapping.md` | [Implementation mapping](implementation-mapping.md) |
| Layer declarations | The `## DDD Layer Structure` section of every `<record>/construction/[<unit>/]infrastructure-design/cicd-pipeline.md` | [Layer declaration](layer-declaration.md) |

A record without a mapping is converted without one; the command never creates an artifact the record does not hold. A record may hold one layer declaration per Unit, or one straight under the stage when the delivery plan produced no Units; both are registered locations and both are converted.

## Run it

```sh
bun <project>/<harness-dir>/tools/ddd-artifact-set.ts migrate \
  --project <project root> \
  --record <intent record> \
  --supplement <mapping supplement YAML> \
  [--apply]
```

Without `--apply` nothing is written: the command reports what it would convert. `--record` has to name a directory that holds `aidlc-state.md` and sits inside `--project`; the settings the command converts belong to that project.

`--supplement` names the file that supplies what the crate/module mapping format has no place for — each aggregate's type name, and each command and factory rule's method, error type and error cases. The shape is described under [migrate a crate/module mapping](implementation-mapping.md). A mapping already in the current format needs no supplement, so the option may be left off once the mapping is converted.

## What the report says

The command writes one JSON report to standard output.

| Field | Meaning |
|---|---|
| `outcome` | The outcome of the whole set |
| `artifacts[]` | One entry per artifact: `artifact`, `path`, `outcome`, and whatever that outcome carries |
| `findings` | Present only when the request itself was refused, before any artifact was read |

The outcome of the set is chosen from the outcomes of its artifacts by one rule: a refusal outranks information still to supply, which outranks having something to convert, which outranks having nothing left to do. An artifact that is not there decides nothing.

| `outcome` | Exit status | Meaning |
|---|---|---|
| `candidate` | 0 | Every artifact can be converted; nothing was written because `--apply` was not given |
| `applied` | 0 | Every artifact that had something to convert was converted |
| `already-migrated` | 0 | Nothing is left to convert |
| `missing-information` | 0 without `--apply`, 1 with it | Something the current format requires is not stated yet; nothing was written |
| `rejected` | 1 | Something was refused; nothing was written |
| `write-failed` | 3 | A write failed partway; see below |
| `invalid-arguments` | 2 | The command line was refused; nothing was read or written |

A per-artifact outcome is one of `absent`, `candidate`, `already-migrated`, `applied`, `missing-information`, `rejected` or `write-failed`.

## What is checked before anything is written

The whole set is assessed first, and the mapping and the declarations are checked against the canonical model this run is about to write rather than the one still on disk. So a reference one artifact makes to an element another does not define is reported now, instead of surviving into a half-converted record.

A model whose factory rules have no business errors to record is still the model the other artifacts name: it reports what is missing while the mapping and the declarations are checked against it as the format it is in states it. They are separate artifacts with separate outcomes, and the set's own outcome is the one rule above applied to all of them.

Expect two rounds in that case. The run that reports the model's missing business errors checks the mapping against the model without them, so the mapping can report `candidate`; once those errors are supplied and the set is run again, the mapping is checked against them and may then report, as `missing-information` of its own, the error cases it does not yet map. A mapping that was ready in the first round is therefore not guaranteed to stay ready in the second — that is the model gaining operations to map, not the mapping changing underneath you.

When any artifact is refused or still incomplete, no file changes — not the ones that were ready either.

## When a write fails partway

A write that fails is not reported as success, and it is not rolled back: unwinding can fail in turn and would leave a state nobody can name. The report says exactly where the run stopped:

| Field | Meaning |
|---|---|
| `written` | The artifacts written before the failure |
| `failed` | The artifact whose write failed, with the `detail` of why |
| `pending` | The artifacts still to convert, in the order they would have been written |
| `rerun` | What to resolve, and what a re-run then does |

Resolve what stopped the write and run the same command again. The artifacts already written read as `already-migrated`, and the rest are converted, so the set finishes on the same record.

The set is written in one order: the canonical model, then the mapping that names it, then the layer declarations by path, and the project settings last, because they are the one document that configures the project as a whole.

## What the migration keeps

The conversion is structural, never textual. Business ids, references, business wording and the language it was written in come through unchanged, including a value whose own wording happens to spell a key of the older format. Outside the one labelled YAML block of each artifact nothing changes: the prose, the section markers, the fence delimiters and every other fenced block keep their bytes, so a CI configuration that sits beside a declaration is left alone.

Running the command again over a converted set reports `already-migrated` and changes no byte.

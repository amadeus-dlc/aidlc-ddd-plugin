---
target: infrastructure-design
plugin: ddd
adds:
  consumes:
    - artifact: ddd-aggregate-mapping
      required: false
  sensors:
    - ddd-layer-structure
    - ddd-design-advisories
fragments:
  - anchor: after-step:2
    order: 100
  - anchor: after-step:5
    order: 100
---

## fragment: after-step:2

### Step 2x (ddd): Ask the layer structure and persistence

Add these question topics, and follow the conventions while designing:

- **Layer structure.** Which packages form the command side, the query side and
  the RMUs, and which package depends on which. A package is named by the
  language that spells it together with its name: `language: rust` for a Cargo
  crate and `language: typescript` for a TypeScript package with its
  `package.json`. The allowed directions are fixed by the layer rules; the
  command and query sides must not depend on each other.
- **Port conventions.** Classify each port as `repository`, `external-client`
  or `es-infrastructure` and name its verbs (`find_by_id`, `store`,
  `delete_by_id` for repositories).
- **Persistence.** The backend, the aggregate-to-store mapping, and how a
  repository's `store` behaves, which follows the `persistence_method` of the
  aggregate in `ddd-aggregate-mapping`: a `state-sourcing` aggregate is saved
  with `store` as an `upsert` that checks the expected version it was read at;
  an `event-sourcing` aggregate appends its events with `store` as
  `insert-only`. When a command raises several events, check the expected
  version once and save them in one append.
- **RMU.** Each read-model updater bridges the command side to the query side;
  it may depend on both. State the unit it keeps events in order for as
  `ordering_scope` (`aggregate`, `item` or `none`) and how it drops an event it
  has already applied as `dedup` (`version-check`, `event-id` or
  `idempotent-write`) on its `rmu` package. Only an `rmu` package states them;
  one that states neither is still accepted and its ordering is left to review.
  Describe delay, gaps and reordering in the artifact's prose, where the review
  judges them.
- **Restoration.** For every Aggregate in the context, the path that rebuilds it
  through its full constructor.

## fragment: after-step:5

### Step 5x (ddd): Write the layer structure

Add exactly one `## DDD Layer Structure` section to the existing required review artifact `cicd-pipeline.md`. In one labelled YAML block, declare the boundaries of components that the pipeline verifies and distributes. Do not generate a separate declaration file. Inherit the artifact's Unit kinds (service / ui / packaging / library); spec does not require it. If this Unit has no domain layer structure, declare `layer_structures: []` and explain why. Artifact prose follows the project's output-language policy; the section heading is a parser marker.

```yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
layer_structures:
  - context_ref: bc.billing
    cqrs: true
    packages:
      - { role: command, code: { language: rust, package: billing-domain } }
      - { role: query, code: { language: rust, package: billing-query } }
      - { role: rmu, code: { language: rust, package: billing-rmu }, ordering_scope: aggregate, dedup: version-check }
    dependencies:
      - { code: { language: rust, package: billing-domain }, depends_on: [] }
      - { code: { language: rust, package: billing-query }, depends_on: [] }
      - code: { language: rust, package: billing-rmu }
        depends_on:
          - { language: rust, package: billing-domain }
          - { language: rust, package: billing-query }
    ports:
      - { name: InvoiceRepository, kind: repository, verbs: [find_by_id, store, delete_by_id] }
    repositories:
      - { name: InvoiceRepository, aggregate_ref: aggregate.invoice, io_unit: single, verbs: [find_by_id, store, delete_by_id], store_semantics: insert-only }
    restoration_paths:
      - { aggregate_ref: aggregate.invoice, via: full-constructor }
    persistence_backend: <the store behind the repositories>
```

The values above are shapes, not content: replace every id and package with the
ones this context actually uses. `role` is `command`, `query` or `rmu`; `kind`
is `repository`, `external-client` or `es-infrastructure`; `io_unit` is
`single`, `collection` or `partial`; `store_semantics` is `upsert`,
`insert-only` or `unknown`; `via` is `full-constructor` or `other`. On an `rmu`
package only, `ordering_scope` is `aggregate`, `item` or `none` and `dedup` is
`version-check`, `event-id` or `idempotent-write`; each may be omitted.

Every package listed under `packages` needs a `dependencies` row, and every
Aggregate in the context needs a `full-constructor` restoration path.

**Standalone completion check.** Before reporting a standalone completion of `infrastructure-design`, run each command below against this attempt's artifact, replacing the path placeholder with the actual path:

- `aidlc engine sensor fire ddd-layer-structure --stage infrastructure-design --output-path <path-to-this-attempt's-cicd-pipeline.md>` (blocking)
- `aidlc engine sensor fire ddd-design-advisories --stage infrastructure-design --output-path <path-to-this-attempt's-cicd-pipeline.md>` (advisory)

A blocking sensor passes only when the command exits 0 and its final JSON line is `result: passed` with no `note`; a non-zero exit (a missing artifact exits non-zero), `result: failed`, or a `note` is a failure: fix the artifact and rerun. The advisory `ddd-design-advisories` never blocks completion: read its findings and address or explain each one. AI-DLC 2.9.0 `report --single` does not check this stage's artifacts or run its gate sensors, so do not skip this check.

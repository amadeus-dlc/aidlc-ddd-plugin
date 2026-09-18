---
target: domain-design
plugin: ddd
adds:
  consumes:
    - artifact: ddd-domain-model-yaml
      required: true
  produces:
    - ddd-aggregate-mapping
  sensors:
    - ddd-model-presence
    - ddd-reference-ids
    - ddd-mapping-declarations
fragments:
  - anchor: after-step:2
    order: 100
  - anchor: after-step:4
    order: 100
---

## fragment: after-step:2

### Step 2x (ddd): Ask the mapping axes and targets

Add these question topics to this stage's question file:

- **Packaging by business vocabulary.** Read the shared `ddd-domain-packaging.md` knowledge and establish a business term, related model IDs, and placement rationale for each domain package and internal module. Do not create technical classifications such as `aggregate/`, `impl/`, `vo/`, or `entities/`. Record the package root and every hierarchy level in `domain_packages`. Clarify missing vocabulary; do not invent aggregates solely to justify a package.
- **Two axes per Aggregate.** For every `aggregate.*` in the canonical model ask
  for its `programming_model` (`actor` or `class`) and its `persistence_method`
  (`state-sourcing` or `event-sourcing`). Actor-modelled aggregates later
  require a Process Manager for multi-aggregate use cases.
- **Mapping target.** For every Aggregate ask where its implementation lives —
  the `package`, the `module` path below that package root, the `type` that
  implements it, its `ports` and its `repository` — and the `reference_ids` (the
  model elements the mapping touches: entity / vo / primitive / invariant /
  command) it must cite. Rust is the only language generated and inspected
  today, so every `code` entry states `language: rust`.
- **Operations and business errors.** For every Command and Factory Rule of the
  Aggregate ask for the `method` that performs it, the `error_type` it returns,
  and the case name each of the model's business errors is spelled as. The
  mapping covers every operation and every error the canonical model declares.
- **Replay declarations.** For event-sourced aggregates, record each input event
  reference ID in `replay_methods` together with the method that applies it. Use
  an empty list if replay is not used.

Do not re-define entities, aggregates or invariants — reference them by ID.

## fragment: after-step:4

### Step 4x (ddd): Write the aggregate mapping

Write `ddd-aggregate-mapping` (logical name) to this stage's engine-resolved
record dir. The first fenced ```yaml block is canonical:

```yaml
schema_version: 2
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: event-sourcing
    reference_ids: [entity.invoice, invariant.invoice.total-positive]
    replay_methods:
      - { event_ref: event.invoice.issued, code: { method: apply_issued } }
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
          - { error_ref: error.invoice.issue.already-issued, code: { case: AlreadyIssued } }
      - operation_ref: factory.invoice.open
        code: { method: open, error_type: OpenInvoiceError }
        errors:
          - { error_ref: error.invoice.open.negative-amount, code: { case: NegativeAmount } }
domain_packages:
  - term: <business term this package stands for>
    model_refs: [bc.billing]
    rationale: <reason for grouping these responsibilities here>
    code: { language: rust, package: billing-domain, module: [] }
  - term: <business term this module stands for>
    model_refs: [aggregate.invoice]
    rationale: <reason for grouping these responsibilities here>
    code: { language: rust, package: billing-domain, module: [invoice] }
```

The values above are shapes, not content: replace every id, name and package
with the ones this project actually uses, and write the business term and the
rationale in the language the record is written in.

`module` is a list of segments below the package root, so the root itself is
`[]`; the package plus that list is the location a package or an aggregate is
declared at. Write one row per Aggregate in the canonical model, and a
human-readable table below it. Never redefine an element owned by the model.

In addition to automated declaration and model-ID checks, review whether each name and its contents follow ubiquitous language. Ensure every aggregate mapping location is declared in domain_packages, together with its root and every intermediate level. Packages planned for future implementation may be declared in advance.

For standalone execution, explicitly run the model-presence, reference-ID, and mapping sensors with `aidlc engine sensor fire` against components and ddd-aggregate-mapping before reporting completion. Every final JSON result must be `result: passed`. Standard 2.9.0 standalone completion does not perform these checks for you.

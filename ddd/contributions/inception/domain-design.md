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

- **Packaging by business vocabulary.** Read the shared `ddd-domain-packaging.md` knowledge and establish a business term, related model IDs, and placement rationale for each domain crate and internal module. Do not create technical classifications such as `aggregate/`, `impl/`, `vo/`, or `entities/`. Record the root and every hierarchy level in `domain_packages`. Clarify missing vocabulary; do not invent aggregates solely to justify a package.
- **Two axes per Aggregate.** For every `aggregate.*` in the canonical model ask
  for its `programming_model` (`actor` or `class`) and its `persistence_method`
  (`state-sourcing` or `event-sourcing`). Actor-modelled aggregates later
  require a Process Manager for multi-aggregate use cases.
- **Mapping target.** For every Aggregate ask for the `crate`, `module`,
  `ports` and `repository` its implementation will live in, and the
  `reference_ids` (the model elements the mapping touches: entity / vo /
  primitive / invariant / command) it must cite.
- **Rust replay declarations.** For event-sourced aggregates, record each replay method and its input event reference ID in `replay_methods`. Use a crate-relative Rust path for `module`, or `crate` for the root. Use an empty list if replay is not used.

Do not re-define entities, aggregates or invariants — reference them by ID.

## fragment: after-step:4

### Step 4x (ddd): Write the aggregate mapping

Write `ddd-aggregate-mapping` (logical name) to this stage's engine-resolved
record dir. The first fenced ```yaml block is canonical:

```yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
aggregate_mappings:
  - aggregate_ref: aggregate.<slug>
    programming_model: <actor | class>
    persistence_method: <state-sourcing | event-sourcing>
    crate: <crate name>
    module: <module path>
    ports: []
    repository: <Aggregate>Repository
    reference_ids: [<ElementId>, ...]   # at least one
    replay_methods: []                # Example: [{ method: apply_event, event_ref: event.invoice.issued }]
domain_packages:
  - crate: <crate name>
    module: crate
    term: <business term represented by the crate>
    model_refs: [<bc.* or related model ID>]
    rationale: <reason for grouping these responsibilities>
  # Add the same fields for each internal module, including intermediate levels.
```

Write one row per Aggregate in the canonical model, and a human-readable table
below it. Never redefine an element owned by the model.

In addition to automated declaration and model-ID checks, review whether each name and its contents follow ubiquitous language. Ensure every aggregate mapping module is declared in domain_packages. Packages planned for future implementation may be declared in advance.

For standalone execution, explicitly run the model-presence, reference-ID, and mapping sensors with `aidlc engine sensor fire` against components and ddd-aggregate-mapping before reporting completion. Every final JSON result must be `result: passed`. Standard 2.8.2 standalone completion does not perform these checks for you.

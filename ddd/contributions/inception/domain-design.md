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

- **Two axes per Aggregate.** For every `aggregate.*` in the canonical model ask
  for its `programming_model` (`actor` or `class`) and its `persistence_method`
  (`state-sourcing` or `event-sourcing`). Actor-modelled aggregates later
  require a Process Manager for multi-aggregate use cases.
- **Mapping target.** For every Aggregate ask for the `crate`, `module`,
  `ports` and `repository` its implementation will live in, and the
  `reference_ids` (the model elements the mapping touches: entity / vo /
  primitive / invariant / command) it must cite.

Do not re-define entities, aggregates or invariants — reference them by ID.

## fragment: after-step:4

### Step 4x (ddd): Write the aggregate mapping

Write `ddd-aggregate-mapping` (logical name) to this stage's engine-resolved
record dir. The first fenced ```yaml block is canonical:

```yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/domain-model.yaml
aggregate_mappings:
  - aggregate_ref: aggregate.<slug>
    programming_model: <actor | class>
    persistence_method: <state-sourcing | event-sourcing>
    crate: <crate name>
    module: <module path>
    ports: []
    repository: <Aggregate>Repository
    reference_ids: [<ElementId>, ...]   # at least one
```

Write one row per Aggregate in the canonical model, and a human-readable table
below it. Never redefine an element owned by the model.

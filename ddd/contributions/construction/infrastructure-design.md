---
target: infrastructure-design
plugin: ddd
adds:
  produces:
    - ddd-layer-structure
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

- **Layer structure.** Which crates form the command side, the query side and
  the RMUs, and which crate depends on which. The allowed directions are fixed
  by the layer rules; the command and query sides must not depend on each other.
- **Port conventions.** Classify each port as `repository`, `external-client`
  or `es-infrastructure` and name its verbs (`find_by_id`, `store`,
  `delete_by_id` for repositories).
- **Persistence.** The backend, the aggregate-to-store mapping, and how a
  repository's `store` behaves (`upsert` preferred).
- **RMU.** Each read-model updater bridges the command side to the query side;
  it may depend on both.
- **Restoration.** For every Aggregate in the context, the path that rebuilds it
  through its full constructor.

## fragment: after-step:5

### Step 5x (ddd): Write the layer structure

Write `ddd-layer-structure` (logical name) to this stage's engine-resolved
per-unit record dir. The first fenced ```yaml block is canonical:

```yaml
schema_version: 1
model_ref: inception/domain-modeling/domain-model.yaml
layer_structures:
  - context_ref: bc.<slug>
    cqrs: <true | false>
    command_side_crates: [<crate>, ...]
    query_side_crates: [<crate>, ...]
    rmu_crates: [<crate>, ...]
    crate_dependencies:
      - { crate: <crate>, depends_on: [<crate>, ...] }
    ports:
      - { name: <Port>, kind: <repository | external-client | es-infrastructure>, verbs: [<verb>, ...] }
    repositories:
      - { name: <Aggregate>Repository, aggregate_ref: aggregate.<slug>, io_unit: <single | collection | partial>, verbs: [find_by_id, store, delete_by_id], store_semantics: <upsert | insert-only | unknown> }
    restoration_paths:
      - { aggregate_ref: aggregate.<slug>, via: <full-constructor | other> }
    persistence_backend: <backend>
```

Every crate that appears in the side lists needs a `crate_dependencies` row, and
every Aggregate in the context needs a `full-constructor` restoration path.

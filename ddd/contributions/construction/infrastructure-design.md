---
target: infrastructure-design
plugin: ddd
adds:
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

Add exactly one `## DDD Layer Structure` section to the existing required review artifact `cicd-pipeline.md`. In one labelled YAML block, declare the boundaries of components that the pipeline verifies and distributes. Do not generate a separate declaration file. Inherit the artifact's Unit kinds (service / ui / packaging / library); spec does not require it. If this Unit has no domain layer structure, declare `layer_structures: []` and explain why. Artifact prose follows the project's output-language policy; the section heading is a parser marker.

```yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
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

For standalone execution, explicitly run `ddd-layer-structure` and `ddd-design-advisories` with `aidlc engine sensor fire` against this attempt's cicd-pipeline before reporting completion. The blocking layer-structure check must return `result: passed` in its final JSON. Standard 2.8.2 standalone completion does not perform these checks for you.

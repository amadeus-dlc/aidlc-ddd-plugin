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

既存の必須レビュー成果物 `cicd-pipeline.md` に `## DDD 層構造宣言` を1つ追加する。
パイプラインが検証・配布するコンポーネントの境界を、この節のラベル付きYAMLブロック1つに記載する。
独立した宣言ファイルは生成しない。既存成果物のUnit種別（service / ui / packaging / library）を引き継ぎ、specには要求しない。
このUnitがドメインの層構造を持たない場合は `layer_structures: []` と理由を明記する。

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

単独実行では、完了報告前に、この試行のcicd-pipelineを対象として `ddd-layer-structure` と
`ddd-design-advisories` を `aidlc engine sensor fire` で明示実行する。
blockingの層構造検査が最終JSONで `result: passed` になるまで完了を報告しない。標準2.8.2の単独完了はこの検査を代行しない。

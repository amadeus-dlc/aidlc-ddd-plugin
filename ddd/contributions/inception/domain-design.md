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

- **業務語彙によるパッケージング。** 共有ナレッジ `ddd-domain-packaging.md` を読み、
  ドメインの各クレートと内部モジュールについて、業務用語・関連モデルID・配置理由を確認する。
  `aggregate/`、`impl/`、`vo/`、`entities/` 等の技術分類を作らない。rootと階層の各段を
  `domain_packages` に記載する。語彙が不足していれば意味を確認し、パッケージのために架空の集約を作らない。
- **Two axes per Aggregate.** For every `aggregate.*` in the canonical model ask
  for its `programming_model` (`actor` or `class`) and its `persistence_method`
  (`state-sourcing` or `event-sourcing`). Actor-modelled aggregates later
  require a Process Manager for multi-aggregate use cases.
- **Mapping target.** For every Aggregate ask for the `crate`, `module`,
  `ports` and `repository` its implementation will live in, and the
  `reference_ids` (the model elements the mapping touches: entity / vo /
  primitive / invariant / command) it must cite.
- **Rustのreplay宣言。** イベントソーシングを選ぶ集約は、replayメソッド名と
  受け取るイベントの参照IDを `replay_methods` へ記録する。`module` はクレート相対の
  Rustモジュールパスとし、ルートは `crate` と書く。replayを使わない場合は空配列にする。

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
    replay_methods: []                # 例: [{ method: apply_event, event_ref: event.invoice.issued }]
domain_packages:
  - crate: <crate name>
    module: crate
    term: <クレートが表す業務語彙>
    model_refs: [<bc.* または関連モデルID>]
    rationale: <この責務をまとめる理由>
  # 内部モジュールごとに同じ項目を追加する。中間の階層も省略しない。
```

Write one row per Aggregate in the canonical model, and a human-readable table
below it. Never redefine an element owned by the model.

domain_packagesの宣言とモデルIDの機械検査に加え、各名称と中身がユビキタス言語に沿うかをレビューする。
集約写像のmoduleがdomain_packagesに存在することも確認する。将来実装するパッケージは先に宣言できる。

単独実行では完了報告前に、componentsとddd-aggregate-mappingを対象として、
モデル存在・参照ID・写像の3センサーを `aidlc engine sensor fire` で明示実行する。
すべての最終JSONが `result: passed` になるまで完了を報告しない。標準2.8.2の単独完了はこの検査を代行しない。

---
target: functional-design
plugin: ddd
adds:
  consumes:
    - artifact: ddd-aggregate-mapping
      required: false
  sensors:
    - ddd-reference-ids
    - ddd-mapping-declarations
    - ddd-design-advisories
fragments:
  - anchor: after-step:2
    order: 100
  - anchor: after-step:4
    order: 100
---

## fragment: after-step:2

### Step 2x (ddd): Ask the use-case items and conventions

Add these question topics, and follow the conventions while designing:

- **配置の継承。** domain-designのdomain_packagesを参照し、Unit単位でaggregate/・vo/等の
  技術分類を新設しない。配置の変更が必要なら、上流の語彙・モデル参照・配置理由を更新してから利用する。
- **Six mandatory items per use case.** `use_case_id` (`uc.<slug>`), `name`,
  `target_aggregates` (one or more `aggregate.*`), `commands` (one or more
  `command.*`), `re_execution_basis` (how each step's idempotency strategy makes
  a retry safe), `recovery_policy` (`caller-retry`, `step-backoff` or `both`),
  and `read_model_exposure` (which view exposes intermediate state).
- **Multi-aggregate strategy.** When a use case targets two or more aggregates,
  require a `multi_aggregate_strategy`: a `process-manager` referencing a `pm.*`
  when the aggregates are actor-modelled, or a `re-execution` rationale when
  they are class-based.
- **Conventions.** Keep the five-point set (transactional consistency boundary,
  idempotency, ordering, failure and compensation, observability) explicit; keep
  the use case the orchestrator, not the domain; state the consistency boundary;
  and make the flow re-execution-safe.

## fragment: after-step:4

### Step 4x (ddd): Write the use-case declarations

既存の必須レビュー成果物 `functional-spec.md` に `## DDD ユースケース宣言` を1つ追加する。
この節にラベル付きYAMLブロックを1つだけ置き、以下の宣言を記載する。独立した宣言ファイルは生成しない。
この追加は既存成果物のUnit種別（service / spec / ui / library）を引き継ぎ、packagingには要求しない。
他の節にあるYAMLの例はDDD宣言として扱わない。

```yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
use_cases:
  - use_case_id: uc.<slug>
    name: <name>
    target_aggregates: [<aggregate.*>, ...]
    commands: [<command.*>, ...]
    re_execution_basis: <how a retry is safe>
    recovery_policy: <caller-retry | step-backoff | both>
    multi_aggregate_strategy:        # required when two or more targets
      kind: <process-manager | re-execution>
      process_manager_ref: <pm.*>    # when process-manager
      rationale: <text>              # when re-execution
    read_model_exposure: <which view>
```

A unit with no use cases writes `use_cases: []` and a one-line explanation.
Reference the model by ID; never redefine it.

単独実行では、完了報告前に、この試行のfunctional-specを対象として `ddd-reference-ids`、
`ddd-mapping-declarations`、`ddd-design-advisories` を `aidlc engine sensor fire` で明示実行する。
blockingの2本が最終JSONで `result: passed` になるまで完了を報告しない。標準2.8.2の単独完了はこの検査を代行しない。

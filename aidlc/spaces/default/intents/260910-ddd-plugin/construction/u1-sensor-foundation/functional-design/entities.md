# エンティティモデル — U1 センサー基盤（u1-sensor-foundation）

## Sources

- `inception/units-generation/unit-of-work.md`（U1 の責務: SensorRuntime と DomainModelSchema。kind は library）
- `inception/units-generation/unit-of-work-story-map.md`（U1 に割り当てた要件: FR2、FR2.1〜FR2.7、FR8、FR8.5、NFR8、NFR9）
- `inception/requirements-analysis/requirements.md`（FR2.1 包含構造、FR2.2 Domain Error 必須、FR2.3 安定 ID、FR2.4 系譜、FR2.5 冪等性戦略、FR2.6 Process Manager、FR2.7 yaml を正とする、FR8.5 ディスパッチャ契約）
- `inception/domain-design/components.md`（SensorRuntime が所有する SensorVerdict / SensorFinding、DomainModelSchema が所有する 11 エンティティ）
- `construction/u1-sensor-foundation/functional-design/functional-design-questions.md`（Q1 ID 接頭辞、Q2 系譜の置き場所、Q3 effect 属性、Q4 手書き検証器）
- `ddd/docs/domain-layer-design.md` §3〜§5、`ddd/docs/use-case-layer-design.md` §5-5

本書は U1 が所有する型の定義である。`domain-model.yaml` の構造（DomainModelSchema 側）と、センサー実行スクリプトが扱う実行時の型（SensorRuntime 側）の 2 群からなる。論理型のみを記し、実装言語の型は code-generation で決める。

## エンティティ定義（正）

```yaml
entities:
  # ---------- DomainModelSchema: 正規モデル ----------
  - name: DomainModel
    description: domain-model.yaml のルート文書。Bounded Context の集合と ID 系譜を持つ唯一の正
    attributes:
      - { name: schema_version, type: integer, required: true, constraints: "初版は 1。読み込み器は未知の版を拒否する" }
      - { name: bounded_contexts, type: list<BoundedContext>, required: true, constraints: "1 件以上" }
      - { name: lineage, type: list<ElementLineage>, required: false, default: "[]", constraints: "Q2: 系譜はこのセクションに置く" }
    constraints:
      - すべての element_id は文書内で一意（系譜に記録された廃止 ID を含めて再利用不可）
    relationships:
      - { target: BoundedContext, cardinality: "1..*", direction: contains }
      - { target: ElementLineage, cardinality: "0..*", direction: contains }

  - name: ElementId
    description: 安定 ID。要素の種別を接頭辞に持つ不変の参照キー（Q1）。値オブジェクト
    attributes:
      - { name: value, type: string, required: true, unique: true, constraints: "正規表現 ^(bc|aggregate|entity|vo|primitive|invariant|command|event|error|transition|factory|pm)(\\.[a-z][a-z0-9-]*)+$" }
      - { name: kind, type: enum, allowed: [bc, aggregate, entity, vo, primitive, invariant, command, event, error, transition, factory, pm], required: true, constraints: "value の先頭セグメントから導出" }
      - { name: segments, type: list<string>, required: true, constraints: "先頭セグメントを除いた名前セグメント。種別ごとの個数は rules.md BR1.3" }
    constraints:
      - element_id は永続的な参照キーで、rename では変わらない（name だけが変わる）

  - name: BoundedContext
    description: 境界づけられたコンテキスト。Aggregate と Process Manager を束ねる
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind = bc" }
      - { name: name, type: string, required: true }
      - { name: aggregates, type: list<Aggregate>, required: true, constraints: "1 件以上" }
      - { name: process_managers, type: list<ProcessManager>, required: false, default: "[]" }
    relationships:
      - { target: Aggregate, cardinality: "1..*", direction: contains }
      - { target: ProcessManager, cardinality: "0..*", direction: contains }

  - name: Aggregate
    description: 集約。不変条件・状態・Command/Event・Domain Error・遷移・生成規則を所有する FSM
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind = aggregate" }
      - { name: name, type: string, required: true }
      - { name: bounded_context, type: ElementId, required: true, references: BoundedContext, constraints: "包含元と一致" }
      - { name: root_element, type: ElementId, required: true, references: DomainElement, constraints: "kind = entity かつ elements に含まれる" }
      - { name: states, type: list<string>, required: false, default: "[]", constraints: "FSM の状態名。transitions が 1 件以上あるときは必須" }
      - { name: elements, type: list<DomainElement>, required: true, constraints: "1 件以上（root_element を含む）" }
      - { name: invariants, type: list<Invariant>, required: true, constraints: "1 件以上（機械完了条件 (i)）" }
      - { name: commands, type: list<Command>, required: true, constraints: "0 件以上" }
      - { name: events, type: list<DomainEvent>, required: false, default: "[]" }
      - { name: transitions, type: list<StateTransition>, required: false, default: "[]" }
      - { name: factory_rules, type: list<FactoryRule>, required: false, default: "[]" }
      - { name: process_managers, type: list<ElementId>, required: false, default: "[]", references: ProcessManager, constraints: "この集約を対象に含む Process Manager への参照（導出値。読み込み器が補完する）" }
    constraints:
      - invariants は 1 件以上（rules.md BR3.2）
      - transitions の from_state / to_state は states に含まれる（BR3.6）
    relationships:
      - { target: BoundedContext, cardinality: "1", direction: belongs-to }
      - { target: DomainElement, cardinality: "1..*", direction: contains }
      - { target: Invariant, cardinality: "1..*", direction: contains }
      - { target: Command, cardinality: "0..*", direction: contains }
      - { target: DomainEvent, cardinality: "0..*", direction: contains }
      - { target: StateTransition, cardinality: "0..*", direction: contains }
      - { target: FactoryRule, cardinality: "0..*", direction: contains }

  - name: DomainElement
    description: Entity / Value Object / Domain Primitive のいずれか。1 つの Aggregate に属する
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind は entity / vo / primitive のいずれかで、kind 属性と一致" }
      - { name: kind, type: enum, allowed: [entity, value-object, domain-primitive], required: true }
      - { name: name, type: string, required: true }
      - { name: aggregate, type: ElementId, required: true, references: Aggregate }
      - { name: attributes, type: list<ElementAttribute>, required: false, default: "[]" }
      - { name: invariants, type: list<ElementId>, required: false, default: "[]", references: Invariant, constraints: "この要素に限定された不変条件（Domain Primitive の生成時検査など）" }
    constraints:
      - domain-primitive は attributes を 1 件だけ持つ（包む言語プリミティブ）か、attributes を持たず base_type だけを持つ（BR3.8）
    relationships:
      - { target: Aggregate, cardinality: "1", direction: belongs-to }

  - name: ElementAttribute
    description: DomainElement の属性。型は他の DomainElement への参照かスカラー
    attributes:
      - { name: name, type: string, required: true }
      - { name: type, type: string, required: true, constraints: "ElementId（entity / vo / primitive）またはスカラー名（string / integer / decimal / boolean / date / datetime）" }
      - { name: required, type: boolean, required: false, default: true }
      - { name: collection, type: boolean, required: false, default: false }

  - name: Invariant
    description: 不変条件。Aggregate が保証する（要素に限定する場合は element を指す）
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind = invariant、形は invariant.<aggregate>.<name>" }
      - { name: name, type: string, required: true }
      - { name: aggregate, type: ElementId, required: true, references: Aggregate }
      - { name: element, type: ElementId, required: false, references: DomainElement, constraints: "省略時は集約全体の不変条件" }
      - { name: statement, type: string, required: true, constraints: "空でない自然言語の条件文" }
    relationships:
      - { target: Aggregate, cardinality: "1", direction: belongs-to }

  - name: Command
    description: Aggregate に対する業務操作。効果の種類・状態遷移・失敗条件・冪等性戦略を宣言する
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind = command、形は command.<aggregate>.<name>" }
      - { name: name, type: string, required: true }
      - { name: aggregate, type: ElementId, required: true, references: Aggregate }
      - { name: effect, type: enum, allowed: [transition, accumulation], required: true, constraints: "Q3。accumulation は加算・追加系（本質的に非冪等）" }
      - { name: state_effect, type: enum, allowed: [transitions, none], required: true, constraints: "none は「遷移なし」の明示（機械完了条件 (ii)）" }
      - { name: transitions, type: list<ElementId>, required: false, default: "[]", references: StateTransition, constraints: "state_effect = transitions のとき 1 件以上、none のとき空" }
      - { name: domain_errors, type: list<DomainError>, required: true, constraints: "1 件以上（FR2.2、機械完了条件 (iii)）" }
      - { name: events, type: list<ElementId>, required: false, default: "[]", references: DomainEvent }
      - { name: idempotency, type: IdempotencyPolicy, required: true }
    relationships:
      - { target: Aggregate, cardinality: "1", direction: belongs-to }
      - { target: DomainError, cardinality: "1..*", direction: contains }
      - { target: StateTransition, cardinality: "0..*", direction: references }
      - { target: DomainEvent, cardinality: "0..*", direction: references }

  - name: IdempotencyPolicy
    description: Command の冪等性戦略（FR2.5）。値オブジェクト
    attributes:
      - { name: strategy, type: enum, allowed: [none, command-id-memory], required: true, constraints: "none = 同値更新の許容で吸収（FR2.5 の (i)）、command-id-memory = コマンド ID 記憶（(ii)）" }
      - { name: retention, type: enum, allowed: [last-one, multiple, time-window], required: false, constraints: "strategy = command-id-memory のとき必須" }
      - { name: retention_count, type: integer, required: false, min: 1, constraints: "retention = multiple のとき必須" }
      - { name: retention_window, type: string, required: false, constraints: "retention = time-window のとき必須。ISO 8601 期間（例: PT24H）" }
      - { name: rationale, type: string, required: false, constraints: "strategy = none のとき推奨（吸収できる理由）" }

  - name: DomainEvent
    description: 1 つの Command が発生させるドメインイベント
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind = event、形は event.<aggregate>.<name>" }
      - { name: name, type: string, required: true }
      - { name: aggregate, type: ElementId, required: true, references: Aggregate }
      - { name: produced_by, type: ElementId, required: true, references: Command, constraints: "同じ Aggregate の Command" }
    relationships:
      - { target: Command, cardinality: "1", direction: produced-by }

  - name: DomainError
    description: Command の失敗条件。エラー時に状態遷移しないことの契約
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind = error、形は error.<aggregate>.<command>.<name>" }
      - { name: name, type: string, required: true }
      - { name: command, type: ElementId, required: true, references: Command }
      - { name: condition, type: string, required: true, constraints: "空でない失敗条件の記述" }
    relationships:
      - { target: Command, cardinality: "1", direction: belongs-to }

  - name: StateTransition
    description: Command が引き起こす Aggregate の状態遷移
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind = transition、形は transition.<aggregate>.<name>" }
      - { name: name, type: string, required: true }
      - { name: aggregate, type: ElementId, required: true, references: Aggregate }
      - { name: from_state, type: string, required: true, constraints: "aggregate.states の要素。初期生成は特別値 initial" }
      - { name: to_state, type: string, required: true, constraints: "aggregate.states の要素" }
      - { name: command, type: ElementId, required: true, references: Command }
    relationships:
      - { target: Aggregate, cardinality: "1", direction: belongs-to }
      - { target: Command, cardinality: "1", direction: caused-by }

  - name: FactoryRule
    description: DomainElement の生成規則（完全コンストラクタで満たすべき前提条件）
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind = factory、形は factory.<aggregate>.<name>" }
      - { name: name, type: string, required: true }
      - { name: target_element, type: ElementId, required: true, references: DomainElement }
      - { name: preconditions, type: list<string>, required: true, constraints: "1 件以上。不変条件 ID（invariant.*）または自然言語" }
    relationships:
      - { target: DomainElement, cardinality: "1", direction: creates }

  - name: ProcessManager
    description: 複数の Aggregate に跨がる流れを調整する要素。Bounded Context が所有する
    attributes:
      - { name: element_id, type: ElementId, required: true, unique: true, constraints: "kind = pm、形は pm.<name>" }
      - { name: name, type: string, required: true }
      - { name: aggregates, type: list<ElementId>, required: true, references: Aggregate, constraints: "2 件以上" }
      - { name: steps, type: list<ProcessStep>, required: true, constraints: "1 件以上" }
      - { name: compensations, type: list<ProcessStep>, required: false, default: "[]" }
    relationships:
      - { target: BoundedContext, cardinality: "1", direction: belongs-to }
      - { target: Aggregate, cardinality: "2..*", direction: coordinates }

  - name: ProcessStep
    description: Process Manager の 1 ステップ（成功時の次アクション／失敗時の補償）
    attributes:
      - { name: name, type: string, required: true }
      - { name: command, type: ElementId, required: true, references: Command, constraints: "aggregates に含まれる Aggregate の Command" }
      - { name: on_failure, type: string, required: false, constraints: "compensations 内のステップ名" }

  - name: ElementLineage
    description: ID の系譜。rename / split / merge / 廃止の関係を記録する（FR2.4）
    attributes:
      - { name: lineage_id, type: string, required: true, unique: true, constraints: "lineage-<連番 4 桁>" }
      - { name: element_id, type: ElementId, required: true, constraints: "対象の ID。deprecated / split / merged では廃止 ID、renamed では現行 ID" }
      - { name: relation, type: enum, allowed: [renamed, split, merged, deprecated], required: true }
      - { name: previous_name, type: string, required: false, constraints: "relation = renamed のとき必須" }
      - { name: successors, type: list<ElementId>, required: false, default: "[]", constraints: "relation = split のとき 2 件以上" }
      - { name: replaced_by, type: ElementId, required: false, constraints: "relation = merged のとき必須" }
      - { name: deprecated_at, type: string, required: false, constraints: "relation が split / merged / deprecated のとき必須。日付（YYYY-MM-DD）または版" }
    constraints:
      - split / merged / deprecated の element_id は本文に存在してはならない（BR2.2）
      - replaced_by / successors の連鎖は非循環（BR2.3）

  # ---------- SensorRuntime: 実行時の型 ----------
  - name: SensorRunContext
    description: ディスパッチャの引数から解決した実行文脈。値オブジェクト
    attributes:
      - { name: stage, type: string, required: true, constraints: "--stage の値。ステージ slug" }
      - { name: output_path, type: string, required: true, constraints: "--output-path（または --file-path）の値。絶対パスに正規化" }
      - { name: record_dir, type: string, required: true, constraints: "output_path の祖先で aidlc-state.md を含む最も近いディレクトリ" }
      - { name: workspace_root, type: string, required: true, constraints: "record_dir の祖先で aidlc/ ディレクトリを含むもの（プロジェクトルート）" }
      - { name: unit, type: string, required: false, constraints: "record_dir/construction/<unit>/ 配下のときの <unit>" }
      - { name: budget_ms, type: integer, required: false, min: 1, constraints: "スクリプトが自マニフェストから渡す軟らかい時間予算" }
      - { name: started_at, type: datetime, required: true }

  - name: StageStatus
    description: aidlc-state.md の Stage Progress 行から読んだ 1 ステージの状態（ADR-004）
    attributes:
      - { name: stage, type: string, required: true }
      - { name: execution, type: enum, allowed: [EXECUTE, SKIP, absent], required: true, constraints: "absent = 行が無い（プラグイン未合成の記録）" }
      - { name: checkbox, type: string, required: false, constraints: "[ ] / [-] / [?] / [R] / [x] / [S] のいずれか" }

  - name: SourceClaim
    description: source-manifest.json の writes 1 件。code-generation の検査対象
    attributes:
      - { name: path, type: string, required: true }
      - { name: repo, type: string, required: false }
      - { name: is_directory, type: boolean, required: true, constraints: "path が / で終わる" }
      - { name: resolved_path, type: string, required: false, constraints: "workspace_root（または repo ルート）に対して解決した絶対パス。範囲外なら未設定" }

  - name: SensorFinding
    description: 1 件の所見。規則 ID・位置・説明を持つ（FR7.13、NFR8）
    attributes:
      - { name: finding_id, type: string, required: true, unique: true, constraints: "<sensor_id>:<rule_id>:<連番>。同一入力では同一" }
      - { name: sensor_id, type: string, required: true }
      - { name: rule_id, type: string, required: true, constraints: "Rust 規則は a〜n の 1 文字、設計検査は <manifest-id>.<条件>（例: model-completeness.i）" }
      - { name: file, type: string, required: true, constraints: "workspace_root からの相対パス" }
      - { name: line, type: integer, required: false, min: 1, constraints: "行を特定できない所見は省略" }
      - { name: message, type: string, required: true, constraints: "違反の一文説明" }
      - { name: severity, type: enum, allowed: [blocking, advisory], required: true }
    relationships:
      - { target: SensorVerdict, cardinality: "1", direction: belongs-to }

  - name: SensorVerdict
    description: スクリプトがディスパッチャに返す報告（標準出力の JSON 1 行）。ディスパッチャはこれから fire_id・result・detail_path を付けた verdict 行と詳細ファイルを生成する
    attributes:
      - { name: pass, type: boolean, required: true, constraints: "所見（severity を問わず）が 0 件のとき true" }
      - { name: sensor_id, type: string, required: true }
      - { name: stage, type: string, required: true }
      - { name: output_path, type: string, required: true }
      - { name: findings_count, type: integer, required: true, min: 0, constraints: "findings の件数と一致" }
      - { name: findings, type: list<SensorFinding>, required: true, constraints: "(file, line, rule_id) の順に整列" }
      - { name: reason, type: string, required: false, constraints: "pass = false のとき必須。所見の要約または失敗理由" }
      - { name: note, type: string, required: false, constraints: "pass = true でも残す注記（例: stage SKIP のため検査省略）" }
    relationships:
      - { target: SensorFinding, cardinality: "0..*", direction: contains }
```

## 要約

- **正規モデル側（DomainModelSchema）** は `DomainModel` を根に、`BoundedContext → Aggregate → { DomainElement, Invariant, Command（→ DomainError, StateTransition, DomainEvent, IdempotencyPolicy）, FactoryRule }` の包含構造と、Bounded Context 直下の `ProcessManager`、根直下の `ElementLineage` からなる。設計書 §3 の包含関係に、Q1〜Q3 で確定した `ElementId` の文法、`lineage:` セクション、`effect` / `state_effect` / `idempotency` の属性を加えた。
- 参照はすべて `ElementId` で行い、包含（contains）と参照（references）を区別する。包含は yaml の入れ子で表し、参照は ID 文字列で表す。
- **実行時側（SensorRuntime）** は `SensorRunContext`（引数から解決した文脈）、`StageStatus`（状態ファイルの読み取り結果）、`SourceClaim`（申告ソース）を入力側の値オブジェクトとし、`SensorVerdict` と `SensorFinding` を出力側の型とする。`SensorVerdict` はディスパッチャの verdict 行（`fire_id` / `result` / `detail_path` を含む）そのものではなく、その材料となるスクリプト側の報告である。
- `components.md` からの差分: (1) `DomainModel`、`ElementId`、`ElementAttribute`、`IdempotencyPolicy`、`ProcessStep`、`SensorRunContext`、`StageStatus`、`SourceClaim` を設計上の補助型として追加した。(2) `ProcessManager` は Aggregate ではなく BoundedContext が所有し、`Aggregate.process_managers` は読み込み器が補完する導出値にした（複数集約に跨がる要素を 1 集約の入れ子にできないため）。(3) `SensorVerdict` の `fire_id` / `result` / `detail_path` はディスパッチャが付与するため、スクリプト側の型からは外した。

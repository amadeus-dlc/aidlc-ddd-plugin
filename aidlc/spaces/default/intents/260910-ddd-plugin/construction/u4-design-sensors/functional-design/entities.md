# エンティティモデル — U4 設計センサー（u4-design-sensors）

## Sources

- `inception/units-generation/unit-of-work.md`（U4 = DesignSensorSuite + GoldenCaseSuite（規約と設計センサー分）。kind: library。U1・U3 に依存し、U5〜U7・U9 が依存する）
- `inception/units-generation/unit-of-work-story-map.md`（U4 の要件: FR4.4、FR5.4、FR5.5、FR6、FR6.1〜FR6.6、FR8.1、FR8.2、FR8.7、NFR4。横断: FR1.7 / FR1.8 の検査実体、FR3.5 / FR4.3 / FR5.4 / FR8.3 の検査実体）
- `inception/requirements-analysis/requirements.md`（FR6 設計検査、FR8.1〜FR8.2 マニフェスト、FR8.7 ゴールデンケース、NFR4）
- `inception/domain-design/components.md`（DesignSensorSuite の 6 マニフェスト、GoldenCaseSuite の GoldenCase、下流成果物のエンティティ AggregateMapping / UseCaseDeclaration / LayerStructureDeclaration）
- `inception/domain-design/decisions.md`（ADR-002、ADR-004、ADR-008、ADR-009）
- `construction/u4-design-sensors/functional-design/functional-design-questions.md`（Q1 fixture 規約、Q2 md/yaml 整合、Q3 存在検査の契機）
- 参照プラグイン `aidlc-workflows/plugins/test-pro/sensors/`（マニフェストの `command: bun {{HARNESS_DIR}}/tools/...` の形と必須フィールド）
- U1 の設計 `construction/u1-sensor-foundation/functional-design/entities.md`（SensorVerdict / SensorFinding / SensorRunContext / StageStatus、DomainModel と ElementIndex）

本書は U4 が所有する型の定義である。3 群からなる: (1) マニフェストと検査の定義、(2) U4 が解析する宣言成果物の構造（U7 が書き、U4 が読む。解析契約の所有者は U4）、(3) ゴールデンケース。実行時の共通型（所見・報告・文脈）は U1 のものをそのまま使う。

## エンティティ定義（正）

```yaml
entities:
  # ---------- (1) マニフェストと検査 ----------
  - name: SensorManifest
    description: sensors/aidlc-<id>.md の frontmatter。6 本の実体は functional-spec.md §1 に列挙する
    attributes:
      - { name: id, type: string, required: true, unique: true, constraints: "ddd-<name>。ファイル名は sensors/aidlc-<id>.md" }
      - { name: kind, type: enum, allowed: [deterministic], required: true }
      - { name: command, type: string, required: true, constraints: "bun {{HARNESS_DIR}}/tools/ddd-sensor-<name>.ts（投影時にハーネスのパスへ置換される）" }
      - { name: default_severity, type: enum, allowed: [blocking, advisory], required: true }
      - { name: fire_on, type: enum, allowed: [gate], required: true, constraints: "6 本すべて gate（FR8.2、CON4）" }
      - { name: matches, type: string, required: true, constraints: "契機となる成果物の glob。旧成果物ツリー路を踏襲しない" }
      - { name: description, type: string, required: true }
      - { name: category, type: string, required: true, constraints: "document-shape または document-traceability" }
      - { name: timeout_seconds, type: integer, required: true, default: 10 }
      - { name: checks, type: list<DesignCheck>, required: true, constraints: "1 件以上。マニフェスト内部で独立に走る検査" }
    relationships:
      - { target: DesignCheck, cardinality: "1..*", direction: contains }

  - name: DesignCheck
    description: マニフェスト内部の独立した検査 1 件。所見の rule_id の出典
    attributes:
      - { name: rule_id, type: string, required: true, unique: true, constraints: "<manifest-name>.<条件>（例: model-completeness.i、layer-structure.k）" }
      - { name: manifest_id, type: string, required: true, references: SensorManifest }
      - { name: requirement, type: string, required: true, constraints: "出典の要件 ID（FR6.5 など）または設計書の規則記号 (e)(f)(j)(k)(l)(m)(n)" }
      - { name: inputs, type: list<string>, required: true, constraints: "読む成果物の論理名（ddd-domain-model-yaml、ddd-aggregate-mapping など）と U1 API" }
      - { name: outcome, type: enum, allowed: [finding, note], required: true, constraints: "finding = 所見を積む、note = 省略理由を note に残して pass" }

  - name: DeclarationDocument
    description: プラグインが追加する宣言成果物（ddd-aggregate-mapping / ddd-use-case-declarations / ddd-layer-structure）の共通形。Markdown の中の最初の fenced yaml ブロックを正とする
    attributes:
      - { name: logical_name, type: enum, allowed: [ddd-aggregate-mapping, ddd-use-case-declarations, ddd-layer-structure], required: true }
      - { name: file, type: string, required: true, constraints: "<record>/inception/domain-design/ddd-aggregate-mapping.md、<record>/construction/<unit>/functional-design/ddd-use-case-declarations.md、<record>/construction/<unit>/infrastructure-design/ddd-layer-structure.md" }
      - { name: schema_version, type: integer, required: true, constraints: "fenced yaml の先頭キー。初版は 1" }
      - { name: model_ref, type: string, required: true, constraints: "参照する正規モデルのパス（記録ディレクトリ相対。既定は inception/domain-modeling/domain-model.yaml）" }
    relationships:
      - { target: AggregateMapping, cardinality: "0..*", direction: contains }
      - { target: UseCaseDeclaration, cardinality: "0..*", direction: contains }
      - { target: LayerStructureDeclaration, cardinality: "0..*", direction: contains }

  # ---------- (2) 宣言成果物の構造（U7 が書き、U4 が読む） ----------
  - name: AggregateMapping
    description: 正規モデルの Aggregate 1 つを型・モジュール・ポート・リポジトリ境界へ写像し、2 軸を宣言する（FR3.2、FR3.3）
    attributes:
      - { name: aggregate_ref, type: string, required: true, unique: true, constraints: "aggregate.<name> 形式の ElementId" }
      - { name: programming_model, type: enum, allowed: [actor, class], required: true }
      - { name: persistence_method, type: enum, allowed: [state-sourcing, event-sourcing], required: true }
      - { name: crate, type: string, required: true, constraints: "実装クレート名（U2 の層規約に従う）" }
      - { name: module, type: string, required: true }
      - { name: ports, type: list<string>, required: false, default: "[]" }
      - { name: repository, type: string, required: true, constraints: "<Aggregate 名>Repository（(m) の設計側は layer-structure が検査）" }
      - { name: reference_ids, type: list<string>, required: true, constraints: "1 件以上。写像先が参照する正規モデルの ElementId（entity / vo / primitive / invariant / command）" }

  - name: UseCaseDeclaration
    description: ユースケース 1 つの必須 6 項目（FR4.1）
    attributes:
      - { name: use_case_id, type: string, required: true, unique: true, constraints: "uc.<name>" }
      - { name: name, type: string, required: true }
      - { name: target_aggregates, type: list<string>, required: true, constraints: "1 件以上。aggregate.* の ElementId" }
      - { name: commands, type: list<string>, required: true, constraints: "1 件以上。command.* の ElementId" }
      - { name: re_execution_basis, type: string, required: true, constraints: "空でない。各ステップの冪等性戦略への参照を含む" }
      - { name: recovery_policy, type: enum, allowed: [caller-retry, step-backoff, both], required: true }
      - { name: multi_aggregate_strategy, type: MultiAggregateStrategy, required: false, constraints: "target_aggregates が 2 件以上のとき必須" }
      - { name: read_model_exposure, type: string, required: true, constraints: "空でない。中間状態をどのビューに出すか" }

  - name: MultiAggregateStrategy
    description: 複数集約に跨がるユースケースの戦略
    attributes:
      - { name: kind, type: enum, allowed: [process-manager, re-execution], required: true, constraints: "process-manager はアクターモデル宣言時、re-execution はクラスベース時" }
      - { name: process_manager_ref, type: string, required: false, constraints: "kind = process-manager のとき必須。pm.* の ElementId" }
      - { name: rationale, type: string, required: false, constraints: "kind = re-execution のとき必須" }

  - name: LayerStructureDeclaration
    description: Bounded Context 1 つの層構造宣言（FR5.1、ADR-009 の必須項目を含む）
    attributes:
      - { name: context_ref, type: string, required: true, unique: true, constraints: "bc.<name> の ElementId" }
      - { name: cqrs, type: boolean, required: true }
      - { name: command_side_crates, type: list<string>, required: true, constraints: "cqrs = false のときは全クレート" }
      - { name: query_side_crates, type: list<string>, required: false, default: "[]" }
      - { name: rmu_crates, type: list<string>, required: false, default: "[]" }
      - { name: crate_dependencies, type: list<CrateDependencyDeclaration>, required: true, constraints: "宣言に現れる全クレートについて 1 件ずつ（依存なしは空配列）" }
      - { name: ports, type: list<PortDeclaration>, required: true }
      - { name: repositories, type: list<RepositoryDeclaration>, required: true }
      - { name: restoration_paths, type: list<RestorationPathDeclaration>, required: true, constraints: "このコンテキストの全 Aggregate について 1 件ずつ" }
      - { name: persistence_backend, type: string, required: true }

  - name: CrateDependencyDeclaration
    description: クレートの依存先宣言（(k)(l) の検査根拠）
    attributes:
      - { name: crate, type: string, required: true }
      - { name: depends_on, type: list<string>, required: true, default: "[]" }

  - name: PortDeclaration
    description: ポートの分類と動詞（FR5.2）
    attributes:
      - { name: name, type: string, required: true }
      - { name: kind, type: enum, allowed: [repository, external-client, es-infrastructure], required: true }
      - { name: verbs, type: list<string>, required: false, default: "[]" }

  - name: RepositoryDeclaration
    description: リポジトリの命名・スコープ・store の意味（(m) と advisory の検査根拠）
    attributes:
      - { name: name, type: string, required: true }
      - { name: aggregate_ref, type: string, required: true, constraints: "aggregate.* の ElementId" }
      - { name: io_unit, type: enum, allowed: [single, collection, partial], required: true, constraints: "partial は advisory の対象（FR5.5）" }
      - { name: verbs, type: list<string>, required: true, constraints: "find_by_id / store / delete_by_id を基本とする" }
      - { name: store_semantics, type: enum, allowed: [upsert, insert-only, unknown], required: false, default: unknown }

  - name: RestorationPathDeclaration
    description: 集約ごとの復元経路（(n) の設計側）
    attributes:
      - { name: aggregate_ref, type: string, required: true }
      - { name: via, type: enum, allowed: [full-constructor, other], required: true }
      - { name: note, type: string, required: false }

  - name: MarkdownMention
    description: domain-model.md から抽出した ID と不変条件文の出現（規則 (f)、Q2）
    attributes:
      - { name: file, type: string, required: true }
      - { name: kind, type: enum, allowed: [element-id, invariant-statement], required: true }
      - { name: text, type: string, required: true, constraints: "element-id は <kind>.<segments> の字面、invariant-statement は行全体" }
      - { name: line, type: integer, required: true, min: 1 }

  # ---------- (3) ゴールデンケース ----------
  - name: GoldenCase
    description: 1 つのセンサーに対する 1 ケース（Q1 の構成規約）
    attributes:
      - { name: case_id, type: string, required: true, unique: true, constraints: "<suite>/<sensor-id>/<case-name>" }
      - { name: suite, type: enum, allowed: [design, rust], required: true, constraints: "U4 は design、U5 は rust" }
      - { name: sensor_id, type: string, required: true, references: SensorManifest }
      - { name: case_name, type: string, required: true, constraints: "violation-<規則> または clean-<説明> で始まる" }
      - { name: kind, type: enum, allowed: [violation, clean], required: true, constraints: "case_name の接頭辞と一致" }
      - { name: record_dir, type: string, required: true, constraints: "<case>/record/。aidlc-state.md と対象成果物を含む記録ディレクトリの最小コピー" }
      - { name: workspace_dir, type: string, required: false, constraints: "<case>/workspace/。Rust センサー（U5）だけが持つ" }
      - { name: expected, type: ExpectedVerdict, required: true, constraints: "expected.json の内容。起動引数（stage、output_path）と期待結果を 1 ファイルで持つ" }

  - name: ExpectedVerdict
    description: expected.json の内容。ケースの起動引数と期待する結果の両方を持つ（ランナーはこのファイルだけを読んで起動と照合を行う）
    attributes:
      - { name: stage, type: string, required: true, constraints: "起動時の --stage（ステージ slug）" }
      - { name: output_path, type: string, required: true, constraints: "record/ からの相対パス。ランナーが record/ のコピー先に対して絶対化し、--output-path に渡す" }
      - { name: pass, type: boolean, required: true }
      - { name: findings, type: list<ExpectedFinding>, required: true, default: "[]", constraints: "kind = clean のとき空、violation のとき 1 件以上" }
      - { name: note_contains, type: string, required: false, constraints: "pass = true で note を検証したいとき（例: SKIP による省略）" }

  - name: ExpectedFinding
    description: 期待する所見。rule_id と位置で照合し、message は照合しない
    attributes:
      - { name: rule_id, type: string, required: true }
      - { name: file, type: string, required: true, constraints: "record_dir（または workspace_dir）からの相対パス" }
      - { name: line, type: integer, required: false, min: 1 }
```

## 要約

- **マニフェストと検査**: `SensorManifest` 6 本（blocking 5、advisory 1）がそれぞれ複数の `DesignCheck` を内包し、所見の `rule_id` は `<manifest-name>.<条件>` で検査ごとに独立する（ADR-002 の「マニフェスト内部で規則ごとに独立検査」）。`command` は参照プラグインと同じ `{{HARNESS_DIR}}` 形式で書く。
- **宣言成果物の構造**: U7 が書く 3 つの `ddd-` 成果物（ADR-008）の fenced yaml の形を U4 が定める。`components.md` の AggregateMapping / UseCaseDeclaration / LayerStructureDeclaration に、ADR-009 が必須化した `crate_dependencies` / `repositories` / `restoration_paths` と、advisory 検査に必要な `io_unit` / `store_semantics`、複数集約の `MultiAggregateStrategy` を加えた。
- **ゴールデンケース**: Q1 の規約を `GoldenCase` / `ExpectedVerdict` / `ExpectedFinding` として固定した。U5 は同じ型に `workspace_dir` を足して使う。
- 実行時の型（`SensorVerdict`、`SensorFinding`、`SensorRunContext`、`StageStatus`）と正規モデルの型・索引は U1 の設計をそのまま使い、本書では再定義しない。

# エンティティモデル — U7 コアステージ contribution（u7-core-contributions）

## Sources

- `inception/units-generation/unit-of-work.md`（U7 = DomainDesignContribution + FunctionalDesignContribution + InfrastructureDesignContribution + CodeGenerationContribution。kind: spec。宣言成果物の解析契約は U4、命名・配置規約の出典は U2）
- `inception/units-generation/unit-of-work-story-map.md`（U7 の要件: FR3、FR3.1〜FR3.5、FR4、FR4.1〜FR4.3、FR5、FR5.1〜FR5.3、FR8.3。横断: FR3.5 / FR4.3 / FR5.4 / FR8.3 のバインドは U7、検査の実体は U4 / U5）
- `inception/requirements-analysis/requirements.md`（FR3〜FR5、FR8.3、CON1〜CON3、CON8、CON12）
- `inception/domain-design/components.md`（4 つの contribution の振る舞いと、AggregateMapping / UseCaseDeclaration / LayerStructureDeclaration の所有）
- `inception/domain-design/decisions.md`（ADR-003、ADR-005、ADR-007、ADR-008、ADR-009）
- `construction/u7-core-contributions/functional-design/functional-design-questions.md`（Q1 挿入位置、Q2 対象外の Unit）
- U4 の設計 `construction/u4-design-sensors/functional-design/entities.md`（DeclarationDocument、AggregateMapping、UseCaseDeclaration、MultiAggregateStrategy、LayerStructureDeclaration とその子要素）と `functional-spec.md` §1〜§2（マニフェスト ID、宣言成果物の形式）
- U5 の設計 `construction/u5-rust-code-sensors/functional-design/functional-spec.md` §1・§7（Rust マニフェスト ID、code-generation の fragments に載せる実装規約）
- U2 の設計 `construction/u2-rust-analysis-foundation/functional-design/functional-spec.md` §1（`conventions()` の規約が fragments の出典）
- 参照プラグイン `aidlc-workflows/plugins/test-pro/contributions/`（contribution ファイルの形）
- コアのステージ定義（`domain-design`、`functional-design`、`infrastructure-design`、`code-generation` の Steps 番号）

本書は U7 が所有する「contribution という文書」の構造の定義である。U7 は実行時の振る舞いを持たない spec Unit で、4 つの Markdown ファイルの frontmatter と本文（fragments）を定める。宣言成果物（`ddd-aggregate-mapping` / `ddd-use-case-declarations` / `ddd-layer-structure`）の yaml の形は U4 が所有し、本書では再定義せず「fragments がどの形式を指示するか」だけを扱う。

## エンティティ定義（正）

```yaml
entities:
  - name: Contribution
    description: contributions/<phase>/<target>.md の 1 ファイル。コアステージ 1 つに対する追加のみの拡張（CON1）
    attributes:
      - { name: target, type: enum, allowed: [domain-design, functional-design, infrastructure-design, code-generation], required: true, unique: true }
      - { name: path, type: string, required: true, constraints: "contributions/inception/domain-design.md、contributions/construction/functional-design.md、contributions/construction/infrastructure-design.md、contributions/construction/code-generation.md" }
      - { name: plugin, type: string, required: true, default: ddd }
      - { name: adds, type: ContributionAdds, required: true }
      - { name: fragments, type: list<Fragment>, required: true, constraints: "1 件以上。anchor は実装済みの 4 種のみ（FR3.4）" }
      - { name: language, type: enum, allowed: [en], required: true, constraints: "本文は英語（U6 Q4 と同じ理由）" }
    relationships:
      - { target: ContributionAdds, cardinality: "1", direction: contains }
      - { target: Fragment, cardinality: "1..*", direction: contains }

  - name: ContributionAdds
    description: frontmatter の adds。使う面は consumes / produces / sensors だけ（required_sections と requires_stage は機械強制されないため使わない、CON2・CON3）
    attributes:
      - { name: consumes, type: list<ConsumeEntry>, required: false, default: "[]", constraints: "domain-design だけが ddd-domain-model-yaml（required: true）を持つ（FR3.1）" }
      - { name: produces, type: list<string>, required: false, default: "[]", constraints: "domain-design → [ddd-aggregate-mapping]、functional-design → [ddd-use-case-declarations]、infrastructure-design → [ddd-layer-structure]、code-generation → []（ADR-008、ADR-003）" }
      - { name: sensors, type: list<string>, required: true, constraints: "domain-design → [ddd-model-presence, ddd-reference-ids, ddd-mapping-declarations]、functional-design → [ddd-reference-ids, ddd-mapping-declarations, ddd-design-advisories]、infrastructure-design → [ddd-layer-structure, ddd-design-advisories]、code-generation → [ddd-rust-domain, ddd-rust-use-case, ddd-rust-interface-adapter]" }

  - name: ConsumeEntry
    description: adds.consumes の 1 行
    attributes:
      - { name: artifact, type: string, required: true, constraints: "ddd-domain-model-yaml" }
      - { name: required, type: boolean, required: true, constraints: "true。domain-modeling が SKIP のスコープでは producer が走らないため moot になる（stage-definition.md の consumes[].required の意味）" }

  - name: Fragment
    description: 本文の ## fragment: <anchor> 節 1 つ。コアの手順に追加される prose
    attributes:
      - { name: anchor, type: string, required: true, constraints: "after-step:<n> / before-step:<n> / end-of-steps / in:<Compartment> のいずれか（FR3.4、CON8）。<n> はコアの現行ステップ番号" }
      - { name: order, type: integer, required: true, constraints: "同じ anchor 内の並び。100 起点で 10 刻み" }
      - { name: kind, type: enum, allowed: [question-topics, declaration-instruction, procedure, conventions, sensor-guidance], required: true, constraints: "question-topics = 質問に含める事項、declaration-instruction = 宣言成果物を書けという指示、procedure = 設計手順の挿入、conventions = 命名・配置・実装規約、sensor-guidance = Sensors 節の案内" }
      - { name: heading, type: string, required: true, constraints: "### Step <n>x (ddd): <title> の形（参照プラグインに倣う）。in:Sensors は ### 見出しなし" }
      - { name: references, type: list<string>, required: true, default: "[]", constraints: "参照するナレッジ（U8 のファイル名）、宣言形式の出典（U4）、規約の出典（U2 conventions()）" }
      - { name: max_lines, type: integer, required: true, default: 40, constraints: "fragment は短く保ち、詳細はナレッジに置く（ADR-006）" }

  - name: DeclarationInstruction
    description: kind = declaration-instruction の fragment が指示する内容。U4 の DeclarationDocument の形式に一致させる
    attributes:
      - { name: logical_name, type: enum, allowed: [ddd-aggregate-mapping, ddd-use-case-declarations, ddd-layer-structure], required: true }
      - { name: file_name, type: string, required: true, constraints: "ddd-aggregate-mapping.md / ddd-use-case-declarations.md / ddd-layer-structure.md。ステージの記録ディレクトリ（per-unit ステージは Unit ディレクトリ）に置く。ルートは書かない（engine-resolved）" }
      - { name: yaml_root_keys, type: list<string>, required: true, constraints: "schema_version: 1、model_ref、そして aggregate_mappings: / use_cases: / layer_structures: のいずれか（U4 §2）" }
      - { name: required_fields, type: list<string>, required: true, constraints: "U4 entities.md の該当エンティティの required 属性をそのまま列挙する" }
      - { name: human_table, type: string, required: true, constraints: "yaml に併記する人間向けの表の列" }
      - { name: empty_form, type: string, required: true, constraints: "Q2。対象外の Unit では一覧を空配列にし、「This unit has no aggregates / use cases / bounded contexts in scope」の一文を添える" }

  - name: QuestionTopicAddition
    description: kind = question-topics の fragment が、コアの質問生成ステップに足すトピック
    attributes:
      - { name: target, type: enum, allowed: [domain-design, functional-design, infrastructure-design], required: true }
      - { name: topics, type: list<string>, required: true, constraints: "domain-design: 集約ごとのプログラミングモデルと永続化方式（2 軸）、写像先のクレート・モジュール・リポジトリ; functional-design: ユースケースごとの対象集約・Command・再実行可能性・回復方針・複数集約時の戦略・読み取りモデルの公開範囲; infrastructure-design: CQRS の有無、コマンド側・クエリ側・RMU のクレート、クレートの依存先、ポートとリポジトリ、復元経路、永続化基盤" }

  - name: ConventionsFragment
    description: code-generation の after-step:1 に挿入する規約（kind = conventions）。U2 と U5 の設計を出典にし、値を再定義しない
    attributes:
      - { name: crate_layout, type: string, required: true, constraints: "層の接尾辞 -domain / -use-case / -interface-adapter / -infrastructure、配置 packages|modules/<layer>/、CQRS 側 -command- / -query- / -rmu、composition root は bin 専用クレート（U2 BR2〜BR3）" }
      - { name: domain_rules, type: list<string>, required: true, constraints: "private フィールドのみ、&mut self は正規モデルの Command 名（snake_case）に一致、replay は apply / apply_event / replay / on_event、init / setup 等の後付け初期化禁止、完全コンストラクタは Self 系を返す関連関数、Default を derive しない（U5 BR3〜BR4）" }
      - { name: use_case_rules, type: list<string>, required: true, constraints: "execute の引数は ID と VO、ユースケース間の execute 呼び出し禁止、getter 呼び出し禁止、I/O クレート（固定一覧）への依存禁止（U5 BR5）" }
      - { name: adapter_rules, type: list<string>, required: true, constraints: "コマンド側⇄クエリ側の相互参照禁止（rmu は例外）、クエリ側はドメイン型・Repository を参照しない、<Aggregate>Repository 命名と媒体語禁止、復元は完全コンストラクタ経由（U5 BR6）" }
      - { name: sensor_ids, type: list<string>, required: true, constraints: "ddd-rust-domain / ddd-rust-use-case / ddd-rust-interface-adapter が code-summary を契機に申告ソースを検査すること（ADR-003）" }
```

## 要約

- **Contribution** は 4 ファイルで、`adds` は consumes / produces / sensors の 3 面だけを使う（機械強制されない `required_sections` と未実装の `requires_stage` は使わない）。`domain-design` だけが `ddd-domain-model-yaml` を必須入力に加え、`code-generation` は成果物を足さず sensors と fragments だけを持つ。
- **Fragment** は Q1 のとおり「質問生成の直後（question-topics）」と「成果物生成の直後（declaration-instruction）」の対で入れ、`code-generation` は計画前の conventions と Sensors 節の sensor-guidance を入れる。fragment は短く保ち（40 行目安）、詳細はナレッジ（U8）と宣言形式（U4）を参照する。
- **DeclarationInstruction** は U4 が定めた宣言成果物の形式をそのまま指示し、Q2 の空の形（`use_cases: []` 等）を含める。
- `components.md` からの差分: 4 つの contribution の entities（AggregateMapping 等）は U4 の解析契約が所有するため本書では再定義せず、contribution の文書構造（Fragment、DeclarationInstruction、ConventionsFragment）を設計上の型として追加した。

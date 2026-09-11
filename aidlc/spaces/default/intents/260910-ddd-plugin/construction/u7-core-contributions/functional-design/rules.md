# 業務ルール — U7 コアステージ contribution（u7-core-contributions）

## Sources

- `inception/units-generation/unit-of-work.md`（U7 の境界: 成果物の解析は U4、命名・配置規約の出典は U2。anchor は実装済み 4 種のみ、追加のみ、ADR-009 の必須項目）
- `inception/units-generation/unit-of-work-story-map.md`（U7 の要件: FR3、FR3.1〜FR3.5、FR4、FR4.1〜FR4.3、FR5、FR5.1〜FR5.3、FR8.3）
- `inception/requirements-analysis/requirements.md`（各規則の出典。CON1〜CON3、CON8、CON12）
- `inception/domain-design/components.md`、`decisions.md`（ADR-003、ADR-005、ADR-007、ADR-008、ADR-009）
- `construction/u7-core-contributions/functional-design/functional-design-questions.md`（Q1〜Q2）
- `construction/u7-core-contributions/functional-design/entities.md`（型の定義）
- U4 の設計 `construction/u4-design-sensors/functional-design/rules.md`（BR1.3 契機の成果物パス、BR4〜BR7 の検査内容）と `entities.md`（宣言成果物の属性）
- U5 の設計 `construction/u5-rust-code-sensors/functional-design/rules.md`（BR3〜BR6 の規約）
- U2 の設計 `construction/u2-rust-analysis-foundation/functional-design/rules.md`（BR2〜BR3 の命名・配置規約）
- コアのステージ定義の Steps 番号（`domain-design` 1〜8、`functional-design` 1〜6、`infrastructure-design` 1〜7、`code-generation` 1〜7）

U7 の規則は「4 つの contribution をどう書くか」である。検査は U4 / U5、宣言の形式は U4、規約の値は U2 / U5 が所有し、U7 はそれらを束ねて指示する側に徹する。

## ルール定義（正）

```yaml
rules:
  # ---------- BR1: contribution の形（CON1〜CON3、CON8、FR3.4） ----------
  - id: BR1.1
    statement: contribution は contributions/<phase>/<target>.md に 1 ステージ 1 ファイルで置き、frontmatter は target / plugin: ddd / adds / fragments を持つ
    category: constraint
    applies_to: Contribution
    trigger: 作成時
    logic: 参照プラグイン test-pro と同じ形。本文は ## fragment: <anchor> 見出しの節を fragments の宣言と同数持つ
    violation: compose が contribution を拒否する、または drops ログに落ちる
    source: FR3.4、FR11.5、domain-layer-design §10
  - id: BR1.2
    statement: adds は consumes / produces / sensors だけを使い、required_sections、requires_stage、when:、after-questions、dependencies を使わない
    category: constraint
    applies_to: ContributionAdds
    trigger: 作成時
    logic: 機械強制されない、または未実装の面に依存しない（CON2、CON3、CON8）。章構造の保証は U4 の gate センサーが担う
    violation: drops ログが空でなくなる（FR11.5 の判定）
    source: FR11.5、CON2、CON3、CON8
  - id: BR1.3
    statement: anchor は after-step:<n> / before-step:<n> / end-of-steps / in:<Compartment> の 4 種だけを使い、<n> はコアの現行ステップ番号に合わせる
    category: constraint
    applies_to: Fragment
    trigger: 作成時
    logic: Q1 の位置: domain-design after-step:2 / after-step:4、functional-design after-step:2 / after-step:4、infrastructure-design after-step:2 / after-step:5、code-generation after-step:1 / in:Sensors。コアのステップ番号が変わったら U9 の統合テスト（drops ログ）で検出し追随する
    violation: drops ログに unknown anchor が出る（FR3.4 の判定）
    source: FR3.4、CON8、Q1
  - id: BR1.4
    statement: fragments は追加のみで、コアの手順・成果物・契約を上書き・削除する表現を含まない
    category: constraint
    applies_to: Fragment
    trigger: 作成時
    logic: 「コアの成果物の代わりに」「〜を省略してよい」といった指示を書かない。コアの成果物と重複する情報は参照 ID で結ぶ（ADR-008）
    violation: レビューで検出
    source: CON1、ADR-008
  - id: BR1.5
    statement: 各 fragment は 40 行を目安に短く保ち、規約の詳細と根拠はナレッジ（U8）を、宣言の形式は U4 の契約を参照する
    category: policy
    applies_to: Fragment
    trigger: 作成時
    logic: fragment は「何を、どの形式で、どこに書くか」と「どの質問を足すか」だけを書く。コード例は ≤15 行の yaml 断片に限る
    violation: レビューで検出
    source: ADR-006
  - id: BR1.6
    statement: 本文は英語で書き、成果物の論理名・センサー ID・anchor は preserved token としてそのまま書く
    category: policy
    applies_to: Contribution
    trigger: 常時
    logic: U6 Q4 / U8 Q1 と同じ理由（コアと揃え、OSS 公開向け）
    violation: なし
    source: U6 Q4

  # ---------- BR2: domain-design への contribution（FR3.1〜FR3.5） ----------
  - id: BR2.1
    statement: adds.consumes に ddd-domain-model-yaml（required: true）を加え、正規モデルが無い場合は domain-design の入力欠落として扱わせる
    category: constraint
    applies_to: ContributionAdds
    trigger: 作成時
    logic: domain-modeling が SKIP のスコープでは producer が走らないため moot になり、domain-design は通常どおり進む。EXECUTE で欠落なら U4 の model-presence（blocking）が止める
    violation: compose 後の domain-design ノードの consumes に含まれない（FR3.1 の判定）
    source: FR3.1、RA-Q1、ADR-007
  - id: BR2.2
    statement: adds.produces に ddd-aggregate-mapping を加え、after-step:4 の fragment で <record>/inception/domain-design/ddd-aggregate-mapping.md を U4 の形式（schema_version、model_ref、aggregate_mappings: 各行に aggregate_ref / programming_model / persistence_method / crate / module / ports / repository / reference_ids）で書かせる
    category: constraint
    applies_to: DeclarationInstruction
    trigger: 作成時
    logic: 正規モデルの全 Aggregate について 1 行ずつ（U4 BR5.1）。reference_ids は 1 件以上（U4 BR4.4）。Entity / Aggregate / 不変条件を再定義しないことを明記する（FR3.2）
    violation: U4 の reference-ids / mapping-declarations が止める
    source: FR3.2、FR3.3、ADR-008、U4 §2
  - id: BR2.3
    statement: after-step:2 の fragment で、質問に「集約ごとのプログラミングモデル（actor / class）と永続化方式（state-sourcing / event-sourcing）」と「写像先のクレート・モジュール・リポジトリ」を含めさせる
    category: policy
    applies_to: QuestionTopicAddition
    trigger: 作成時
    logic: 2 軸は集約ごと（または Bounded Context ごと）に独立に問う。組み合わせの影響（アクターモデルなら Process Manager、クラスベースなら再実行可能なユースケース）をナレッジ ddd-cqrs-and-consistency.md の参照で示す
    violation: なし
    source: FR3.3、FR3.4、use-case-layer-design §6
  - id: BR2.4
    statement: adds.sensors は ddd-model-presence、ddd-reference-ids、ddd-mapping-declarations の 3 つとする
    category: constraint
    applies_to: ContributionAdds
    trigger: 作成時
    logic: 参照 ID 検査（FR6.1）と正規モデル存在検査（FR6.4）に加え、2 軸宣言の検査（FR3.3）を束ねる。contribution は ID を列挙するだけで検査の実体は U4
    violation: compose 後の domain-design ノードの sensors に含まれない（FR3.5 の判定）
    source: FR3.5、U4 §1

  # ---------- BR3: functional-design への contribution（FR4.1〜FR4.3） ----------
  - id: BR3.1
    statement: adds.produces に ddd-use-case-declarations を加え、after-step:4 の fragment で <record>/construction/<unit>/functional-design/ddd-use-case-declarations.md を U4 の形式（use_cases: 各行に use_case_id / name / target_aggregates / commands / re_execution_basis / recovery_policy / multi_aggregate_strategy / read_model_exposure）で書かせる
    category: constraint
    applies_to: DeclarationInstruction
    trigger: 作成時
    logic: 必須 6 項目（FR4.1）は U4 の required 属性に対応する。複数集約のときは multi_aggregate_strategy（process-manager または re-execution）を必須にする（U4 BR5.2）。対象のない Unit は use_cases: [] と一文（Q2）
    violation: U4 の mapping-declarations が止める
    source: FR4.1、ADR-008、Q2、U4 §2
  - id: BR3.2
    statement: after-step:2 の fragment で、規約 5 点セット（DIP、execute の引数は集約 ID と VO のみ、ユースケース間呼出禁止、業務判断はドメインに置く、I/O はポート経由のみ）、「ユースケースは進行役」の原則、トランザクション境界（集約＝強整合、ユースケース＝弱整合）、再実行可能性の設計手順（store は upsert、同値更新の許容、コマンド ID 記憶、作成系のゴミ集約の許容）を手順として挿入し、質問に 6 項目を含めさせる
    category: policy
    applies_to: Fragment
    trigger: 作成時
    logic: 手順は要点だけを書き、根拠はナレッジ ddd-use-case-conventions.md を参照する。複数集約を跨ぐ流れにはまず集約境界の引き直しを促す
    violation: compose 後の functional-design 本文に現れない（FR4.2 の判定）
    source: FR4.2、use-case-layer-design §2〜§5
  - id: BR3.3
    statement: adds.sensors は ddd-reference-ids、ddd-mapping-declarations、ddd-design-advisories の 3 つとする
    category: constraint
    applies_to: ContributionAdds
    trigger: 作成時
    logic: (g)(h)(i)(d) はコード側の規則で code-generation の Rust マニフェスト（U5）が検査するため、functional-design に束ねるのは設計側の検査（6 項目、(j) 冪等性戦略、複数集約更新の advisory）である。FR4.3 の「(g)(h)(i)(d)(j) をバインドする」は、(j) と 6 項目を mapping-declarations で、(g)(h)(i)(d) を code-generation の Rust マニフェストで満たす（ADR-009 の設計側／コード側の分離を functional-design にも適用する）
    violation: compose 後の functional-design ノードの sensors に含まれない
    source: FR4.3、FR4.4、ADR-009、U4 §1
  - id: BR3.4
    statement: 複数集約更新の検出は ddd-design-advisories（advisory）に委ね、fragment で「検出されてもレビュー対象であり進行は止まらない」と案内する
    category: policy
    applies_to: Fragment
    trigger: 作成時
    logic: FR4.4 の判定（advisory の verdict）は U4 BR7.1 が担う
    violation: なし
    source: FR4.4、FR6.6

  # ---------- BR4: infrastructure-design への contribution（FR5.1〜FR5.4） ----------
  - id: BR4.1
    statement: adds.produces に ddd-layer-structure を加え、after-step:5 の fragment で <record>/construction/<unit>/infrastructure-design/ddd-layer-structure.md を U4 の形式（layer_structures: 各行に context_ref / cqrs / command_side_crates / query_side_crates / rmu_crates / crate_dependencies / ports / repositories / restoration_paths / persistence_backend）で書かせる
    category: constraint
    applies_to: DeclarationInstruction
    trigger: 作成時
    logic: ADR-009 の必須項目（各クレートの依存先、リポジトリ名、集約ごとの復元経路）を含める。宣言する Bounded Context は、その Unit の集約（ddd-aggregate-mapping の crate が Unit のクレートに属するもの）が属するもの。対象のない Unit は layer_structures: [] と一文（Q2）
    violation: U4 の layer-structure が止める
    source: FR5.1、ADR-009、Q2、U4 §2
  - id: BR4.2
    statement: after-step:2 の fragment で、CQRS の有無と層構造（コマンド側／クエリ側／RMU）、ポート・リポジトリ規約（Repository / 外部システムクライアント / ES 基盤ポートの分類、<集約名>Repository 命名、I/O 単位は集約単体または集合、動詞は find_by_id / store（upsert）/ delete_by_id、媒体名の禁止、in-memory から始める、クエリ側は DAO＋DTO）、永続化基盤の選定（CQRS/ES は CDC 対応 KVS、ステートソーシングは RDB 可）、RMU 設計（順序は基盤保証、冪等性はシーケンス番号の条件付き書き込み）を手順として挿入し、質問に宣言事項を含めさせる
    category: policy
    applies_to: Fragment
    trigger: 作成時
    logic: 要点だけを書き、根拠はナレッジ ddd-interface-adapter-conventions.md を参照する。クレート命名は U2 の規約（接尾辞・配置・CQRS 側・composition root）に従わせる
    violation: compose 後の infrastructure-design 本文に現れない（FR5.2、FR5.3 の判定）
    source: FR5.2、FR5.3、ADR-005、interface-adapter-layer-design §2〜§7
  - id: BR4.3
    statement: adds.sensors は ddd-layer-structure、ddd-design-advisories の 2 つとする
    category: constraint
    applies_to: ContributionAdds
    trigger: 作成時
    logic: 設計側の (k)(l)(m)(n)（FR5.4）は ddd-layer-structure が宣言に対して検査し、リポジトリスコープと store の upsert（FR5.5）は advisory。コード側は code-generation の Rust マニフェスト
    violation: compose 後の infrastructure-design ノードの sensors に含まれない（FR5.4 の判定）
    source: FR5.4、FR5.5、ADR-009、U4 §1

  # ---------- BR5: code-generation への contribution（FR8.3、ADR-003） ----------
  - id: BR5.1
    statement: adds.sensors は ddd-rust-domain、ddd-rust-use-case、ddd-rust-interface-adapter の 3 つとし、adds.produces と adds.consumes は持たない
    category: constraint
    applies_to: ContributionAdds
    trigger: 作成時
    logic: 契機の code-summary はコアの code-generation が produces に宣言済み（ADR-003）。マニフェストの matches が **/code-summary.md に絞る
    violation: compose 後の code-generation ノードの sensors に 3 ID が含まれない（FR8.3 の判定）
    source: FR8.3、ADR-003、U5 §1
  - id: BR5.2
    statement: after-step:1 の fragment で、クレート命名・配置規約（U2）、ドメイン層・ユースケース層・IA 層の実装規約（U5 の規則 (a)〜(n) の要点）、正規モデルの Command 以外の状態変更メソッドを書かないこと、replay 経路と後付け初期化の名前、I/O クレートの固定一覧を、計画（Step 2）の前に読む規約として挿入する
    category: policy
    applies_to: ConventionsFragment
    trigger: 作成時
    logic: 値は U2 の conventions() と U5 の lists.ts を出典にし、fragment 内で再定義しない（改訂時に 1 か所で済ませる）。詳細はナレッジ ddd-rust-domain-conventions.md / ddd-rust-persistence-conventions.md を参照する
    violation: レビューで検出
    source: FR8.3、ADR-005、U5 §7
  - id: BR5.3
    statement: in:Sensors の fragment で、3 本の Rust マニフェストが code-summary を契機に申告ソースだけを検査すること、所見の rule_id（a〜n、layer.*、model.invalid）の意味、失敗時の直し方を案内する
    category: policy
    applies_to: Fragment
    trigger: 作成時
    logic: 正規モデルが無いワークフローでは正規モデル依存の検査が省略される（U5 Q2）ことも書く
    violation: なし
    source: FR8.3、U5 BR3.4、BR7.1

  # ---------- BR6: 宣言成果物の共通事項（ADR-008、Q2、CON12） ----------
  - id: BR6.1
    statement: 宣言成果物は Markdown で、最初の fenced yaml ブロックを正とし、人間向けの表を併記する。yaml の先頭は schema_version: 1 と model_ref
    category: constraint
    applies_to: DeclarationInstruction
    trigger: 作成時
    logic: model_ref の既定は inception/domain-modeling/domain-model.yaml（記録ディレクトリ相対）。U4 BR4.1 が形を検査する
    violation: U4 の <manifest>.document が止める
    source: ADR-008、U4 BR4.1
  - id: BR6.2
    statement: 参照は正規モデルの ElementId（aggregate.* / command.* / pm.* など）で書き、Entity / Aggregate / 不変条件を再定義しない
    category: constraint
    applies_to: DeclarationInstruction
    trigger: 作成時
    logic: U4 の reference-ids が未定義・廃止・種別違反を止める
    violation: U4 の reference-ids が止める
    source: FR3.2、domain-layer-design §4
  - id: BR6.3
    statement: 対象のない Unit では一覧を空配列にした宣言を書き、成果物を省略しない
    category: policy
    applies_to: DeclarationInstruction
    trigger: 作成時
    logic: Q2。空の一覧に対して U4 の検査は所見を出さない（要素ごとの検査）。「This unit has no … in scope」の一文を表の代わりに書く
    violation: なし
    source: Q2
  - id: BR6.4
    statement: 論理名はすべて ddd- 接頭辞で、コアの成果物名や無接頭辞名を使わない
    category: constraint
    applies_to: ContributionAdds
    trigger: 作成時
    logic: CON12。compile が論理名を拒否しないことを U9 が確認する
    violation: compile が拒否する
    source: FR11.2、CON12
```

## ルール要約

| ID | 分類 | 要点 | 出典 |
|---|---|---|---|
| BR1.1〜BR1.6 | 形 | 1 ステージ 1 ファイル、adds の 3 面、anchor 4 種と位置、追加のみ、短く、英語 | FR3.4、CON1〜CON3、CON8、Q1 |
| BR2.1〜BR2.4 | domain-design | 正規モデルを必須入力、写像成果物、2 軸の質問、3 センサー | FR3.1〜FR3.5 |
| BR3.1〜BR3.4 | functional-design | ユースケース宣言、規約 5 点と手順、3 センサー、複数集約は advisory | FR4.1〜FR4.4 |
| BR4.1〜BR4.3 | infrastructure-design | 層構造宣言、ポート・永続化・RMU の手順、2 センサー | FR5.1〜FR5.5 |
| BR5.1〜BR5.3 | code-generation | 3 つの Rust センサー、計画前の規約、Sensors 節の案内 | FR8.3、ADR-003 |
| BR6.1〜BR6.4 | 宣言の共通 | fenced yaml が正、参照 ID、空の宣言、ddd- 接頭辞 | ADR-008、Q2、CON12 |

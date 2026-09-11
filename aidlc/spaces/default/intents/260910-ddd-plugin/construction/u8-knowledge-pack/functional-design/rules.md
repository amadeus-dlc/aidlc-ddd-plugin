# 業務ルール — U8 ナレッジ（u8-knowledge-pack）

## Sources

- `inception/units-generation/unit-of-work.md`（U8 の境界: 必須条件はナレッジだけに任せず U4〜U7 にも定義する。スキーマと命名規約の説明は U1・U2 の実装を出典にする）
- `inception/units-generation/unit-of-work-story-map.md`（U8 の要件: FR10、FR10.1〜FR10.6）
- `inception/requirements-analysis/requirements.md`（各規則の出典）
- `inception/domain-design/components.md`（DddKnowledgePack）と `decisions.md`（ADR-006、ADR-010）
- `construction/u8-knowledge-pack/functional-design/functional-design-questions.md`（Q1〜Q3）
- `construction/u8-knowledge-pack/functional-design/entities.md`（型の定義）
- `ddd/docs/domain-layer-design.md` §9、`ddd/docs/use-case-layer-design.md` §9、`ddd/docs/interface-adapter-layer-design.md` §9

U8 の規則は「ナレッジ文書をどう書き、どこに置き、何を主張してよいか」の執筆規則である。検査主体は執筆者（code-generation の developer）と U9 の統合テスト、そしてレビューである。

## ルール定義（正）

```yaml
rules:
  # ---------- BR1: 配置と命名（FR10.3、FR10.4、ADR-006、CON6） ----------
  - id: BR1.1
    statement: ナレッジは knowledge/<agent-slug>/ に置き、ディレクトリ名は消費するエージェントの slug と完全一致させる
    category: constraint
    applies_to: KnowledgeFile
    trigger: ファイル作成時
    logic: 許すディレクトリは aidlc-architect-agent / aidlc-developer-agent / aidlc-aws-platform-agent / aidlc-shared の 4 つだけ。タイポは compose が黙って無視するため、U9 の PlacementCheck で検出する
    violation: PlacementCheck が fail
    source: FR10.3、ADR-006、CON6
  - id: BR1.2
    statement: ファイル名は ddd- 接頭辞を付け、コアの knowledge/ に既存の名前と衝突させない
    category: constraint
    applies_to: KnowledgeFile
    trigger: ファイル作成時
    logic: 8 本の名前は functional-spec.md §1 で固定する。コアの既存名（ddd-patterns.md、architecture-guide.md など）とは stem が異なることを U9 が検証する
    violation: compose が上書きを拒否する（CON6、FR10.4）
    source: FR10.4
  - id: BR1.3
    statement: aidlc-shared/ には層境界と依存方向の原則だけを置き、他の主題を置かない
    category: policy
    applies_to: KnowledgeFile
    trigger: ファイル作成時
    logic: aidlc-shared は全エージェントが全ステージで読むため、分量を最小にする
    violation: レビューで検出
    source: ADR-006
  - id: BR1.4
    statement: 各ファイルは consumers に挙げたステージの lead または support エージェントのディレクトリに置く
    category: constraint
    applies_to: KnowledgeFile
    trigger: ファイル作成時
    logic: domain-modeling / domain-design / functional-design のリード = architect、code-generation のリード = developer、infrastructure-design のリード = aws-platform。functional-design の support は developer
    violation: PlacementCheck が fail
    source: FR10.3、ADR-006

  # ---------- BR2: 内容の網羅（FR10.1、FR10.2、Q2） ----------
  - id: BR2.1
    statement: FR10.1 の基盤トピックはすべて architect の 4 本または shared の 1 本のいずれかに載せる
    category: constraint
    applies_to: KnowledgeFile
    trigger: 執筆時
    logic: 対応表は functional-spec.md §2。トピックが 1 つでも欠ければ違反
    violation: レビューで検出（FR10.1 の判定）
    source: FR10.1、Q2
  - id: BR2.2
    statement: FR10.2 の Rust トピックはすべて developer の 2 本のいずれかに載せる
    category: constraint
    applies_to: KnowledgeFile
    trigger: 執筆時
    logic: 対応表は functional-spec.md §2
    violation: レビューで検出（FR10.2 の判定）
    source: FR10.2、Q2
  - id: BR2.3
    statement: IA 層の規約（ポート設計、永続化基盤の選定、RMU 設計、コマンド側からリードモデルを読まない理由、upstream-contracts、infrastructure 層は言語拡張のみ）は aws-platform の 1 本に載せる
    category: constraint
    applies_to: KnowledgeFile
    trigger: 執筆時
    logic: 対応表は functional-spec.md §2
    violation: レビューで検出
    source: FR10.1、interface-adapter-layer-design §9

  # ---------- BR3: 言語と書式（Q1） ----------
  - id: BR3.1
    statement: 本文は英語で書く
    category: constraint
    applies_to: KnowledgeFile
    trigger: 執筆時
    logic: 識別子・ID・パス・規則記号 (a)〜(n) はそのまま。日本語の設計書から引用するときは英訳し、原文の出典（ファイルと節）を併記する
    violation: レビューで検出
    source: Q1
  - id: BR3.2
    statement: 各ファイルは H1 のタイトル、H2 の節（Purpose を先頭、Sources を末尾）、表または箇条書きで構成し、コアのナレッジと同じ書式に揃える
    category: constraint
    applies_to: KnowledgeFile
    trigger: 執筆時
    logic: 節の種別は entities.md の KnowledgeSection.kind。長い散文より表を優先する
    violation: レビューで検出
    source: コアのナレッジの書式
  - id: BR3.3
    statement: 1 ファイルは 250 行以内を目安にし、8 本の合計が 1500 行を超えない
    category: policy
    applies_to: KnowledgeFile
    trigger: 執筆時
    logic: エージェントはディレクトリの全ファイルを読むため、分量が読み込みコストになる。超える場合は要約を残して詳細を設計書への参照にする
    violation: なし（目安）
    source: Q2

  # ---------- BR4: 規則の書き方（FR10.5、FR10.6） ----------
  - id: BR4.1
    statement: すべての規則は rule_id を持ち、statement は ALWAYS / NEVER / PREFER のいずれかで始める 1 文にする
    category: constraint
    applies_to: RuleEntry
    trigger: 執筆時
    logic: rule_id は K.<topic>.<n>。文書間で一意
    violation: レビューで検出
    source: FR10.5
  - id: BR4.2
    statement: すべての規則は enforcement を明示し、guidance-only 以外は強制手段の参照（センサーの規則 ID、fragment の anchor、スキーマの属性）を必ず書く
    category: constraint
    applies_to: RuleEntry
    trigger: 執筆時
    logic: IF level ∈ {sensor, stage-contract, schema} AND refs が空 THEN 違反。IF 参照先が U4 / U5 / U6 / U7 / U1 の設計に存在しない THEN 違反
    violation: レビューで検出（「実装済みと主張するのは強制できる範囲だけ」）
    source: FR10.5、FR10.6
  - id: BR4.3
    statement: 必須条件（ALWAYS / NEVER）は guidance-only であってはならず、センサー・ステージ契約・スキーマのいずれかで強制されていなければならない
    category: constraint
    applies_to: RuleEntry
    trigger: 執筆時
    logic: IF statement が ALWAYS または NEVER で始まる AND level = guidance-only THEN 違反（PREFER に言い換えるか、強制手段を足す）
    violation: レビューで検出
    source: FR10.6
  - id: BR4.4
    statement: 例外には必ず理由を記録する
    category: constraint
    applies_to: RuleEntry
    trigger: 執筆時
    logic: exceptions の各項目は「<例外> — <理由>」の形
    violation: レビューで検出
    source: FR10.5
  - id: BR4.5
    statement: 規則の記述はコードの実測に anchored する。センサーで強制される規則は、その規則のゴールデンケース（違反あり／なし）を根拠として参照する
    category: policy
    applies_to: RuleEntry
    trigger: 執筆時
    logic: level = sensor の規則は example-index に fixture を持つ（BR6）
    violation: レビューで検出
    source: FR10.5

  # ---------- BR5: コアとの矛盾（FR10.4、ADR-010） ----------
  - id: BR5.1
    statement: ADR-010 の矛盾 4 件を conflicts 節に転記し、コアの記述・位置・プラグインの規約・適用範囲・採用理由・優先順位を書く
    category: constraint
    applies_to: ConflictEntry
    trigger: 執筆時
    logic: C-1 Repository の動詞、C-2 集約の導出、C-3 Entity の可変性、C-4 Event Sourcing とコマンドの戻り値。いずれも precedence = plugin
    violation: レビューで検出（FR10.4 の判定）
    source: FR10.4、ADR-010
  - id: BR5.2
    statement: 矛盾しないコアの記述（集約間参照は ID、トランザクションは集約を跨がない、リポジトリは集約ルート単位、クエリは別の読み取りモデル、VO をプリミティブより優先）はプラグイン側の根拠として引用する
    category: policy
    applies_to: KnowledgeSection
    trigger: 執筆時
    logic: rationale または principles の節で core-knowledge を SourceRef として引用する
    violation: なし
    source: ADR-010
  - id: BR5.3
    statement: 衝突時の優先順位を meta 節に明文化する: プラグインの規約 > コアのナレッジ、ただし Bounded Context 間の連携パターンはコアを引き続き適用する
    category: constraint
    applies_to: KnowledgeSection
    trigger: 執筆時
    logic: meta 節（ddd-always-valid-model.md に置く）に記載し、他のファイルはそこを参照する
    violation: レビューで検出
    source: FR10.5、ADR-010

  # ---------- BR6: 例の索引（FR10.5、Q3） ----------
  - id: BR6.1
    statement: 良い例はスニペットではなく、ゴールデンケースの「違反なし」fixture をリポジトリ相対パスで索引する
    category: constraint
    applies_to: ExampleIndexEntry
    trigger: 執筆時
    logic: fixture_path は tests/golden/<suite>/<sensor-id>/clean-*/ 配下。存在しない fixture を指してはならない（U9 のテストが検証）
    violation: テスト失敗
    source: FR10.5、Q3
  - id: BR6.2
    statement: 各索引には、投影先のハーネスからは fixture を参照できない旨と、プラグインのリポジトリでの参照方法を注記する
    category: constraint
    applies_to: ExampleIndexEntry
    trigger: 執筆時
    logic: projection_note は必須
    violation: レビューで検出
    source: Q3
  - id: BR6.3
    statement: ナレッジ本文にコード例を置く場合は 15 行以下の最小例に限り、規則の「良い例」の代わりにしない
    category: policy
    applies_to: KnowledgeFile
    trigger: 執筆時
    logic: 設計ステージの制約と同じ上限
    violation: レビューで検出
    source: Q3

  # ---------- BR7: 出典と失効（ADR-006、FR10.5） ----------
  - id: BR7.1
    statement: スキーマと ID 文法の説明は U1 の設計を、命名・配置規約の説明は U2 の設計を出典にし、ナレッジ側で再定義しない
    category: constraint
    applies_to: KnowledgeSection
    trigger: 執筆時
    logic: SourceRef.kind = unit-design で construction/u1-*/functional-design/ または construction/u2-*/functional-design/ を指す。値の列挙（接頭辞、接尾辞、CQRS 側の印）は転記してよいが「出典は U1 / U2」と明記する
    violation: レビューで検出
    source: ADR-006、FR10.6
  - id: BR7.2
    statement: 失効した規則は消さず、打ち消し線と失効注記（日付または版、理由、後継）で残す
    category: constraint
    applies_to: RetiredRule
    trigger: 改訂時
    logic: retired 節に移す。rule_id は再利用しない
    violation: レビューで検出
    source: FR10.5
  - id: BR7.3
    statement: すべてのファイルは Sources 節を持ち、設計書の節・ADR・Unit 設計・要件 ID のいずれかを 1 件以上引用する
    category: constraint
    applies_to: KnowledgeFile
    trigger: 執筆時
    logic: SourceRef の一覧
    violation: レビューで検出
    source: FR10.5

  # ---------- BR8: 検証（FR10.3、NFR4） ----------
  - id: BR8.1
    statement: compose 後、各対象ステージの inline_context_paths にそのステージの consumers に挙げたナレッジが現れることを U9 の統合テストで検証する
    category: constraint
    applies_to: PlacementCheck
    trigger: bun run check
    logic: domain-modeling / domain-design / functional-design → architect の 4 本 + shared; functional-design / code-generation → developer の 2 本 + shared; infrastructure-design → aws-platform の 1 本 + shared
    violation: テスト失敗
    source: FR10.3
  - id: BR8.2
    statement: 8 本の存在、ddd- 接頭辞、コアとの名前衝突なし、Sources 節の存在、example-index の fixture の実在をテストで検証する
    category: constraint
    applies_to: KnowledgeFile
    trigger: bun run check
    logic: ファイル名は functional-spec.md §1 の一覧と一致すること
    violation: テスト失敗
    source: FR10.4、NFR4
```

## ルール要約

| ID | 分類 | 要点 | 出典 |
|---|---|---|---|
| BR1.1〜BR1.4 | 配置と命名 | slug 完全一致、ddd- 接頭辞、shared は最小、consumers に応じた置き場 | FR10.3、FR10.4、ADR-006 |
| BR2.1〜BR2.3 | 網羅 | 基盤・Rust・IA のトピックがそれぞれのファイルに載る | FR10.1、FR10.2 |
| BR3.1〜BR3.3 | 言語と書式 | 英語、コアと同じ書式、分量の目安 | Q1、Q2 |
| BR4.1〜BR4.5 | 規則の書き方 | ID と文型、強制手段の明示、必須条件は強制されている、例外の理由、実測に anchored | FR10.5、FR10.6 |
| BR5.1〜BR5.3 | コアとの矛盾 | ADR-010 の 4 件の転記、矛盾しない記述の引用、優先順位の明文化 | FR10.4、ADR-010 |
| BR6.1〜BR6.3 | 例の索引 | fixture を索引、投影先の注記、最小スニペットの上限 | FR10.5、Q3 |
| BR7.1〜BR7.3 | 出典と失効 | U1 / U2 を出典、失効規則の残し方、Sources 節 | ADR-006、FR10.5 |
| BR8.1〜BR8.2 | 検証 | inline_context_paths の確認、存在・命名・衝突・索引の実在 | FR10.3、NFR4 |

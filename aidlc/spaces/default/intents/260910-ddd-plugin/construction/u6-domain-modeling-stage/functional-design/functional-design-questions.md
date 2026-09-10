# Functional Design — 確認事項（U6 domain-modeling ステージ / u6-domain-modeling-stage）

## Sources

- `inception/units-generation/unit-of-work.md`（U6 の責務: 新設ステージ `stages/inception/domain-modeling.md` の frontmatter と、イベント逆算から集約候補を導く手順本文、単独実行と入力なし対話の手順。kind: spec。Aggregate 境界までを所有する）
- `inception/units-generation/unit-of-work-story-map.md`（U6 に割り当てた要件: FR1、FR1.1〜FR1.9。先に固める要件は FR1.1〜FR1.4 の frontmatter）
- `inception/requirements-analysis/requirements.md`（FR1 各要件、FR2 正規モデルのスキーマ、FR6.5 完了条件の検査）
- `inception/domain-design/components.md`（DomainModelingStage の振る舞い、依存先 DomainModelSchema / DesignSensorSuite / DddKnowledgePack）
- `inception/domain-design/decisions.md`（ADR-004 状態ファイルの読み取り、ADR-006 ナレッジ配置、ADR-007 独立ステージとレビューア、ADR-010 コアとの矛盾）
- U1 の設計 `construction/u1-sensor-foundation/functional-design/entities.md`（`domain-model.yaml` の構造: schema_version、bounded_contexts、lineage、ElementId の文法、Command の effect / state_effect / idempotency）
- U4 の設計 `construction/u4-design-sensors/functional-design/rules.md`（BR2 model-completeness の検査内容、Q2 の md 側の約束: 見出しまたは表に element_id、不変条件の statement 全文）
- U8 の設計 `construction/u8-knowledge-pack/functional-design/functional-spec.md`（リードが読むナレッジ: ddd-always-valid-model、ddd-aggregate-and-invariants）
- `ddd/docs/domain-layer-design.md` §2〜§5、コアのステージ定義プロトコル `.claude/aidlc-common/protocols/stage-definition.md`（frontmatter の項目）
- 確定済みで再確認しない事項: frontmatter は `plugin: ddd`、`phase: inception`、`requires_stage` に `requirements-analysis`、`lead_agent: aidlc-architect-agent`、`mode: inline`、`reviewer: aidlc-architecture-reviewer-agent` + `review_class: advisory`、`scopes` は enterprise / feature / mvp / classic / workshop / refactor の 6 つ、`produces` は `ddd-domain-model` と `ddd-domain-model-yaml`、`sensors` に `ddd-model-completeness`（FR1.1〜FR1.4、FR1.7、ADR-007、U4）。正規モデルの構造と ID 文法は U1（FR2）。md の書き方は U4 Q2 の約束に従う。独自エージェントは作らない（ADR-007）。

設計書と上流の設計で決まっていない、ステージ手順そのものに関わる点だけを聞きます。

---

## Q1. `domain-modeling` は `user-stories` の後に置きますか？（グラフ上の位置）

文脈: 要件（FR1.2）は `requires_stage` に `requirements-analysis` を含めることだけを求めています。しかし `requires_stage` が `requirements-analysis` だけだと、コアの `user-stories` と並列になり、表示順のタイブレーク（アルファベット順）で `domain-modeling` が `user-stories` より前に走ります。その場合、推奨入力のはずのユーザーストーリー（`stories.md`）がステージ開始時にまだ存在しません。`requires_stage` に条件付きステージを足すのはコアの `domain-design`（`refined-mockups` を要求）と同じ扱いで、`user-stories` が SKIP のスコープでも順序辺として機能します。

- A. `requires_stage: [requirements-analysis, user-stories]` にして、ユーザーストーリーがあれば必ず読める位置に置く（FR1.2 の「requirements-analysis を含む」は満たす）
- B. `requires_stage: [requirements-analysis]` だけにし、ユーザーストーリーは「あれば読む」に留める（`user-stories` が後に走る構成では対話でドメイン語彙を引き出す）
- C. `requires_stage: [requirements-analysis, user-stories, refined-mockups]` にして、コアの `domain-design` の直前に置く（画面設計の語彙も入力にする）
- X. Other (please specify)

[Answer]: A. user-stories の後 (Recommended)

---

## Q2. ユビキタス言語が日本語などの非 ASCII のとき、安定 ID（`aggregate.<名前>` など小文字ケバブ）の名前セグメントをどう決めますか？

文脈: `element_id` の文法は `[a-z][a-z0-9-]*` のセグメント（U1 Q1）で、`name` は表示名として自由です。日本語の業務用語（例: 「請求書」）から `invoice` のような ID を導く方法はステージの手順として決める必要があります。ID は rename でも変わらない永続キーなので、最初の決め方が後々まで残ります。

- A. 質問ファイルで集約候補ごとに「英語の ID セグメント」を人間に確認する（ステージが英訳案を提示し、人間が承認または修正する）。`name` には元の言語の用語をそのまま残す
- B. ステージが英訳した ID を提示だけして確認は求めない（人間はレビュー承認で一括して見る）
- C. ローマ字化（`seikyusho`）を機械的に使い、英訳しない
- X. Other (please specify)

[Answer]: A. 英訳案を人間が確認 (Recommended)

---

## Q3. 既存コードがあるワークスペース（brownfield）では、逆解析の成果物（コード知識ベースの `architecture.md` / `component-inventory.md`）も集約候補の入力にしますか？

文脈: 設計書 §2 は「既存コードベースへの後付け適用を可能にする」ために単独実行を認めています。refactor スコープでは `domain-modeling` が EXECUTE で、`reverse-engineering` の成果物が存在します。ユーザーストーリーからのイベント逆算（トップダウン）に加えて、既存コードの構造（ボトムアップ）を候補の材料にするかどうかで、ステージの手順と `consumes` が変わります。

- A. `consumes` に `architecture` と `component-inventory` を `required: false`、`conditional_on: brownfield` で加え、手順で「既存コードの構造を集約候補の照合材料にする（ただし正規モデルの導出はイベント逆算を正とする）」と定める
- B. 入力はユーザーストーリーと対話だけにし、既存コードは参照しない（トップダウンに徹する）
- C. brownfield では既存コードの構造から集約候補を直接起こす（ボトムアップを正にする）
- X. Other (please specify)

[Answer]: A. 照合材料として読む (Recommended)

---

## Q4. ステージ定義ファイル（`stages/inception/domain-modeling.md`）の本文の言語はどうしますか？

文脈: ナレッジ本文は英語と決まりました（U8 Q1）。ステージ定義はリード（architect）が読む手順書で、コアのステージ定義はすべて英語です。OSS として公開するプラグインなので、コアとの一貫性と利用者の範囲が判断材料になります。質問ファイルと成果物（`domain-model.md`）は会話言語で書かれるため、この選択はステージ定義ファイルだけに影響します。

- A. 英語（コアのステージ定義と U8 のナレッジに揃える）
- B. 日本語（このプロジェクトの会話言語に揃える）
- X. Other (please specify)

[Answer]: A. 英語 (Recommended)

---

## Consolidated Summary Confirmation

- Q1 グラフ上の位置: `requires_stage: [requirements-analysis, user-stories]` にして、ユーザーストーリーがあれば必ず読める位置に置く（A）
- Q2 非 ASCII の ID: 集約候補ごとに英語の ID セグメント案を質問ファイルで提示し、人間が承認または修正する。`name` には元の言語の用語を残す（A）
- Q3 brownfield の入力: `consumes` に `architecture` と `component-inventory` を `required: false`、`conditional_on: brownfield` で加え、既存コードの構造を集約候補の照合材料にする。導出はイベント逆算を正とする（A）
- Q4 ステージ定義の言語: 英語（コアのステージ定義と U8 のナレッジに揃える）（A）

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

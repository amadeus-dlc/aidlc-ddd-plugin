# Unit 定義 — DDD プラグイン（AI-DLC v2）

## Sources

- `inception/domain-design/components.md`（14コンポーネントと依存グラフ。各 Unit はここに宣言されたコンポーネントを1つ以上含み、どのコンポーネントも1つの Unit にだけ属する）
- `inception/domain-design/decisions.md`（ADR-001 の4ライブラリ分離、ADR-002 の9マニフェスト、ADR-006 のナレッジ配置、ADR-009 の設計側／コード側検査の分離が Unit 境界を制約する）
- `inception/requirements-analysis/requirements.md`（FR1〜FR11、NFR1〜NFR10、制約 CON10〜CON12）
- `inception/units-generation/units-generation-questions.md`（Q1〜Q8 の確認済み回答と分解計画の承認）

`user-stories` は本スコープでは実行していないため、ストーリーの代わりに要件 ID（FR／NFR）を Unit に写像する。

## 分解方針

- 境界軸は「compose の合成面と依存の向き」（Q1）。共有ライブラリ → センサー群 → ステージ／contribution → ナレッジ → パッケージングの順に依存が流れる。
- 各 Unit は作り終えた時点で単独に検証できる。センサー Unit はゴールデンケースを同梱し（Q4）、宣言系 Unit は compose の統合テスト（`aidlc-plugin-test`）で検証する。
- 投影先はプラグイン1つ（`plugins/ddd/`）であり、Unit ごとの独立配布はしない。デプロイ形態はすべて「embedded（プラグインに同梱）」。

## Unit 一覧

| Unit ID | Directory | Unit 名 | kind | 複雑度 | 含むコンポーネント |
|---|---|---|---|---|---|
| U1 | u1-sensor-foundation | センサー基盤 | library | M | SensorRuntime、DomainModelSchema |
| U2 | u2-rust-analysis-foundation | Rust 解析基盤 | library | M | RustSyntaxAnalyzer、WorkspaceLayerResolver |
| U3 | u3-plugin-scaffold | プラグイン足場 | packaging | S | PluginPackaging（plugin.json の contributes 宣言、ビルド配線） |
| U4 | u4-design-sensors | 設計センサー | library | L | DesignSensorSuite、GoldenCaseSuite（設計センサー分と fixture 規約） |
| U5 | u5-rust-code-sensors | Rust コードセンサー | library | XL | RustCodeSensorSuite、GoldenCaseSuite（Rust センサー分） |
| U6 | u6-domain-modeling-stage | domain-modeling ステージ | spec | M | DomainModelingStage |
| U7 | u7-core-contributions | コアステージ contribution | spec | M | DomainDesignContribution、FunctionalDesignContribution、InfrastructureDesignContribution、CodeGenerationContribution |
| U8 | u8-knowledge-pack | ナレッジ | spec | M | DddKnowledgePack |
| U9 | u9-release-quality | 公開品質 | packaging | S | PluginPackaging（README、CHANGELOG、LICENSE、compose 統合テスト） |

PluginPackaging は U3 と U9 に分かれる（Q7）。足場の更新は他の Unit が投影されるための前提で、公開品質はすべての Unit が揃ってから仕上げるため、変更時期が異なる。

## Unit 詳細

### U1 センサー基盤（u1-sensor-foundation）

- **kind**: library　**デプロイ**: embedded（`tools/ddd/lib/runtime/`、`tools/ddd/lib/schema/`）　**複雑度**: M
- **責務**: センサー実行スクリプト共通のランタイム（ディスパッチャ契約の引数解釈、記録ディレクトリ・`aidlc-state.md`・`source-manifest.json` の解決、所見の集約、詳細ファイルと compact JSON verdict の出力、終了コード）と、正規モデル `domain-model.yaml` のスキーマ（JSON Schema と TypeScript 型）、安定 ID の文法、ID 系譜規則、読み込み器・構造検証器・要素索引。
- **境界**: センサーの規則そのものは持たない。Rust 構文にも Cargo にも触れない。
- **実装メモ**: ネットワークにアクセスしない（NFR2、NFR9）。verdict の形式はエンジンのディスパッチャ契約に合わせる（FR8.5）。`aidlc-state.md` の Stage Progress 行の形式は state-template を出典とし、形式の fixture をテストに含める（ADR-004）。スキーマの適合／不適合サンプルをテストに持つ（NFR4）。

### U2 Rust 解析基盤（u2-rust-analysis-foundation）

- **kind**: library　**デプロイ**: embedded（`tools/ddd/lib/rust/`、`tools/ddd/lib/workspace/`、`tools/ddd/wasm/`）　**複雑度**: M
- **責務**: tree-sitter-rust（WASM）を web-tree-sitter で bun から読み込む構文解析と問い合わせ API、Cargo workspace の走査とクレート → 層・CQRS 側・composition root の判定（`CrateLayerAssignment`）、許可依存方向の表。
- **境界**: 規則の判定はしない（構文木の事実と層の事実を返すだけ）。
- **実装メモ**: WASM と web-tree-sitter を `tools/ddd/` 配下に同梱し、cargo・Node.js・ネットワークを要求しない（FR8.4、NFR2）。ライセンス（MIT）を README 用に記録する（ADR-001）。層判定は Cargo.toml の読み取りのみでビルドスクリプトを実行しない（ADR-005）。第2言語の解析器を並置できるよう `lib/<lang>/` の境界を守る（FR8.6）。

### U3 プラグイン足場（u3-plugin-scaffold）

- **kind**: packaging　**デプロイ**: embedded（`plugins/ddd/.aidlc-plugin/plugin.json`、`package.json`、biome 設定）　**複雑度**: S
- **責務**: `plugin.json` の `contributes` を stages / overlays / sensors / knowledge / tools の5面で宣言し（agents・scopes は宣言しない）、`bun run validate / build:claude / build:codex / check` の配線と biome 設定を整える。成果物論理名の `ddd-` 接頭辞規約をここで固定する。
- **境界**: README・CHANGELOG・LICENSE・統合テストの拡充は U9。
- **実装メモ**: 既存の足場（コード知識ベース `ddd/component-inventory.md` の5つの空ディレクトリと既存配線）を更新する形で進める。未実装機構（`adds.requires_stage`、`when:`、`memory/` 配布など）に依存しない（FR11.5）。

### U4 設計センサー（u4-design-sensors）

- **kind**: library　**デプロイ**: embedded（`sensors/aidlc-ddd-*.md` 6本、`tools/ddd-sensor-*.ts` 6本、`tests/golden/design/`）　**複雑度**: L
- **責務**: 6マニフェスト（model-completeness、model-presence、reference-ids、mapping-declarations、layer-structure、design-advisories）と対応する実行スクリプト、および設計成果物（`domain-model.yaml`、`ddd-aggregate-mapping`、`ddd-use-case-declarations`、`ddd-layer-structure`）の解析。ゴールデンケース fixture の構成規約（違反あり／なしの対、期待所見の書式、テストランナー）をこの Unit で確定する。
- **境界**: Rust コードは読まない。マニフェストをどのステージに束ねるかは U6・U7 が宣言する。
- **実装メモ**: blocking は `fire_on: gate` で宣言し、advisory は別マニフェストにする（FR8.2、ADR-002）。model-presence は `aidlc-state.md` の EXECUTE/SKIP で適用可否を決める（ADR-004）。layer-structure は宣言のみを検査する（ADR-009）。意味判断が必要な指摘は止めない（FR6.6）。

### U5 Rust コードセンサー（u5-rust-code-sensors）

- **kind**: library　**デプロイ**: embedded（`sensors/aidlc-ddd-rust-*.md` 3本、`tools/ddd-sensor-rust-*.ts` 3本、`tools/ddd/lib/rules/`、`tests/golden/rust/`）　**複雑度**: XL
- **責務**: 規則モジュール (a)〜(n) と層依存方向（FR9.5）の検査、層ごとの3マニフェスト（rust-domain、rust-use-case、rust-interface-adapter）、`code-summary` を契機に `source-manifest.json` の申告ソースだけを検査する発火経路、規則ごとのゴールデンケース。
- **境界**: 構文木の取得と層判定は U2 に委ねる。正規モデルの Command 集合は U1 の読み込み器で得る。
- **実装メモ**: `matches` は `**/code-summary.md`（ADR-003）。申告パスがワークスペース外を指す場合は検査せず所見にする。言語横断の規則定義と Rust 固有の判定を分離する（FR8.6、NFR7）。200 ファイル規模で1センサー 10 秒以内を目安に計測する（NFR3、仮置き）。fixture 規約は U4 で確定したものに従う。

### U6 domain-modeling ステージ（u6-domain-modeling-stage）

- **kind**: spec　**デプロイ**: embedded（`stages/inception/domain-modeling.md`）　**複雑度**: M
- **責務**: 新設ステージの frontmatter（`plugin: ddd`、`requires_stage: [requirements-analysis]`、`lead_agent: aidlc-architect-agent`、`mode: inline`、`reviewer: aidlc-architecture-reviewer-agent`、`review_class: advisory`、`scopes` 6つ、`produces` の `ddd-domain-model` / `ddd-domain-model-yaml`、`sensors` に U4 の model-completeness）と、イベント逆算から集約候補を導く手順本文、単独実行と入力なし対話の手順。
- **境界**: Aggregate 境界までを所有し、モジュール・デプロイ単位・ユースケース手順は所有しない（FR1.9）。
- **実装メモ**: 独自エージェントを作らない（ADR-007）。compose 後の `stage-graph.json` に載り、drops ログが空であることを U9 の統合テストで確認する（FR1.1、FR1.2）。

### U7 コアステージ contribution（u7-core-contributions）

- **kind**: spec　**デプロイ**: embedded（`contributions/inception/domain-design.md`、`contributions/construction/functional-design.md`、`contributions/construction/infrastructure-design.md`、`contributions/construction/code-generation.md`）　**複雑度**: M
- **責務**: 4つの contribution の frontmatter（`adds.consumes` / `adds.produces` / `adds.sensors`）と fragments。`ddd-aggregate-mapping`、`ddd-use-case-declarations`、`ddd-layer-structure` の記載形式（fenced yaml を正、人間向けの表を併記）。U4・U5 のマニフェスト ID を各コアステージのゲートに束ねる。
- **境界**: 成果物の解析は U4 が担う。命名・配置規約の出典は U2 の WorkspaceLayerResolver。
- **実装メモ**: anchor は実装済みの4種のみ（FR3.4）。追加のみで上書きしない（CON1）。宣言の必須項目（依存先、リポジトリ名、復元経路）は ADR-009 に従う。

### U8 ナレッジ（u8-knowledge-pack）

- **kind**: spec　**デプロイ**: embedded（`knowledge/aidlc-architect-agent/`、`knowledge/aidlc-developer-agent/`、`knowledge/aidlc-aws-platform-agent/`、`knowledge/aidlc-shared/`）　**複雑度**: M
- **責務**: 基盤ナレッジ（Always Valid、ADT、4種分類、集約＝FSM、ID 参照、ユビキタス言語、upstream-contracts、ユースケース規約、CQS、整合性境界、冪等性、プロセスマネージャー、CQRS 層構造）、Rust コード規約、IA 層規約、層境界の原則、メタ規律、ADR-010 の矛盾一覧の転記。
- **境界**: 必須条件はナレッジだけに任せず U4〜U7 にも定義する（FR10.6）。
- **実装メモ**: ディレクトリ名は slug 完全一致（CON6）。ファイル名は `ddd-` 接頭辞（FR10.4）。スキーマと命名規約の説明は U1・U2 の実装を出典にする（ADR-006）。

### U9 公開品質（u9-release-quality）

- **kind**: packaging　**デプロイ**: embedded（`plugins/ddd/README.md`、`CHANGELOG.md`、`LICENSE`、統合テスト）　**複雑度**: S
- **責務**: README（拡張ポイント、対応ハーネス、命名規約、センサー一覧 (a)〜(n)、導入手順、既知の制約、同梱ライセンス）、CHANGELOG、LICENSE、`aidlc-plugin-test --install` の3条件（drop なし、グラフに載る、バイト安定）を確認する統合テスト、Claude Code と Codex CLI の両ハーネスでの投影確認。
- **境界**: 各コンポーネントの実体は U1〜U8。
- **実装メモ**: `bun run check` が全 Unit のテストを通して緑であること（FR11.3、NFR4）。既存テスト2本は緑のまま。

## コンポーネント → Unit 対応

| コンポーネント | Unit |
|---|---|
| SensorRuntime | U1 |
| DomainModelSchema | U1 |
| RustSyntaxAnalyzer | U2 |
| WorkspaceLayerResolver | U2 |
| PluginPackaging | U3（足場）、U9（公開品質） |
| DesignSensorSuite | U4 |
| RustCodeSensorSuite | U5 |
| GoldenCaseSuite | U4（規約と設計センサー分）、U5（Rust センサー分） |
| DomainModelingStage | U6 |
| DomainDesignContribution | U7 |
| FunctionalDesignContribution | U7 |
| InfrastructureDesignContribution | U7 |
| CodeGenerationContribution | U7 |
| DddKnowledgePack | U8 |

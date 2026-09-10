# アーキテクチャ決定記録（ADR）— DDD プラグイン ドメイン設計

## Sources

- `inception/requirements-analysis/requirements.md`（FR1〜FR11、NFR1〜NFR10、制約 CON1〜CON12、未解決事項 OQ1〜OQ7）
- `inception/domain-design/domain-design-questions.md`（Q1〜Q8 の確認済み回答）
- `inception/domain-design/components.md`（コンポーネントカタログ）
- コード知識ベース `aidlc/spaces/default/codekb/aidlc-workflows/architecture.md`・`component-inventory.md`、`aidlc/spaces/default/codekb/ddd/architecture.md`・`component-inventory.md`
- コアのステージ定義 `.claude/aidlc-common/stages/construction/code-generation.md` とエンジン `.claude/tools/aidlc-state.ts`（ADR-003 の前提確認）
- コアの方法論ナレッジ `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` と設計書 `ddd/docs/domain-layer-design.md` §3・§6・§9、`ddd/docs/interface-adapter-layer-design.md` §5（ADR-010 の矛盾洗い出し）
- 第1回レビュー所見 R-01〜R-04（ADR-009、ADR-010、および ADR-002／ADR-003 の追記）

## ADR 一覧

| ADR | タイトル | 状態 | 出典 |
|---|---|---|---|
| ADR-001 | センサー実装を共有ランタイムと3つの解析器に分離し `tools/ddd/` 配下に置く | Accepted | Q2、FR8.4〜FR8.6 |
| ADR-002 | センサーのマニフェストは層ごと・設計成果物ごとに分け、重大度が異なる検査だけ別にする | Accepted | Q1、FR8.2 |
| ADR-003 | Rust コードセンサーは `code-generation` のゲートで `source-manifest.json` の申告ソースを検査する | Accepted | Q3、FR8.3 |
| ADR-004 | 正規モデル存在検査は `aidlc-state.md` の EXECUTE/SKIP を読んで適用可否を決める | Accepted | Q4、FR6.4、OQ4 |
| ADR-005 | 層・CQRS 側・composition root の判定規約を WorkspaceLayerResolver に集約する | Accepted | Q5、Q6、FR9、OQ1、OQ2 |
| ADR-006 | ナレッジは役割ごとのエージェント配下に置き、`aidlc-shared/` は最小限にする | Accepted | Q7、FR10.3 |
| ADR-007 | `domain-modeling` は独立ステージとし、コアの architect をリード、architecture-reviewer を advisory で付ける | Accepted | Q8、RA-Q1、RA-Q3、OQ5 |
| ADR-008 | contribution が求める宣言は `ddd-` 接頭辞の独立成果物として追加する | Accepted | FR3〜FR5、CON12 |
| ADR-009 | (k)(l)(m)(n) の設計側検査は `ddd-layer-structure` の宣言に対して行い、コード側検査と分ける | Accepted | FR5.4、FR7.8〜FR7.11、レビュー R-01 |
| ADR-010 | コアの `ddd-patterns.md` との矛盾4件を確定し、プラグインの規約を優先する | Accepted | FR10.4、OQ6、レビュー R-03 |

---

## ADR-001: センサー実装を共有ランタイムと3つの解析器に分離し `tools/ddd/` 配下に置く

**Status**: Accepted　**Date**: 2026-09-10

### Context

センサー実行スクリプトは `tools/` 配下だけが投影され、`src/` は投影されない。`tools/` は再帰的にコピーされるが、コピー先の `<harness>/tools/` はコアと他プラグインの共有名前空間である。設計検査（YAML/Markdown）と Rust 検査（構文木）は入力が異なるが、ディスパッチャ契約・記録ディレクトリ解決・verdict 出力は共通で、正規モデルの読み込みも両方が使う。第2言語の検査器を後から追加できる構造が要件（FR8.6）。

### Decision

共有コードを4つのライブラリに分け、`tools/ddd/lib/` に置く。`SensorRuntime`（契約と出力）、`DomainModelSchema`（正規モデル）、`RustSyntaxAnalyzer`（tree-sitter-rust WASM、`tools/ddd/wasm/` に文法を同梱）、`WorkspaceLayerResolver`（Cargo workspace の判定）。各センサースクリプトは `tools/ddd-sensor-<id>.ts` として薄く保ち、規則モジュールは `tools/ddd/lib/rules/` に置く。`ddd` 名前空間で共有 `tools/` の衝突を避ける。

### Consequences

- 正: 契約変更は SensorRuntime の1か所で済む。第2言語は `lib/<lang>/` の解析器と規則モジュールの追加で足りる。ゴールデンケースは投影されるものと同じソースを実行する。
- 負: `tools/ddd/lib/` が投影されるため、ライブラリの内部構造も配布物になる。WASM（1〜2 MB）が投影物に含まれる。
- 中立: 相対 import のパスが投影後も同じ相対関係で保たれる前提（`tools/` の再帰コピーで保証）。
- セキュリティ・コンプライアンス: 同梱する web-tree-sitter と tree-sitter-rust のライセンス（MIT）を README に明記する。センサーは対象コードを実行しない（NFR9）。

### Alternatives Rejected

- `src/` を開発ソースとし各スクリプトを単一ファイルにバンドルして `tools/` へ出力: 投影物は自己完結するが、ビルド工程が増え、テストが検証する対象がバンドル前後どちらかが曖昧になる。
- 各スクリプトへ複製: 規則変更のたびに全スクリプトを直すことになり、ドリフトの温床になる。
- 別 npm パッケージ: OSS 公開前に依存関係と公開作業を増やす。

---

## ADR-002: センサーのマニフェストは層ごと・設計成果物ごとに分け、重大度が異なる検査だけ別にする

**Status**: Accepted　**Date**: 2026-09-10

### Context

重大度（blocking / advisory）はマニフェスト単位でしか宣言できない（CON4）。ゲート発火は「宣言された成果物ごとに1回」で、マニフェストが増えるほど起動回数が増える。要件は違反ごとの独立検査・独立報告（FR7.12、FR7.13）を求めるが、これはマニフェスト内部で満たせる。

### Decision

Rust コードセンサーは層ごとに3本（`aidlc-ddd-rust-domain` / `aidlc-ddd-rust-use-case` / `aidlc-ddd-rust-interface-adapter`、すべて blocking、`code-generation` ゲート）。設計センサーは成果物ごとに5本の blocking（`aidlc-ddd-model-completeness`、`aidlc-ddd-model-presence`、`aidlc-ddd-reference-ids`、`aidlc-ddd-mapping-declarations`、`aidlc-ddd-layer-structure`）と、レビュー行き検査をまとめた advisory 1本（`aidlc-ddd-design-advisories`）。合計9本（Q1 の「約8本」に、FR5.4 の設計側検査を担う `aidlc-ddd-layer-structure` を ADR-009 で1本足した）。各マニフェスト内部では規則ごとに独立して検査し、所見に規則ID を付ける。

### Consequences

- 正: 所見の出どころが層／成果物で分かる。advisory と blocking が混在しない。起動回数はゲートあたり数回に収まる。
- 負: 1つの規則だけを無効化したい場合はマニフェスト単位ではできない（規則モジュール側の設定が必要になる。初版では提供しない）。
- セキュリティ・コンプライアンス: blocking の override は監査付きでエンジンが管理する（CON9）。プラグイン側で override 経路を追加しない。

### Alternatives Rejected

- 1ルール1マニフェスト（約20本）: 粒度は最も細かいが、ゲートでの起動回数と保守対象が3倍になる。
- バインド先ステージごと（約7本）: `domain-design` と `functional-design` が同じ参照ID検査を必要とし、重複した実装になる。
- 全ルール1本: advisory と blocking を分けられない。

---

## ADR-003: Rust コードセンサーは `code-generation` のゲートで `source-manifest.json` の申告ソースを検査する

**Status**: Accepted　**Date**: 2026-09-10

### Context

ゲート発火のセンサーが受け取るのは成果物パス（記録ディレクトリ内）であり、Rust ソースのパスではない。`fire_on: write` で `*.rs` に反応させると advisory 止まりで SM2 を満たせない（CON4）。`code-generation` は Unit ごとに `source-manifest.json` に生成ソースを申告する。既存コード（プラグイン導入前）の違反で新規生成を止めるべきではない。

### Decision

3本の Rust マニフェストは `fire_on: gate`、`matches` を `**/code-summary.md` に限定し、Unit ごとに1回発火させる。前提の確認（レビュー R-02 への回答）: `code-summary` はコアの `code-generation` ステージが `produces` に宣言している成果物である（`.claude/aidlc-common/stages/construction/code-generation.md` frontmatter）。ゲート発火は宣言された各成果物パスに対してマニフェストの `matches` glob を照合し、一致した成果物にだけセンサーを起動する（`.claude/tools/aidlc-state.ts` の `gateSensorMatchesOutput` / `fireGateSensors`）。したがって contribution 側で成果物を追加する必要はなく、`matches` による絞り込みは有効である。スクリプトは `--output-path` から Unit ディレクトリを辿り、同じ Unit の `source-manifest.json` が申告する Rust ファイルだけを検査対象にする。層判定のために Cargo workspace 全体のメタデータ（Cargo.toml）は読む。

### Consequences

- 正: 生成直後に止まる（SM3 に最も近い）。既存コードの違反に巻き込まれない。検査対象が Unit 単位で小さく、NFR3 の時間予算に収まりやすい。
- 負: 申告漏れのソースは検査されない（申告の完全性はエンジン側の source-manifest 検証に依存）。既存コードの後付け検査は本方式では行えない（refactor スコープでは code-generation が既存ファイルを申告するため対象になる）。
- セキュリティ・コンプライアンス: 申告パスが記録ディレクトリやワークスペース外を指す場合は検査せず所見として報告する。

### Alternatives Rejected

- ワークスペース全 `*.rs` を毎回走査: 既存違反で新規生成が止まり、走査時間も Unit 数に比例せず増える。
- `build-and-test` ゲート: 生成の1ステージ後で、修正コストが上がる。
- 両方: 重複実行で所見が二重に出る。

---

## ADR-004: 正規モデル存在検査は `aidlc-state.md` の EXECUTE/SKIP を読んで適用可否を決める

**Status**: Accepted　**Date**: 2026-09-10

### Context

`domain-design` にバインドする正規モデル存在検査（FR6.4）は blocking だが、`domain-modeling` が SKIP のスコープ（express、poc、bugfix 等）でコアの `domain-design` を止めてはいけない（OQ4）。センサーは `--output-path` から記録ディレクトリを辿れる。

### Decision

`aidlc-ddd-model-presence` は、記録ディレクトリの `aidlc-state.md` にある Stage Progress の行（`- [ ] domain-modeling — EXECUTE` / `SKIP`）を読み、EXECUTE のときだけ `domain-model.yaml` の存在と全参照IDの解決を検査する。SKIP または行が存在しない（プラグインが合成されていない記録）場合は note 付きで pass にする。

### Consequences

- 正: スコープに追随し、設定ファイルを増やさない。状態ファイルの行形式は state-template で公開されている。
- 負: 状態ファイルの行形式が変わると判定が壊れる（ゴールデンケースに形式の fixture を含めて検出する）。
- セキュリティ・コンプライアンス: 状態ファイルは読み取りのみ。書き込みは行わない。

### Alternatives Rejected

- `scope-grid.json` と Scope の突き合わせ: ハーネスディレクトリの解決が必要で、記録ディレクトリだけでは完結しない。
- `inception/domain-modeling/` ディレクトリの有無: ステージ開始前にディレクトリが作られる／作られないの挙動に依存し、脆い。
- 常に blocking: SKIP スコープで毎回 override が必要になり、ガードレールの信頼を損なう。

---

## ADR-005: 層・CQRS 側・composition root の判定規約を WorkspaceLayerResolver に集約する

**Status**: Accepted　**Date**: 2026-09-10

### Context

センサー (d)(g)(k)(l) と依存方向検査（FR9.5）は、ファイルの所属クレートが「どの層か」「CQRS のどちら側か」「composition root か」を機械的に知る必要がある。設計書 §7-5 は「設定ファイルではなく所属サブプロジェクトから導く」とだけ定め、要件は接尾辞と配置の両方を認め、該当なしを違反とした（FR9.2〜FR9.4）。composition root（OQ1）と CQRS 側（OQ2）の識別は未決だった。

### Decision

判定規約を1つのコンポーネント（WorkspaceLayerResolver）に集約する。層はクレート名の接尾辞（`-domain` / `-use-case` / `-interface-adapter` / `-infrastructure`）またはディレクトリ（`packages|modules/<layer>/`）。CQRS 側はセグメント（`-command-` / `-query-` / `-rmu`）またはディレクトリ（`packages/command|query|rmu/`）、印がなければ非 CQRS。composition root は `[[bin]]` ターゲット、接尾辞 `-composition-root`、ディレクトリ `packages/composition-root/` のいずれかで、層規則の対象外。どの層にも該当しないクレートは「層不明」として blocking 違反。同じ規約を contribution の手順とナレッジが出典として参照する。

### Consequences

- 正: 規約が1か所にあり、センサー・手順・ナレッジが同じ定義を使う。設定ファイルなしで決定的に判定できる。
- 負: 規約に合わない既存ワークスペースは全クレートが「層不明」になる（後付け適用では命名の移行が先に必要）。
- セキュリティ・コンプライアンス: Cargo.toml の読み取りのみ。ビルドスクリプトは実行しない。

### Alternatives Rejected

- `[[bin]]` のみで composition root を判定: ライブラリ型の結線クレート（テスト用の composition root 等）を除外できない。
- 名前規約のみ: 既存の `main` バイナリクレートが層不明になる。
- `infrastructure-design` の宣言表をセンサーが読む: 設計書 §7-5 の「設定ファイルではなく」に反し、宣言とコードのドリフトが生じる。
- 初版は非 CQRS のみ: 設計書 [IA] §2〜§4 と要件 FR7.8〜FR7.9 が CQRS を明示している。

---

## ADR-006: ナレッジは役割ごとのエージェント配下に置き、`aidlc-shared/` は最小限にする

**Status**: Accepted　**Date**: 2026-09-10

### Context

`knowledge/<agent-slug>/` はディレクトリ名がエージェント slug と完全一致しないと黙って無視される（CON6）。`aidlc-shared/` は全エージェントが全ステージで読むため、置きすぎるとコンテキストが重くなる。`domain-modeling` / `domain-design` / `functional-design` のリードは architect、`infrastructure-design` は aws-platform、`code-generation` は developer。

### Decision

architect に基盤ナレッジ（Always Valid、ADT、4種分類、集約＝FSM、ID参照、ユビキタス言語、upstream-contracts、ユースケース規約、CQS、整合性境界、冪等性、プロセスマネージャー、CQRS 層構造）と設計規約、developer に Rust コード規約、aws-platform に IA 層（ポート規約、永続化基盤、RMU）、`aidlc-shared/` に層境界と依存方向の原則だけを置く。ファイル名は `ddd-` 接頭辞。コアの `ddd-patterns.md` との矛盾は一覧にして明示する。

### Consequences

- 正: 各ステージが必要なナレッジだけを読む。配置ミスは compose 後の `inline_context_paths` で検証できる（FR10.3 の判定）。
- 負: 同じ原則が複数ディレクトリに分かれ、改訂時に整合を保つ手間がある（`aidlc-shared/` の原則を正とし、各ディレクトリはそれを参照する形で軽減）。
- セキュリティ・コンプライアンス: ナレッジは Markdown のみで、実行コードを含まない。

### Alternatives Rejected

- すべて `aidlc-shared/`: 配置ミスの心配はないが、全ステージのコンテキストを恒常的に重くする。
- architect と developer のみ: `infrastructure-design` のリード（aws-platform）に IA 層の規約が届かない。
- architect のみ: `code-generation` の developer に Rust 規約が届かず、fragments に長文を書くことになる。

---

## ADR-007: `domain-modeling` は独立ステージとし、コアの architect をリード、architecture-reviewer を advisory で付ける

**Status**: Accepted　**Date**: 2026-09-10

### Context

設計書 §2 は `domain-modeling` を `domain-design` の前に置く独立ステージと定めたが、`adds.requires_stage` が未実装（C1）で順序辺は自ステージの `requires_stage` でしか張れない。独自エージェントは `mode: inline` 以外や `reviewer:` と組み合わせるとハーネス依存を生む（C3）。要件はコアの architect をリードにし（RA-Q3）、順序は `adds.consumes` と blocking センサーで強制する（RA-Q1）と確定した。レビューアの有無は未決だった（OQ5）。

### Decision

`domain-modeling` は独立ステージ（`requires_stage: [requirements-analysis]`、`mode: inline`、`lead_agent: aidlc-architect-agent`、`reviewer: aidlc-architecture-reviewer-agent`、`review_class: advisory`、`reviewer_max_iterations: 1`）。`domain-design` 側は DomainDesignContribution の `adds.consumes` と DesignSensorSuite の `aidlc-ddd-model-presence` で正規モデルの存在を強制する。独自エージェントは作らない。

### Consequences

- 正: 正規モデルが独立した成果物として先に確定する。コアのエージェントだけを使うため Claude Code と Codex CLI の両方で compose が拒否しない。advisory レビューは人間承認の判断材料になる。
- 負: `domain-design` が `domain-modeling` を「待つ」ことは順序辺では表現されず、ゲートで止める形になる（順序を先に誤ると手戻りが1ステージ分になる）。
- セキュリティ・コンプライアンス: 追加のディスパッチ面を作らないため、ハーネス側の権限設定を変えない。

### Alternatives Rejected

- `domain-design` への contribution だけで実装（独立ステージなし）: 順序問題は消えるが、正規モデルが domain-design の成果物に埋もれ、設計書 §2 の理由に反する。
- プラグイン独自エージェント: Codex に手書きのディスパッチ面が必要になる（inline なら不要だが、コアの `ddd-patterns.md` との二重管理は残る）。
- レビューアなし: 機械条件 (i)〜(v) は検査できるが、集約境界の妥当性という意味判断が人間だけに残る。
- adversarial レビュー: inception の散文ステージでは判断が人間に属するため、修正ループより advisory が適切（コアの inception ステージと同じ扱い）。

---

## ADR-008: contribution が求める宣言は `ddd-` 接頭辞の独立成果物として追加する

**Status**: Accepted　**Date**: 2026-09-10

### Context

写像属性と2軸宣言（FR3.2〜FR3.3）、ユースケースの必須6項目（FR4.1）、IA 層の構造宣言（FR5.1）は、センサーが機械的に読める形で残る必要がある。コアの成果物（`components.md`、`functional-spec` 等）に混ぜると、コア側の形式変更で解析が壊れ、`adds.required_sections` も機械強制されない（C2）。成果物論理名はフラット名前空間で `<plugin>-` 接頭辞が必須（CON12）。

### Decision

各 contribution は `adds.produces` で独立した成果物を追加する。`ddd-aggregate-mapping`（domain-design）、`ddd-use-case-declarations`（functional-design）、`ddd-layer-structure`（infrastructure-design）。形式は機械可読（fenced `yaml` ブロックを正とし、人間向けの表を併記）。センサーはこれらの成果物だけを解析し、コア成果物の内部形式に依存しない。

### Consequences

- 正: センサーの入力形式をプラグインが所有できる。コア成果物の改訂に追随しなくてよい。fragments は「この成果物を書け」という短い手順で済む。
- 負: 利用者が書く成果物が増える。コア成果物との二重記載（例: components.md の依存とマッピングの重複）が生じる箇所は、写像成果物側を参照IDで結ぶ形にして最小化する。
- セキュリティ・コンプライアンス: 成果物は記録ディレクトリ内の Markdown/YAML で、機微情報の新たな置き場にはならない。

### Alternatives Rejected

- コア成果物に節を追加し `adds.required_sections` で強制: 機械強制されない（C2）。
- コア成果物をヒューリスティックに解析: 形式変更で壊れ、確定性（NFR1）を損なう。
- 宣言を `domain-model.yaml` に全部入れる: `domain-modeling` が所有しない情報（モジュール、永続化方式、ユースケース）を正規モデルに混ぜることになり、所有権の境界（FR1.9）に反する。

---

## ADR-009: (k)(l)(m)(n) の設計側検査は `ddd-layer-structure` の宣言に対して行い、コード側検査と分ける

**Status**: Accepted　**Date**: 2026-09-10

### Context

FR5.4 は `infrastructure-design` の `adds.sensors` に (k) コマンド側⇄クエリ側の相互参照、(l) クエリ側でのドメイン型・リポジトリ参照、(m) リポジトリ命名違反、(n) 復元経路の検査迂回をバインドすることを求める。一方、FR7.8〜FR7.11 は同じ4規則を Rust コードに対して検査することを求め、ADR-003 でそれは `code-generation` のゲートに束ねた。`infrastructure-design` のゲートには Rust コードがまだ存在せず、検査できるのは宣言（`ddd-layer-structure`、ADR-008）だけである。初版のカタログはこの設計側検査を担うコンポーネントを欠いていた（レビュー R-01）。

### Decision

DesignSensorSuite に blocking マニフェスト `aidlc-ddd-layer-structure` を追加し、InfrastructureDesignContribution の `adds.sensors` で `infrastructure-design` のゲートに束ねる。検査対象は `ddd-layer-structure` の宣言のみで、宣言に次の項目を必須で書かせる: 各クレートの依存先（`crate_dependencies`。(k) はコマンド側クレートとクエリ側クレートの相互依存宣言、(l) はクエリ側クレートの依存先にドメイン層クレートまたはリポジトリポートが含まれる宣言を違反とする。RMU は両側に依存してよい）、リポジトリ名（`repositories`。(m) は `集約名＋Repository` 以外と媒体名を含む名前を違反とする）、集約ごとの復元経路（`restoration_paths`。(n) は完全コンストラクタ経由と宣言されていない集約を違反とする）。コード側の (k)(l)(m)(n) は従来どおり RustCodeSensorSuite の `aidlc-ddd-rust-interface-adapter` が `code-generation` のゲートで検査する。

### Consequences

- 正: FR5.4 と FR7.8〜FR7.11 がそれぞれ独立した実現手段を持つ。設計段階で層構造の誤りを止められ、コード段階の違反は宣言との食い違いとして説明できる。
- 負: 同じ4規則が宣言用とコード用の2つの検査器に分かれる。規則の意味を変えるときは両方を直す必要がある（規則IDを共有し、ゴールデンケースで対応づけて軽減する）。宣言の必須項目が増える。
- セキュリティ・コンプライアンス: 宣言の読み取りのみ。コードは実行も解析もしない。

### Alternatives Rejected

- RustCodeSensorSuite の規則モジュールを宣言にも適用する: 入力が構文木と YAML で異なり、規則モジュールの入力形式が二重になる。
- 設計側検査を advisory にする: FR5.4 は blocking のバインドを求めており、宣言の誤りをコード生成まで持ち越すことになる。
- `infrastructure-design` へのバインドを諦め、FR5.4 をコード側検査で代替する: 要件を満たさず、トレーサビリティに GAP が残る。

---

## ADR-010: コアの `ddd-patterns.md` との矛盾4件を確定し、プラグインの規約を優先する

**Status**: Accepted　**Date**: 2026-09-10

### Context

FR10.4 と要件書 §7 の OQ6 は、コアの方法論ナレッジ `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` とプラグインの Always Valid 方針が矛盾する箇所を洗い出し、矛盾・適用範囲・採用理由を明示することを求め、決着先を本ステージとしていた。両者は architect が同じステージで同時に読むため、黙って優先順位を決めると設計が揺れる（レビュー R-03）。

### Decision

コアの `ddd-patterns.md` を通読し、矛盾を4件に確定する。いずれもプラグインの規約を優先し、DddKnowledgePack の基盤ナレッジに「衝突した記述・適用範囲・採用理由」として転記する。矛盾しない項目（集約間参照は ID、トランザクションは集約を跨がない、リポジトリは集約ルート単位、クエリは別の読み取りモデル、Value Object をプリミティブより優先）はプラグイン側の根拠として引用する。

| # | コアの記述 | プラグインの規約 | 適用範囲 | 採用理由 |
|---|---|---|---|---|
| 1 | Repository の例に `save(order)` と `findByCustomer(customerId): Order[]` を示す | 動詞は `find_by_id` / `store`（upsert）/ `delete_by_id` の3つ。条件検索はリポジトリに置かず、クエリ側は DAO＋DTO | interface-adapter 層のポート設計（FR5.2、センサー (m)） | 条件検索をリポジトリに許すとクエリ側がドメイン型に依存し、(l) の機械強制と CQRS の分離が崩れる |
| 2 | 「大きめの集約から始め、競合や性能の問題が出たら分割する」 | 集約はユーザーストーリーから逆算したドメインイベントと不変条件から導く（集約＝FSM）。分割・統合は ID 系譜で追跡する | domain-modeling の導出手順（FR1.6、FR2.4） | 大きめの集約から始めると不変条件の所在が曖昧なまま正規モデルが確定し、機械完了条件 (i)（全 Aggregate に不変条件）が形式的になる。コアの経験則は既存モデルのリファクタリング時の参考に留める |
| 3 | Entity は「可変。状態は時間とともに変わる」 | Entity／Aggregate は原則不変。状態を変えられるのは正規モデルで Command として宣言した業務操作のみ（Rust は排他的可変借用の下で許可）。setter と段階的初期化は禁止 | ドメイン層のコード規約（FR7.1〜FR7.3） | 可変を原則にすると setter 禁止と完全コンストラクタ強制の根拠が失われ、Always Valid が成立しない |
| 4 | Event Sourcing は選択肢の1つ。Command と Event の対応は自由（Event-Carried State Transfer 等） | 集約ごとに永続化方式を宣言する（FR3.3）。Event Sourcing では1コマンド1イベントで decide／apply を分離し、replay は検査対象外。ステートソーシングではイベントは任意 | コマンドの戻り値契約と復元経路（センサー (c)(n)） | 戻り値契約を方式ごとに固定しないと、センサーが復元経路と生成経路を区別できない。コアの統合パターン（通知、状態転送）は Bounded Context 間の連携に限って引き続き適用する |

### Consequences

- 正: 未解決事項 OQ6 が本ステージで閉じ、DddKnowledgePack の執筆時に判断が残らない。architect が両方を読んでも、どちらを採るかが明文化されている。
- 負: コアのナレッジは編集できないため、矛盾する記述は残り続ける。プラグイン側の一覧が唯一の調停であり、コアの改訂に追随して見直す必要がある。
- セキュリティ・コンプライアンス: ナレッジは Markdown のみで、実行コードを含まない。

### Alternatives Rejected

- コアの `ddd-patterns.md` を上書き・削除する: プラグインの合成は既存ファイルへの上書きを拒否する（CON6、FR10.4）。
- 矛盾の洗い出しをナレッジ執筆（Construction）へ先送りする: Inception フェーズの規約「未解決の矛盾を持ち越さない」に反し、要件書が決着先を本ステージと定めている。
- コアの記述を優先しプラグイン側を緩める: setter 禁止・完全コンストラクタ・CQRS 分離という成功指標 SM3 の根拠が崩れる。

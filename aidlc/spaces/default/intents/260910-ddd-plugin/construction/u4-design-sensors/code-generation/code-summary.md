# Code Summary — U4 設計センサー（u4-design-sensors）

## この記録の位置づけ

本 Unit の実装は `ddd/` の作業ツリー上にすでに存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
Step 1・3・5・7・9・10 は**既存実装の検証**であり、**既存ファイルへの改変は 1 件も無い**。
本 Unit は新規ファイルも作成していない。U3（`u3-plugin-scaffold`）は新規テスト 1 本を書いたが、
本 Unit はそれも無く、成果物は本記録（`code-summary.md` / `traceability.json` / `source-manifest.json`）のみである。

## Sources

- `inception/units-generation/unit-of-work.md`（U4 = DesignSensorSuite + GoldenCaseSuite、kind: library、複雑度 L）
- `inception/units-generation/unit-of-work-story-map.md`（U4 の割当 14 ID）
- `inception/requirements-analysis/requirements.md`（FR1.8、FR4.4、FR5.4、FR5.5、FR6、FR6.1〜FR6.6、FR8.1、FR8.2、FR8.7、NFR4）
- `construction/u4-design-sensors/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `construction/u4-design-sensors/code-generation/code-generation-plan.md`、`unit-test-instructions.md`

## 作成物

`source-manifest.json` に 18 パスを列挙している。**全 18 パスが既存**（検証のみ、無改変）である。

| パス | 責務 |
|---|---|
| `sensors/aidlc-ddd-model-completeness.md` | 宣言 8 規則。`domain-model.yaml` のスキーマ・(i)(ii)(iv)・md 整合 (f) |
| `sensors/aidlc-ddd-model-presence.md` | 宣言 3 規則。`domain-design` ゲートでの正規モデル存在と全参照解決 |
| `sensors/aidlc-ddd-reference-ids.md` | 宣言 8 規則。(e) 未定義・廃止・kind 不一致・malformed・循環 |
| `sensors/aidlc-ddd-mapping-declarations.md` | 宣言 7 規則。(j) 冪等性戦略、集約マッピング、(ii) 軸、重複、PM 要否 |
| `sensors/aidlc-ddd-layer-structure.md` | 宣言 8 規則。(k) 相互参照、(l) 依存、(m) 命名・媒体、(n) 復元経路 |
| `sensors/aidlc-ddd-design-advisories.md` | 宣言 3 規則。意味判断を advisory で報告（multi-aggregate / repository-scope / store-upsert） |
| `tools/ddd-sensor-model-completeness.ts` | U1 の `loadDomainModel` / `checkCompleteness` を転記し、md を `ID_PATTERN` で照合 |
| `tools/ddd-sensor-model-presence.ts` | `readStageStatus(context, "ddd-domain-modeling")` の SKIP 分岐を持つ |
| `tools/ddd-sensor-reference-ids.ts` | `REASON_RULE` で `ResolveReason` を rule_id に写像 |
| `tools/ddd-sensor-mapping-declarations.ts` | `PROGRAMMING_MODELS` / `PERSISTENCE_METHODS` / `RECOVERY_POLICIES` の語彙を所有 |
| `tools/ddd-sensor-layer-structure.ts` | `MEDIA_WORDS` の語彙を所有。Rust と Cargo は読まない（BR6.6） |
| `tools/ddd-sensor-design-advisories.ts` | 3 規則のみを発行する最小の advisory センサー |
| `tools/ddd/lib/sensors/common.ts` | U4 の共有ヘルパ（`finding` / `readText` / `collectUnresolved` / `pascalCase`）。U5 も使う |
| `tools/ddd/lib/sensors/declaration.ts` | 3 つの `ddd-` 宣言成果物の解析契約（ADR-008）。**解析契約の所有者は U4** |
| `tests/golden/runner.ts` | 40 ケースを実起動で比較するランナー。U5 も同じランナーを使う |
| `tests/golden/design/cases.ts` | 設計センサー 40 ケースの表（インライン YAML fixture） |
| `tests/u4-design-sensors.test.ts` | 17 件。6 スクリプトを子プロセス起動して検証 |
| `tests/u4-golden.test.ts` | 40 ケース＋規約 3 件 |

## 主要な実装判断（検証で確認したもの）

- **スクリプトは薄い。** 6 本すべてが U1 の `runSensor({sensor_id, severity, budget_ms, evaluate})` に
  評価コールバックを渡すだけの形で、スキーマ読込・完全性検査・参照解決・状態ファイル読取は
  U1 に委ねている（functional-spec.md §7）。U4 が所有するのは**検査の意味**と**宣言成果物の解析契約**だけである。
- **テストはスクリプトを `import` せず子プロセス起動する。** スクリプト末尾が `process.exit` を
  呼ぶため、直接 import するとテストランナーごと終了する。`Bun.spawnSync` による起動は
  実運用のディスパッチャ契約と同じ経路でもある。
- **正常モデルはモックしない。** U1 の `loadDomainModel` を実物のまま通す。読み込み失敗を
  U1 の所見として転記する経路そのものが検証対象だからである。
- **`ddd-aggregate-mapping` を読む検査は、それが無いとき note を付けて判定を省略する。**
  `mapping-declarations` の Process Manager 検査と `layer-structure` の (n) がこれにあたる。
  ステージ束ねを U6・U7 が宣言する立場（U4 境界）と整合する。
- **fixture は `tests/` 配下に置く（BR8.6）。** `tools/` には置かない。ランナーは
  `mkdtemp` で一時記録ディレクトリを作り、`finally` で `rmSync` する。

## テストカバレッジ

- **実行コマンド**: `cd ddd && bun test tests/u4-design-sensors.test.ts` /
  `cd ddd && bun test tests/u4-golden.test.ts`
- **テストランナー**: `bun:test`（bun 組み込み）。追加の devDependency は導入していない。
- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit のコンポーネントは
  DesignSensorSuite（6 センサー）と GoldenCaseSuite で、既存テストが床を満たす。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であることのみ。

| コマンド | 実測（2026-09-11） |
|---|---|
| `cd ddd && bun test tests/u4-design-sensors.test.ts` | **17 pass / 0 fail**、24 expect、1 ファイル |
| `cd ddd && bun test tests/u4-golden.test.ts` | **43 pass / 0 fail**、45 expect、1 ファイル |
| `cd ddd && bun test tests/` | **142 pass / 12 fail**、339 expect、10 ファイル |

`u4-golden.test.ts` の 43 件は、設計ゴールデンケース 40 件と規約テスト 3 件
（「宣言された各規則に違反ケースがある」「3 回実行して一致」「実エントリポイントで全件走る」）である。
ゴールデンケースの内訳は model-completeness 8、model-presence 4、reference-ids 8、
mapping-declarations 8、layer-structure 8、design-advisories 4。

`bun test tests/` の 12 件の失敗はすべて既存の `tests/codex-dispatch-bridge.test.ts` にあり、
`ENOENT: no such file or directory, scandir '<workspace>/aidlc-workflows/dist/codex/aidlc'`
の 1 原因に集約される（`ddd/tests/README.md` が既知の前提条件として記載）。
`framework-compatibility.test.ts` と `install.test.ts` は緑である。

### 宣言 rule_id と発行 rule_id の照合（計画の検証項目）

| センサー | マニフェストの宣言 | 実行時の発行 | 差 |
|---|---|---|---|
| model-completeness | 8 | 8 | — |
| model-presence | 3 | 3 | — |
| reference-ids | 8 | 8 | — |
| mapping-declarations | 7 | 9 | **+2（未宣言）** |
| layer-structure | 8 | 9 | **+1（未宣言）** |
| design-advisories | 3 | 4 | **+1（未宣言）** |
| 合計 | **37** | **41** | **+4** |

未宣言の 4 つは `mapping-declarations.document` / `mapping-declarations.model` /
`layer-structure.model` / `design-advisories.document` で、いずれも実行時に実際に発行されることを
一時記録ディレクトリで実測した（宣言成果物の不在、または `model_ref` の解決失敗で発火する）。
`mapping-declarations.document` / `.model` / `layer-structure.model` は `severity: blocking`、
`design-advisories.document` は `severity: advisory` である。

宣言された 37 規則のうち、違反ゴールデンケースを持つのは **34** である。残る 3 つ
（`model-completeness.iv` / `model-presence.unresolved` / `reference-ids.malformed`）は
`tests/u4-golden.test.ts` の `UNREACHABLE` にハードコードされ、網羅性テストの対象から除外されている。

## 検証

承認済み計画の「検証」に挙げた項目の実測値。

### Step 12 の前後（2026-09-12）

| 実測 | Step 12 の前 | Step 12 の後 |
|---|---|---|
| `bun test tests/u4-design-sensors.test.ts tests/u4-golden.test.ts` | 60 pass / 0 fail / 69 expect | **64 pass / 0 fail / 73 expect** |
| `bun test tests/` 全体 | 142 pass / 12 fail / 339 expect | **146 pass / 12 fail / 343 expect** |
| 設計側スクリプトの未宣言 rule_id | 4 件 | **0 件** |
| `validate` / `build:claude` / `build:codex` / `check:biome` / `check` | 0 / 0 / 0 / 0 / 1 | **0 / 0 / 0 / 0 / 1**（変化なし） |

増えた 4 件は Step 12 で追加したゴールデンケースそのものである。
`bun test tests/u4-golden.test.ts` の「every declared rule has a violation case」が緑であり、
宣言した 4 件すべてに違反ケースが対応していることが実測で確認できた。
`validate` が 0 のまま通ったので、追加した宣言は 6 本のマニフェストの schema を壊していない。
12 fail は U2・U3 と同一の既知フィクスチャ欠落（逸脱 4）で、Step 12 の前後で変わらない。

### ビルドと検証コマンド

| コマンド | 終了コード | 実測 |
|---|---|---|
| `cd ddd && bun run validate` | **0** | `Plugin validation: VALID`、Errors 0 / warnings 1（既存の `hooks/compose.ts [compose-hook-absent]`） |
| `cd ddd && bun run build:claude` | **0** | `Plugin build: COMPLETE`、出力 `ddd/dist/claude` |
| `cd ddd && bun run build:codex` | **0** | `Plugin build: COMPLETE`、出力 `ddd/dist/codex` |
| `cd ddd && bun run check:biome` | **0** | 51 ファイルを検査してエラー 0 |
| `cd ddd && bun run check` | **1** | `check:biome` と `validate` は通り、`test` 段で上記 12 件により失敗（逸脱 4） |

`validate` は 6 本のマニフェストを受理した（FR8.1）。ビルド後の投影
`dist/{claude,codex}/sensors/aidlc-ddd-*.md` に 6 本が現れることも確認した（Step 10、ただし逸脱 5 を参照）。

### マニフェストの宣言（FR8.1 / FR8.2）

6 本すべてが `id` / `kind: deterministic` / `command` / `default_severity` / `description` /
`matches` を持ち、`fire_on: gate` と `timeout_seconds: 10` を宣言する。
`default_severity` は blocking 5 本・advisory 1 本（`ddd-design-advisories`）で、
FR6.6・FR4.4・FR5.5 が求める「止めずに報告する」分類と一致する。

### センサー

| センサー | 対象 | 判定 |
|---|---|---|
| `required-sections` | `code-generation-plan.md` | **pass** — H2 を 9 件検出、findings 0 |
| `required-sections` | `unit-test-instructions.md` | **pass** — H2 を 7 件検出、findings 0 |
| `linter` | 本 Unit の .ts ソース | 実行不可 — exit 127 `eslint-unavailable`（本リポジトリは ESLint ではなく Biome を使う） |
| `linter` | 記録ディレクトリ | 実行不可 — exit 127 `no-eslint-config` |
| `type-check` | 本 Unit の .ts ソース | 実行不可 — exit 127 `tsc-unavailable` |
| `type-check` | 記録ディレクトリ | 該当なし — exit 1 `no-tsconfig-found`（記録ディレクトリに TS プロジェクトが無い） |
| `traceability` | `traceability.json` | `gaps` / `orphans` / `missing_from_table` / `invalid_entries` / `invalid_targets` いずれも **0**。`missing_from_upstream_ids` は 120 件（advisory、逸脱 2 と同じ既知の挙動） |

`linter` と `type-check` はいずれも `default_severity: advisory` であり、ステージ進行を止めない。
代替として `bun run check:biome` が本 Unit の 12 の .ts ファイルを含む 51 ファイルをエラー 0 で検査した。

**正直な申告**: 本 Unit の .ts ソースは、`bun test` の実行によっても Biome によっても
**型検査を受けたことにならない**（Bun は型を剥がすだけで検査しない）。実測で 60 件のテストが
緑であることは、型が正しいことの証明にはならない。U3 と同じ制約である。

## 計画からの逸脱

計画時に申告した 3 点は、いずれも**実装を書き換えず逸脱として記録する**方針どおりである。
検証中に追加で判明した点を逸脱 4〜7 に記す。

### 逸脱 1: ゴールデンケースの構成規約が仕様と異なる（計画時の申告 1）

仕様 BR8.1 / WF8.1〜8.2 / SM2 は `tests/golden/<suite>/<sensor-id>/<case-name>/` に
`record/` と `expected.json` を置き、ランナーがディレクトリを列挙して `expected.json` を読む形を
要求している。実装は `tests/golden/design/cases.ts` の **TypeScript の表**でケースを持ち、
`files` / `state` を一時ディレクトリに実体化してからスクリプトを起動する。
`expected.json` は存在せず、`record/` のディレクトリ列挙も無い（したがって SM2 の
「構成規約違反 → Invalid」経路も無い）。

一方で BR8.2（`pass` と `(rule_id, file)` 集合の完全一致）、BR8.4（実引数起動）、
BR8.5（決定性）、BR8.6（fixture を `tests/` に置く）は満たしている。

### 逸脱 2: 3 本のマニフェストが、スクリプトの発行する rule_id を 4 つ宣言していない（計画時の申告 2）

`mapping-declarations.document` / `mapping-declarations.model` / `layer-structure.model` /
`design-advisories.document` はスクリプトが実行時に発行するが、各マニフェストの `checks:` に無い。
BR1.1 / BR1.2 はマニフェストが自分の検査を宣言することを求めており、宣言の無い所見は
`requirement` / `inputs` / `outcome` を持たない。

**検証で判明した追加の事実**: この 4 つは
(a) ゴールデンケースの網羅性テストの対象外であり（同テストは「宣言された rule_id」を起点にする）、
(b) 4 つの rule_id 文字列はテストツリーのどこにも現れず、直接の表明も無い。
すなわち**この 4 経路は本 Unit のテストで一度も踏まれていない**。うち 3 つは `severity: blocking` で
ゲートを閉じうる。`reference-ids` は同種の `.document` / `.model` を宣言しており、他 3 本だけが揃っていない。

**レビュー所見 R-01 を受けた訂正（修正周回）**: この 4 つの rule_id は「マニフェストの宣言漏れ」に
とどまらない。`rules.md` の BR5（mapping-declarations）・BR6（layer-structure）・BR7（design-advisories）の
いずれにも一度も現れず、機能仕様に**定義の無い未仕様の検査経路**である（対照的に
`reference-ids.document` / `.model` は BR4.1 に明記されている）。うち 3 つ（`mapping-declarations.document` /
`.model`、`layer-structure.model`）は blocking でゲートを閉じうる。ゴールデンケースの網羅性テスト
（`tests/golden/runner.ts` の `declaredRules`）はマニフェスト本文から rule_id を集めるだけで `rules.md` を
参照しないため、この不整合を検出できない。

### 逸脱 2 の決着（Step 12・2026-09-12）

承認ゲートで「**マニフェストに宣言する**」判断を得た（削除ではなく）。決め手は、4 経路が
いずれも「宣言ブロックが壊れている／正規モデルが読めない」という**不正入力のハンドリング**であり、
同じ形の `reference-ids.document` / `.model` が `rules.md` BR4.1 に明記済みで
マニフェストにも宣言済みだったことである。削除すると
construction フェーズ規則「境界でのエラー処理」に反し、`reference-ids` だけがハンドリングを持つ
非対称も残る。Step 12 で次を実施した。

**1. 3 本のマニフェストに 4 件を宣言した。** `requirement` / `inputs` は `reference-ids` の
同種の宣言に揃えた。

| rule_id | マニフェスト | `requirement` | `inputs` |
|---|---|---|---|
| `mapping-declarations.document` | `aidlc-ddd-mapping-declarations.md` | ADR-008 | `[ddd-aggregate-mapping, ddd-use-case-declarations]` |
| `mapping-declarations.model` | 同上 | FR6.1 | `[ddd-domain-model-yaml, U1 loadDomainModel]` |
| `layer-structure.model` | `aidlc-ddd-layer-structure.md` | FR6.1 | `[ddd-domain-model-yaml, U1 loadDomainModel]` |
| `design-advisories.document` | `aidlc-ddd-design-advisories.md` | ADR-008 | `[ddd-use-case-declarations, ddd-layer-structure]` |

**2. ゴールデンケースを 4 件追加した。** `tests/u4-golden.test.ts` の
「every declared rule has a violation case」が宣言ごとに違反ケースを要求するため、
宣言だけでは落ちる。`ddd-reference-ids` の `violation-document`（宣言 yaml を `# no yaml\n` に差し替え）と
`violation-model`（`model_ref` を実在しないパスに差し替え）を雛形に、
`mapping-declarations` に `violation-document` / `violation-model`、
`layer-structure` に `violation-model`、`design-advisories` に `violation-document` を加えた。

**3. センサースクリプトは 1 行も変えていない。** 宣言を実装の実態に合わせただけである。

**実測による確認**: 6 本のスクリプトが発行する設計側 rule_id 41 件と、マニフェストの宣言を
突き合わせた結果、**未宣言は 0 件**になった。
（逆向きの「宣言されているが設計側スクリプトが発行しない」11 件は
`aidlc-ddd-rust-*.md`（U5 所有）の rule_id であり、本 Unit の範囲外である。）

**残る乖離**: この 4 経路は依然として `rules.md` の BR5・BR6・BR7 のいずれにも現れない
（grep で 0 件）。仕様本文への追記は functional-design ステージの成果物への変更であり、
code-generation の範囲外なので本 Unit では行わない。
**恒久的な解消には functional-design への変更依頼が要る。**
現状は「実装とマニフェストの宣言は一致したが、仕様には未定義」である。

### 逸脱 3: model-presence が読む正規モデルのパスが、仕様本文の記載と異なる（計画時の申告 3）

仕様 WF3.3 は `<record>/inception/domain-modeling/domain-model.yaml` と書くが、実装は
`<record>/inception/ddd-domain-modeling/domain-model.yaml` を読む。ステージ slug は
`ddd-domain-modeling`（`ddd/stages/inception/ddd-domain-modeling.md` の frontmatter `slug`）であり、
FR11.2 の `ddd-` 接頭辞規約からも**実装が正しく仕様本文が不正確**である。
`model-completeness.md` の `matches`（`**/ddd-domain-modeling/domain-model.yaml`）と `model-presence.md` の
説明文中のパス（`inception/ddd-domain-modeling/domain-model.yaml`）も一貫している
（レビュー所見 R-02 を受けた訂正: 当初「マニフェストの `matches` も一貫」と書いたが、
`model-presence.md` 自身の `matches` は `**/domain-design/components.md` であり、一貫しているのは
`model-completeness.md` の `matches` と `model-presence.md` の説明文である）。
本 Unit の成果物に誤りは無く、記録のみとする。

### 逸脱 4: FR8.7 と NFR4 の検証欄が指す `bun run check` は終了コード 0 にならない

計画時の申告どおり、`bun run check` は `test` 段を含むため終了コード 1 になる。原因は
本 Unit ではなく、既存の `tests/codex-dispatch-bridge.test.ts` が要求する
`aidlc-workflows/dist/codex/aidlc` の fixture が未生成であることである
（`ddd/tests/README.md` が既知の前提条件として記載。`aidlc-workflows/` は読み取り専用サブモジュール）。

計画どおり**要件本文**に照らして判定した。FR8.7 の本文が求めるのは「各センサーに違反あり／なしの
ゴールデンケースを同梱し、テストで通過を確認する」ことで、これは 40 ケースが緑であることで満たす。
NFR4 の本文が求めるのは「各センサーのゴールデンケース」と「既存テスト 2 本は緑のまま」で、
前者は同上、後者は `framework-compatibility.test.ts` と `install.test.ts` が緑であることで満たす。
**目標を下げて通すことはしていない。**`check` コマンドそのものの緑は U9 が所有し、
U3 は `FR11.3` として既に GAP を記録している。

### 逸脱 5: 計画 Step 10 の「`{{HARNESS_DIR}}` を展開して投影する」は不正確

計画 Step 10 は `bun run build:claude` / `bun run build:codex` が `{{HARNESS_DIR}}` を
展開すると書いたが、**ビルドは展開しない**。投影後の
`dist/{claude,codex}/sensors/aidlc-ddd-layer-structure.md` は
`command: bun {{HARNESS_DIR}}/tools/ddd-sensor-layer-structure.ts` を**そのまま**持つ。

展開するのはインストール時である。フレームワーク側は `.cursor` 向けの特殊ケースを除き
`{{HARNESS_DIR}}` を温存し（`.claude/tools/aidlc-plugin-emit.ts:260`）、
本プラグインのインストーラ `ddd/scripts/install.ts:495` が `target.harnessLeaf` に置換する。

したがって Step 10 の実質的な主張（追加ツールチェーンを要求せず、6 本のマニフェストが
投影される）は満たしているが、**計画の文言が機構を取り違えていた**。
実装に誤りは無く、記録のみとする。

### 逸脱 6: BR8.3 の網羅性は 37 規則中 34 規則で成立する（計画時の主張の補正）

計画は「BR8.3 の網羅性は満たしている」と書いたが、正確には **34 / 37** である。
`model-completeness.iv` / `model-presence.unresolved` / `reference-ids.malformed` の 3 つは
`tests/u4-golden.test.ts:14` の `UNREACHABLE` にハードコードされ、網羅性テストの対象から除外される。

除外の根拠はコメントに明記されている（U1 のローダが未定義参照で読み込み自体を失敗させるため、
読み込みに成功したモデルからはこの 3 規則を生成できない。BR6.2）。根拠は妥当であり
テストを緩めたわけではないが、**除外はマニフェスト側の宣言ではなくテスト側のハードコード**である。
`UNREACHABLE` を消すと網羅性テストは落ちる。

### 逸脱 7: FR5.4 は本 Unit だけでは満たせない（`Deferred` として記録）

FR5.4 はストーリーマップで U4 に割り当てられているが、その本文は
「`adds.sensors` で (k)(l)(m)(n) をバインドする」、検証欄は
「compose 後の `infrastructure-design` ノードの `sensors` に 4ID が含まれる」である。
`adds.sensors` は contribution の側の宣言であり、unit-of-work.md の U4 境界も
「マニフェストをどのステージに束ねるかは U6・U7 が宣言する」と定めている。

本 Unit が提供するのは (k)(l)(m)(n) の**検査実体**（`layer-structure.k/.l/.m-name/.m-media/.n`）であり、
**バインドの半分は U7 が持つ**。したがって `traceability.json` では FR5.4 を `GAP` ではなく
`Deferred` とし、目標を `ddd/tools/ddd-sensor-layer-structure.ts` に置いて理由を `note` に記した。
**承認ゲートに上げる。**

### 逸脱 8: 計画本文の「（未実施）」が Step 12 の実行後も残る

計画 `code-generation-plan.md` の「この計画の位置づけ」は
「本改訂で Step 12 を追加した（未実施）」と書き、「検証」節も Step 12 を
これから実施するものとして書いている。承認時点ではこれが正しかったが、
Step 12 は**承認後に実行した**ため、現在は実態と食い違う。

**チェックボックスは更新した。実測で確認している。**
承認フィンガープリントの射影はタスクマーカーを明示的にリセットする
（`aidlc-testing-posture.ts`: 「List task markers are reset: `[x]`, `[X]` and `[-]` become `[ ]`
… A tick is a claim about execution, not a change to the plan.」）。
Step 12 の 3 つのチェックボックスを `[x]` にした後も
`aidlc-testing-posture.ts verify --unit u4-design-sensors` は
`ok: true` / `fingerprintValid: true` を返し、フィンガープリントは
`sha256:v3:f87b316fb28801d2e15cc1fa998e72235a0dc726caa6c7047ae1f9e56332b6ae` のまま変わらなかった。

**散文は更新できない。** 射影が除外するのはタスクマーカーだけで、それ以外は byte-exact である。
「（未実施）」という語句を消すとフィンガープリントが変わり、Change Control が `strict` の下で
承認が失効する。したがって計画本文は書き換えず、本項で開示する。

実施状況の正は次のとおりである — チェックボックス（`[x]`）と本記録であり、計画の散文ではない。
計画を書く際は、後で実行するステップの散文を「未実施」と断定せず、
チェックボックスに実施状況を委ねる書き方をするのが正しい。

## 注記

- **FR6.5 の (iii) はスキーマ層で強制されている。** FR1.8 の機械完了条件 (i)〜(v) のうち、
  (i) は `model-completeness.i`、(ii) は `.ii`、(iv) は `.iv`、(v) は `f-*` 群が担うが、
  (iii)「全 Command に Domain Error が定義されている」に対応する rule_id は存在しない。
  代わりに `tools/ddd/lib/schema/domain-model.schema.json:123` が `command` の
  `required` に `domain_errors` を含め、`minItems: 1` を課しているため、
  (iii) を破る Command は `model-completeness.schema` で拒否される。
  要件は満たしているが、対応が rule_id ではなくスキーマ制約である点を記録する。
- **U4 のテスト量は 154 件中 60 件である。** ファイル別の実測は次のとおり。

  | ファイル | 実測 |
  |---|---|
  | `tests/u4-design-sensors.test.ts`（本 Unit） | 17 pass |
  | `tests/u4-golden.test.ts`（本 Unit） | 43 pass |
  | `tests/u1-sensor-foundation.test.ts` | 18 pass |
  | `tests/u2-rust-analysis-foundation.test.ts` | 12 pass |
  | `tests/u3-plugin-scaffold.test.ts` | 6 pass |
  | `tests/u5-golden.test.ts` | 17 pass |
  | `tests/u5-rust-code-sensors.test.ts` | 10 pass |
  | `tests/framework-compatibility.test.ts` | 9 pass |
  | `tests/install.test.ts` | 9 pass |
  | `tests/codex-dispatch-bridge.test.ts` | 1 pass / **12 fail** |
  | 合計 | **154（142 pass / 12 fail）** |

  U3 の `code-summary.md` は `bun test tests/` の 142 を「直前の 136 に自 Unit の 6 件を加えた数」と
  記しているが、テストファイルは当時も今も同じ 10 本で、U4 の 60 件は v0.1.0 から存在する。
  U3 時点の 142 にはすでに U4 の 60 件が含まれており、U3 適用前の実測は 76 pass であった。
  **U3 の内訳の記述は算術が合わない**（本 Unit の記録と成果物には影響しない）。
- **未宣言 rule_id の所見メッセージは記録ディレクトリの絶対パスを含む。**
  `file` は記録ディレクトリ相対である一方、`mapping-declarations.document` などの
  `message` は絶対パスを埋め込む。仕様違反ではないが、宣言済み規則との差として観察した。
- 既存ファイルへの改変は Step 12 の 4 パスに限られる（下記「完了条件の確認」を参照）。
  `ddd/CHANGELOG.md` の v0.1.0 の内容は変わっていない。
- すべての変更は未コミットである。

## 完了条件の確認

- 本 Unit が所有する全アプリケーションソース 18 パスを `source-manifest.json` に列挙した
  （全 18 パスの実在を確認済み）。
- `traceability.json` の `OK` 目標はすべて実在するワークスペース相対パスである
  （センサーの `invalid_targets` は 0 件）。
- Step 1・3・5・7・9・10 は既存実装に対する改変を行っていない。
- **既存ファイルへの改変は Step 12 に限られる**。すなわち
  `sensors/aidlc-ddd-mapping-declarations.md`（宣言 2 件追加）、
  `sensors/aidlc-ddd-layer-structure.md`（1 件）、
  `sensors/aidlc-ddd-design-advisories.md`（1 件）、
  `tests/golden/design/cases.ts`（ゴールデンケース 4 件追加）の 4 パスである。
  いずれも `source-manifest.json` に既に含まれており、追加は不要だった。
- **6 本のスクリプトが発行する rule_id はすべて対応するマニフェストに宣言されている**
  （未宣言 0 件、実測で確認）。
- `bun test tests/u4-golden.test.ts` の「every declared rule has a violation case」が緑である。
- Step 12 はセンサースクリプトを 1 行も変えていない。`validate` は 0 のまま。
- 検証で見つかった乖離 8 件を本記録の逸脱欄に記載した。うち **逸脱 7（FR5.4）は要件の未達**
  にあたるため、承認ゲートに上げる。逸脱 2 は Step 12 で解消したが、
  4 経路が `rules.md` に未定義である点は functional-design への変更依頼として残る。

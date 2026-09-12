# Code Summary — U1 センサー基盤（u1-sensor-foundation）

## この記録の位置づけ

本 Unit の実装は `ddd/` の作業ツリー上にすでに存在し、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。
本ステージは**既存実装を code-generation の成果として記録する**ものであり、新規のコード生成も
既存ファイルの改変も行っていない。以下の「作成物」は、その実装が本 Unit の成果物として
どのファイルで構成されているかを示す。

## Sources

- `construction/u1-sensor-foundation/functional-design/functional-spec.md`（WF1〜WF5、SM1〜SM2、公開 API）
- `construction/u1-sensor-foundation/functional-design/rules.md`（BR1.1〜BR9.3）
- `construction/u1-sensor-foundation/functional-design/entities.md`（DomainModelSchema 15 型 / SensorRuntime 4 型）
- `inception/units-generation/unit-of-work.md`（U1 = SensorRuntime + DomainModelSchema、kind: library、複雑度 M）
- `inception/requirements-analysis/requirements.md`（FR2.1〜FR2.7、FR8.5、NFR1、NFR2、NFR8、NFR9）

## 作成物

いずれも `ddd/` リポジトリ相対。全 11 パスを `source-manifest.json` に列挙している。

### 実装（9 ファイル）

| ファイル | 責務 |
|---|---|
| `tools/ddd/lib/schema/element-id.ts` | `parseElementId` — ID 文法・種別ごとの段数・接頭辞と kind の対応（BR1.1、BR1.3、BR3.8） |
| `tools/ddd/lib/schema/model.ts` | `DomainModelSchema` の型定義 15 種と派生型（FR2.1） |
| `tools/ddd/lib/schema/domain-model.schema.json` | JSON Schema 2020-12。同梱物であり実行時依存を増やさない（NFR1） |
| `tools/ddd/lib/schema/index-builder.ts` | ID → 要素・kind → 要素群・集約 → 所有要素群の索引（BR1.2） |
| `tools/ddd/lib/schema/loader.ts` | `loadDomainModel` — 構文解析から系譜検証までの読み込み経路。失敗時は部分索引を返さない（BR1.4〜BR6.2） |
| `tools/ddd/lib/schema/completeness.ts` | `checkCompleteness` — 冪等性戦略の宣言と保持方針の完全性（BR4.1〜BR4.3） |
| `tools/ddd/lib/runtime/context.ts` | `resolveContext` / `readStageStatus` / `readSourceClaims` — record_dir・workspace_root・unit の解決（BR8.1〜BR8.6） |
| `tools/ddd/lib/runtime/runtime.ts` | `runSensor` — 引数解決、フェイルクローズ、標準出力 JSON 1 行、終了コード（BR7.1〜BR7.8） |
| `tools/ddd/lib/shared/findings.ts` | `assembleFindings` — 所見の必須項目・`finding_id` 採番・`(file, line, rule_id)` 整列（BR9.1〜BR9.3） |

### テスト（2 ファイル）

| ファイル | 内容 |
|---|---|
| `tests/u1-sensor-foundation.test.ts` | 本 Unit の唯一のテストファイル。18 テスト |
| `tests/fixtures/u1/valid.yaml` | 正規モデルの最小の正例。読み込み成功・索引解決・完全性 0 件の基準 |

## 主要な実装判断

- **ID 文法と種別の対応を 1 ファイルに閉じる。** `element-id.ts` が接頭辞と種別の対応表を持ち、
  `loader.ts` はそこを経由して構造を検証する。U6（domain-modeling ステージ）と U4・U5（センサー）は
  同じ関数を共有し、ID 文法の解釈が実装ごとに分岐しない。
- **yaml を唯一の正とする（BR6.1）。** `loader.ts` は `domain-model.yaml` だけを読み、
  Markdown 側の記述は読まない。読み込み時に 1 件でも違反があれば索引を返さず failure にする（BR6.2）。
  部分索引を返すと呼び出し側が違反を見落とすためである。
- **標準出力は `SensorIO` 経由に限定する。** `runSensor` は `{ stdout, stderr }` の 2 関数しか
  受け取らない。テストが `process.stdout` を差し替えずに済み、センサーの報告形式が
  1 か所で決まる。
- **`finding_id` を入力から決定的に導出する（NFR9）。** 乱数も時刻も使わない。
  同一入力に対して同一の所見列と同一の ID が得られることを、整列規則
  `(file, line, rule_id)` と併せてテストで固定している。
- **ファイルシステムはモックしない。** 一時ディレクトリに本物の `domain-model.yaml` と
  `aidlc-state.md` を書き、パス解決そのものを検証対象にする。モックするのは `SensorIO` だけである。

## テストカバレッジ

- **実行コマンド**: `cd ddd && bun test tests/u1-sensor-foundation.test.ts`
- **実測**: **18 pass / 0 fail / 50 expect() 呼び出し**（2026-09-11 実測）
- **内訳**: `parseElementId` 3 件、`loadDomainModel` 8 件、`findings assembly` 1 件、`sensor runtime` 6 件
- **戦略**: Standard（コンポーネントあたり 5〜8 件）。U1 の 2 コンポーネントに対して 18 件。
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無い。既存スイートが緑であることのみ。
- **テストランナー**: `bun:test`（bun 組み込み）。追加の devDependency は導入していない（NFR1）。

## 計画からの逸脱

### 逸脱 1: `bun run check` は緑ではない（計画の検証欄は未達）

計画の検証欄は `bun run check`（Biome + プラグイン検証 + 全テスト）が緑であるとしているが、
実測は記録時 **133 pass / 12 fail**（終了コード 1）、修正周回の再実測（2026-09-11、レビュー所見 R-02）では
**142 pass / 12 fail**（終了コード 1）である。pass の増分 9 件は後続 Unit（U2〜U4）が追加したテストで、
fail は同じ 12 件である。

- 12 件はすべて既存の `tests/codex-dispatch-bridge.test.ts` にあり、原因は同一で
  `ENOENT: no such file or directory, scandir '<workspace>/aidlc-workflows/dist/codex/aidlc'`。
  `scripts/copy-reference-fixture.ts` が参照する dist fixture が存在しないために落ちている。
- `aidlc-workflows/` は本家参照用の読み取り専用サブモジュールであり、
  `ddd/docs/framework-compatibility.md` と `ddd/docs/reference-read-only.md` が
  再生成・保護解除を禁じている。`ddd/tests/README.md` も「the two pre-existing
  harness-adapter suites need the `aidlc-workflows` dist fixture」「skip-fail when that
  dist is not built」として、この落ち方を既知の前提条件として記載している。
- したがってこれは **U1 の欠陥ではなく、環境の前提条件が満たされていないことによる既存スイートの失敗**
  である。本 Unit のテスト（18 件）と Biome（記録時 50 ファイル、再実測 51 ファイル。増分は
  `tests/u3-plugin-scaffold.test.ts`）とプラグイン検証（VALID、警告 1 件
  `hooks/compose.ts [compose-hook-absent]`）はいずれも通っている。
- 修正には読み取り専用サブモジュールの dist 生成が必要で、これは明示的な指示なしには行わない。

### 逸脱 2: テスト件数の記載が実測と一致しない（15 件 → 実際は 18 件）

計画と `unit-test-instructions.md` は「本 Unit は 2 コンポーネントで 15 件
（SensorRuntime 系 6 件、DomainModelSchema 系 9 件）」と記載しているが、実測は
**18 件（SensorRuntime 系 6 件、DomainModelSchema 系 12 件）**である。

- 計画 Step 4 の「`loadDomainModel`（7 件）」も実際は 8 件、Step 6 の「`sensor runtime`（5 件）」も
  実際は 6 件である。Step 9 の配分記載も同様にずれている。
- Standard 戦略の要求（コンポーネントあたり 5〜8 件）は 18 件で満たしている。
  **不足ではなく過少申告**であり、品質目標の引き下げは発生していない。
- 件数の記載を訂正するには承認済み計画の文言変更が必要で、それは Plan Approval の再取得を伴う。
  本記録では承認済み計画を書き換えず、実測値との乖離をここに記録するに留める。

### 逸脱 3: traceability センサーは割り当て外 ID を advisory 所見として報告する

`traceability.json` は本 Unit に割り当てられた ID（FR2、FR2.1〜FR2.7、FR8、FR8.5、NFR1、NFR2、
NFR8、NFR9 と BR1.1〜BR9.3 の計 55 件）を列挙している。sensor の判定は次のとおり。

- `gaps` / `orphans` / `missing_from_table` / `invalid_entries` / `invalid_targets` はいずれも **0 件**。
  `OK` 目標はすべて実在するワークスペース相対パスである。
- `missing_from_upstream_ids` が 81 件出る。これは sensor が requirements.md から
  **製品全体の FR／NFR を解決する**ためで、内容は他 Unit に割り当てられた ID
  （FR1.x、FR3.x〜FR7.x、FR9.x〜FR11.x、NFR3〜NFR7、NFR10）である。
- 同じ挙動が既存の `functional-design/traceability.json` でも起きている（75 件）。当該 sensor は
  `default_severity: advisory` であり、ステージ進行を止めない。
- ステージ定義は「**割り当てられた** AC / NFRx.y / BRx.y を列挙する」と指示しており、
  本記録はそれに従った。他 Unit への割り当てを U1 の記録に書き写すことはしていない。

## 完了条件の確認

- 本 Unit が作成・変更した全アプリケーションソース 11 パスを `source-manifest.json` に列挙した。
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスであることを
  sensor で確認した（`invalid_targets` 0 件）。
- 既存実装に対する改変は発生していない（記録のみ）。

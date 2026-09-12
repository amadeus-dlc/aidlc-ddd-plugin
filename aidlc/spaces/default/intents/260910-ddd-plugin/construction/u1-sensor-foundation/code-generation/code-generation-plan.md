# Code Generation Plan — U1 センサー基盤（u1-sensor-foundation）

## この計画の位置づけ

本 Unit の実装は **すでに完了している**。`ddd/tools/ddd/lib/runtime/`、`ddd/tools/ddd/lib/schema/`、
`ddd/tools/ddd/lib/shared/` および `ddd/tests/u1-sensor-foundation.test.ts` が作業ツリーに存在し、
`ddd/CHANGELOG.md` の v0.1.0 に含まれている。

そこで本計画は、**既存実装を code-generation ステージの成果として記録する**ための計画とする。
Step 4 の生成は「既存コードの検証と記録」を意味し、**新しいコードを書き起こすことはしない**。
既存ファイルの改変も行わない。計画の各ステップは、その実装がどの順序で成立したかを記述し、
完了済みとしてチェックする。

## 対象と根拠

| 種別 | パス |
|---|---|
| 機能設計 | `construction/u1-sensor-foundation/functional-design/functional-spec.md` |
| 規則 | `construction/u1-sensor-foundation/functional-design/rules.md` |
| 型 | `construction/u1-sensor-foundation/functional-design/entities.md` |
| Unit 定義 | `inception/units-generation/unit-of-work.md`（U1 = SensorRuntime + DomainModelSchema、kind: library、複雑度 M） |
| 要件 | `inception/requirements-analysis/requirements.md`（FR2.1〜FR2.7、FR8.5、NFR1、NFR2、NFR8、NFR9） |
| 参照設計 | `ddd/docs/domain-layer-design.md` §3〜§5、`ddd/docs/use-case-layer-design.md` §5-5 |

実装言語は TypeScript、ランタイムは bun、フォーマッタ／リンタは Biome 2.5.12（`ddd/package.json` / `ddd/biome.json`）。
テストランナーは `bun:test`（追加依存なし）。

## Testing Contract

以下は `bun .claude/tools/aidlc-testing-posture.ts render` の出力をそのまま貼り付けたものである。
Part 2 において権威を持つのはこの契約であり、実装者は memory を独自に再解決・再解釈しない。

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run",
  "scope": "plugin-dev",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:0dbdec58e08cf5020b398132d8493de8d1b9bd5cefa4770cb5aeb68c85cd934a",
  "contract_sha256": "sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386"
}
```

### この契約を U1 に適用する

`methodology: test-after`、`ordering: implement each applicable testable layer, then write and run`。
U1 はライブラリであり、UI・HTTP・DB を持たないため、契約の `testable_layers` のうち該当するのは
**データモデル相当（正規モデルの構造検証）** と **ビジネスロジック相当（規則 (a)〜(n) の前提となる
読み込み時検査・索引解決・完全性検査）** の 2 層である。API/endpoint と frontend の層は成立しないため
省略する。リポジトリ／データアクセス層は、ファイル読み込みと申告ソース解決
（`readSourceClaims`）がこれに相当するため「データモデル」層に併合する。

`runner_step` の要求どおり、最初のテストステップより前に既存ランナーの疎通と
Unit 限定コマンドの確定を行う（Step 2）。`runner_ready_before_first_test: true` を満たす。

## Sources

- `construction/u1-sensor-foundation/functional-design/functional-spec.md`（WF1〜WF5、SM1〜SM2、公開 API 面）
- `construction/u1-sensor-foundation/functional-design/rules.md`（BR1〜BR9）
- `construction/u1-sensor-foundation/functional-design/entities.md`（DomainModelSchema 15 型 / SensorRuntime 4 型）
- `inception/units-generation/unit-of-work.md`（U1 の責務と境界）
- `inception/requirements-analysis/requirements.md`（FR2、FR8.5、NFR1、NFR2、NFR8、NFR9）

## 実装ステップ

### 基盤

- [x] **Step 1: プロジェクト構造と本番構成の骨格** — `ddd/tsconfig.json` と `ddd/biome.json` の下で
      `tools/ddd/lib/` を層別に切る（`runtime/`、`schema/`、`shared/`）。規則判定は持たず、
      U4・U5 から共有される純粋なライブラリ層として置く。ネットワークアクセスを行わない（NFR2、NFR9）。
- [x] **Step 2: テストランナーの疎通確認と Unit 限定コマンドの確定** — 既存の `bun:test` を確認し、
      Unit 限定コマンド `bun test tests/u1-sensor-foundation.test.ts` を `unit-test-instructions.md` に記録する。
      追加依存を導入しない（NFR2）。

### データモデル層（正規モデルの構造）

- [x] **Step 3: データモデル層の実装** — `tools/ddd/lib/schema/element-id.ts` に `parseElementId`
      （ID 文法と種別ごとの段数、BR1.1・BR1.3）、`tools/ddd/lib/schema/model.ts` に
      `entities.md` の型定義、`tools/ddd/lib/schema/domain-model.schema.json` に JSON Schema 2020-12 を置く。
      `tools/ddd/lib/schema/index-builder.ts` に ID → 要素・kind → 要素群・集約 → 所有要素群の索引を作る（BR1.2）。
- [x] **Step 4: データモデル層のテストを実装後に書いて実行** — `tests/u1-sensor-foundation.test.ts` の
      `parseElementId`（3 件）と `loadDomainModel`（7 件）で、文法違反・段数違反・未知キー
      （BR3.9）・版不一致・重複 ID・Command の Domain Error 必須（BR3.4）・未解決参照（BR1.5）を確認する。
      適合サンプルは `tests/fixtures/u1/valid.yaml`。

### ビジネスロジック層（読み込み・完全性・実行契約）

- [x] **Step 5: ビジネスロジック層の実装** — `tools/ddd/lib/schema/loader.ts` に `loadDomainModel`
      （WF2: 構文解析 → 構造検証 → ID 文法 → 索引構築 → 所有者一致と参照解決 → 系譜検証 → 導出値補完。
      読み込み時違反が 1 件でもあれば索引を返さず failure、BR6.2）、
      `tools/ddd/lib/schema/completeness.ts` に `checkCompleteness`（WF3: completeness.i / ii / iii、idempotency.j）、
      `tools/ddd/lib/runtime/context.ts` に `resolveContext` / `readStageStatus` / `readSourceClaims`
      （WF4・WF5、BR8）、`tools/ddd/lib/runtime/runtime.ts` に `runSensor`（WF1、BR7: 引数解決、
      フェイルクローズ、予算、整列・採番、標準出力 JSON 1 行、終了コード 0／同梱資産欠落のみ 127）、
      `tools/ddd/lib/shared/findings.ts` に `assembleFindings`（BR9.2、BR9.3）を置く。
- [x] **Step 6: ビジネスロジック層のテストを実装後に書いて実行** — `findings assembly`（1 件）と
      `sensor runtime`（5 件）で、整列と採番、`resolveContext` の record_dir / workspace_root / unit 解決、
      `args-missing`、Stage Progress 行の読み取り（BR8.3）、source-manifest の展開と欠落所見
      （BR8.4・BR8.5）、pass 時の JSON 1 行と終了コード 0、評価例外時のフェイルクローズ（BR7.5）を確認する。

### 構成と文書

- [x] **Step 7: 環境・ビルド構成** — `ddd/package.json` の `test` スクリプトを `bun test tests/` のまま据え置き、
      `check` を `check:biome && validate && test` として Biome とプラグイン検証を前置する。
      Unit 固有の追加設定は設けない。
- [x] **Step 8: ドキュメントとトレーサビリティ** — `code-summary.md` に作成物と判断を記録し、
      `traceability.json` に FR／NFR と実装ファイルの対応を、`source-manifest.json` に本 Unit が
      作成・変更した全パスを列挙する。

### テスト構成

- [x] **Step 9: テスト戦略に応じたテストファイル** — Standard 戦略の「コンポーネントあたり 5〜8 件」に対し、
      U1 の 2 コンポーネントへ 15 件を配分する（SensorRuntime 系 6 件、DomainModelSchema 系 9 件）。
      Unit 限定実行は `bun test tests/u1-sensor-foundation.test.ts`。
- [x] **Step 10: テスト構成** — `bun:test` を既定のまま使い、専用設定ファイルを追加しない。
      `ddd/package.json` の `test` がディレクトリ単位で全 Unit を走査する。
      一時ディレクトリは `mkdtempSync` + `afterEach` で後始末し、テスト間の状態を持ち越さない。

## 要件 → 実装ステップの対応

| 要件 | 内容 | ステップ | 実装先 |
|---|---|---|---|
| FR2.1 | 集約の包含構造を機械可読に保つ | Step 3, 5 | `schema/loader.ts`、`schema/model.ts` |
| FR2.2 | Command に Domain Error を必須化 | Step 5, 6 | `schema/loader.ts`（`schema.command-no-error`） |
| FR2.3 | 安定 ID の文法と一意性 | Step 3, 6 | `schema/element-id.ts`、`schema/index-builder.ts` |
| FR2.4 | ID 系譜（rename / split / merge / 廃止） | Step 5 | `schema/loader.ts`（BR2.2〜BR2.4） |
| FR2.5 | 冪等性戦略の宣言 | Step 5 | `schema/completeness.ts`（`idempotency.j`） |
| FR2.6 | Process Manager の任意宣言と 2 集約以上 | Step 5 | `schema/loader.ts`（BR5） |
| FR2.7 | yaml を正とし md は従属 | Step 5 | `schema/loader.ts`（BR6.1） |
| FR8.5 | ディスパッチャ契約（verdict と終了コード） | Step 5, 6 | `runtime/runtime.ts`、`shared/findings.ts` |
| NFR1 | 確定性（同一入力に対して常に同一の所見・verdict） | Step 5, 6 | `finding_id` の入力からの決定的な採番と `(file, line, rule_id)` 整列（`shared/findings.ts`） |
| NFR2 | ネットワーク非依存 | Step 1 | 全モジュールがローカル完結 |
| NFR8 | 所見の形式（ID・位置・重大度） | Step 5 | `shared/findings.ts`（BR9） |
| NFR9 | セキュリティ（対象コードを実行しない、外部通信・認証情報の参照を行わない） | Step 3, 5 | `runtime/runtime.ts` はファイル読み取りと標準出力のみで、実行系 API・HTTP クライアントを呼ばない（NFR2 と同じ根拠） |

## テスト方針（Unit 限定）

- **実行コマンド**: `bun test tests/u1-sensor-foundation.test.ts`（`ddd/` を作業ディレクトリとする）
- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit は 15 件（実施済み）
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であること
- **品質目標**: 契約の coverage floor を緩和しない。落ちた場合は目標を下げずに乖離を報告する

## 検証

- [x] `bun test tests/u1-sensor-foundation.test.ts` が緑
- [x] `bun run check`（Biome + プラグイン検証 + 全テスト）が緑
- [x] センサー `required-sections` / `linter` / `type-check` / `traceability` が本 Unit の成果物に対して通る

## 完了条件

- 本 Unit が作成・変更した全アプリケーションソースが `source-manifest.json` に列挙されている
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスである
- 既存実装に対する改変が発生していない（記録のみ）

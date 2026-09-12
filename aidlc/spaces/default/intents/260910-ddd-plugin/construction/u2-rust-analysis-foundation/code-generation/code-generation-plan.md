# Code Generation Plan — U2 Rust 解析基盤（u2-rust-analysis-foundation）

## この計画の位置づけ

本 Unit の実装は **すでに完了している**。`ddd/tools/ddd/lib/workspace/resolver.ts`、
`ddd/tools/ddd/lib/rust/analyzer.ts`、`ddd/tools/ddd/lib/rust/vendor/`、`ddd/tools/ddd/wasm/`
および `ddd/tests/u2-rust-analysis-foundation.test.ts` が作業ツリーに存在し、
`ddd/CHANGELOG.md` の v0.1.0 に含まれている。

そこで本計画は、**既存実装を code-generation ステージの成果として記録する**ための計画とする。
Step 1〜9 の生成は「既存コードの検証と記録」を意味し、**新しいコードを書き起こすことはしない**。
計画の各ステップは、その実装がどの順序で成立したかを記述し、完了済みとしてチェックする。

ただし本改訂は、レビュー所見に応じた**既存ファイルへの限定的な改変を 2 件含む**。

- **Step 6b（実施済み）** — `tests/u2-rust-analysis-foundation.test.ts` にテストを 3 件追加した。
  併せて、その 3 件が踏んだ実装不具合 2 件を `lib/rust/analyzer.ts` で修正した（+15/−3）。
  `struct_expression` の `..base` を `body` フィールド経由で見るようにした点と、
  item 位置のマクロ呼び出しが `expression_statement` に包まれる場合を拾うようにした点である。
- **Step 6c（未実施）** — `lib/workspace/resolver.ts` の `isAllowed` にある到達不能な比較を
  除去する（レビュー所見 R-02、`tsc --noEmit` の TS2367）。

## 対象と根拠

| 種別 | パス |
|---|---|
| 機能設計 | `construction/u2-rust-analysis-foundation/functional-design/functional-spec.md`（WF1〜WF5、SM1〜SM2、公開 API） |
| 規則 | `construction/u2-rust-analysis-foundation/functional-design/rules.md`（BR1.1〜BR7.2） |
| 型 | `construction/u2-rust-analysis-foundation/functional-design/entities.md` |
| Unit 定義 | `inception/units-generation/unit-of-work.md`（U2 = RustSyntaxAnalyzer + WorkspaceLayerResolver、kind: library、複雑度 M） |
| 要件 | `inception/requirements-analysis/requirements.md`（FR7.4〜FR7.9、FR7.12、FR8.4、FR8.6、FR9.1〜FR9.6、NFR1、NFR2、NFR3） |
| 参照設計 | `inception/domain-design/components.md`、`inception/domain-design/decisions.md`（ADR-001、ADR-005） |

実装言語は TypeScript、ランタイムは bun、フォーマッタ／リンタは Biome 2.5.12。
Rust 文法は tree-sitter-rust（WASM）を同梱し、パーサ本体は web-tree-sitter を vendor する。
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

### この契約を U2 に適用する

`methodology: test-after`、`ordering: implement each applicable testable layer, then write and run`。
U2 はライブラリであり、UI・HTTP・DB を持たない。契約の `testable_layers` のうち該当するのは
**データモデル相当（CargoWorkspace / CrateManifest / CargoTarget の事実の構造）** と
**ビジネスロジック相当（層判定の決定表・ファイル分類・許可表・構文的事実の抽出）** の 2 層である。
API/endpoint と frontend の層は成立しないため省略し、リポジトリ／データアクセス層は
`Cargo.toml` の読み込みがこれに相当するためデータモデル層に併合する。

`runner_step` の要求どおり、最初のテストステップより前に既存ランナーの疎通と
Unit 限定コマンドの確定を行う（Step 2）。`runner_ready_before_first_test: true` を満たす。

**テスト量について**: Standard 戦略は「コンポーネントあたり 5〜8 件」を求める。
初版の U2 の配分は WorkspaceLayerResolver 6 件 / RustSyntaxAnalyzer 3 件で、
**RustSyntaxAnalyzer が床を下回っていた**。レビューでこの所見が上がったため、
本改訂で RustSyntaxAnalyzer に 3 件を追加し、**6 件 / 6 件の計 12 件**とする（Step 6b）。
追加するテストは BR6.4・BR6.6・BR6.7・BR6.8 の経路で、いずれも現行のテストが踏んでいない。

## Sources

- `construction/u2-rust-analysis-foundation/functional-design/functional-spec.md`（WF1〜WF5、SM1〜SM2）
- `construction/u2-rust-analysis-foundation/functional-design/rules.md`（BR1.1〜BR7.2）
- `construction/u2-rust-analysis-foundation/functional-design/entities.md`（workspace 側と解析器側の型）
- `inception/units-generation/unit-of-work.md`（U2 の責務と境界）
- `inception/requirements-analysis/requirements.md`（FR7、FR8.4、FR8.6、FR9、NFR1〜NFR3）

## 実装ステップ

### 基盤

- [x] **Step 1: プロジェクト構造と本番構成の骨格** — `ddd/tools/ddd/` の下に
      `lib/workspace/`（層判定）と `lib/rust/`（構文解析）を切り、`wasm/` を同梱資産の置き場とする。
      言語非依存の事実の型は `lib/` 直下の言語別ディレクトリに閉じ、`lib/<lang>/` の境界を守る（BR7.1、BR7.2）。
- [x] **Step 2: テストランナーの疎通確認と Unit 限定コマンドの確定** — 既存の `bun:test` を確認し、
      Unit 限定コマンド `bun test tests/u2-rust-analysis-foundation.test.ts` を
      `unit-test-instructions.md` に記録する。追加依存を導入しない（NFR1）。

### データモデル層（workspace の事実）

- [x] **Step 3: データモデル層の実装** — `lib/workspace/resolver.ts` に `CargoWorkspace` /
      `CrateManifest` / `CargoTarget` / `LayerDiagnostic` を、`lib/rust/analyzer.ts` に
      `Span` と構文的事実の型を置く。事実は字面と位置だけで表し、型推論も名前解決もしない（FR7.12、BR6.4）。
- [x] **Step 4: データモデル層のテストを実装後に書いて実行** — `scanWorkspace` の 2 件で
      メンバー解決・ターゲット自動検出・パス依存の収集と、読めないルートの診断を確認する（BR1.1〜BR1.4）。

### ビジネスロジック層（層判定・分類・構文解析）

- [x] **Step 5: ビジネスロジック層の実装** — `lib/workspace/resolver.ts` に `assignLayers`
      （WF2、BR2〜BR3: 同居検査、composition root、CQRS 側、rmu、接尾辞と配置の一致／不明／食い違い、
      診断の code → crate_name 整列）、`classifyFile`（WF3、BR4）、`isAllowed` / `permissionTable` /
      `conventions`（WF5、BR5）を置く。`lib/rust/analyzer.ts` に `initAnalyzer` / `parse` と
      `structs` / `impls` / `fns` / `uses` / `calls` / `constructions` / `opaqueRegions`
      （WF4、BR6）を置く。
- [x] **Step 6: ビジネスロジック層のテストを実装後に書いて実行** — `assignLayers` の 2 件で
      機能仕様 §2 の決定表と bin/lib 同居、`classifyFile` の 1 件で crate-source / auxiliary / unowned、
      `permissions` の 1 件で許可表と `isAllowed`、`RustSyntaxAnalyzer` の 3 件で
      事実抽出・解析エラーとマクロ領域・content hash によるキャッシュ共有を確認する（BR6.3、BR6.5、BR6.6）。

### レビュー所見への対応（テスト量の不足）

- [x] **Step 6b: RustSyntaxAnalyzer のテストを 3 件から 6 件へ増やす** — 初版は 3 件で
      Standard 戦略の床（コンポーネントあたり 5〜8 件）を下回っていた。次の 3 件を
      `tests/u2-rust-analysis-foundation.test.ts` に追加し、6 件とする。いずれも現行のテストが
      踏んでいない経路である。
  - [x] **BR6.4 — `uses` が字面と先頭セグメントを返す**: 別名付きの use
        （`use crate::infra::Repo as RepoImpl;`）で `path_text` が字面のまま、
        `first_segment` が先頭セグメント、`alias` が別名になることを確認する。
        波括弧付きの use（`use billing_domain::{Order, Line};`）でも先頭セグメントが
        正しく取れることを確認する。
  - [x] **BR6.6 — 組み込み属性は不透明にしない**: `#[derive(...)]` は不透明領域にせず、
        非組み込みの属性マクロ（`#[my_custom_macro]`）だけを `attribute-macro` として報告する。
        式位置のマクロ呼び出しが `macro-expression`、item 位置のマクロ呼び出しが
        `macro-item` になることも同じテストで確認する。
  - [x] **BR6.7・BR6.8 — `body_shape` と構築箇所の種別**: メソッド本体の形が
        `&self.total` / `self.id.clone()` で `returns-field-only`、`self.id = …` /
        `self.id.push_str(…)` で `assigns-field`、`self.id.len()` のようにどちらでもない本体で
        `other`、`format!(…)` のようにマクロを含む本体で `opaque` になることを確認する。
        併せて `constructions` が `struct-literal` / `update-syntax`（`..` 付き）/
        `default-call`（`Type::default()` と `Default::default()`）/ `associated-call` を
        区別することを確認する。
  - [x] **上記 3 件が踏んだ実装不具合の修正** — `lib/rust/analyzer.ts` を 2 か所直した。
        `constructionFacts` は `base_field_initializer` を `struct_expression` 直下ではなく
        `body` フィールド配下に探す（`..base` の取りこぼしを直す）。`opaqueFacts` は
        item 位置の判定を `isItemPosition` に切り出し、tree-sitter が `mac!();` を
        `expression_statement` で包む場合も item 位置として拾う。
        期待値を実装に合わせて緩めた箇所は無い。

### レビュー所見への対応（型エラー R-02）

- [ ] **Step 6c: `isAllowed` の到達不能な比較を除去する** — `lib/workspace/resolver.ts` の
      `isAllowed` は `if (opposite && fromSide !== "rmu")` と書かれているが、`opposite` が真の
      時点で `fromSide` は `"command" | "query"` に絞られているため `!== "rmu"` は到達不能で、
      `tsc --noEmit` が TS2367 を出す。`&& fromSide !== "rmu"` を落とす。
      `rmu` は `opposite` を成立させないため、振る舞いは変わらない。
      `permissionTable` の `cross_side_allowed: from === "rmu"` は現状のままとする。
      修正後に `bun test tests/u2-rust-analysis-foundation.test.ts` と
      `bunx tsc --noEmit -p .` を実測し、本 Unit 由来の TS2367 が消えたことを確認する。

### 構成と文書

- [x] **Step 7: 環境・ビルド構成** — tree-sitter の wasm と web-tree-sitter を `vendor/` と `wasm/` に
      同梱し、ライセンス表記（`LICENSE`、`NOTICE.md`）を添える。実行時に外部から取得しない（NFR1、NFR2）。
- [x] **Step 8: ドキュメントとトレーサビリティ** — `code-summary.md` に作成物と判断を記録し、
      `traceability.json` に FR／NFR／BR と実装ファイルの対応を、`source-manifest.json` に
      本 Unit が作成・変更した全パスを列挙する。
- [x] **Step 9: テスト構成** — `bun:test` を既定のまま使い、専用設定ファイルを追加しない。
      一時ディレクトリに Cargo workspace を組み立てて後始末し、テスト間の状態を持ち越さない。

## 要件 → 実装ステップの対応

| 要件 | 内容 | ステップ | 実装先 |
|---|---|---|---|
| FR7.4 | Cargo workspace のメンバー解決 | Step 3, 5 | `lib/workspace/resolver.ts` |
| FR7.5 | クレートのターゲット自動検出 | Step 3, 5 | `lib/workspace/resolver.ts` |
| FR7.6 | クレートの層判定 | Step 5 | `lib/workspace/resolver.ts`（BR2、BR3） |
| FR7.7 | ファイル単位の分類 | Step 5 | `lib/workspace/resolver.ts`（BR4） |
| FR7.8 | 依存方向の許可表 | Step 5 | `lib/workspace/resolver.ts`（BR5） |
| FR7.9 | 規約の出典（U7・U8 が転記） | Step 5 | `lib/workspace/resolver.ts`（`conventions`） |
| FR7.12 | 字面と位置のみを返し解決しない | Step 3, 5 | `lib/rust/analyzer.ts`（BR6.4） |
| FR8.4 | Rust 構文的事実の抽出 | Step 5, 6 | `lib/rust/analyzer.ts` |
| FR8.6 | 言語別ディレクトリの境界 | Step 1 | `lib/rust/`、`lib/workspace/` |
| FR9.1〜FR9.6 | Cargo workspace からの層判定 | Step 3, 5 | `lib/workspace/resolver.ts` |
| NFR1 | 実行時依存を増やさない | Step 2, 7 | wasm と vendor の同梱、`bun:test` |
| NFR2 | ネットワーク非依存 | Step 1, 7 | 同梱資産のみ。実行時取得なし |
| NFR3 | 時間予算 | Step 5 | content hash による解析キャッシュ（BR6.3） |

## テスト方針（Unit 限定）

- **実行コマンド**: `bun test tests/u2-rust-analysis-foundation.test.ts`（`ddd/` を作業ディレクトリとする）
- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit は 12 件
  （WorkspaceLayerResolver 6 件、RustSyntaxAnalyzer 6 件）。Step 6b の追加後
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であること
- **品質目標**: 契約の coverage floor を緩和しない。落ちた場合は目標を下げずに乖離を報告する

## 検証

承認後、Step 1〜6 は**既存実装の検証**、Step 6b は**実施済みのテスト追加と不具合修正の検証**、
Step 6c は**未実施の型エラー修正の実行**として進める。いずれも結果は `code-summary.md` に記録する。

- `bun test tests/u2-rust-analysis-foundation.test.ts` の実測（pass / fail 件数）
- `bun test tests/` 全体の実測（既存スイートの状態を含む）
- `bun run check`（Biome + プラグイン検証 + 全テスト）の実測
- `bunx tsc --noEmit -p .` の実測。Step 6c の後、本 Unit 由来の TS2367 が消えていること。
  本 Unit 以外の既存エラーは件数を記録し、本 Unit の範囲では扱わない
- センサー `required-sections` / `linter` / `type-check` / `traceability` の本 Unit 成果物に対する判定
- `source-manifest.json` の全パスが実在し、未申告の変更が無いこと

## 完了条件

- 本 Unit が作成・変更した全アプリケーションソースが `source-manifest.json` に列挙されている
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスである
- Step 1〜6 は既存実装に対する改変を行っていない
- 本 Unit の改変は Step 6b と Step 6c に限られる。すなわち
  `tests/u2-rust-analysis-foundation.test.ts` のテスト 3 件追加、
  `lib/rust/analyzer.ts` の不具合修正 2 か所（Step 6b）、
  `lib/workspace/resolver.ts` の到達不能な比較の除去（Step 6c）である。
  いずれのパスも `source-manifest.json` に含める
- `bunx tsc --noEmit -p .` に本 Unit 由来の型エラーが残っていない

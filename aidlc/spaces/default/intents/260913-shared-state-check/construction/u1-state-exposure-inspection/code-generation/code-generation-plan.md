# U1 状態公開の共通検査 — 実装計画

## Sources

- [機能仕様](../functional-design/functional-spec.md)、[規則](../functional-design/rules.md)、[値モデル](../functional-design/entities.md): U1の設計とBR1.1〜BR1.10。
- [契約](../../../inception/contract-design/contract-summary.md): 公開入口、共通値、正常の証跡保持、応答欠落の分類。
- [作業単位](../../../inception/units-generation/unit-of-work.md)、[要件](../../../inception/requirements-analysis/requirements.md): U1の所有範囲と品質条件。
- [ストーリー](../../../inception/user-stories/stories.md): US1.3の七受入条件と他ストーリーへの協力範囲。

## Scope and Baseline

U1の共通値・要求準備・実行時検証・純粋な判定を実装し、専用試験と英日文書を追加する。U2の解析器・検証CLIや既存の本番センサーは変更対象に含めない。初期の未コミット変更はこの作業以前のものとして保存し、同じファイルへ無関係な変更を混ぜない。

既存のpackage.json、tsconfig.json、Biome設定とテストソースを確認した。現在のBunテストはbun:test、型の入口は明示export、相対importには.tsを使う。既存所見の並べ方はlocaleCompareを使うため、C1のUnicodeスカラー値順にそのまま流用しない。

直近の既存Rust基準試験の実績はリバースエンジニアリング時の25件成功である。この実装開始前の再実行は計画承認を確認するフックで拒否されたため、未実施として扱う。Step 1で新規コードを書く前に改めて実行して記録する。

## Files and Ownership

| パス（リポジトリ相対） | 内容 |
|---|---|
| ddd/tools/ddd/lib/state-exposure/contract.ts | C1の共通型、版、理由コード、返却値の宣言 |
| ddd/tools/ddd/lib/state-exposure/canonical.ts | JSON互換性・Unicode・整数の確認、正規化・比較・複製の共通処理 |
| ddd/tools/ddd/lib/state-exposure/request.ts | 入力・要求検証、UTF-8スナップショット、要求識別の準備 |
| ddd/tools/ddd/lib/state-exposure/evidence.ts | 実行状態の外枠と応答、Fact・完全性・位置の検証 |
| ddd/tools/ddd/lib/state-exposure/inspection.ts | 判定、確定所見・未解決理由・正常の証跡を保持した結果生成 |
| ddd/tools/ddd/lib/state-exposure/index.ts | prepareInspectionRequest・inspectStateExposureと必要な型の明示export |
| ddd/tests/state-exposure-contract.test.ts | 値・要求・正規化・応答の境界試験 |
| ddd/tests/state-exposure-inspection.test.ts | 判定と公開入口を通す結合試験 |
| ddd/tests/fixtures/state-exposure-inspection/ | 両試験が使う独立した固定入力・期待値。必要な場合のみ追加 |
| ddd/docs/developers/state-exposure-inspection.md / state-exposure-inspection.ja.md | 共通検査の契約と単独実行手順を英日で記録 |

責務上必要なら上記の同一ディレクトリ内で補助ファイルへ分けるが、公開契約・所有範囲・試験範囲は変えない。変更が計画内容を変える場合は計画の承認を取り直す。依存追加や共通のpackage.json・tsconfig.jsonの変更が必要なら、U2の所有へ勝手に書き込まず、その必要性を報告する。

## Ordered Steps

- [x] Step 1 — 既存の実行環境・設定と未コミット差分を再確認する。新規コードに触れる前に既存Rustの三つの基準テストを実行し、直近の基準を記録する。BunとローカルBiomeの実行可否を確認する。U1専用コマンドはunit-test-instructions.mdに従う。（US1.3、NFR2、NFR3）
- [x] Step 2 — contract.tsとcanonical.ts、request.tsを実装する。JSON互換性、循環と共有参照の区別、安全な整数、Unicodeスカラー値順、改行を保持したUTF-8、正規化要求識別、入力を変更しない返却を実装する。（US1.3、BR1.1、BR1.2、BR1.9）
- [x] Step 3 — 上記の実装に対してstate-exposure-contract.test.tsの値・要求試験を書き、実行する。キー順や共有参照の同値性、本文・設定・対象・版の差、不正値・重複・Unicode・改行・範囲境界を確認する。（AC1.3.1、AC1.3.4、AC1.3.7）
- [x] Step 4 — evidence.tsとinspection.tsを実装する。要求検証、実行外枠、応答検証、判定の順序を分け、未検証値を判定へ渡さない。キー欠落・非JSON値とresponse:nullを区別する。全体が検査不能でも確定違反を保持し、正常時もtargetとcheckedEvidenceを返す。（US1.3、BR1.3〜BR1.8）
- [x] Step 5 — 応答の検証試験を契約テストへ追加し、判定試験をstate-exposure-inspection.test.tsへ書いて実行する。四つの判定条件、部分的な空集合、混在、未知版・識別不一致・欠落・不正、起動不能・失敗を確認する。（AC1.3.2〜AC1.3.7）
- [x] Step 6 — index.tsの公開入口を接続する。外部解析器やI/Oへの依存を作らず、既存の本番経路へ接続しない。（US1.3、BR1.10）
- [x] Step 7 — 公開入口から要求準備→検査→JSON往復を通す結合試験を書いて実行する。正常の根拠だけの差、入力変更からの独立性、同じ意味の両言語由来の共通値、順序の再現性を確認する。各テストは期待値を実際の結果から作らない。（AC1.3.1、AC1.3.3、AC1.3.7、NFR1、NFR3）
- [x] Step 8 — U1の全専用試験、対象ファイルのBiome検査、Bunの構文・束ね検査を行う。既存Rust基準も再実行し、新規失敗がないことを確認する。U2でCompiler API等の依存が導入された後の静的型検査へ、このU1も引き継ぐ。（US1.3、NFR2、NFR3）
- [x] Step 9 — 英日文書を追加する。実際の入口・試験コマンド、対応範囲、実行した検証と未実施の検証を区別して記す。code-summary.md、source-manifest.json、traceability.jsonを作成し、全変更パスと七AC・十BRの対応を残す。（US1.3、FR6.2）

データベース、永続化リポジトリ、HTTP API、画面、インフラの層はU1に存在しないため、テスト契約の汎用ステップから適用外として除く。テスト用のBun設定は既存設定を利用する。実装してから当該部分の試験を書く順序は維持し、未実装のスタブ試験や常に成功する試験を追加しない。

## Acceptance Traceability

| 受入条件 | 実装・確認するステップ |
|---|---|
| AC1.3.1: 要求と根拠の対応 | 2、3、4、7 |
| AC1.3.2: 部分的な空結果を正常にしない | 4、5 |
| AC1.3.3: 確定違反と未解決を保持 | 4、5、7 |
| AC1.3.4: 不正応答を根拠にしない | 2、3、4、5 |
| AC1.3.5: 実行状態と規則結果の区別 | 4、5 |
| AC1.3.6: 正常・適用外の根拠を限定 | 4、5 |
| AC1.3.7: 同じ意味の情報の共通比較 | 2、3、4、5、6、7 |

## Verification Limits

Step 1とStep 8の既存基準の確認はdddを作業ディレクトリとして次を実行する。既存試験の内容や期待値は変更しない。このコマンドはU1の新規専用試験とは別の回帰確認である。

```sh
bun test tests/u2-rust-analysis-foundation.test.ts tests/u5-rust-code-sensors.test.ts tests/u5-golden.test.ts
```

新しい数値のカバレッジ下限は設定しない。既存のStandard方針と全七受入条件・十規則を満たし、必要な境界ケースを表形式で追加する。Bunの構文・束ね検査を静的型検査の成功とは記載しない。U2での両言語の実ソース抽出・C2実行・全体の型検査は、このU1の単独検証と分ける。

## Testing Contract

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

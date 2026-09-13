# U2 言語別抽出と検証実行 — 実装計画

## Sources

- [機能仕様](../functional-design/functional-spec.md)、[規則](../functional-design/rules.md)、[値モデル](../functional-design/entities.md): 修正済みU2設計、BR2.1〜BR2.14。
- [契約](../../../inception/contract-design/contract-summary.md)、[作業単位](../../../inception/units-generation/unit-of-work.md)、[要件](../../../inception/requirements-analysis/requirements.md)、[ストーリー](../../../inception/user-stories/stories.md): C1/C2、所有範囲、US1.1・US1.2・US1.4の16受入条件。
- [公式Compiler APIガイド](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API): 従来のProgram・TypeCheckerのAPIは6.0以前が対象であり、7系とは世代を区別する。
- [TypeScript 6.0の公開説明](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)、[sha2 0.10.9](https://docs.rs/sha2/0.10.9/sha2/): 採用するAPI世代と本文ダイジェスト実装の参照。

## Scope and Baseline

Rustの指定型抽出、TypeScriptの二表現の抽出、U1への変換・呼出し、固定ケースの比較・報告・検証CLIを実装する。U1の共通契約と判定を利用し、規則の意味をU2で再定義しない。既存の版1試作と本番Rustセンサーを維持する。

U1は専用138件と既存Rust79件の試験、および独立レビューを通過済みである。U2の実装前に基準を再実行し、現在の未コミット変更を保存する。U1の実装はこのUnitの書込対象に含めない。型検査でU1の修正が必要と分かった場合は、検査を弱めず、対象と原因を報告して所有範囲を整理する。

## Dependencies and Configuration

- 従来のCompiler APIを使うため、TypeScript 6.0系の安定版を採用する。導入時に6.0系の版を解決し、package.jsonへ完全一致で保存し、bun.lockと実行記録にも解決した版を残す。7系や開発版へ自動的に置き換えない。createProgram・Program・TypeCheckerが実際に利用できることを最小入力で確認する。
- Bun 1.3.13環境の型宣言として@types/bun 1.3.13を完全固定で追加する。依存解決に失敗した場合に別の版を無断で採用しない。
- Rustの本文ダイジェストはsha2 =0.10.9を使い、Cargo.lockを更新する。既存syn =3.0.5は維持し、無関係な依存更新を混ぜない。
- ddd/package.json・bun.lock・必要な型検査設定はU2の変更範囲とする。既存のコマンド・設定・ユーザー編集を保持し、今回の検証を追加する。
- U1とU2の共通検査経路を対象にするtsconfig.state-exposure.jsonを追加し、既存の厳格な型検査条件を継承する。新経路の実装・試験・検証スクリプトと、そのU1依存を含め、無関係な全体ファイルを検査対象へ広げない。型エラーを隠すためにstrict等を無効にしない。

承認後の依存導入はdddから `bun add --dev --exact typescript@6.0 @types/bun@1.3.13` を使う。TypeScriptの具体的な解決版を記録し、以後は凍結したロックで導入する。依存導入は準備作業であり、C2の検証入口で実行しない。

## Files and Ownership

| パス（リポジトリ相対） | 内容 |
|---|---|
| ddd/experiments/rust-syn/src/main.rs / analysis.rs と同ディレクトリの補助モジュール | 版1を維持し、版2の指定型・入力識別・確定性・位置を追加 |
| ddd/experiments/rust-syn/Cargo.toml / Cargo.lock | 本文ダイジェストの依存追加と固定 |
| ddd/tools/ddd/lib/rust/state-evidence/ | 版2の起動、ネイティブ応答検証、C1への変換 |
| ddd/tools/ddd/lib/typescript/state-evidence/ | 固定入力のProgram、対象・class・コンパニオン・位置の抽出 |
| ddd/tools/ddd/lib/state-exposure-verification/ | 固定ケース、実行管理、期待値比較、報告の組立て |
| ddd/scripts/prepare-state-exposure.ts | 承認済みのオフラインビルドと固定配置を行う明示的な準備入口 |
| ddd/scripts/verify-state-exposure.ts | C2の検証CLI |
| ddd/tests/state-exposure-rust.test.ts / state-exposure-typescript.test.ts / state-exposure-verification.test.ts | 三構成要素と接続境界の試験 |
| ddd/tests/fixtures/state-exposure-languages/ | 両言語の正常・違反・未解決・混在と実行異常の固定ケース |
| ddd/package.json / bun.lock / tsconfig.state-exposure.json / 必要なtsconfig.json変更 | 依存、コマンド、自動検証と型検査への接続 |
| ddd/docs/developers/state-exposure-verification.md / state-exposure-verification.ja.md | 対応範囲、準備、使用方法、終了コード、実行条件 |
| ddd/docs/developers/evidence/state-exposure-check.json | 実際に検証した環境とケースの結果 |
| ddd/docs/developers/README.md / README.ja.md、ddd/tests/README.md / README.ja.md | 新しい実行案内へのリンク |
| ddd/scripts/verify-rust-syn.ts | 版1回帰の維持に必要な接続調整がある場合のみ変更 |

上記ディレクトリ内の補助ファイル分割は必要な責務に限る。本番センサー、既存Rust解析器、第三者フレームワークは変更しない。U1の共通実装と契約へ変更が必要なら、その影響を明示して扱う。

## Ordered Steps

- [x] Step 1 — 既存の未コミット差分を確認し、U1専用試験と既存Rustの三基準ファイルを再実行して実装前の基準を記録する。Bun、Cargo、rustc、Biomeの利用可否を確認する。（NFR2、US1.4）
- [x] Step 2 — 依存を固定して導入し、限定した型検査設定とテスト実行環境を準備する。最小の固定ソースでProgramとTypeCheckerが使えることを確認する。Rustの明示的な依存取得を行い、以後のビルドはlocked/offlineとする。（BR2.1、BR2.13、BR2.14）
- [x] Step 3 — Rust内部版2の要求・応答と、指定型・名前付き／タプルフィールド・確定性・位置・本文ダイジェストを実装する。既存版1の形状と8 MiB入力上限を維持する。一般の名前解決やTypeScript側でのRust再解析を追加しない。（US1.1、BR2.2〜BR2.4）
- [x] Step 4 — Rust内部の単独試験と、明示的なビルド・配置の準備スクリプトを追加して実行する。版1との互換性、不正入力、指定型、Unicode・改行・条件付き構文を試験する。準備スクリプトはfetchせず、機能設計の固定参照先へ配置する。（US1.1、BR2.8、BR2.13）
- [x] Step 5 — RustStateEvidenceの起動・版2応答検証・C1変換を実装し、state-exposure-rust.test.tsを書いて実行する。正常終了と応答の妥当性を分け、空出力と不正出力の経路をそれぞれ試験する。（AC1.1.1〜AC1.1.5、BR2.8〜BR2.10）
- [x] Step 6 — TypeScriptStateEvidenceを実装する。固定ソースと準備済み標準ライブラリに読取りを限定したCompilerHostでProgramを作り、TypeCheckerで対象とブランドを確認する。class、局所instance、成功値ラッパー、内側メソッドのreturnの区別を実装する。（US1.2、BR2.2、BR2.5〜BR2.7）
- [x] Step 7 — state-exposure-typescript.test.tsを書いて実行する。二表現の正常・違反・未解決、readonly、非公開ブランドの計算名、型アサーション、継承、spread、追えない戻り経路、位置の変換を確認する。（AC1.2.1〜AC1.2.5）
- [x] Step 8 — StateExposureVerificationのケース・実行管理・比較・報告を実装し、state-exposure-verification.test.tsの単独試験を書いて実行する。期限と出力上限、実準備不足と意図した異常、根拠だけの差、正常時の証跡保持を検証する。（US1.4、BR2.8〜BR2.12、BR2.14）
- [x] Step 9 — verify-state-exposure.tsとpackage.jsonのC2コマンドを接続し、実際の両言語を通す結合試験とCLI試験を追加して実行する。exit0〜3、空集合・未知caseId・重複引数、stdoutの単一JSON、再実行の一致、空出力・不正出力のcompleted/unresolvedを確認する。（AC1.4.1〜AC1.4.3、AC1.4.6）
- [x] Step 10 — U2専用試験、両Unitを対象にする限定型検査、変更範囲のBiome、版1の試作比較、既存Rust基準を実行する。既存checkの処理を保持し、明示的なオフライン準備・通常試験・新C2検証・限定型検査を別ステップとして自動検証へ接続する。C2の中にfetch・buildを入れない。（US1.4、NFR1〜NFR3）
- [x] Step 11 — 英日文書と実行証跡を作成し、案内を接続する。実際の採用版・環境・準備・コマンド・ケース・成否と未対応範囲を記録する。未実行環境を検証済みにしない。（AC1.4.6、BR2.13）
- [x] Step 12 — code-summary.md、source-manifest.json、traceability.jsonを作成する。16 ACと14 BRを、実在する単一の代表実装または試験ファイルへ各一行で対応付ける。全アプリケーション変更パスをマニフェストに含め、計画はチェックマーカーだけ更新する。（US1.1、US1.2、US1.4）

各部分を実装してから、その部分の試験を書き実行する。未実装のスタブや常に通る試験を作らない。データベース、独立したHTTPサービス、画面、配布基盤はこのUnitにないため、Testing Contractの汎用層から適用外とする。

## Acceptance Traceability

| 対象 | 実装・試験ステップ |
|---|---|
| AC1.1.1〜AC1.1.5 | 3、4、5、9 |
| AC1.2.1〜AC1.2.5 | 6、7、9 |
| AC1.4.1〜AC1.4.3 | 8、9、10 |
| AC1.4.4〜AC1.4.6 | 1、2、10、11 |

## Regression and Preparation

基準と版1の回帰はdddを作業ディレクトリとして実行する。既存試験を弱めず、C2の検証とは別の実績として記録する。

```sh
bun test tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts
bun test tests/u2-rust-analysis-foundation.test.ts tests/u5-rust-code-sensors.test.ts tests/u5-golden.test.ts
bun run experiment:rust-syn
```

新しいprepare:state-exposureは、機能設計どおりhostを指定したlocked/offlineビルドと、experiments/rust-syn/target/state-exposure/ddd-rust-syn-spikeへの配置を行う。依存キャッシュが不足する場合のcargo fetchは別の明示的な初期準備とし、検証入口から実行しない。

## Quality and Limits

既存の厳格な設定とStandardの試験方針を維持する。三構成要素ごとに主要ケース5〜8件以上を目安とし、必要な境界はデータ駆動で追加する。新しいカバレッジ数値下限は設けない。共通値の試験・型検査・実ソース抽出・CLIの結合結果を区別する。

TypeScriptは選んだ6.0系の具体版を導入後に記録する計画であり、現時点で特定パッチ版の導入成功を主張しない。異なるAPI世代や、承認済み契約にない対応範囲への切替はこの計画に含めない。

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

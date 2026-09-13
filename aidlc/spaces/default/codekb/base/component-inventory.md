# 調査範囲内の構成要素

## Inventory Scope

以下は状態公開の最小経路に関係する、今回詳細確認した実装単位の一覧である。製品全体の境界づけられたコンテキストを新たに定義するものではない。`healthy`は今回の用途で責務を追えること、`at-risk`は共通化や正確性に具体的な制約があることを示し、全機能の品質保証を意味しない。

## 開発コマンド設定

- 評価: `healthy`
- 実装範囲: `ddd/package.json`、`bun.lock`、`tsconfig.json`、`biome.json`
- 責務と所有: 検証・ビルド・テストの入口と開発依存を所有する。
- 依存: Bun、Biome、既存フレームワークのビルド・妥当性検証コマンド。
- 制約: 宣言は明確。TypeScript解析用の依存版と新経路の自動検証接続は未導入。

## 本番Rustセンサー実行

- 評価: `healthy`
- 実装範囲: `ddd/tools/ddd-sensor-rust-domain.ts`、`ddd/tools/ddd/lib/runtime/runtime.ts`
- 責務と所有: 解析器初期化、規則の指定、実行コンテキスト、予算・例外処理、JSON判定を所有する。
- 依存: Rust構文抽出、規則評価、所見出力。
- 制約: 既存の入口として維持する。共通経路の実行状態を現在のpass計算へ暗黙に流用しない。

## Rust構文抽出

- 評価: `at-risk`
- 実装範囲: `ddd/tools/ddd/lib/rust/analyzer.ts`
- 責務と所有: tree-sitter構文木、構文キャッシュ、Rustのstruct等の抽出情報を所有する。
- 依存: vendored tree-sitter-rustとweb-tree-sitterの資産。
- 制約: 公開タプルフィールドを拾わない既知の差がある。型推論・コンパイラ名前解決・マクロ展開を提供しない。

## 規則評価

- 評価: `at-risk`
- 実装範囲: `ddd/tools/ddd/lib/rules/{types,definitions,context,evaluate}.ts`、`rules/rust/evaluators.ts`
- 責務と所有: 現行コンテキスト、規則の要求情報、状態公開判定、所見・noteの集約を所有する。
- 依存: Rust構文抽出、Cargo・モデル・ソースクレームの周辺処理、所見出力。
- 制約: Rust固有型が境界に出る。周辺のCargo・モデル処理の内部設計は未調査。

## 所見出力

- 評価: `healthy`
- 実装範囲: `ddd/tools/ddd/lib/shared/findings.ts`
- 責務と所有: 所見の必要項目、位置、整列順、決定的なIDを所有する。
- 依存: 規則・実行側から渡される値。
- 制約: 共通経路の参考にできるが、所見一覧だけでは実行完了や情報の完全性を保証しない。

## syn解析試作

- 評価: `at-risk`
- 実装範囲: `ddd/experiments/rust-syn/{Cargo.toml,Cargo.lock,src/main.rs,src/analysis.rs}`
- 責務と所有: 試作用入力プロトコル、Rust構文走査、ファイル単位の候補と未解決理由を所有する。
- 依存: syn、proc-macro2、quote、serde、serde_json。
- 制約: 試作として境界が明確。指定型と完全性の共通契約、本番組込み、他OS配布は未検証または未実装。

## 試作比較検証

- 評価: `healthy`
- 実装範囲: `ddd/scripts/verify-rust-syn.ts`、`ddd/experiments/rust-syn/cases.json`
- 責務と所有: 試作ビルド、固定入力、現行解析器・センサーとの比較、不正入力の検証を所有する。
- 依存: syn解析試作、現行Rust経路、ゴールデンランナー、Bun、Cargo、一部rustc。
- 制約: 保存済みの試作結果が対象。今回の調査では再実行していない。通常checkには接続されていない。

## Rust回帰検証

- 評価: `healthy`
- 実装範囲: `ddd/tests/u2-rust-analysis-foundation.test.ts`、`u5-rust-code-sensors.test.ts`、`u5-golden.test.ts`、`README.ja.md`
- 責務と所有: 既存解析・規則・センサーの回帰期待値と検証案内を所有する。
- 依存: Bunテスト、現行Rust経路、ゴールデン検証の周辺処理。
- 制約: 今回実行した25件は成功。TypeScriptと共通契約を検証した結果ではない。

## Planned Components

TypeScript解析器、指定型の状態情報の共通契約、共通評価器はまだない。syn試作をそれらの代わりに数えない。今後の構成要素と配置はIssue #38の設計で決め、このリバースエンジニアリングでは実装済み一覧へ混ぜない。

## Sources

根拠は[開発者の調査記録](../../intents/260913-shared-state-check/inception/reverse-engineering/developer-scan.md)である。本文のソース位置はその記録から引き継いだ。構成の解釈は本分析による。詳細調査と概要確認の範囲は[調査時点と範囲](reverse-engineering-timestamp.md)に記録した。

# 調査対象の依存関係

## External Dependencies

| 利用側 | 依存先 | 境界 |
|---|---|---|
| プラグイン開発コマンド | Bun、Biome | 実行と静的検査。版は技術スタックに集約 |
| 本番Rust解析器 | vendored tree-sitter-rust／web-tree-sitter | WASM・ランタイム資産。依存本体の内部実装は未調査 |
| Rust試作 | syn、proc-macro2、quote | Rust構文とトークン・位置の抽出 |
| Rust試作 | serde、serde_json | CLI入力の検証と報告の直列化 |
| 試作比較 | Cargo、必要ケースのrustc | 試作のreleaseビルドとコンパイル対照 |

版の確認元と未確認のものは[技術スタック](technology-stack.md)を正とする。TypeScript Compiler APIは計画上の依存で、現在のmanifestには入っていない。

## Internal Dependencies

本番経路はセンサー入口から実行制御へ進み、Rustコンテキストと構文情報を用いて規則を判定し、所見処理へ集約する。コンテキストにはCargo、モデル、ソースクレームの情報が流入する。これら周辺処理の内部構造は概要確認にとどまる。

独立した`experiment:rust-syn`は、`verify-rust-syn.ts`から`cargo build --locked --release`を呼び、出来た試作CLIを起動する。同じスクリプトは既存のtree-sitter解析器とRustゴールデンランナーにも依存する。本番Rustセンサーからsyn試作への依存は、この調査経路では見つかっていない。

`check`はBiome、プラグイン妥当性検証、`bun test tests/`の順に実行する。`experiment:rust-syn`は独立コマンドで、現在の`check`および`test:sandbox`からは起動されない。新規経路の検証を自動実行する際は、その登録と必要ツールを明示する必要がある。

## Framework Boundary

`build:claude`、`build:codex`、`validate`は既存の`.codex/tools/`フレームワークコマンドを呼ぶ。今回確認したのはパッケージ設定上の呼出先までであり、第三者フレームワークの実装は読んでいない。Issue #38はその実装改変や新規CI基盤を前提にしない。

## Dependency Risks

共通評価器に現在の`InspectionContext`を直接渡すと、状態公開一規則の固定入力にもCargo・Rust構文モデルが必要になり、TypeScript用の経路がRustへ依存する。言語別の実装で抽出した最小情報を渡す設計なら、この依存を避ける余地がある。

syn試作を通常検証へ接続する場合、Bunだけだった検証にRustビルドの前提が追加される。どのコマンドでビルドし、どの失敗を検査不能とするかを今回の最小経路で明示する必要があるが、利用者環境で都度Rustビルドする本番配布方式をここで採用するものではない。

## Sources

根拠は[開発者の調査記録](../../intents/260913-shared-state-check/inception/reverse-engineering/developer-scan.md)である。本文のソース位置はその記録から引き継いだ。構成の解釈は本分析による。詳細調査と概要確認の範囲は[調査時点と範囲](reverse-engineering-timestamp.md)に記録した。

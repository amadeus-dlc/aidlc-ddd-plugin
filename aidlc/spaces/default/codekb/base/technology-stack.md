# 技術スタックと確認した版

## Languages and Runtimes

| 技術 | 確認した版・設定 | 確認の種類 |
|---|---|---|
| TypeScript／Bun | Bun 1.3.13、ESM | 開発者が今回テスト実行時に確認 |
| TypeScript開発設定 | strict、noEmit、ESNext、bundler解決、Bun型 | `ddd/tsconfig.json`の宣言 |
| Rust試作 | edition 2021 | `ddd/experiments/rust-syn/Cargo.toml`の宣言 |
| rustc／Cargo | 1.95.0 | 保存済み試作証跡の値。今回の再ビルド結果ではない |
| 試作の実行環境 | darwin-arm64 | 保存済み試作証跡の値。他OSへの適合性を示さない |

Rustのedition 2021は試作CLI自身のコンパイル設定であり、解析対象の全Rustソースをそのeditionで検証したという意味ではない。synでパースできることと、対象プロジェクトのコンパイル可否は別である。

## Libraries and Tools

| 依存 | 版 | 現在の用途 |
|---|---|---|
| Biome | 2.5.12、manifest／lockで固定 | プラグインの静的検査と整形 |
| syn | 3.0.5、Cargo.tomlで完全固定 | full、parsing、printing、visitによる構文解析 |
| proc-macro2 | 1.0.107、Cargo.lock | トークンとソース位置 |
| quote | 1.0.47、Cargo.lock | トークン表記 |
| serde | 1.0.229、Cargo.lock | 試作CLIの入出力の型付き変換 |
| serde_json | 1.0.151、Cargo.lock | JSON入出力 |
| tree-sitter-rust／web-tree-sitter | vendored資産。今回版未確認 | 本番Rust構文解析 |
| TypeScript Compiler API | 未導入、採用版未確定 | Issue #38で導入予定のTypeScript解析基盤 |

当該Bunパッケージの宣言済み開発依存はBiomeのみである。`typescript`依存も`tsc`実行スクリプトもまだない。Bunでテストが通ることをTypeScriptコンパイラによる型検査の実行と扱わない。

## Compatibility Boundary

今回読んだ開発用tsconfigと、利用者のTypeScriptコードを解析するProgramの条件は別である。Issue #38の固定入力に必要なCompiler APIの具体版と設定を定め、結果に解析条件を結び付ける必要がある。

現在の試作はネイティブ配布戦略を確定する根拠には不足する。今回のintentは本番配布とフレームワーク統合を含まず、他OSやNext.jsの動作保証は行わない。依存の結び付きは[依存関係](dependencies.md)を参照する。

## Sources

根拠は[開発者の調査記録](../../intents/260913-shared-state-check/inception/reverse-engineering/developer-scan.md)である。本文のソース位置はその記録から引き継いだ。構成の解釈は本分析による。詳細調査と概要確認の範囲は[調査時点と範囲](reverse-engineering-timestamp.md)に記録した。

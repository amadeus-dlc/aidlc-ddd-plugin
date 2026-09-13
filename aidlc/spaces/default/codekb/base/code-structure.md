# 調査対象のコード構造

## Package Organization

`ddd/`の非公開開発パッケージを中心に、TypeScriptの本番センサーとRust試作が別のビルド単位に置かれている。以下は今回の調査に必要な抜粋であり、プラグイン全体の完全なツリーではない。

```text
ddd/
  package.json / bun.lock / tsconfig.json / biome.json
  tools/
    ddd-sensor-rust-domain.ts
    ddd/lib/
      runtime/runtime.ts
      rust/analyzer.ts
      rules/types.ts / definitions.ts / context.ts / evaluate.ts
      rules/rust/evaluators.ts
      shared/findings.ts
  experiments/rust-syn/
    Cargo.toml / Cargo.lock / cases.json
    src/main.rs / analysis.rs
  scripts/verify-rust-syn.ts
  tests/
    u2-rust-analysis-foundation.test.ts
    u5-rust-code-sensors.test.ts
    u5-golden.test.ts
    README.ja.md
  docs/developers/
    inspection-contract-design.ja.md
    rust-syn-spike.ja.md
```

## File Classification

| 分類 | 主な場所 | 今回の読み方 |
|---|---|---|
| 開発設定・依存固定 | `package.json`、各lock、`tsconfig.json`、`biome.json`、`Cargo.toml` | 宣言と実行コマンドを詳細確認 |
| 本番のセンサー・内部処理 | 上記`tools/`の個別ファイル | 状態公開に関係する入口・抽出・評価・出力を詳細確認 |
| 独立試作 | 上記`experiments/rust-syn/`の個別ファイル | 入出力、Visitor、固定入力を詳細確認 |
| 比較・回帰検証 | 上記スクリプトと3テスト、テストREADME | 呼出しと検証意図を詳細確認。実行範囲は品質評価に記録 |
| 合意済み設計・保存済み証跡 | 上記2文書 | 現状と計画を分離するために詳細確認 |
| その他 | `ddd/src/`、`ddd/tests/golden/`、他のlib・scripts・開発者資料 | 検索や呼出先・代表例の概要確認のみ |

25ファイルの正確な一覧は[Scope of Analysis](reverse-engineering-timestamp.md#scope-of-analysis)を正とする。ディレクトリ全体を列挙した行は、その全ファイルを深く理解したという主張ではない。

## Observed Code Patterns

本番入口は規則IDを渡す小さなラッパーになっている。共有の所見処理は文字列・位置・規則を検証して結果を整列する。Rust解析器は構文木を内部保持し、抽出した構文情報を公開するが、規則側はそのRust用表現に依存する。

Rust試作では標準入力とプロトコルの検証を`main.rs`、構文走査を`analysis.rs`へ分離している。比較スクリプトは試作CLIをビルドして起動し、現行解析器やゴールデンランナーを対照にする。本番入口が試作のビルドを行う構造にはなっていない。

## Change Boundary

Issue #38の具体的な追加ファイルは未決定である。共通経路の追加は本番センサーの置換と切り離し、既存Rustテストを回帰対象として残す。共有インターフェイスを導入するためにCargo探索・モデル移行・全規則の分割を先行実装する必要はない。

`.codex/tools/`のフレームワーク実装、既存ユーザー編集、ワークフロー状態は本分析の変更対象ではない。開発コマンドからのフレームワーク呼出しは[依存関係](dependencies.md)に示す。

## Sources

根拠は[開発者の調査記録](../../intents/260913-shared-state-check/inception/reverse-engineering/developer-scan.md)である。本文のソース位置はその記録から引き継いだ。構成の解釈は本分析による。詳細調査と概要確認の範囲は[調査時点と範囲](reverse-engineering-timestamp.md)に記録した。

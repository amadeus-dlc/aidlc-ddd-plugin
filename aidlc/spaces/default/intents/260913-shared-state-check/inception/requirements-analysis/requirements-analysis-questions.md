# 状態公開の共通検査 — 要件確認

対象は[Issue #38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38)に限定する。これまでの指定に従い、一問ずつ対話で確認する。合意済みの方針を再質問せず、未確定の判定の意味だけを確認する。

## Sources

- 初期依頼: `project-description.json`。`aidlc engine workspace project-description`で取得した記述を根拠とする。
- [Issue #38の範囲と完了条件](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38)
- 承認済みの[目的と対象範囲](../../../../codekb/base/business-overview.md)、[構成](../../../../codekb/base/architecture.md)、[コード構造](../../../../codekb/base/code-structure.md)
- 合意済みの[共通検査契約](../../../../../../../ddd/docs/developers/inspection-contract-design.ja.md)

## Already Confirmed

- 指定した型の状態公開という一規則を、Rust＋synとTypeScript Compiler APIで共通判定する。
- Rustの名前付き・タプル構造体、TypeScriptのclass・構造体＋コンパニオンの固定した代表例を扱う。
- 正常・違反・検査不能を区別し、不完全な空結果や未知形式を正常としない。
- 確定した違反は、他に検査不能な箇所があっても保持する。
- パッケージ探索、import・型別名の解決、エラー集合、成果物移行、本番センサー切替、配布、Next.js統合は含めない。
- APIバージョン、具体的な形式・配置、対応形状はこの範囲内で設計し、検証した条件を記録する。設定上の不明点を理由に対象範囲を増やさない。

## Q1: 確定した違反と検査不能が同時にある場合

指定した型に「確実に公開されているフィールド」と「解析できず、状態公開の有無を判断できない部分」が両方ある場合、全体の結果をどう返すか。

どちらの選択肢でも正常とは扱わず、確定した違反と未解決理由の両方を残す。ここで決めるのは、呼出し元へ返す全体結果の優先順位である。

- A. 全体は検査不能とし、確定した違反も併記する（推奨）。検査が完了していないことを全体結果に反映する。
- B. 全体は違反とし、検査が未完了であることも併記する。確定した違反の存在を全体結果に反映する。
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- 今回は、明示したソースと型に対する状態公開の一規則だけを実装する。固定プロジェクト入力を使い、ワークスペース全体から対象を探索しない。
- Rustはsynで名前付き・タプル構造体を調べる。TypeScriptはCompiler APIのProgramとTypeCheckerを使い、classと構造体＋コンパニオンの合意済み表現を扱う。
- 状態公開に必要な最小の共通情報・形式の版・入力と設定の識別・根拠を定義する。言語固有の構文木やコンパイラの型は共通判定へ渡さない。
- 正常・違反・検査不能を区別する。確定した違反と検査不能が同時にある場合、全体を検査不能とし、確定した違反と未解決理由の両方を残す（Q1: A）。
- 対象の欠落・曖昧さ、未知バージョン、結果不足、入力識別の不一致、不正または不完全な応答を正常としない。不完全な空リストを不在の証明に使わない。
- 両言語の正常・違反・検査不能を再実行できる検証コマンドと自動試験を用意し、既存Rustの回帰検証を維持する。検証したAPI版・対応形状・実行条件を記録し、該当する英日文書を揃える。
- パッケージ探索、import・型別名の解決、メソッドエラー集合、利用者成果物・設定の移行、本番センサー切替、ネイティブ配布、Next.js統合、一般的な副作用・可変参照の証明は今回の完了条件へ追加しない。
- 具体的なJSONキー、CLI引数、コード配置、対応形状の詳細は、上記の範囲を変えずに後続の設計で具体化する。

上記の内容で要件書を作成してよいか確認する。

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

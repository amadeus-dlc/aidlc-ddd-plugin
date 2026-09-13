# 調査対象のAPIと入出力

## External Interfaces

HTTPエンドポイントは今回深く読んだ範囲にない。外部との境界はローカルCLIの標準入力・標準出力・終了コードとファイル入力である。

| 入口 | 入力 | 出力 | 終了・異常の扱い |
|---|---|---|---|
| 本番`ddd-sensor-rust-domain` | 既存の`--stage`、`--output-path`に基づく実行コンテキスト | 単一JSONの`SensorVerdict` | 通常は0。解析資産欠落は127。例外・予算超過は`pass:false` |
| syn試作CLI | `protocol_version: 1`、非空の`files[{path,source}]`を標準入力へ渡す | ファイルごとの構文情報・候補・未解決理由を含む単一JSON | 不正リクエストは2。未解決を含め報告を出せれば0 |
| `experiment:rust-syn` | 保存された固定ケースと実行環境 | 比較検証結果 | assertionの不一致を失敗として扱う。共通契約の受入コマンドではない |

CLIの終了0は「規則に違反していない」と同義ではない。特に試作は解析不能を報告できた場合も0を返すため、後続処理は報告の状態を読まなければならない。

syn試作の入力境界は未知フィールド、不正JSON、空の対象集合、8 MiBを超える入力等を拒否する。これらは既存の試作用プロトコルの仕様であり、将来の共通契約にそのまま採用済みという意味ではない。

## Internal Interfaces

| 関数・型 | 所在 | 現在の責務と注意点 |
|---|---|---|
| `analyze(file, source)` | `experiments/rust-syn/src/analysis.rs:264` | `syn::parse_file`とVisitorで構文を集める。`field_inspection.state`、候補、types、unresolvedを返し、意味解析は`semantic_analysis: unsupported`とする |
| `initAnalyzer` / `parse` / `structs` | `tools/ddd/lib/rust/analyzer.ts:177`、`:649`、`:675` | WASM初期化、構文解析、struct抽出。内容ハッシュによる構文キャッシュと内部WeakMapを使う |
| `evaluateSensor` | `tools/ddd/lib/rules/evaluate.ts:20` | コンテキスト構築、規則の呼出し、所見とnoteの集約 |
| `InspectionContext` | `tools/ddd/lib/rules/types.ts:71` | 解析器・構文木・Cargo・RustProgramを含む現行のRust依存コンテキスト |
| `ruleA` | `tools/ddd/lib/rules/rust/evaluators.ts:42` | 対象ファイル内のstructフィールドのうちprivate以外を所見にする。指定型一件の契約ではない |
| `runSensor` | `tools/ddd/lib/runtime/runtime.ts:68` | 実行対象解決、予算、例外、単一JSON判定の出力 |
| 所見検証・整列 | `tools/ddd/lib/shared/findings.ts:31`、`:56` | 必須項目・行の検証、順序の安定化、決定的な`finding_id`付与 |

## Existing Contract Limitations

試作はファイル内に未解決要因があればファイル全体を未解決にする。指定型の欠落や同名候補の曖昧さ、別の入力から来た応答、対象集合の完全性を共通形式で検査する契約は持たない。

候補は確定違反ではない。条件付きコンパイル配下の公開フィールドも候補になり得る。正常と判断するには対応範囲・対象との結び付き・必要情報の完全性を確認し、不完全な空結果を合格に変換しない必要がある。

現行のnoteは将来の`resolved`／`absent`／`unresolved`と同じ型ではない。既存フレームワークの承認ディスパッチャーは今回未調査のため、noteが実運用で承認を止めるかはこの資料だけでは断定できない。

## Contract Work for Issue 38

次段階で、要求する型、ソースと設定の識別、解析器とプロトコルの版、位置を含む根拠、解決状態、完全性、実行状態と規則結果の最小形式を定める。構文木・Compiler APIのSymbol等は言語別の実装内へ閉じるという設計方針を維持する。

未知版、不正応答、結果の欠落、入力識別の不一致には正常結果を返さない。確認できた違反と未解決領域が同時にある場合の表現も定める。これは未実装の設計課題であり、本資料から新しいAPI名・JSONキー・状態列挙を確定させない。

## Sources

根拠は[開発者の調査記録](../../intents/260913-shared-state-check/inception/reverse-engineering/developer-scan.md)である。本文のソース位置はその記録から引き継いだ。構成の解釈は本分析による。詳細調査と概要確認の範囲は[調査時点と範囲](reverse-engineering-timestamp.md)に記録した。

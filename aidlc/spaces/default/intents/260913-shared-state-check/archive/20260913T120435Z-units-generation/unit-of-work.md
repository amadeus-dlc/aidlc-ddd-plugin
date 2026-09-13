# 状態公開の共通検査 — 作業単位

## Sources

- [components.md](../domain-design/components.md): 承認済みの四つの構成要素と情報の所有。
- [decisions.md](../domain-design/decisions.md): 共通契約と判定の一括所有、呼出し方向、既存系との関係。
- [requirements.md](../requirements-analysis/requirements.md): 機能要件21 IDと品質要件3件。
- [units-generation-questions.md](units-generation-questions.md): 二単位の計画をApprove Planで承認し、生成内容をLooks correctで確認した記録。

対象は[Issue #38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38)の一規則である。作業単位は実装・試験を完了できる範囲を表し、承認済みの構成要素の責務を変更しない。

## Unit Catalogue

| Unit ID | Directory | Name | Kind | Deployment Model | Complexity | Components |
|---|---|---|---|---|---|---|
| U1 | u1-state-exposure-inspection | 状態公開の共通検査 | library | embedded | M | StateExposureInspection |
| U2 | u2-language-state-verification | 言語別抽出と検証実行 | library | embedded | L | RustStateEvidence、TypeScriptStateEvidence、StateExposureVerification |

IDとDirectoryを後続の契約・設計・試験で維持する。DirectoryはこのintentのConstruction記録で使う名前であり、アプリケーションソースをその下へ配置する指定ではない。ソースの所有先は後述の表で定める。

両単位は既存の`ddd/`開発パッケージに組み込む。U2にはRust試作の実行と開発用検証の入口があるが、独立してデプロイする製品サービスを作る単位ではない。`library`は内部実装の性質を表し、試験用コマンドの有無とは分けて扱う。

## U1: 状態公開の共通検査

### Responsibilities

- InspectionRequest、StateEvidence、InspectionResultの共通契約と、要求に対する応答の検証を実装する。
- 版・入力・設定・対象・根拠の対応を確認し、不正な応答を判定へ渡さない。
- 状態公開の正常・違反・検査不能を共通判定する。未解決が残る場合の全体結果と、確定違反の保持を実装する。
- 解析器を起動しない契約・判定試験と、共通契約の英日文書を用意する。

U1は言語別解析器、ファイル読取り、コマンド実行を呼ばない。共通契約の所有と、検査入力を実際に読み込む責務を混ぜない。情報の検証と規則判定には別々の関数・試験を設ける。

### Completion Evidence

- 正常、違反、検査不能、確定違反と検査不能の併存を、固定した共通情報で確認できる。
- 不完全な空リスト、未知版、不正形式、欠落結果、入力・設定・対象の不一致が正常にならない。
- 検証済みの根拠と、不確実な候補を区別できる。別の入力に属する根拠を判定へ混ぜない。
- 共通判定の試験がRustやCompiler APIを起動せず、既存のBun環境で実行できる。
- 対応する文書に、契約の意味、適用範囲、未解決時の扱いと試験方法が記載されている。

ここまでで証明するのは共通情報からの判定であり、RustやTypeScriptのソースから正しく根拠を抽出できることはU2で確認する。U1単独でIssue #38を完了したとは扱わない。

### Complexity and Constraints

相対規模はMとする。一規則に限定される一方、実行状態・情報の完全性・規則結果を混同しない設計と失敗経路の試験が必要である。データ形式の全情報種別への一般化や、新しい解析器の依存をU1へ追加しない。

## U2: 言語別抽出と検証実行

### Responsibilities

- RustStateEvidenceで既存syn試作を利用し、指定型の名前付き・タプル構造体から根拠を抽出する。必要な試作の変更とネイティブ応答の検証も担当する。
- TypeScriptStateEvidenceでProgramとTypeCheckerを使い、class・構造体＋同名コンパニオンの対応形状を抽出する。
- 抽出結果をU1の共通形式へ変換する。共通形式の版、意味、判定規則をU2で定義し直さない。
- StateExposureVerificationで固定入力と設定を確定し、指定言語の抽出とU1の判定を呼び、期待値との差を報告する。
- 検証ケース・実行記録、検証コマンド、自動検証への登録、開発依存、実行証跡、英日での実行案内を担当する。
- 両単位を対象とする型検査と既存Rustの回帰検証を行う。

### Completion Evidence

- Rustの名前付き・タプル、TypeScriptの二表現で、正常・違反・検査不能が承認済み要件と同じ意味になる。
- Rustの`pub`・`pub(crate)`を含む公開フィールドを検出し、非公開フィールドを誤検出しない。TypeScriptのブランドの印や操作メソッドだけを公開状態と誤認しない。
- 構文エラー、対応外形状、対象の欠落・曖昧さ、解析器の起動不能・失敗、不正応答を正常へ変換しない。
- 入力内容と解析設定を固定して、同じ要求の証跡をU1へ渡せる。共通検査にAST、Cargo構造体、Compiler APIの型が漏れていないことを型検査でも確認する。
- 実際の抽出から共通判定までを文書のコマンドで再実行でき、期待値不一致や実際の必要ツール不足が検証成功にならない。
- 異常を意図的に与える試験では、期待した違反・検査不能と実際の結果を照合する。想定どおりの非正常結果と、試験実行そのものの失敗を区別する。
- 既存Rustの基準試験を維持する。syn試作の変更が既存の比較検証に及ぶ場合は、その検証も実行して期待値を弱めない。
- 対応形状、必要ツール、採用API版、コマンド、実行環境と結果を英日文書・証跡へ記録する。両言語で最終結果と根拠の対応を確認する。

### Complexity and Constraints

相対規模はLとする。二言語の抽出、共通形式への変換、コマンドからの結合検証が含まれるためである。厳密な対応形状は契約設計・機能設計で固定し、一般の型解決、マクロ展開、可変参照や副作用の網羅的な証明まで広げない。

本番Rustセンサーの入口と出力契約を維持する。現行のInspectionContextを新経路へ渡さず、新経路の未解決を旧センサーの合格で埋め合わせない。

## Source and Artifact Ownership

以下は各単位が変更を所有する範囲である。`新規`のパスは配置先として確保したもので、現時点で実装済みという意味ではない。ディレクトリを所有する行でも、目的に必要なファイルだけを追加・変更する。

| Owner | 対象パス | 区分・責務 |
|---|---|---|
| U1 | `ddd/tools/ddd/lib/state-exposure/` | 新規。共通契約・受信検証・規則判定。解析器固有の実装は置かない |
| U1 | `ddd/tests/state-exposure-contract.test.ts`、`ddd/tests/state-exposure-inspection.test.ts` | 新規。共通契約と判定の単独試験 |
| U1 | `ddd/tests/fixtures/state-exposure-inspection/` | 必要な場合に追加する共通情報の試験入力 |
| U1 | `ddd/docs/developers/state-exposure-inspection.md`、`state-exposure-inspection.ja.md` | 新規。共通検査の仕様と単独検証の案内 |
| U2 | `ddd/tools/ddd/lib/rust/state-evidence/` | 新規。Rust試作との接続、ネイティブ応答の検証、共通形式への変換 |
| U2 | `ddd/tools/ddd/lib/typescript/state-evidence/` | 新規。Compiler APIによる根拠抽出と共通形式への変換 |
| U2 | `ddd/tools/ddd/lib/state-exposure-verification/` | 新規。固定入力、抽出と判定の呼出し、期待値比較、実行記録 |
| U2 | `ddd/experiments/rust-syn/`、`ddd/scripts/verify-rust-syn.ts` | 既存。指定型の根拠取得に必要な試作と比較検証の変更 |
| U2 | `ddd/scripts/verify-state-exposure.ts` | 新規。開発用検証コマンドの入口 |
| U2 | `ddd/tests/state-exposure-rust.test.ts`、`ddd/tests/state-exposure-typescript.test.ts`、`ddd/tests/state-exposure-verification.test.ts` | 新規。言語別抽出とコマンドの検証 |
| U2 | `ddd/tests/fixtures/state-exposure-languages/` | 新規。両言語の固定ソースと対応ケース |
| U2 | `ddd/package.json`、`ddd/bun.lock`、`ddd/tsconfig.json` | 既存。Compiler API・型検査の依存と設定、検証コマンドの登録 |
| U2 | `ddd/docs/developers/state-exposure-verification.md`、`state-exposure-verification.ja.md`、`ddd/docs/developers/evidence/state-exposure-check.json` | 新規。対応形状・実行案内と検証済み環境・結果 |
| U2 | `ddd/docs/developers/README.md`、`README.ja.md`、`ddd/tests/README.md`、`README.ja.md` | 既存。両単位の文書と検証コマンドへの案内 |

省略した日本語版ファイル名は、同じ行の英語版と同じディレクトリに置く。共通設定と案内の変更窓口はU2に限定する。U1は既存のBun環境で契約・判定試験を実行できる形で完了し、Compiler API導入後の型検査はU2が両単位へ実行する。U1がU2の解析器や追加ツールを呼ぶ依存は作らない。

既存の`u2-rust-analysis-foundation.test.ts`、`u5-rust-code-sensors.test.ts`、`u5-golden.test.ts`は回帰の対照として読む・実行する。期待値の変更を作業の前提にしない。本番センサーと既存Rust解析器、第三者の`.codex/tools/`・`.claude/tools/`、無関係な既存編集は本計画の変更範囲に含めない。

所有範囲をまたぐ修正が必要になった場合は、その単位の計画と契約への影響を明示する。相手の実装や共通契約を無断で書き換えない。新しい解析対象や利用者成果物が必要になれば、Issue #38の完了条件へ追加せず親課題へ分離する。

## Integration and Quality Responsibilities

U2がU1へ渡す要求・証跡・実行状態と、U1が返す判定結果を次のContract Designで固定する。契約はU1、実際のソースと解析器の対応付けはU2が所有する。詳しい接続点は[依存関係](unit-of-work-dependency.md)を参照する。

| 品質要件 | U1の担当 | U2の担当 | 最終確認 |
|---|---|---|---|
| NFR1 | 結果・所見・未解決理由の決定的な構成と順序 | 入力・設定・ツール版を固定した繰返し実行 | 実行固有のID等と判定内容を分けて比較する |
| NFR2 | 本番経路から独立した追加と既存試験への影響確認 | 既存Rust基準試験と影響するsyn比較検証 | 新しい失敗を隠すために期待値を弱めない |
| NFR3 | 解析器を呼ばない契約・判定の試験境界 | 両言語の変換と、両単位の型検査 | AST・Cargo・Compiler APIの型が共通境界に漏れない |

## Scope and Completion Boundary

各単位には自分の実装を確かめる試験と英日文書を含める。実行用knowledge・sensors・stages・contributionsを変更する要件は今回の単位へ追加していない。`aidlc/`の記録は日本語とする。

この計画は依存関係と担当範囲を定める。出荷優先順位、日程、クリティカルパスは選定しない。両単位の実装・試験が揃い、両言語を通す検証が成功した時点でIssue #38の完了条件を評価する。

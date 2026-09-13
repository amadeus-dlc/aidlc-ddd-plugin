# 状態公開の言語別抽出と検証

[English](state-exposure-verification.md) | [共通契約](state-exposure-inspection.ja.md)

`bun run verify:state-exposure` は、固定ソースの指定型を Rust の syn と TypeScript Compiler API で調べ、U1 の `state-exposure/1` へ根拠を渡します。検査対象のソースは実行しません。本番センサーの入口・出力は維持しています。

## 準備と実行

作業ディレクトリは `ddd/` です。Bun 1.3.13、Cargo/rustc 1.95.0、TypeScript **6.0.3**、`@types/bun` **1.3.13**、syn **3.0.5**、sha2 **0.10.9**、Biome **2.5.12** で確認しました。TypeScript の `Program`・`TypeChecker` を利用するため、6.0.3 を完全固定しています。

初回の依存取得は明示的に実行します。

```sh
bun install --frozen-lockfile
cargo fetch --locked --manifest-path experiments/rust-syn/Cargo.toml
```

続いて準備済みの依存だけからビルドし、固定位置へ配置します。

```sh
bun run prepare:state-exposure
bun run verify:state-exposure --case all
```

準備は `rustc -vV` の host を `cargo build --target` に渡し、`--locked --offline --release` で生成します。配置先は `experiments/rust-syn/target/state-exposure/ddd-rust-syn-spike` です。ビルド準備の子コマンド上限は120秒で、途中失敗ではコピーしません。同一内容なら再コピーせず、固定位置の版プローブで起動確認します（最大180秒）。初回ビルドや OS の新規実行ファイル確認に時間がかかって失敗した場合は、診断を確認して準備を再実行してください。ソース・ロック変更後も明示的に再準備します。C2 の検証中は取得・ビルド・コピー・自動再試行を行いません。

```sh
bun run test:state-exposure
bun run test:state-exposure:native
bun run typecheck:state-exposure
bun run experiment:rust-syn
bun run check
```

`check` は既存の形式検査、plugin validate、開発scope確認を維持し、明示的なオフライン準備、通常の全試験、Rust内部試験、版1比較、新C2、限定型検査を別ステップとして実行します。U1の単独試験は Rust・Compiler API の起動を必要としません。全試験には今回の実抽出試験が含まれるため、固定バイナリが必要です。

## 対応形状

| 表現 | 確認する根拠 | 未解決にする例 |
|---|---|---|
| Rust 名前付き・タプル構造体 | 直接宣言とinline module経路、非公開・pub・pub(crate)等、フィールドのUTF-8位置 | 対象欠落・型名前空間の重複、外部module、未展開macro、doc以外の属性、構文不正 |
| TypeScript class | 初期値または直接のconstructor代入で実体を確認した宣言フィールド、`#`の非公開、操作メソッド | 継承、decorator、accessor、計算名、declare/abstract、追えないconstructor処理 |
| TypeScript 型＋同名コンパニオン | 同一ファイルの型/valueシンボル、非exportのunique symbolブランド、局所constインスタンス、直接returnとok:true/value | ブランドの別名export・取り違え、spread、未対応計算名、型アサーション、追えない別名・再代入・return、異なる複数インスタンス |

TypeScript の `private`・`protected`・`readonly` は実行時の非公開を証明しないため、通常のデータプロパティは公開として扱います。 constructor内の入れ子関数が`this`を含む場合、即時arrowや同期callbackを含め、呼出し経路を証明せず一覧を`partial`、理由を`unsupported-syntax`とします。未解決の構築経路があっても、別に確認した公開フィールドの所見は保持します。通常のインスタンス操作メソッドのreturnはこの構築経路へ混ぜません。確認した操作メソッドとブランドは `absent` の根拠を持ちます。ブランド生成は、TypeCheckerで固定標準ライブラリのシンボルと確認した`Symbol()`または文字列リテラル一個の`Symbol("説明")`だけを受け付けます。初期値内のas/type assertion/satisfies、Symbol.for、shadow/alias、別変数・関数経由は未解決です。コンパニオンの生成メソッドは一つ、戻り型は対象または対象を成功値に持つ局所Result形状を確認します。内側の操作メソッドのreturnは生成関数のreturnへ混ぜません。

CompilerHost は渡したソースと固定した TypeScript パッケージ内の `lib.*.d.ts` だけを読みます。プロジェクト探索、ambient `@types`、外部import・再公開の解決は追加しません。初版の有効設定は空オブジェクトで、未対応設定を渡すと未解決になります。要求には全設定と実抽出器・解析ライブラリの版を含めます。

Rust 内部版2は版1とは別に、要求識別、指定対象、原文SHA-256、確定性、完全性、バイト位置を返します。変換側は外枠と原文への対応・UTF-8境界を検証します。synが除去するBOM/shebangの位置差を補正し、CRLF・LF・CR・U+2028・U+2029の共通行規約へ変換します。全体を確認できない構文は確定違反にせず、個別フィールドだけが未解決なら独立した公開違反を保持します。

## CLI の結果

引数は `--case all|caseId`（既定all）、`--timeout-ms`（既定30000）、`--max-output-bytes`（既定1048576）です。上限は正の安全な整数を受け付け、32bitを超える期限は単調時計で分割予約します。未知・重複引数、未知ID、空ケース集合、不正期待値は実行前に拒否します。

標準出力は `state-exposure-verification/1` のJSON一個と改行だけです。標準エラーは診断用です。`runId`、コマンド、実際に使えたツール版、環境、caseId順の期待値・実測値・差分を保持します。

| 終了コード | status | 意味 |
|---|---|---|
| 0 | passed | 選択した全ケースが完全一致し、必要経路を実行済み |
| 1 | mismatch | 実行した結果・理由・対象・根拠等が期待と不一致 |
| 2 | usage-error | 引数・ID・固定ケース定義が不正 |
| 3 | execution-error | 実ツール不足、実行期限超過、想定外例外等で検証未完了 |

プロセスは終了を観測してから採用し、期限・stdout超過・stderr資源超過ではkill後のcloseを待ちます。起動不能は `unavailable`、起動後の異常は `failed` です。正常終了の空・空白出力は `completed/response:null`、非空の不正・複数応答は `completed/response:"invalid-native-response"` でU1へ渡し、`invalid-response` の `unresolved` になります。正常終了だけをpassにはしません。

同梱の23ケースは [`cases.json`](../../tests/fixtures/state-exposure-languages/cases.json) で確認できます。実ソース14件は Rust 名前付き・タプル、TypeScript class・コンパニオンの正常・違反・未解決に加え混在・対象欠落を含みます。実行異常9件は制御fixtureで空・空白・不正・複数応答、異常終了、期限、stdout超過、stderr超過、意図的起動不能を観測します。fixtureの開始標識も確認し、準備不備による別の異常終了を成功にしません。期待値は手書き仕様から独立作成し、入力識別だけをC1の準備処理で埋めます。実際の判定結果を期待値へコピーしません。

## 検証範囲と証跡

[実行証跡](evidence/state-exposure-check.json)に、採用版、実行環境、コマンド、単独・実抽出・C2・既存回帰の成否を保存しています。正常時も対象・完全性・非公開/不在の根拠を比較し、根拠だけの変更でexit1になることを確認します。

既存版1比較はhost指定・locked/offlineビルドを使い、一時コピーの初回起動確認（最大180秒）と、従来の各版1試験（10秒）を分けます。OSの初回ローダー待ちは性能保証に含めず、測定値を版1比較報告へ残します。

確認済み環境はmacOS arm64のみです。一般の型解決、Cargoの意味解析、macro展開、cfg選択、操作の副作用、可変参照漏出、外部Result、別OS、本番センサー切替や配布は保証しません。

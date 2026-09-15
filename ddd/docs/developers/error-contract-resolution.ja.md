# 業務エラー契約の解決

[English](error-contract-resolution.md) | [検査契約の設計](inspection-contract-design.ja.md)

`error-contract/1` は、準備済みのCargo workspaceから、指定した一つの操作の戻り値型とエラー型を解決し、操作・結果契約・エラーケース集合・解決経路・各事実の完全性を報告する契約です。公開入口は [`tools/ddd/lib/error-contract/index.ts`](../../tools/ddd/lib/error-contract/index.ts) です。

本契約が出力するのは解決情報だけです。合否の判定は出しません。観測したケース集合と正規エラーとの集合比較は後続の契約が担います。本番センサーや承認ゲートへは接続していません。

`prepareErrorContractRequest(input: unknown)` は、要求を持つ `prepared` または理由を一件持つ `input-rejected` を返します。`resolveErrorContract(request: unknown, execution: unknown)` は、結果を持つ `evaluated` または `input-rejected` を返します。正確なフィールドとタグは [`contract.ts`](../../tools/ddd/lib/error-contract/contract.ts) に定義しています。

## コマンド

```sh
bun run prepare:error-contract   # ネイティブ抽出器（protocol version 3）の構築と設置
bun run verify:error-contract    # 固定シナリオの検証と証跡の出力
bun run check                    # 上記2件を含む全体検査
```

`bun run verify:error-contract --write` は [`evidence/error-contract.json`](evidence/error-contract.json) を更新します。`cargo` と `rustc` が必要です。固定シナリオ `tests/fixtures/error-contract/workspace` は自身の `Cargo.lock` を同梱しています。

## 解析スナップショット

検査は一つのビルド条件に結び付きます。呼出し元は [`resolveCargoCondition`](../../tools/ddd/lib/rust/error-contract/cargo-condition.ts) を使い、Cargo境界で条件を確定させます。この関数は `cargo metadata --format-version 1 --frozen` を、一つの `--filter-platform` と一つのfeature選択で実行します。`--frozen` はロックファイルの書き込みと取得を禁じるため、検査が依存を準備することはありません。ロックファイルが整っていないworkspaceは、ロックファイルを得るのではなく `unavailable` として報告されます。

記録する条件は、ターゲットトリプルと、workspace所有パッケージごとの不透明なCargo package ID、検査対象となる `lib` ターゲット（プロジェクト相対のソースパス）、edition、選択feature、依存名変更です。検査対象は `lib` ターゲットだけです。解決はパッケージのライブラリcrateルートから入るためで、`lib` ターゲットを持たないworkspaceメンバーはcrateルートを提供しないため、検査が入れないパッケージとして記録するのではなく、条件から外します。パッケージ名は識別ではありません。名前を共有する2パッケージは別々のレコードのまま保たれ、その名前に到達した参照は統合されず `multiple-package-versions` として報告されます。依存名変更は、マニフェストの綴りではなくextern名で記録します。Rustのパスが持てる名前にするため、Cargoがハイフンをアンダースコアへ置き換えるからです。別名 `billing-alias` は `billing_alias` として記録され、これがソースに書かれた参照の名前と一致します。

要求識別は、識別自身を除く既知の全フィールドを正規化JSON化した `sha256:` です。Cargo条件・ソーススナップショット・プロジェクト設定・ツール版のすべてが参加します。選択feature、ターゲットトリプル、edition、package ID、Cargoターゲット、依存名変更のいずれを変えても識別は変わり、前の条件で作られた応答は再利用されず `identity-mismatch` として拒否されます。

## 解決が対応する範囲

解決はネイティブ抽出器の中で動きます。抽出器は `syn` で構文解析するだけで、ソースをコンパイルも実行もしません。パッケージの `lib` ターゲットが指すcrateルートからモジュール木を辿り、子モジュールについては両方のプロジェクト配置を受理しつつ、宣言するファイルが正確に1件であることを求めます。宣言するファイルが1件も無い場合は `missing-referent`、両方の配置綴りが宣言する場合は `ambiguous-candidate` です。

| 書式 | 記録する解決経路 |
|---|---|
| 宣言された名前をそのまま書いた参照 | `direct` |
| `crate`・`self`・`super` を含む複数区切りのパス | `qualified` |
| 名前を変える非公開の `use` | `use-rename` |
| `pub use` による再公開 | `re-export` |
| 型引数付きで展開される透明な型別名 | `type-alias` |
| 依存名変更の別名を経た依存パッケージ | `dependency-rename` |
| impl の所有者を経て解決される具体的な `Self` | `self-type` |

型引数は構造に沿って置換します。型別名は引数の個数が仮引数の個数と一致するときだけ展開し、標準Resultは引数が正確に2個のときだけ認識します。型引数を削って一致させることはありません。引数数の不一致、引数の欠落、未確定のまま残る型引数は、いずれも `unsupported-type-argument` として報告します。

型別名の連鎖は標準Resultの識別まで辿ります。アプリケーションが定義した同名の `Result` はその識別ではありません。結果契約は `standardResult: false` として解決し、ローカルの宣言を指し示します。エラーケース集合は `shadowed-result-identity` で止まります。

エラーケース集合は解決したエラーenumから読み取ります。`#[non_exhaustive]` のenumと、選択feature外の条件に依存するヴァリアントは、いずれも既知のケースと理由を保持した `partial` の集合になります。不完全な一覧を空の閉じた集合として報告することはありません。

## 未解決として区別するもの

限界に当たった場合ごとに、機械可読な固有の理由を出します。後続の契約はこれらを取り違えません。

| 理由 | 発生条件 |
|---|---|
| `shadowed-result-identity` | 戻り値がアプリ定義の `Result` を指している |
| `alias-cycle` | 型別名または名前束縛の連鎖が自分自身へ戻る |
| `ambiguous-candidate` | 有効な宣言・glob import・モジュールファイルが同じ名前を複数提供する |
| `missing-referent` | 参照先の宣言・モジュールファイル・crateがスナップショットにない |
| `incomplete-case-set` | エラーenumが `#[non_exhaustive]` である |
| `unsupported-type-argument` | 型引数を構造に沿って置換できない |
| `multiple-package-versions` | 条件が同名のパッケージを複数記録している |
| `trait-selection-required` | エラー型が型引数に対する実装選択に依存する |
| `associated-type-required` | エラー型が関連型の射影である |
| `expression-inference-required` | 戻り値の型を本体だけが確定させる |
| `unknown-cfg` | 宣言またはヴァリアントに付いた `cfg` 述語を、選択featureでは確定できない |
| `macro-generated` | 囲むモジュールのitemマクロ、または宣言に付いた `derive` が、まだ名前を宣言しうる |
| `unsupported-syntax` | 本契約が解決しない書式である。契約が解釈しない属性もここに含む |

この語彙は `state-exposure/1` の理由コードを再定義せずに拡張したものです。プロセス境界は `tool-unavailable`・`execution-failed`・`timeout`・`output-limit`・`resource-limit` を従来の意味のまま報告し続けます。

## 構文解析の成功はコンパイラの受理ではない

抽出器が報告するのは `syn` が構文解析できたかどうかだけで、コンパイラが受理したかどうかは報告しません。`bun run verify:error-contract` は両者を別々に測ります。各ケースを抽出器で解決し、同じソースを `rustc --emit metadata` でコンパイルし、`syntax_parsed` と `compiler_accepted` を独立した2値として、検証した `rustc`・`cargo`・`bun`・`syn` の版とともに記録します。記録されたケースのうち5件は、構文解析に成功しつつコンパイラに拒否され、診断は `E0107`・`E0391`・`E0432`・`E0659` です。

## 追加の意味解析を要する通常の想定コード（T-10への引継ぎ）

以下は作為的な入力ではなく、通常の使い方で現れる形です。本契約ではこれ以上解決できません。本番Rust実行ファイルの作業への引継ぎ事項です。いずれも `tests/fixtures/error-contract/workspace/billing-domain/src/limits.rs` に実在します。

trait実装の選択 — 呼出し側が渡す型引数に束縛された実装がエラー型を決める:

```rust
pub fn issue<T: Failing>(&mut self, inner: &mut T) -> core::result::Result<(), T::Error> {
    inner.issue()
}
```

関連型の射影 — 操作をtrait経由で宣言し、エラー型を実装側の型から指す:

```rust
impl Failing for Invoice {
    type Error = crate::errors::IssueInvoiceError;

    fn issue(&mut self) -> core::result::Result<(), Self::Error> {
        Ok(())
    }
}
```

式全般の推論 — 戻り値の型を本体だけが確定させる:

```rust
pub fn issue(&mut self) -> impl core::fmt::Debug {
    0u8
}
```

これらを解決するには、同じスナップショットに対して検証済みの意味解析提供者が必要です。提供者の追加は互換性と配布の独立した判断であり、`syn` の採用に含まれるものではありません。

## 本契約の対象外

全Cargo設定・全Rust構文の保証、任意の型・ライフタイム・const引数の解決、trait solving、マクロ展開、`rustc-private`・rust-analyzer統合、正規エラーとの集合比較、本番センサーの移行、ネイティブ実行ファイルの配布。

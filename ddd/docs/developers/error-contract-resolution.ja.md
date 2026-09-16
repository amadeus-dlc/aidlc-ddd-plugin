# 業務エラー契約の解決

[English](error-contract-resolution.md) | [検査契約の設計](inspection-contract-design.ja.md)

`error-contract/1` は、準備済みのCargo workspaceまたはTypeScriptプロジェクトから、指定した一つの操作の戻り値型とエラー型を解決し、操作・結果契約・エラーケース集合・解決経路・各事実の完全性を報告する契約です。公開入口は [`tools/ddd/lib/error-contract/index.ts`](../../tools/ddd/lib/error-contract/index.ts) です。

検査は自分の言語を名乗り、その名前がどの解析条件を持つかを決めます。Rust要求はCargo条件を、TypeScript要求はプロジェクト条件を持ちます。どちらも相手側の条件を持つことはありません。

本契約が出力するのは解決情報だけです。合否の判定は出しません。観測したケース集合と正規エラーとの集合比較は後続の契約が担います。本番センサーや承認ゲートへは接続していません。

`prepareErrorContractRequest(input: unknown)` は、要求を持つ `prepared` または理由を一件持つ `input-rejected` を返します。`resolveErrorContract(request: unknown, execution: unknown)` は、結果を持つ `evaluated` または `input-rejected` を返します。正確なフィールドとタグは [`contract.ts`](../../tools/ddd/lib/error-contract/contract.ts) に定義しています。

## コマンド

```sh
bun run prepare:error-contract              # ネイティブ抽出器（protocol version 3）の構築と設置
bun run verify:error-contract               # 固定Rustシナリオの検証と証跡の出力
bun run verify:error-contract:typescript    # 固定TypeScriptシナリオの検証と証跡の出力
bun run check                               # 上記すべてを含む全体検査
```

`bun run verify:error-contract --write` は [`evidence/error-contract.json`](evidence/error-contract.json) を更新します。`cargo` と `rustc` が必要です。固定シナリオ `tests/fixtures/error-contract/workspace` は自身の `Cargo.lock` を同梱しています。

`bun run verify:error-contract:typescript --write` は [`evidence/error-contract-typescript.json`](evidence/error-contract-typescript.json) を更新します。Rustツールチェーンもネイティブ実行ファイルも不要です。固定シナリオ `tests/fixtures/error-contract/typescript-workspace` は、導入済みのCompiler APIだけで解決と型検査を行います。

## Cargo解析スナップショット

検査は一つのビルド条件に結び付きます。呼出し元は [`resolveCargoCondition`](../../tools/ddd/lib/rust/error-contract/cargo-condition.ts) を使い、Cargo境界で条件を確定させます。この関数は `cargo metadata --format-version 1 --frozen` を、一つの `--filter-platform` と一つのfeature選択で実行します。`--frozen` はロックファイルの書き込みと取得を禁じるため、検査が依存を準備することはありません。ロックファイルが整っていないworkspaceは、ロックファイルを得るのではなく `unavailable` として報告されます。

記録する条件は、ターゲットトリプルと、workspace所有パッケージごとの不透明なCargo package ID、検査対象となる `lib` ターゲット（プロジェクト相対のソースパス）、edition、選択feature、依存名変更です。検査対象は `lib` ターゲットだけです。解決はパッケージのライブラリcrateルートから入るためで、`lib` ターゲットを持たないworkspaceメンバーはcrateルートを提供しないため、検査が入れないパッケージとして記録するのではなく、条件から外します。パッケージ名は識別ではありません。名前を共有する2パッケージは別々のレコードのまま保たれ、その名前に到達した参照は統合されず `multiple-package-versions` として報告されます。依存名変更は、マニフェストの綴りではなくextern名で記録します。Rustのパスが持てる名前にするため、Cargoがハイフンをアンダースコアへ置き換えるからです。別名 `billing-alias` は `billing_alias` として記録され、これがソースに書かれた参照の名前と一致します。

## TypeScript解析スナップショット

TypeScriptの検査は一つのプロジェクト条件に結び付きます。呼出し元は [`resolveTypeScriptCondition`](../../tools/ddd/lib/typescript/error-contract/project-condition.ts) を使い、プロジェクト境界で条件を確定させます。この関数はプロジェクト自身の `tsconfig.json` と、参照する各パッケージの `package.json` を読みます。境界は読み取りだけを行い、ファイルの書き込みもディレクトリの作成も行いません。検査が対象プロジェクトを準備することはありません。

記録する条件は、対応Compiler API版、module種別、モジュール解決、言語ターゲット、解決条件、およびプロジェクトが厳格に型検査されることの要求です。workspace所有パッケージごとに、不透明なpackage ID、宣言された名前とversion、パッケージルート、ビルド単位である `tsconfig.json`、`exports` が公開する入口（プロジェクト相対の対象）、プロジェクト参照が持つパッケージ、マニフェストが依存するパッケージを記録します。この条件が扱わない設定は、既定値へ丸めずに拒否します。非対応のmodule種別・モジュール解決・言語ターゲット、厳格に型検査しないプロジェクト、そのプロジェクトのパッケージを指さない依存やプロジェクト参照は、いずれも `unavailable` になります。条件が記録するパスは、空セグメントもドットセグメントも持たないプロジェクト相対のパスに限ります。これは要求が受け付けるパスと同じ規則です。プロジェクトの外にある参照パッケージや、自分のパッケージから出る `exports` の対象は、要求側が後で拒否する条件を記録するのではなく、その場で `unavailable` になります。

条件は、そのプロジェクトが言語拡張用Resultとして設定した宣言も持ちます。TypeScriptには標準のResultがないため、名前の綴りではなくその宣言との同一性が、操作が標準Resultを返すかどうかを決めます。

パッケージ名がここでも識別ではありません。名前を共有する2パッケージは別々のレコードのまま保たれます。その名前に到達した参照は、versionも同じなら `multiple-package-versions`、versionが異なるなら `unsupported-version-resolution` として報告し、一つの候補へ統合することはありません。

## 要求識別

要求識別は、識別自身を除く既知の全フィールドを正規化JSON化した `sha256:` です。解析条件・ソーススナップショット・プロジェクト設定・ツール版のすべてが参加します。

Rustでは、選択feature、ターゲットトリプル、edition、package ID、Cargoターゲット、依存名変更のいずれを変えても識別は変わります。TypeScriptでは、Compiler API版、解決条件、設定されたResult宣言、および記録された各パッケージの項目（名前、version、ルート、ビルド単位、入口、プロジェクト参照、依存）のいずれを変えても同様です。いずれの場合も、前の条件で作られた応答は再利用されず `identity-mismatch` として拒否され、結果は改めて導出されます。

## Rustの解決が対応する範囲

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

## TypeScriptの解決が対応する範囲

解決はこのプロセス内でCompiler APIを使って動きます。版は条件が記録したものに固定します。Programは凍結したスナップショットと記録した条件だけから構築します。プロジェクト探索も、ambientな型パッケージも、出力も行いません。スナップショット以外に読むのは、コンパイラ自身の標準ライブラリだけです。Programは一つの要求に属し、呼び出しをまたいで保持しません。条件が変わったときに、前の条件のコンパイラで答えることはありません。

参照指定子がどのファイルを指すかは、検査時にパッケージマニフェストを読み直すのではなく、記録した入口から答えます。bare指定子は公開された subpath でパッケージへ到達し、相対指定子はスナップショット内のファイルへ到達します。スコープ付きの名前は2セグメントで一つの名前です。`@scope/package/subpath` はパッケージ `@scope/package` と subpath `./subpath` を指し、スコープだけの指定子はどのパッケージも指しません。ファイル自体が見つかっても、参照元のプロジェクト参照がそのパッケージを持たない場合は `invalid-project-reference` として拒否します。参照が解決できることと、その参照が許されることは別の問いです。

解決経路は、操作の宣言された戻り値型から業務エラーの宣言へ到達した経路を記録します。`void` を返す操作は結果契約を持たないため、結果契約とケース集合はどちらも `absent` です。戻り値型が、直接または透明な型別名を経て、設定されたResult宣言ではなくその綴りも持たない宣言を名指す場合は、`standardResult: false` として記録し、ケース集合は `absent` とし、解決経路にはその宣言へ到達した経路を記録します。

| 書式 | 記録する解決経路 |
|---|---|
| 宣言された名前をそのまま書いた参照 | `direct` |
| 名前を変えるimport | `import-alias` |
| 依存として保持される型のみのimport | `import-type` |
| `export ... from` による再公開 | `re-export` |
| 型引数付きで展開される透明な型別名 | `type-alias` |
| `exports` が公開する入口を経たパッケージ | `package-entry` |
| 内部へのパスを経たパッケージ | `internal-path` |
| 構造体＋コンパニオンを経て到達した操作 | `companion` |

公開入口経由と他パッケージの内部パス経由は、同じ宣言へ到達しても区別したまま保ちます。同一パッケージ内の相対パスはそのどちらでもありません。参照が型のみかどうかも固有の経路として記録するため、型のみの依存は依存のまま保たれ、値のimportが型のみとして報告されることはありません。

契約を確立するのは型注釈だけです。行コメント、ブロックコメント、ドキュメンテーションコメント、両方の引用符形式の文字列、両方のテンプレートリテラル形式に同じ表記があっても、それらは型位置ではなく、何も確立しません。戻り値型を書いていない操作は `expression-inference-required`、本体のアサーションだけが形を述べている場合は `unchecked-assertion` として報告します。同じ表記が型位置にある場合、それは文字列リテラル型であり、型参照ではなくケース名です。

閉じたエラー型として扱うのは、単一の文字列リテラル型と、構成要素がすべて文字列リテラル型であるunionです。広い構成要素やケースを持たない構成要素が加わったunionは閉じられないため、空の閉じた集合としてではなく `open-error-type` として報告します。

## 未解決として区別するもの

限界に当たった場合ごとに、機械可読な固有の理由を出します。後続の契約はこれらを取り違えません。

| 理由 | 発行する言語 | 発生条件 |
|---|---|---|
| `shadowed-result-identity` | Rust, TypeScript | 戻り値が、その綴りでありながら標準Resultではない宣言を指している |
| `alias-cycle` | Rust, TypeScript | 型別名または名前束縛の連鎖が自分自身へ戻る |
| `ambiguous-candidate` | Rust | 有効な宣言・glob import・モジュールファイルが同じ名前を複数提供する |
| `missing-referent` | Rust, TypeScript | 参照先の宣言・モジュールファイル・crate・入口がスナップショットにない |
| `incomplete-case-set` | Rust | エラーenumが `#[non_exhaustive]` である |
| `unsupported-type-argument` | Rust, TypeScript | 型引数を構造に沿って置換できない |
| `multiple-package-versions` | Rust, TypeScript | 条件が同名のパッケージを複数記録している |
| `trait-selection-required` | Rust | エラー型が型引数に対する実装選択に依存する |
| `associated-type-required` | Rust | エラー型が関連型の射影である |
| `expression-inference-required` | Rust, TypeScript | 戻り値の型を本体だけが確定させる |
| `unknown-cfg` | Rust | 宣言またはヴァリアントに付いた `cfg` 述語を、選択featureでは確定できない |
| `macro-generated` | Rust | 囲むモジュールのitemマクロ、または宣言に付いた `derive` が、まだ名前を宣言しうる |
| `escape-type` | TypeScript | 成功型またはエラー型が `any` か `unknown` である |
| `open-error-type` | TypeScript | エラー型が閉じたケース集合を述べていない |
| `unchecked-assertion` | TypeScript | 本体のアサーションだけが戻り値の形を述べている |
| `invalid-project-reference` | TypeScript | 参照が到達したパッケージを、参照元のプロジェクト参照が持っていない |
| `unsupported-version-resolution` | TypeScript | 条件が、参照された名前のパッケージを異なるversionで複数記録している |
| `unsupported-syntax` | Rust, TypeScript | 本契約が解決しない書式である。契約が解釈しない属性もここに含む |

この語彙は `state-exposure/1` の理由コードを再定義せずに拡張したものです。プロセス境界は `tool-unavailable`・`execution-failed`・`timeout`・`output-limit`・`resource-limit` を従来の意味のまま報告し続けます。

## 構文解析の成功はコンパイラの受理ではない

抽出器が報告するのは `syn` が構文解析できたかどうかだけで、コンパイラが受理したかどうかは報告しません。`bun run verify:error-contract` は両者を別々に測ります。各ケースを抽出器で解決し、同じソースを `rustc --emit metadata` でコンパイルし、`syntax_parsed` と `compiler_accepted` を独立した2値として、検証した `rustc`・`cargo`・`bun`・`syn` の版とともに記録します。記録されたケースのうち5件は、構文解析に成功しつつコンパイラに拒否され、診断は `E0107`・`E0391`・`E0432`・`E0659` です。

## 解決の成功はコンパイラの受理ではない

TypeScriptでも同じ分離が成り立ちます。抽出器と型検査器が同じCompiler APIであるため、`bun run verify:error-contract:typescript` はProgramを2つ構築して両者を分けます。検査側のProgramは記録した入口から参照指定子に答えます。受理側のProgramはプロジェクト自身の `tsconfig.json` から構築し、パッケージマネージャが導入するworkspaceリンクの代わりに、記録した条件ではなくプロジェクト自身の `package.json` を使います。各ケースは `resolution_reasons` の隣に `compiler_accepted` を記録します。拒否されたケースのうち2件を除くすべてはコンパイルが通ります。コンパイラが拒否するのは、自分自身を参照する別名連鎖を持つモジュールと、importがプロジェクトのどのモジュールも指さないモジュールだけです。

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

TypeScript側: 全TypeScript規則の保証、任意のmonorepo構成、条件付き入口とパターン入口、透明な型別名と閉じたリテラルunionを超える型機能、`neverthrow`・Effect・fp-ts統合、Next.js・Workers・Edge統合、任意の参照漏出・業務不変条件の証明、公開境界違反の全ルール化。

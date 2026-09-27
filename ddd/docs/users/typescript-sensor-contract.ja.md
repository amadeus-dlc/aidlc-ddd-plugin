# TypeScript ドメインセンサーの契約

[English](typescript-sensor-contract.md) | 日本語

更新: 2026-09-27、T-11-02。`ddd-typescript-domain` は、TypeScript のドメイン層に対するコード生成ゲートである。Rust のドメインゲート（`ddd-rust-domain`）と同じ規則 ID を同じ意味で報告し、[TypeScript の事実](../developers/typescript-fact-extraction.ja.md)から判定する。事実で決められない箇所では、検査不能として停止する。ユースケース層・インターフェースアダプタ層の規則（T-11-03）とモジュール配置の検査（T-11-04）は含まない。

## 起動する条件と読むもの

`code-generation` のゲートで、Rust のゲートと並んで `code-summary.md` に対して起動する。入口は `source-manifest.json` で申告した `.ts` / `.tsx` ファイル（`.d.ts` を除く）である。

| 申告 | 応答 |
|---|---|
| TypeScript のファイルが無い | 合格。note は `no typescript sources claimed`。compiler は使わない |
| TypeScript のファイルはあるが、ドメインのソースが無い | 所有者の無い申告、申告したパッケージの層診断、実行済みのドメインモデルの読み込み失敗が無ければ合格。compiler は使わない |
| ドメインのソースが1件以上ある | 同梱した compiler を起動し、すべての規則を実行する |

申告したファイルは、その上にある最も近い `package.json` のパッケージに属する。層は、スコープを除いたパッケージ名と配置から、Rust の crate と同じ規約で決める。規約は、`-domain` / `-use-case` / `-interface-adapter` / `-infrastructure` の接尾辞、`packages/<layer>/` または `modules/<layer>/`、`command` / `query` / `rmu` の区分、composition root の目印である。ドメインのソースとは、ドメインパッケージの `src/` 配下にある、試験ではない `.ts` / `.tsx` ファイルである。`*.test.ts`、`*.spec.ts`、`__tests__/` は補助ファイルとして扱う。

申告したファイルのほかに、各パッケージの `package.json`、ルートの `tsconfig.json` が参照する各パッケージの `tsconfig.json`（`paths` と `baseUrl` のため）、正規モデル、状態ファイル、集約写像、すべてのドメインパッケージの `src/` 配下にある全ソースの事実を読む。どのソースで宣言した型も、申告したファイルで構築・呼び出し・replay されうるためである。

## 2つのコード表現

ドメイン型は、`class`、または companion である。companion は、同じファイルにある同名の `type T = { … }` の型リテラルと `const T = { … }` のオブジェクトリテラルの組である。companion のインスタンスは、そのオブジェクトの中で型に対して書かれたリテラルである。すなわち、その型で注釈したリテラルか、型のブランドをキーに持つ型の無いリテラルである。`interface` と `const` の組は companion として扱わない。

## 規則

| 規則 | class | companion |
|---|---|---|
| a: 公開された状態 | `#` フィールドではない、static でないすべてのプロパティ（パラメータプロパティを含む）。`private`、`protected`、`readonly` は compiler が消去するため、フィールドを隠さない。メソッドは操作であり、static メンバーは class オブジェクトに属する。文言: `public field Invoice.id in domain layer` | 型リテラルのすべてのプロパティ（型リテラルの行に1回だけ報告する）と、型リテラルが宣言していないインスタンスのプロパティ。生成関数が作るクロージャに保持した状態は隠れている |
| b: 未宣言のミューテーション | `this` のメンバーか捕捉した状態へ書き込むインスタンスメソッド（`#` のメソッドを含む）、または配列・`Map`・`Set` と型を書いたフィールドの変更メソッド（`push`、`set`、`add`、`delete` など）を呼ぶインスタンスメソッド。文言: `mutating method Invoice.rename is not declared as command.invoice.rename` | 捕捉した状態へ書き込むインスタンスメソッド、または閉包の状態に対して変更メソッド（`push`、`set`、`add`、`delete` など）を呼ぶインスタンスメソッド |
| c: 不完全な構築 | class 本体の外での `new T`、`T` と型を書いたリテラル、`x as T`。post-init メソッド（`init`、`setup`、`initialize`、`reset`、`configure`）は `b` ではなく `c` | companion のオブジェクトの外での、`T` と型を書いたリテラルと `x as T` |
| d: getter の呼び出し | 書かれた型がドメイン型である受け手に対する getter の呼び出し。getter とは、本体が `this` の1つのメンバー、閉包の状態の1つのメンバー、または閉包の状態そのものを `return` するだけのメソッドである。`this.total()` は許可する。文言: `getter total called from domain layer (Tell, Don't Ask)` | インスタンスが持つ getter について同じ。閉包の状態とは生成関数が束縛するものであり、モジュールの定数を返すメソッドは getter にならない |
| g: 依存 | 下記 | 下記 |

規則 b は、Rust のゲートと同じく正規モデルのコマンドのスラッグに従う。`rename` は `command.<aggregate>.rename` でなければならず、`applyEvent` は `apply-event` になる。replay メソッドが除外されるのは、次の条件がすべて成り立つときだけである。集約写像が event-sourcing の集約について `replay_methods` で宣言している。その集約が型のパッケージとモジュールパスに置かれている。メソッドの1つの引数の型が、同じパッケージにある、宣言したイベントのドメイン型と書かれている。ドメインモデルが SKIP または無いとき、b は判定せず、そのことを note に記録する。`c-default` に対応するものは無い。TypeScript には `Default` の導出が無いためである。

文言では、Rust のゲートが `::` で綴るメンバーを `.` で綴る。それ以外の言葉は同じである。

### 依存の方向（g）

申告したドメインのソースにある各 import と、モジュールを名指す各再公開を、プロジェクトが解決する順に辿る。順は、パス、パッケージの `imports` 指定子（`#…`）、パッケージの `tsconfig.json` の `paths` エイリアス、プロジェクトのパッケージ名（サブパスを含む）、それ以外はプロジェクト外のパッケージである。プロジェクトのパッケージとは、ルートを含むワークスペース内のディレクトリのうち、`package.json` が名前を持つものすべてであり、ルートの `tsconfig.json` が参照しているかどうかを問わない。`node_modules`、`dist`、`.` で始まるディレクトリなど、プロジェクトの走査が数えないディレクトリは除く。申告したパッケージの `package.json` の `dependencies`、`devDependencies`、`peerDependencies`、`optionalDependencies` も依存の辺として扱う。ただし、同じ辺を import がすでに表している場合は除く。1つの辺は1件の所見であり、その文言は所見となる判定区分をすべて並べる。

| 判定区分 | 意味 |
|---|---|
| `layer-forbidden` | 層の許可表が、依存先パッケージの層を禁止している（domain が依存してよいのは infrastructure だけ） |
| `external-io` | npm の I/O リスト（データベース、キャッシュ、メッセージブローカー、HTTP クライアント、RPC、Web フレームワーク、クラウド SDK）にある外部パッケージ。Node の組込みモジュールは含まない |
| `private-path` | 別パッケージのディレクトリへのパス、または `exports` が公開していないパッケージのサブパス |
| `alias` | 別パッケージへ通じる `paths` エイリアス。同じパッケージの中へのエイリアスは許可する |
| `wildcard-reexport` | パッケージの `exports` が公開するファイルでの `export *` または `export * as ns`。`exports` が名指さないファイルは、隣のファイルを再公開してよい |
| `type-only` | 依存が出力から消える場合（`import type`、import 型）に、他の区分に添える。型だけの依存も同じ規約で判定する |

command 側と query 側のパッケージ間の参照は、このドメインゲートでは報告しない。Rust のドメインゲートも報告しない。

### ドメインパッケージング

ソースのモジュールパスは、`src/` 配下の配置から決める。`src/index.ts` はパッケージの根 `[]`、`src/a.ts` と `src/a/index.ts` は `[a]`、`src/a/b.ts` は `[a, b]` である。申告が触れたドメインパッケージの各モジュールには、そのパッケージについて TypeScript に置いた `domain_packages` の宣言が必要である。規則 ID と意味は Rust のゲートの `domain-packaging.*` と同じである（[パッケージング契約](domain-packaging-design.ja.md)を参照）。モジュールの要素にならないファイル名（`invoice.model.ts`）と、1つのモジュールパスを名指す2つのファイル（`src/invoice.ts` と `src/invoice/index.ts`）は `domain-packaging.unresolved` になる。

### 層の診断

`layer.unknown` と `layer.conflict` は、申告したパッケージの `package.json` に報告する。どの `package.json` にも属さない申告した TypeScript ファイルは `layer.unowned` になり、Rust のゲートが所有者の無い申告を名指すのと同じく、記録ディレクトリからの相対パスで名指す。`layer.mixed-targets` は Cargo の診断であり、宣言していない。

## ゲートを止めるもの

このゲートが決められないものは合格にしない。次のいずれも、終了コード 127、stdout に判定を出さず、stderr に該当する構文をすべて `<file>:<line> …`（`package.json` の依存は `<file> …`）として列挙して停止する。フレームワークは、blocking のゲートを閉じたままにする。

- 抽出が読めなかったドメインのソース（`syntax-error`）、または未解決の構文（`decorator`、`computed-name`、`object-spread`、`binding-pattern`、`import-equals`、`export-assignment`、`dynamic-import`、`namespace`、`dynamic-callee`）を含むドメインのソース。申告したかどうかを問わない
- アクセサ、基底クラス、実装する interface を持つ class、アンビエントな class、`declare`・`abstract`・計算名のメンバー
- 次のいずれかに当たる companion。ブランドが、export されていない最上位の `unique symbol` 型の `const` で、グローバルの `Symbol()` / `Symbol("…")` で作ったもの1つではない。インスタンスを書いていない。インスタンスがメンバーを隠す（スプレッド）。インスタンスに型のメソッドが欠けている。インスタンスを `as` / `satisfies` で作っている
- 受け手の型が注釈で書かれていない、または1つの名前付きの型以外（共用型、ジェネリクスの適用）で書かれている、getter と同名の呼び出し
- どのパッケージにも属さない場所へのパス、パッケージが対応付けていない `imports` 指定子、`exports` を持たない、またはモデル化していない形の `exports` を持つパッケージ、ちょうど1つのパッケージへ通じないエイリアス、ワークスペース内の複数の `package.json` が持つパッケージ名、`baseUrl` を設定したパッケージを通る依存
- `exports` を持たない、モデル化していない形の `exports` を持つ、または `exports` がソースではないファイル（`./dist/index.js` など）だけを指すパッケージの、申告したドメインのソースにある `export *` または `export * as ns`。そのファイルが公開されているかを判定できないため
- ルートの `tsconfig.json` が参照していないドメインパッケージへ import で解決される型名。そのパッケージのソースは読んでいないため
- ルートの `tsconfig.json` が参照していない、申告したドメインパッケージ。起動時にその compiler 設定を確認していないため
- 起動できない compiler。報告は[事実抽出](../developers/typescript-fact-extraction.ja.md#抽出を起動できないとき)と同じく `ddd-typescript-domain: tool unavailable: <起動の報告の message>` である

## 判定しないこと

このゲートは、Rust のゲートの明示的な型の照合と同じく、型チェッカーを使わない。受け手の型は、引数、変数、class のフィールドに書かれた型である。初期化式から推論はしない。型名は、同じファイルの宣言に、それが無ければ名指す import を通して、import 先パッケージのドメイン型に解決する。別の場所で保持する値（`this` の別名、型を書いていないコレクションのフィールド）を通した状態の変更は見えない。companion の外で書かれた、ブランドをキーに持つリテラルは構築として報告しない。TypeScript のすべての構文の網羅は保証しない。生成したコードには引き続き型検査と試験が必要である。

Rust のゲート（`ddd-rust-domain`、`ddd-rust-use-case`、`ddd-rust-interface-adapter`）が判定するのは、申告した `.rs` ファイルだけである。申告した `.ts` ファイルは判定の対象外なので、TypeScript のソースだけを申告するプロジェクトは、注記 `no rust sources claimed` 付きでこれらのゲートに合格する。どの Cargo workspace にも属さない申告した `.rs` ファイルは、引き続き `layer.unowned` になる。

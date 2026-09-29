# TypeScript センサーの契約

[English](typescript-sensor-contract.md) | 日本語

更新: 2026-09-28、T-03-03。TypeScript のソースは、3つのコード生成ゲートが判定する。各ゲートは、同じ層の Rust のゲートと同じ規則 ID を同じ意味で報告する。ただし、ドメインゲートの規則 b だけは意味が異なる（[後述](#ドメインゲートの規則)）。

| ゲート | 判定するもの | 対応する Rust のゲート | 規則 |
|---|---|---|---|
| `ddd-typescript-domain`（T-11-02） | ドメインパッケージの申告したソース | `ddd-rust-domain` | a、b、c、d、g、ドメインパッケージング、層の診断 |
| `ddd-typescript-use-case`（T-11-03） | ユースケースパッケージの申告したソース | `ddd-rust-use-case` | g、h、i、d |
| `ddd-typescript-interface-adapter`（T-11-03） | インターフェースアダプタと rmu のパッケージ、および層を問わず query 側のすべてのパッケージの申告したソース | `ddd-rust-interface-adapter` | k、l、m、n、g |

各ゲートは [TypeScript の事実](../developers/typescript-fact-extraction.ja.md)から判定し、事実で決められない箇所では検査不能として停止する。モジュール配置の検査（T-11-04）は含まない。

## 起動する条件と読むもの

各ゲートは `code-generation` のゲートで、Rust のゲートと並んで `code-summary.md` に対して起動する。入口は `source-manifest.json` で申告した `.ts` / `.tsx` ファイル（`.d.ts` を除く）である。ゲートが判定するソースとは、上の表の層のパッケージのソースである。

| 申告 | 応答 |
|---|---|
| TypeScript のファイルが無い | 合格。note は `no typescript sources claimed`。compiler は使わない |
| TypeScript のファイルはあるが、ゲートが判定するソースが無い | 所有者の無い申告、実行済みのドメインモデルの読み込み失敗、ドメインゲートに限り申告したパッケージの層診断が無ければ合格。compiler は使わない |
| ゲートが判定するソースが1件以上ある | 同梱した compiler を起動し、そのゲートのすべての規則を実行する |

申告したファイルは、その上にある最も近い `package.json` のパッケージに属する。層は、スコープを除いたパッケージ名と配置から、Rust の crate と同じ規約で決める。規約は、`-domain` / `-use-case` / `-interface-adapter` / `-infrastructure` の接尾辞、`packages/<layer>/` または `modules/<layer>/`、`command` / `query` / `rmu` の区分、composition root の目印である。ドメインのソースとは、ドメインパッケージの `src/` 配下にある、試験ではない `.ts` / `.tsx` ファイルである。`*.test.ts`、`*.spec.ts`、`__tests__/` は補助ファイルとして扱う。

各ゲートは、申告したファイルのほかに、各パッケージの `package.json`、ルートの `tsconfig.json` が参照する各パッケージの `tsconfig.json`（`paths` と `baseUrl` のため）、正規モデル、状態ファイル、集約写像、申告したか、ルートの `tsconfig.json` が参照するすべてのドメインパッケージの `src/` 配下にある全ソースの事実を読む。どのソースで宣言した型も、申告したファイルで構築・呼び出し・replay されうるためである。ユースケースゲートは、そうしたユースケースパッケージの全ソースも読む。申告したソースが名指すユースケース、ポート、リポジトリポートは、そのどれで宣言されていてもよいためである。それ以外のソース（ユースケースゲートにとってのインターフェースアダプタ層、インターフェースアダプタゲートにとってのユースケース層）は読まないので、ゲートを止めることもない。

## 2つのコード表現

ドメイン型は、`class`、または companion である。companion は、同じファイルにある同名の `type T = { … }` の型リテラルと `const T = { … }` のオブジェクトリテラルの組である。companion のインスタンスは、そのオブジェクトの中で型に対して書かれたリテラルである。すなわち、その型で注釈したリテラルか、型のブランドをキーに持つ型の無いリテラルである。`interface` と `const` の組は companion として扱わない。

## ドメインゲートの規則

| 規則 | class | companion |
|---|---|---|
| a: 公開された状態 | `#` フィールドではない、static でないすべてのプロパティ（パラメータプロパティを含む）。`private`、`protected`、`readonly` は compiler が消去するため、フィールドを隠さない。メソッドは操作であり、static メンバーは class オブジェクトに属する。文言: `public field Invoice.id in domain layer` | 型リテラルのすべてのプロパティ（型リテラルの行に1回だけ報告する）と、型リテラルが宣言していないインスタンスのプロパティ。生成関数が作るクロージャに保持した状態は隠れている |
| b: 状態へ書き込むドメインメソッド | 状態へ書き込む、static でないすべてのインスタンスメソッド（`#` のメソッドを含む）。書き込みとは、`#` フィールドや `this` のほかのメンバーへの代入、または配列・`Map`・`Set` と型を書いたフィールドに対する変更メソッド（`push`、`pop`、`shift`、`unshift`、`splice`、`sort`、`reverse`、`fill`、`copyWithin`、`set`、`add`、`delete`、`clear`）の呼び出しである。メソッドの宣言行に報告する。文言: `domain method Invoice.rename changes the state of its instance; a TypeScript domain method returns a new instance instead` | 捕捉した閉包の状態へ書き込むすべてのインスタンスメソッド、またはファイルに書かれた型から配列・`Map`・`Set` と分かる閉包の状態に対して同じ変更メソッドを呼ぶすべてのインスタンスメソッド。対象は、書いた型がそれらである閉包の束縛か、型を書いていない閉包の束縛（分割代入の束縛を含む）、または閉包の束縛のメンバー `state.m` のうち、束縛に書いた型（その場の型リテラル、または同じファイルの最上位で宣言した型リテラルの型別名・interface を指す型引数なしの1つの名前）がプロパティシグネチャ `m` をちょうど1つ持ち、その型がそれらであるものである。ほかの型を書いた束縛（`add` が新しい値を返す `paid: Money` のような値オブジェクト）、書かれた型から決められないメンバー（束縛が型を書いていない、またはそのように宣言していない型を名指す）、2段以上のアクセス連鎖、添字アクセスへの同じ呼び出しは書き込みとしない。行と文言は class と同じ |
| c: 不完全な構築 | class 本体の外での `new T`、`T` と型を書いたリテラル、`x as T`。post-init メソッド（`init`、`setup`、`initialize`、`reset`、`configure`）は `b` ではなく `c` | companion のオブジェクトの外での、`T` と型を書いたリテラルと `x as T` |
| d: getter の呼び出し | 書かれた型がドメイン型である受け手に対する getter の呼び出し。getter とは、本体が `this` の1つのメンバー、閉包の状態の1つのメンバー、または閉包の状態そのものを `return` するだけのメソッドである。`this.total()` は許可する。文言: `getter total called from domain layer (Tell, Don't Ask)` | インスタンスが持つ getter について同じ。閉包の状態とは生成関数が束縛するものであり、モジュールの定数を返すメソッドは getter にならない |
| g: 依存 | 下記 | 下記 |

TypeScript のドメインメソッドは不変である。状態へ書き込まず、新しいインスタンスを返し、ユースケースがそれを保存する。そのため規則 b の意味は、宣言したコマンドでも replay メソッドでもない `&mut self` のメソッドを報告する Rust のゲートの b とは異なる。ここでは、状態へ書き込むメソッドは、正規モデルがコマンドとして宣言しているかどうか、集約写像が `replay_methods` で宣言しているかどうかを問わず、すべて所見になる。replay メソッドも次のインスタンスを返す。b はモデルを読まないため、ドメインモデルが SKIP または無いとき（ddd-domain-modeling を SKIP したときなど）も判定する。そのときの note は `model-dependent checks (h, c-model, n-model) skipped` であり、b を含まない。post-init メソッド（`init`、`setup`、`initialize`、`reset`、`configure`）は c だけが報告し、b は報告しない。`c-default` に対応するものは無い。TypeScript には `Default` の導出が無いためである。

ドメインメソッドが何を返すかは、ゲートは判定しない。state sourcing では `Result<Invoice, XxxError>`、event sourcing では `Result<{ next: Invoice; event: XxxEvent }, XxxError>`（1コマンドに1イベント）、`command-id-memory` のコマンドでは成功の値が `CommandOutcome<Invoice, XxxEvent>`、すなわち `{ kind: "applied"; next; event } | { kind: "already-applied" }` である。これはレビューと振る舞いテストで確かめる。

文言では、Rust のゲートが `::` で綴るメンバーを `.` で綴る。それ以外の言葉は同じである。ただし、意味の異なる b の文言は除く。

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

ユースケースゲートとインターフェースアダプタゲートは、対応する Rust のゲートと同じく、層の診断を報告しない。渡された申告についての `layer.unowned`、`runtime.claims`、`model.invalid` は報告する。

## ユースケースゲートの規則

| 規則 | 報告するもの | 文言 |
|---|---|---|
| g: 依存 | 申告したユースケースのソースと、そのパッケージの `package.json` の各依存。ドメインゲートと同じ順に辿る。`layer-forbidden` は層の許可表に従い（ユースケースが依存してよいのはドメイン層とインフラ層）、`external-io` はドメインゲートと同じく適用する。`private-path`、`alias`、`wildcard-reexport`、`type-only` の意味もドメインゲートと同じ | `dependency direction @acme/billing-use-case -> @acme/billing-interface-adapter via "@acme/billing-interface-adapter" (layer-forbidden)` |
| h: 集約の引数 | `execute`（class のメソッド。static と abstract を含む。またはファイルの最上位で宣言した関数）の引数のうち、書かれた型が、モデルが集約に結び付けるドメイン型であるもの。`Readonly<T>`、`T` と `null` / `undefined` の共用型、`T[]`、`readonly T[]`、`Array<T>`、`ReadonlyArray<T>` は `T` を渡すものとして扱う。ID と値オブジェクトは許可する。ドメインモデルが SKIP または無いとき、h は判定せず、そのことを note に記録する | `execute receives aggregate Invoice directly; pass ids and value objects`。型は引数に書かれたとおりに綴る（import の別名はその名前のまま） |
| i: ユースケースの連鎖 | 書かれた型が、`execute` を宣言するユースケースパッケージの class である受け手に対する `execute` の呼び出し。`this`、呼び出し元の class 自身の値、interface（ポート）に対する呼び出しと、同じファイルが宣言した関数 `execute` の呼び出しは許可する | `use case calls packages/use-case/billing-use-case/src/finish.ts#FinishInvoice.execute`。呼ばれた class を、宣言したファイルで名指す |
| d: getter の呼び出し | ドメインゲートと同じ getter の呼び出しを、use-case 層からの呼び出しとして報告する。ただし、getter の結果を、リポジトリポートが宣言するメソッドへ変更せずに渡すことは許可する。渡し方は、その呼び出しの引数（括弧だけで囲んでもよい）か、すべての参照がそうした引数である `const` の束縛（そうした束縛の連鎖を含む）である。`case` 節または `default` 節の直下で宣言した `const` は、後の節から読めるため、この束縛に当たらない。節をブロックで囲めば、その中の `const` を通して渡せる。リポジトリポートとは、ドメインまたはユースケースのパッケージのポート（規則 m と同じく `interface` または型リテラルの型別名）で、名前が `…Repository` で終わり、呼んだメソッドを宣言しているものであり、受け手に書かれた型がそれを名指している必要がある。結果を計算・変換・分岐に使うことや、ほかのもの（関数、別のポート、`…Repository` という名前の class）へ渡すことは、引き続き所見になる | `getter total called from use-case layer (Tell, Don't Ask)` |

Rust のゲートと同じく、リポジトリへの受け渡しを証明できないときは、ゲートを止めずに d の所見のままにする。

## インターフェースアダプタゲートの規則

| 規則 | 報告するもの | 文言 |
|---|---|---|
| k: 横断参照 | 申告したソースと、そのパッケージの `package.json` の依存のうち、command 側のパッケージと query 側のパッケージの間のもの。向きと、型だけかどうかは問わない。rmu のパッケージは両側を橋渡しし、どちらにも当たらない | `cross-side reference @acme/billing-command-api -> @acme/billing-query-dao via "@acme/billing-query-dao" (type-only)` |
| l: query 側からのドメイン参照 | query 側のパッケージの申告したソースで、import または再公開が別のモジュールから受け取る名前のうち、ドメイン型であるもの、または名前が `…Repository` で終わるもの。`import type` を含む。判定する名前はモジュールが公開する名前なので、別名で import しても同じ参照である。query の DTO は許可する | `query side references domain type / repository port Invoice` |
| m: リポジトリの命名 | 名前が `…Repository` で終わるポート（`interface`、または型リテラルの型別名）で、`<Aggregate>Repository` ではないもの、または保存媒体を名指すもの。名前が `…Repository` で終わる実装の `class` は媒体を名指してよい（`PostgresInvoiceRepository`）が、集約にちなんだ名前である必要はある。集約はモデルの集約とし、モデルが無ければすべてのドメイン型とする | `repository port DynamoDbInvoiceRepository names a storage medium`、`repository port CustomerRepository is not <Aggregate>Repository` |
| n: 復元のバイパス | 型が提供する factory（`Invoice.open(…)`）で復元せず、アダプタ自身がドメイン型を構築すること。class の `new`、型を書いたリテラル、`x as T` が当たる | `adapter constructs Invoice via new-expression instead of a full constructor`（`typed-object-literal`、`type-assertion`） |
| g: 依存 | ユースケースゲートと同じ。ただし外部の I/O パッケージは許可する。インターフェースアダプタ層が依存してよいのはユースケース層・ドメイン層・インフラ層、rmu 層が依存してよいのはドメイン層・インターフェースアダプタ層・インフラ層である | `dependency direction … (layer-forbidden)` |

## ゲートを止めるもの

ゲートが決められないものは合格にしない。次のいずれも、終了コード 127、stdout に判定を出さず、stderr に該当する構文をすべて `<file>:<line> …`（`package.json` の依存は `<file> …`）として列挙して停止する。フレームワークは、blocking のゲートを閉じたままにする。

- ゲートが読むソースのうち、抽出が読めなかったもの（`syntax-error`）、または未解決の構文（`decorator`、`computed-name`、`object-spread`、`binding-pattern`、`import-equals`、`export-assignment`、`dynamic-import`、`namespace`、`dynamic-callee`）を含むもの。申告したかどうかを問わない
- アクセサ、基底クラス、実装する interface を持つ class、アンビエントな class、`declare`・`abstract`・計算名のメンバー
- 次のいずれかに当たる companion。ブランドが、export されていない最上位の `unique symbol` 型の `const` で、グローバルの `Symbol()` / `Symbol("…")` で作ったもの1つではない。インスタンスを書いていない。インスタンスがメンバーを隠す（スプレッド）。インスタンスに型のメソッドが欠けている。インスタンスを `as` / `satisfies` で作っている
- 受け手の型が注釈で書かれていない、または1つの名前付きの型以外（共用型、ジェネリクスの適用）で書かれている、getter と同名の呼び出し
- ユースケースゲートでは次のもの。型を書いていない `execute` の引数、または h が見通す形以外で集約を含む型（`Map<string, Invoice>` など）を書いた `execute` の引数。受け手の型が書かれていない `execute` の呼び出し、または名前・`this`・`this` のフィールド以外を受け手とする `execute` の呼び出し。そのファイルが宣言していない関数 `execute` の名前による呼び出し
- インターフェースアダプタゲートでは次のもの。query 側のソースにある、ドメインパッケージの名前空間 import、`export *` / `export * as ns`、動的 import、import 型。どのドメイン型にも届きうるため。別の型の中にドメイン型を含む型での構築（`{} as Record<string, Invoice>` など）
- どのパッケージにも属さない場所へのパス、パッケージが対応付けていない `imports` 指定子、`exports` を持たない、またはモデル化していない形の `exports` を持つパッケージ、ちょうど1つのパッケージへ通じないエイリアス、ワークスペース内の複数の `package.json` が持つパッケージ名、`baseUrl` を設定したパッケージを通る依存
- `exports` を持たない、モデル化していない形の `exports` を持つ、または `exports` がソースではないファイル（`./dist/index.js` など）だけを指すパッケージの、申告したドメインのソースにある `export *` または `export * as ns`。そのファイルが公開されているかを判定できないため
- ルートの `tsconfig.json` が参照していないドメインパッケージ（ユースケースゲートではユースケースパッケージも）へ import で解決される型名。そのパッケージのソースは読んでいないため
- ルートの `tsconfig.json` が参照していない、ゲートが判定する申告したパッケージ。起動時にその compiler 設定を確認していないため
- 起動できない compiler。報告は[事実抽出](../developers/typescript-fact-extraction.ja.md#抽出を起動できないとき)と同じく `<センサー ID>: tool unavailable: <起動の報告の message>` である

## 判定しないこと

各ゲートは、Rust のゲートの明示的な型の照合と同じく、型チェッカーを使わない。受け手の型は、引数、変数、class のフィールドに書かれた型である。初期化式から推論はしない。型名は、同じファイルの宣言に、それが無ければ名指す import を通して、import 先パッケージのドメイン型（ユースケースとポートについては class と interface）に解決する。別の場所で保持する値（`this` の別名、型を書いていないコレクションのフィールド、ファイルに書かれた型からコレクションと決められない閉包の状態のメンバー）を通した状態の変更は見えない。companion の外で書かれた、ブランドをキーに持つリテラルは構築として報告しない。変数に保持したアロー関数、オブジェクトリテラルのメソッド、interface のメソッドシグネチャとして書いた `execute` は h で判定しない。Rust のゲートが判定するのも impl のメソッドと自由関数だけである。TypeScript のすべての構文の網羅は保証しない。生成したコードには引き続き型検査と試験が必要である。

Rust のゲート（`ddd-rust-domain`、`ddd-rust-use-case`、`ddd-rust-interface-adapter`）が判定するのは、申告した `.rs` ファイルだけである。申告した `.ts` ファイルは判定の対象外なので、TypeScript のソースだけを申告するプロジェクトは、注記 `no rust sources claimed` 付きでこれらのゲートに合格する。どの Cargo workspace にも属さない申告した `.rs` ファイルは、引き続き `layer.unowned` になる。

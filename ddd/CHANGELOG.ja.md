# Changelog

[English](CHANGELOG.md) | 日本語

dddプラグインの主な変更を記録します。形式は[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)に従います。

## 未リリース — 配布物・承認・CI・Next.js での TypeScript の検証

- **パッケージの `target` が `ES2017` 以上 `ESNext` 以下の TypeScript プロジェクトを受け入れる。** `create-next-app` が生成する `tsconfig.json` は `target: "ES2017"` を書くため、これまでは `typescript-extractor:project-condition-mismatch` として拒否していた。事実と規則は target に依存しないため、`ES2017` 〜 `ES2025` と `ESNext` を大文字小文字を問わず受け入れる。それより低い target、書かれていない target、パッケージ間で異なる target は、引き続き拒否する。`module: esnext`・`moduleResolution: bundler`・`strict: true` は変えていない。error-contract の条件は、`esnext` だけを受け入れるのをやめ、プロジェクトが書いた target（`es2017` 〜 `esnext`）をそのまま記録する。両方の入口は同じプロジェクトを拒否する。[TypeScript の事実抽出](docs/developers/typescript-fact-extraction.ja.md)を参照。
- **共通の振る舞いテストを TypeScript の見本で実行する。** 正常な状態変更、業務エラー時の状態保持、不正値の生成拒否、永続化後の復元を、各コード表現・各モジュール配置の生成見本で実行する（`t11-typescript-behavior.test.ts`）。検証した `class` × `state-sourcing` の組み合わせを、[TypeScript の実行モデルと永続化方式の検証](docs/developers/typescript-execution-persistence-verification.ja.md)と[実行記録](docs/developers/evidence/typescript-execution-persistence-verification.json)に記録した。`actor` と `event-sourcing` は未検証として記録している。
- **共通の振る舞いテストを Rust の見本で実行する。** 同じ4シナリオを Rust で書き、請求書の集約を持つ Rust の見本で、両モジュール配置 `file`・`mod-rs` について `cargo test` でコンパイル・実行する（`t11-rust-behavior.test.ts`）。この見本は Rust のドメイン・ユースケース・インターフェースアダプタ・モジュール配置の各ゲートを所見なしで通る。検証した `class` × `state-sourcing` の組み合わせを、[Rust の実行モデルと永続化方式の検証](docs/developers/rust-execution-persistence-verification.ja.md)と[実行記録](docs/developers/evidence/rust-execution-persistence-verification.json)に記録した。`mod-rs` での `class` × `event-sourcing` と `actor` は未検証のまま。規則・センサー・コード生成の手順は変えていない。試験に `cargo` と `rustc` が必要なのはこのリポジトリの CI だけで、導入先のプロジェクトでは必要ない。
- **配布物・導入・承認・CI で TypeScript のセンサーが動くことを確認する。** `scripts/verify-dist.ts` は `dist/<harness>/tools` から、`install-sandbox.test.ts` は導入済みのプロジェクトから、すべての見本に対して TypeScript の4ゲートとモジュール配置の CI 用入口を実行する。`t1-gate-integration.test.ts` は Claude と Codex で、すべての見本について全 DDD センサーのもとで code-generation のゲートを開く。これらの試験は、CI が実行する `bun run check` に含まれる。
- **Node.js 上の ESM Next.js アプリで見本を検証する。** `bun run verify:nextjs-integration` は、各見本を Next.js 16.3.6 のホストと組み合わせ、`npm ci` で導入し、`next build` でビルドし、ゲートと CI 用入口を実行し、`next start` への発行要求の応答を確かめる。検証した版と未検証のホスト環境は、[Next.js 統合の検証](docs/developers/nextjs-integration-verification.ja.md)と[実行記録](docs/developers/evidence/nextjs-integration-verification.json)にある。

## 未リリース — TypeScript のコード生成

- **両コード表現・両配置の TypeScript のコード生成を指示する。** コード生成の手順を、言語共通の規約、Rust の規約、TypeScript の規約に分けた。Rust の文は移しただけで、言語共通の規約で `crate` を `package` と読み替えた箇所を除いて変えていない。TypeScript のパッケージは宣言と照合しないと述べていた古い重複の箇条は除いた。TypeScript の区分は `.ddd.toml` の `code_representation` と `module_layout` を読み、書くべきコードを次のように指示する。`class` では `#` フィールド、private constructor、static factory を使う。`companion` では同名の `type` と `const`、クロージャの状態、非公開の `unique symbol` ブランド1つ、型注釈つきのインスタンスリテラルを使う。状態を変えるのはコマンドのスラッグで名付けたメソッドだけにする。`Result` は infrastructure 層の言語拡張パッケージに宣言し、パッケージ名から `import type` する。操作ごとに、集約写像が名付けたエラー型を、そのケースの文字列リテラルだけの閉じた union として宣言し、戻り値の型を明記する。入力はコピーして保持し、出力はコピーで返し、業務エラーは状態を変える前に返す。依存はパッケージ名と `exports` だけで表し、`paths`・`baseUrl`・`export *` を使わない。配置ごとに、親と子を指す相対指定子の書き方を示す。新しい developer エージェントのナレッジ `ddd-typescript-domain-conventions.md` が、これらの規則を例とともに持つ。infrastructure-design の手順から「Rust だけが対象」という記述を除いた。共有ナレッジのレイヤー境界とドメインパッケージ構成は package で述べるようにし、TypeScript の範囲を加えた。Rust の規則は変えていない。
- **TypeScript の例をゲートで確かめる。** 両表現・両配置の生成見本（`Result` を宣言する infrastructure のパッケージ、集約 `invoice` と子 `invoice/line` を持つドメインのパッケージ、リポジトリポート `InvoiceRepository` とユースケース `IssueInvoice` を持つユースケースのパッケージ、`InMemoryInvoiceRepository` で集約を復元するインターフェースアダプタのパッケージ）が、TypeScript のドメインゲート・ユースケースゲート・インターフェースアダプタゲートを、申告したソースを検査したうえで所見0件で、TypeScript のモジュール配置ゲートを所見0件で、その CI 用入口を終了コード0で、コンパイラを診断0件で通る（`t11-typescript-generation-samples.test.ts`）。実行用指示にある TypeScript の例は、どれも見本のファイルのいずれかと一致し、両表現を示す必要がある（`generation-instructions.test.ts`）。センサー、ツール、ゴールデンの期待値は変えていない。

## 未リリース — TypeScript のユースケースゲートとインターフェースアダプタゲート

- **code-generation に TypeScript のユースケースゲート `ddd-typescript-use-case` を追加する。** ドメインの class 表現と companion 表現の両方について、規則 `g`（依存の方向と外部 I/O）、`h`（class のメソッドまたは最上位の関数である `execute` への集約の引き渡し）、`i`（ユースケースから別のユースケースの呼び出し）、`d`（getter の呼び出し）を TypeScript の事実で判定し、`ddd-rust-use-case` と同じ規則 ID と所見の意味で報告する。Rust のゲートと同じく、getter の結果を、直接または `const` の束縛を通して、リポジトリポートのメソッドへ変更せずに渡すことは `d` の所見にしない。
- **code-generation に TypeScript のインターフェースアダプタゲート `ddd-typescript-interface-adapter` を追加する。** インターフェースアダプタ層・rmu 層と、query 側のすべてのパッケージについて、規則 `k`（command／query の横断参照）、`l`（query 側からのドメイン型・リポジトリポートの参照）、`m`（リポジトリの命名）、`n`（復元のバイパス）、`g` を判定し、`ddd-rust-interface-adapter` と同じ規則 ID と所見の意味で報告する。型だけの依存も値の依存と同じく判定する。[TypeScript センサー契約](docs/users/typescript-sensor-contract.ja.md)を参照。
- **判定できない箇所では両ゲートを止める。** 読むソースの構文エラーや未解決の構文、型が書かれていない `execute` の引数や受け手、query 側でのドメインの名前空間 import や `export *`、起動できない compiler は、いずれも判定を出さずに終了コード 127 で終わる。そのため blocking のゲートは閉じたままになる。
- **TypeScript の事実を拡張する。** 関数宣言は `params` を持ち、結果を変更せずに別の呼び出しへ渡す呼び出しは `forwarded_to` を持つ。どちらも任意のフィールドであり、既存の事実は変わらない。
- ドメインゲートの規則と判定結果は変わらない。検査の組み立ては新しいゲートと共通のゲート設定で行い、依存の辺は1回の実行につき1度だけ組み立てるようにした。

## 未リリース — TypeScript のモジュール配置

- **TypeScript のモジュール配置を、両配置で、ゲートと CI で検査する。** 新しい `ddd-typescript-module-layout` ゲートセンサーと `ddd-check-typescript-module-layout.ts` CI 用入口は同じ検査を呼ぶため、検査が適用されるプロジェクトでは同じ所見と同じ判定を返す。対象外のプロジェクト（後述）では、センサーは合格にし、CI 用入口は検査したパッケージが0件のため 0 以外を返す。検査はプロジェクト直下の `.ddd.toml` の `typescript.module_layout` を読み、各パッケージのルート（`package.json` のあるディレクトリ）直下の `src` にあるモジュールをすべて判定する。`named-file` では親を `src/<m>.ts`、`index-file` では親を `src/<m>/index.ts` に置き、末端はどちらも `src/<m>/<leaf>.ts` とする。`src/index.ts` はパッケージの入口として扱う。`module-layout.configuration`・`module-layout.violation`・`module-layout.unresolved` の意味は Rust と同じである。もう一方の規約で置いた親や、子の無いディレクトリに残った `index.ts` は、必要なファイルを示す violation になる。1つのモジュールを両方のファイルに置いた構成、モジュールファイルの無いモジュールディレクトリ、シンボリックリンク、モジュールファイルの名前にならないソース（`*.test.ts`、`*.d.ts`、`.tsx`、`.mts`、`.cts`）、別のパッケージの `src` の中のパッケージ、読めないディレクトリ、設定があるのに `src` を持つパッケージが無いプロジェクトは unresolved とし、合格にしない。typescript を名指しせず、`tsconfig.json` も TypeScript ソースも持たないプロジェクトには何も報告しないため、Rust だけのプロジェクトは新しいセンサーを通過する。接続先は Rust の配置検査と同じ code-generation・build-and-test・ci-pipeline である。Rust の配置検査は、設定の読込と、走査中の入れ子の設定・シンボリックリンク・読めないディレクトリの報告を TypeScript の検査と共有するようにした。所見は変わらない。[TypeScript モジュール配置契約](docs/users/typescript-module-layout.ja.md)を参照。

## 未リリース — TypeScript のドメインゲート

- **code-generation に TypeScript のドメインゲート `ddd-typescript-domain` を追加する。** class 表現と companion 表現の両方について、規則 `a`（公開された状態）、`b`（未宣言のミューテーション）、`c`（不完全な構築）、`d`（getter の呼び出し）、`g`（依存の方向）、`domain-packaging.*`、層の診断を TypeScript の事実で判定し、`ddd-rust-domain` と同じ規則 ID と所見の意味で報告する。状態隠蔽は state-evidence の検査に従う。状態を隠すのは `#` フィールドと companion のクロージャだけであり、companion には非公開の `unique symbol` のブランドが1つ必要である。依存は、パス、`imports`、`paths` エイリアス、パッケージ名を通して辿る。非公開パス、別パッケージへのエイリアス、`exports` が公開しないサブパス、公開入口での `export *` は、型だけの依存であっても所見になる。[TypeScript ドメインセンサー契約](docs/users/typescript-sensor-contract.ja.md)を参照。
- **判定できない箇所では TypeScript のドメインゲートを止める。** 申告の有無を問わず構文エラーや未解決の構文を含むドメインのソース、規則がモデル化していない class・companion の形、名前付きの型が書かれていない getter の受け手、辿れない依存、起動できない compiler は、いずれも判定を出さずに終了コード 127 で終わる。そのため blocking のゲートは閉じたままになる。起動の失敗は、事実抽出と同じ報告になる。
- **ゲートが判定に使う TypeScript の事実を拡張する。** メンバーは `ambient`、`abstract`、`computed_key`（1つの識別子で綴った計算名はメンバーになる）、`type_text`、`params`、`writes`、`returns_state_only` を持つ。class は `heritage`、型の別名は `type_literal`、変数は `type_text` と `initializer` を持つ。型付きのリテラルは `form`、`members`、`opaque` を持つ。`type-assertion` の構築、`keyed_literals`、メソッド呼び出しの `receiver_binding_type` を追加した。その他の未解決の理由と構文エラーの契約は変えていない。
- Rust のドメインゲートの変更メソッドの分類、パッケージ構成の判定、層の割当を TypeScript のゲートと共通化した。Rust のゲートは申告した `.rs` ファイルだけを判定するようになった。これまで `layer.unowned` として報告していた他言語の申告ファイルは、その言語のゲートに任せる。その他の Rust の判定結果は変わらない。

## 未リリース — TypeScript の事実抽出

- **TypeScript Compiler API を同梱し、それを使って TypeScript の事実を抽出する。** 配布物は `typescript@6.0.3` を `tools/ddd/lib/typescript/vendor/typescript.js` に同梱し、その sha256 を manifest に記録する。導入先のプロジェクトに `typescript` パッケージは不要になり、新規導入と `--update` のどちらでも配置される。`bun run prepare:typescript` は固定した開発用依存関係からこれを複製する。1つの抽出が、ファイルごとに宣言、メンバーと可視性、型だけのものを区別した import と export、呼び出し、構築を返す。構文から決められないもの（デコレータ、計算された名前、オブジェクトリテラルのスプレッド、分割代入、`import =`、`export =`、指定子の決まらない動的 import、namespace、動的な呼び出し先）は `domain-facts.unresolved` の note として返し、構文エラーのあるファイルには事実を返さない。起動できない場合は `typescript-extractor:compiler-missing`、`checksum-mismatch`、`load-failed`、`version-mismatch`、`project-condition-mismatch` のいずれかに分類し、ネイティブ抽出器と同じ形でセンサーを検査不能として止める。対応する Compiler API の版とプロジェクト設定は1か所で定め、error-contract のプロジェクト条件と共有する。error-contract の応答は変わらない。この事実を読むセンサーはまだ無い。[TypeScript の事実抽出](docs/developers/typescript-fact-extraction.ja.md)を参照。

## 未リリース — ゲートが言語共通の成果物を読む

- **規則 `a`・`d` を判定するゲートは、`#[cfg(test)]` の中の属性マクロと `async_trait` では停止せず、verdict を返すようにした。** 抽出器は、`#[cfg(test)]` を持つ項目自身の属性マクロ、その項目の中の属性マクロ、`#![cfg(test)]` で始まるファイルの中の属性マクロを記録しなくなった。通常のビルドはそのコードをコンパイルしないため、それらの規則が読む宣言は変わらない。判別には、宣言の走査が項目やファイルを補助とするために既に持つ区別をそのまま使う。`#[cfg(test)]` 自身は引き続き `conditional-compilation` として記録する。ほかの構成条件と、試験用でない impl・trait ブロックの中で `#[cfg(test)]` を持つメソッドは、従来どおり扱う。抽出器は、属性マクロの許可リスト `ATTRIBUTE_MACRO_ALLOW_LIST` も、derive の補助属性の許可リストの隣に同じ形式で持つようにした。載せているのは `async_trait` だけで、パスの最終セグメントで照合するため、`#[async_trait]`、`#[async_trait::async_trait]`、`#[async_trait(?Send)]` は記録しない。async-trait は `async fn` のシグネチャを書き換えるだけで、公開メンバーも getter も加えないからである。これにより、規則 `a`・`d` の判定元となるファイルのインライン `#[cfg(test)]` モジュールにある `#[tokio::test]` や、そこにあるポート・リポジトリの `#[async_trait]` で、`ddd-rust-domain` と `ddd-rust-use-case` は停止しなくなり、それ以外の場所でも `domain-facts.unresolved` の note を加えなくなった。本体コードにある同じ `#[tokio::test]` と、許可リストに無い属性マクロでは、引き続き停止する。protocol は `protocol_version` 7 のままである。ゴールデンの期待値は変更していない。`t10-rust-domain-facts.test.ts` のゲートの回帰試験1件と、抽出器の単体試験1件の期待値を反転した。[属性マクロの扱い](docs/developers/rust-syn-spike.ja.md#属性マクロの扱い)と[判定が変わった範囲](docs/developers/rust-syn-spike.ja.md#判定が変わった範囲)を参照。
- **操作エラー集合の照合は、TypeScript の観測が写像のモジュールのファイルを指しているかを検査するようにした。** 従来、照合器は TypeScript の観測のファイルを写像の `code.module` と比べなかったため、パッケージ・型・メソッドが同じ別モジュールのファイルを指す観測も受理していた。実装写像の形式と `schema_version` は変えず、置き場所は観測側のプロジェクト設定が述べる契約とした。照合器は、観測の `packageRoot`、設定の `typescript.moduleLayout`、写像の `code.module` から許すファイルを求め、`target.file` と完全一致で比べる。ソースルートはパッケージのルート直下の `src` で、`named-file` では `<module>.ts`、`index-file` では `<module>/index.ts` と `<module>.ts` を許す。設定が TypeScript の配置を名指ししない観測、`code.module` が空か TypeScript のモジュール名として綴れない要素を持つ写像、宣言パスが型の1要素だけではない観測も拒否する。これで観測を写像へ結ぶ検査の強さが Rust とそろう。Rust の検査は変えていない。TypeScript の検証経路も両配置で観測するようにし、class とコンパニオンの両プロジェクトに `index-file` で書いた `billing-domain-index-file` を追加した。両表現・両配置で同じ判定になり、[証跡](docs/developers/evidence/operation-error-set.json)の `typescript_module_layouts` に記録する。証跡の未検証項目から TypeScript の `index-file` が外れ、[操作エラー集合の照合](docs/developers/operation-error-set.ja.md)の「限界」からこの項目を外した。置き場所の規約は[プロジェクト設定](docs/users/project-settings.ja.md)と[実装写像](docs/users/implementation-mapping.ja.md)に記載した。
- **規則 `a`・`d` を判定するゲートは、属性マクロの可能性がある属性を合格させず停止するようにした。** 属性マクロは注釈した項目を置換するため、規則 `a` が報告する公開メンバーや、規則 `d` が報告する getter を追加しうる。従来そうした項目は所見なしで合格していた。ネイティブ抽出器は、組込みでもなく、同じ項目の derive の補助属性として許可リストに載ったものでもない属性をすべて、理由 `attribute-macro` の `unresolved` として、その `#` がある行で記録し、`conditional-compilation` と同じ経路で報告する。許可リストの内容は、`Serialize` と `Deserialize` が宣言する `serde`、`Default` が宣言する `default`、thiserror の `Error` が宣言する `error`・`from`・`source`・`backtrace` である。そのため、serde のこれらの derive を持つ struct・enum・union（そのフィールドとバリアントを含む）に付いた `#[serde(...)]`、`Default` を derive した enum のバリアントに付いた `#[default]`、`Error` を derive したエラー型に付いた thiserror の補助属性は記録せず、対応する derive を持たない項目に付いた同じ補助属性は記録する。`ddd-rust-domain` と `ddd-rust-use-case` は、規則 `a`・`d` の判定元となるファイル（申告ファイルと、プログラム層の全クレートの全ソース。インライン `#[cfg(test)]` モジュールを含む）にその記録があれば、検査不能として停止する。終了コードは 127 で、verdict は返さず、各記録を stderr に示す。それ以外のファイルでは `domain-facts.unresolved` の note にとどめてゲートは verdict を返し、どちらの規則も判定しない `ddd-rust-interface-adapter` も note にとどめる。derive と許可リストの補助属性だけが付いた項目は、従来どおり判定する。`cfg_attr` が適用する中身は `conditional-compilation` の記録にとどまる。protocol は `protocol_version` 7 になり、6 を答えるままの導入先は `native-extractor:protocol-mismatch` として受け付けない。ゴールデンの期待値は変更していない。組込みでない属性マクロを誰も報告しないことを確かめていた回帰試験1件は、式の位置のマクロだけを対象にした。[属性マクロの扱い](docs/developers/rust-syn-spike.ja.md#属性マクロの扱い)と[判定が変わった範囲](docs/developers/rust-syn-spike.ja.md#判定が変わった範囲)を参照。
- **Rust で実際に検証している集約の実行モデルと永続化方式の組み合わせを記録した。** 既存の試験・ゴールデンケース・検証シナリオが `programming_model` × `persistence_method` × モジュール配置のどの組み合わせを判定しているかを洗い出し、組み合わせごとに根拠となるケース・試験への参照を添えて[実行モデルと永続化方式の検証](docs/developers/rust-execution-persistence-verification.md)（[日本語](docs/developers/rust-execution-persistence-verification.ja.md)）と[実行記録](docs/developers/evidence/rust-execution-persistence-verification.json)に記録した。`.ddd.toml` と集約写像を同時に持つゴールデンケースの定義は無く、両モジュール配置の検証は配置検査・Rust ソース規則・解決・ゲート統合（パッケージング4ケースの周囲に `.ddd.toml` を置く）の4経路に分かれているため、記録もその4経路を分けている。未検証の3件（`class` × `event-sourcing` × `mod-rs`、`actor` × 任意 × Rust ソース層、`actor` × `event-sourcing`）は理由つきで未検証として記載し、対応済みとしては記載していない。規則・判定・ゴールデンケースの期待値はいずれも変更していない。
- **tree-sitter 資産を撤去し、出荷されるすべての Rust センサーをネイティブ抽出器だけで判定するようにした。** `lib/rust/analyzer.ts`、`lib/rust/vendor/` の同梱 `web-tree-sitter` ビルド、`wasm/tree-sitter-rust.wasm` の文法を削除した。出荷されるセンサー、CI 用入口、ビルドした配布物のいずれもこれらを運ばなくなり、`dist/<harness>/tools/` には `*.wasm` が1件も存在しない。構文解析器がまだ答えていた2点は、構文解析なしで答えるようになった。`InspectionTarget` は構文木の代わりに申告ファイルのパスを運び、検査が読めなかった申告ファイルは検査対象から落ちるのではなく規則が判定すべきファイルとして残るため、ネイティブ抽出器を必要とする条件は従来と同じである。カタログ済みのどの入力も従来の `(rule_id, file)` の結論を保つ。`tests/golden/**` の期待値はいずれも変更しておらず、配布物の387ケースはハーネスごとに従来どおり全通過する。出荷する抽出器がリンクする第三者クレート（コミット済みの `Cargo.lock` から解決した通常依存の19件と、`cargo metadata` が報告するそれぞれのライセンス式）は [tools/ddd/bin/NOTICE.md](tools/ddd/bin/NOTICE.md) に記載し、削除した資産が運んでいた同梱 NOTICE を置き換える。解決されるがリンクされない2件（手続きマクロの `serde_derive` と、ビルドスクリプト用の依存 `version_check`）も同ファイルに明記している。
- **`analyzer.macro-opaque` の note は無くなり、代替も作らない。** どのマクロ形式もこの note を生まなくなった。モジュール宣言を隠しうるマクロは、従来どおりその宣言に `domain-packaging.unresolved` として拒否し、項目マクロと `cfg`／`cfg_attr` は従来どおり `domain-facts.unresolved` の note を伴う。したがって報告が消えるのは、式の位置に書かれたマクロと、組込みでない属性マクロの2形式である。いずれもネイティブ側が何も記録しない形式であり、verdict はこれらについて何も述べなくなる。組込み属性（`derive`・`allow`・`cfg`・`cfg_attr`・`test`）は `analyzer.macro-opaque` の note を従来も生んでいないため、ここで失うものはない。`cfg` と `cfg_attr` が生むのは上記の `domain-facts.unresolved` の note であり、これは変わらない。
- **申告を読む前にゲートを止める最後の条件が無くなった。** tree-sitter のガードはコンテキスト組み立てより前に発火していたため、構文解析器を初期化できない導入先では、Rust ソースを1件も申告せず判定対象が無い実行でも終了コード 127 になっていた。初期化する対象そのものが無くなった。ネイティブ抽出器は従来どおり、規則が判定するファイルを持つ場合にのみ必要とするため、Rust ソースを1件も申告しない実行は、正常な導入先と同じく `no rust sources claimed` の note を添えた verdict を返す。
- 資産の撤去で実測できたことと、未実測のまま残ることを記録した。試作報告の `unverified` から `plugin installation and gate integration` を外し、`full sensor parity` は `sensor answers for inputs the golden catalog does not carry` へ絞った。`Linux/Windows/x86_64`、`WASM distribution`、参照解決と型推論の4項目は、いずれも実測していないため残す。[証跡](docs/developers/evidence/rust-syn-spike.json)は、削除した抽出器が埋めていた `tree_sitter_fields` と `getter_comparison` の列を除いて再生成した。tree-sitter の文法との比較はこのリポジトリからは行えなくなったため、それによって未確定になる問いは[試作報告](docs/developers/rust-syn-spike.ja.md)と[完了タスク](docs/developers/completion-tasks.ja.md)に、解決済みとせずに記録する。
- **操作エラー集合の照合を、Rustの両方のモジュール配置で検証するようにした。** Rustの検証経路はモジュール配置を `file` に固定し、写像のモジュールをライブラリcrateルートと同じディレクトリのリーフファイルとして探していたため、`mod-rs` では何も読めなかった。写像のモジュールを、そのパッケージが書かれている配置が置く場所（`file` なら `<module>.rs`、`mod-rs` なら `<module>/mod.rs`）に置き、検査のプロジェクト設定でもその配置を名乗るようにした。シナリオが配置を記録していないパッケージは、推測した配置で検査せず、理由を添えて拒否する。宣言パスはどちらの配置でも `[...module, type]` のままなので、照合器が突き合わせる相手は変わらない。シナリオのワークスペースには、既存のシナリオを読み続ける `file` のパッケージと並べて、`mod-rs` で書いた `billing-domain-mod-rs` を追加した。どちらも同じ判定になり、[証跡](docs/developers/evidence/operation-error-set.json)の `rust_module_layouts` に記録する。証跡の未検証項目から Rust の `mod-rs` が外れた。TypeScript の `index-file` は未検証のまま残る。
- **`ddd-rust-use-case` と `ddd-rust-interface-adapter` が報告するすべての規則を、ネイティブ抽出器で判定するようにした。** tree-sitter の構文木を走査していた最後の4件の列挙が、他のすべての Rust 規則と同じ `domain-facts/1` のバッチを読む。execute への集約直接引き渡しの規則 `h` はネイティブの `impls` と新設の `functions`、クエリ側からのドメイン参照の規則 `l` はネイティブの `uses`、リポジトリ命名の規則 `m` はネイティブの `traits` と `types`、復元バイパスの規則 `n` はネイティブの `constructions` を読む。これにより、出荷される Rust ソースセンサーのうちモジュール配置検査以外はすべて共通契約に載った。カタログ済みのどの入力も従来の `(rule_id, file)` の結論を保ち、`m` の各所見が運ぶ行も従来と同じである。カタログに無い入力については、結論が動く。trait の関連定数の既定値に書かれたものは宣言の走査に届かないため、そこに書かれた構築を `n` が、そこのブロックが宣言する項目を `m`・`l`・`h` が報告しなくなり、その位置で所見を出していた入力は合格になる。本体を書く trait メソッド内のものと、`impl` ブロックの関連定数の既定値に書かれたものは、どちらも従来どおり記録され、従来どおり報告される。規則 `a` が読む公開メンバーも同様である。その走査が届かない位置は trait の関連定数だけではない。現時点で確認できたほかの位置は、置き換えた列挙がそこで何を報告していたかを断定せずに、走査が届かない位置として[判定が変わった範囲](docs/developers/rust-syn-spike.ja.md)と親課題向けの[完了タスク](docs/developers/completion-tasks.ja.md)に記録する。protocol は `protocol_version` 6 になった。impl ブロックの外で宣言された関数を答えるようになり、最上位・インラインモジュール内・別の関数の本体内・本体を書く trait メソッドの各位置で報告する。本体を持たない trait メソッドと impl ブロックのメソッドは、すでにそれらを運んでいる宣言に任せる。加えて、すべての型・trait 宣言に `line` を持つようになり、いずれも属性ではなく最初のキーワードの位置で開く。どちらも省略可能としては読まない。いずれかを欠く応答は「何も宣言していない」と読まずに拒否し、protocol 5 を答えるままの導入先は `native-extractor:protocol-mismatch` に分類して、verdict を出さずに終了コード 127 で終わる。
- **`ddd-rust-domain` が報告するすべての規則を、ネイティブ抽出器で判定するようにした。** 未宣言ミューテーションの規則 `b`、不完全構築の規則 `c`、依存方向の規則 `g`、`domain-packaging.*` の各規則が、規則 `a`・`d` が既に読んでいる `domain-facts/1` の同じバッチを、その土台となる宣言索引、型解決、依存辺、呼び出し事実、パッケージ・モジュール解決とともに読む。これらを支えていた `moduleLayout()` のモジュール配置と `value-flow.ts` の構文走査は削除し、リポジトリ引数の例外判定は抽出器自身の `forwarded_argument_calls` で証明する。カタログ済みの入力はいずれも `(rule_id, file)` の結論を保つ。対象の `.rs` ファイルが1つに定まる `#[path]` は従来どおり追従し、`cfg_attr` による条件付き、複数指定、不正リテラル、クレート外脱出、および項目マクロは従来どおり `domain-packaging.unresolved` として報告する。**ソースファイルの名前が `*.rs` でない `mod` 宣言——そのようなファイルを指す `#[path]` も、そこへ解決するシンボリックリンクも——は、そのファイルを開くのをやめ、その宣言の位置に報告するようになった。** バッチは走査が読むファイルの `.rs` という名前で集めるため、他の名前は抽出器に問い合わせていないからである。`ddd-rust-domain` は `domain-packaging.unresolved` を報告する。従来はそのファイルを Rust として読み、モジュールとして扱っていた。protocol は `protocol_version` 5 になった。
- **Rust ゲートが判定を拒否するファイルの範囲を広げた。** これらの規則はプログラム全体で型を解決するようになったため、判定元となるファイルは、申告ファイルに加えて domain 層クレートだけでなく**プログラム層の全クレート**の全ソースになった。use-case 層または interface-adapter 層のクレートに抽出器が読めないソースがある実行は、それを含めて組み立てた verdict を報告せず、抽出器が返した理由とともに終了コード 127 で終わる。`ddd-rust-use-case` と `ddd-rust-interface-adapter` はこの判定元を共有するため、同じ条件で停止する。所見が増える入力も減る入力もない。
- **モジュール走査の宣言もネイティブ抽出器から読むようにした。** `ddd-rust-module-layout` と CI 用入口 `ddd-check-rust-module-layout` は、抽出器のファイル単位の宣言からモジュールを解決するため、どちらも抽出器を必要とするようになった。起動できない場合、および応答を読めない場合、ゲートは verdict を出力せず終了コード 127 で終わり、CI 用入口は終了コード 1 と `{"pass": false, "reason": …}` を返し、走査を完了した実行が返す件数の結果はいずれも含まない。抽出器が使える場合、カタログ済みの入力の判定はいずれも従来どおりで、結論が動くのは次の 3 件である。`mod` 宣言や Cargo ターゲット根のソースファイルがプロジェクト探索の対象外ディレクトリ（隠しエントリ、`aidlc`、`node_modules`、`vendor`、`target`、`dist`）内にある場合——直接その位置を指す場合も、シンボリックリンク経由でそこへ解決する場合も——対象外のツリーへ追従してそこで配置を判定するのをやめ、宣言側——宣言を書いたファイルの該当行、ターゲット根ならそのクレートの `Cargo.toml`——に `module-layout.unresolved` を報告する。そのため、そうしたファイルを規約どおりに置いて合格していたプロジェクトは不合格になる。そのファイルは検査対象外で抽出器にも問い合わせておらず、同じ探索が対象外としたファイルの配置を判定することは元々矛盾していたためである。宣言を読めなかったモジュールファイルは `module-layout.unresolved` のみを受け取り、`mod-rs` のプロジェクトで並んで報告されていた `module-layout.violation` が出なくなった。子を宣言するかどうかこそが読めなかった内容だからである。また、探索が集めないファイル——`*.rs` でない名前のファイル——を指す `mod` 宣言は、そのファイルに `module-layout.violation` を報告するのをやめ、宣言側に `module-layout.unresolved` を報告する。探索対象外ディレクトリの場合と同じ理由である。配布が対応しないプラットフォームでは別の環境で実行すること。[ネイティブ抽出器の配布](docs/developers/native-extractor-distribution.ja.md)を参照。
- **公開メンバーの規則 `a` と getter の規則 `d` を、ネイティブ抽出器で判定するようにした。** これらを宣言する `ddd-rust-domain` と `ddd-rust-use-case` は、新しい `domain-facts/1` protocol（`--domain-facts-version`、`protocol_version` 5）を、検査対象プログラムの全ソースを含む1バッチで読む。**公開タプルメンバーを指摘するようになった。** `pub struct Invoice(pub u64);` と、その `pub(crate)`・`pub(super)`・`pub(in ...)` 形式は、メンバーの序数を名として、可視性が始まる行で規則 `a` を報告する。隣にある非公開メンバーは報告しない。**本体が明示的な `return self.amount;` の getter も規則 `d` の対象になり**、その呼出行で報告する。raw識別子は `r#` を保ち、非ASCII名も綴りを保つため、`r#total` が別の型の `total` に吸収されることはない。名前付きフィールド、末尾式の getter、trait 実装、enum のバリアントの合否は従来どおり。
- **この事実を読めないゲートは、合格させずに停止するようにした。** 各ゲートは評価の前に抽出器の起動を1回分類する。ファイルの事実が得られない条件（起動時の6条件、実行が完了しない、protocol 外の応答、リクエスト上限を超えるバッチ）では、verdict を出力せず終了コード 127 で終わる。解析器が受理できなかったファイルは宣言の記録自体を持たない。申告ファイルによってこれらの規則が判定する対象を持つ実行で、判定元となるファイルにそれが含まれる場合は、同じ終了コードで、抽出器が返した理由とともにゲートを停止し、「何も宣言していない」とは報告しない。そのようなファイルを申告しない実行では、どの規則も評価せず、従来どおり verdict を報告する。
- tree-sitter から読み続ける範囲は維持する。どの申告ファイルを検査対象にするか、そのマクロ由来の未解析領域、および `ddd-rust-use-case` と `ddd-rust-interface-adapter` だけが報告する `h`・`l`・`m`・`n` の宣言列挙が該当する（候補の解決はネイティブのプログラム解決で行う）。この2ゲートが持つ6件の規則のうち `i` と `k` は共通の判定基盤とともに移り、ネイティブの呼び出し事実と `use` 事実で判定するようになった。結論は変わらない。項目マクロと `cfg`／`cfg_attr` は、モジュール宣言を隠している場合は `domain-packaging.unresolved` の所見として報告し、それ以外は `domain-facts.unresolved` の note として判定に添える。[残る境界](docs/developers/rust-syn-spike.ja.md)を参照。
- `bun run test:domain-facts:native` を追加し、この protocol に対する抽出器自身の単体試験を `bun run check` の中で実行するようにした。
- **ネイティブ抽出器を製品パス1か所から起動し、配布物へ同梱した。** 両言語の入口は、`experiments/rust-syn/target/` 配下の2つのディレクトリを指すのをやめ、共通モジュール経由で `tools/ddd/bin/<platform-key>/ddd-rust-syn-spike` を解決する。ビルドと `tools/ddd/bin/manifest.json` は `tools/` payload の他のファイルと同じ経路で運ばれるため、新規導入と `--update` の双方で、導入先が起動できる抽出器が配置される。`bun run prepare:native` が `prepare:state-exposure` と `prepare:error-contract` を置き換える。1回ビルドし、そのパスへ設置し、各 protocol を照会し、プラットフォームを記録する。この配布が対応するのは `darwin-arm64` で、それ以外の環境は対象外であり対応済みとは表示しない。[ネイティブ抽出器の配布](docs/developers/native-extractor-distribution.ja.md)を参照。
- **ネイティブ抽出器が起動できない条件をそれぞれ区別し、いずれも合格にしない。** 対象外プラットフォーム、ファイルの欠損、実行権限の欠落、記録済みダイジェストとの不一致、照会の不成立、別 protocol の応答を、固定順で1回だけ分類し、それぞれ固有の subject で報告する（`native-extractor:unsupported-platform`、`:binary-missing`、`:binary-not-executable`、`:checksum-mismatch`、`:probe-failed`、`:protocol-mismatch`）。完了しなかった照会は、観測が報告した reason code（`tool-unavailable`、`execution-failed`、`timeout`、`output-limit`、`resource-limit` のいずれか）をそのまま保ち、protocol の不一致としては報告しない。いずれも実行状態が `completed` に達しないため、検査は合格ではなく未解決になる。ダイジェストの検査は起動より前に行う。
- **ゲート実行時に、抽出器のための Rust ツールチェーンを要求しなくなった。** 同梱ビルドの解決・検証・起動に `rustc` も `cargo` も使わない。Rust の操作エラー集合経路が Cargo 条件へ渡すターゲットトリプルは、配布 manifest から取得する。`cargo metadata --frozen` は引き続き実行する。これは**検査対象**プロジェクト側のビルド条件を解決するためである。
- 正規モデル・実装写像・レイヤー宣言の `schema_version: 2` と、プロジェクト設定の `schema_version = 2` を、ゲートが通るすべての経路で読むようにした。**移行が必要な形式のままの記録は拒否する**。モデルは `model-completeness.schema`、`model-presence.invalid`、`model.invalid`、`mapping-declarations.model`、`reference-ids.model`、`layer-structure.model`、`domain-packaging.reference` のいずれかとして、写像は `mapping-declarations.document`、`reference-ids.document`、`domain-packaging.declaration` のいずれかとして、宣言は `layer-structure.item` または `design-advisories.document` として、設定は `module-layout.configuration` として報告する。どの拒否も、変換するコマンドを併せて示す。
- `ddd-artifact-set.ts migrate --project <root> --record <record> [--supplement <path>] [--apply]` を追加。プロジェクトの設定と、記録1件のモデル・写像・レイヤー宣言をまとめて変換する。写像と宣言は、これから書き込むモデルに対して検査する。一式全体が準備できていなければ何も書かない。書込が途中で失敗した場合は、書き込んだもの、失敗したもの、残っているもの、完了させる方法を報告する。[成果物一式の移行](docs/users/artifact-migration.ja.md)を参照。
- Unitを持たないワークフローがステージ直下（`<record>/construction/infrastructure-design/cicd-pipeline.md`）に書くレイヤー宣言も、Unitが書くものと同様に読むようにした。それ以外の場所にある `cicd-pipeline.md` は、引き続き宣言として扱わない。
- Rustソースセンサーには、写像のRust項目を、それらのセンサーが照合するcrate名とモジュール列へ投影して渡すようにした。別の言語に置かれた集約・パッケージはセンサーへ渡らない。replay照合・集約束縛・パッケージ照合の検査範囲は従来どおり。
- **設計ゲートの所見を、より少ない規則IDで報告するようにした。** 写像の読込処理が拒否した内容は、`mapping-declarations.document`（または `mapping-declarations.model`、`domain-packaging.technical-name`）として、メッセージの先頭に読込処理自身の規則IDを付けて報告する。これに伴い、`mapping-declarations.duplicate`、`mapping-declarations.axes`、`mapping-declarations.aggregate-unmapped`、`reference-ids.missing`、および `ddd-mapping-declarations` の `domain-packaging.declaration`・`domain-packaging.duplicate`・`domain-packaging.coverage` は存在しなくなった。`ddd-rust-domain` からも `domain-packaging.duplicate` を削除した。
- **レイヤー宣言に対するリポジトリ命名規則の検査を廃止した**。`layer-structure.m-name` と `layer-structure.m-media` を削除する。宣言は言語を名指ししないため、特定言語の綴りの規約を宣言に対する規則としない。Rustソースのリポジトリ命名は、引き続き `ddd-rust-interface-adapter` の `m` 規則が検査する。
- **読み込めない写像が隣にある機能設計をブロックするようにした。** 写像が存在するのに現行形式で読めない場合、Process Manager要否を未評価のままにせず、その写像を対象として `mapping-declarations.document` を報告する。写像が存在しない場合は、従来どおり不在を注記するだけとする。
- **`ddd-layer-structure` が写像を読むのをやめた。** 集約のコードがどこにあるかは、その文脈が復元を担うかどうかを決めないため、文脈のすべての集約に復元経路が必要となる。
- Rustのモジュール配置検査の要否を、設定が名指しする言語から決めるようにした。Rustを名指しせず、Cargoマニフェストも `.rs` ファイルも持たないプロジェクトは検査対象がない。Rustを名指ししないのにいずれかを持つ場合は `module-layout.configuration` として報告する。
- 生成指示、センサーマニフェスト、ナレッジ、フィクスチャを同じ形式へ移行し、現時点で生成・検査の対象となる言語はRustだけであることを明記した。`functional-spec.md` のユースケース宣言はversion 1のまま。言語が綴る名前を持たないため。
- ファクトリ規則の業務エラーがまだないモデルは、それらを `missing-information` として報告し、変換しない。補ってから再実行すること。補われるまで、写像はその業務エラーを持たないモデルに対して検査されるため、その実行で `candidate` だった写像が、モデル補完後の再実行では写像自身のエラーケース不足を `missing-information` として報告することがある。移行後の記録は、それを拒否していたゲートが読む。

## 未リリース — 言語共通のレイヤー宣言

- `cicd-pipeline.md` の `## DDD Layer Structure` 節の `schema_version: 2` を追加。3つのcrateリストを、`command`・`query`・`rmu` の `role` を持つ1つの `packages` リストへ統合し、`crate_dependencies` を同じパッケージ識別上の `dependencies` へ移す。パッケージは、その名前を綴る言語と名前の組で識別する。文脈参照、cqrs、ポート、リポジトリ、復元経路、永続化基盤は変更しない。
- 宣言文書1件の読込処理を追加。crate固定のものを含む未知のキー、言語のないパッケージ識別、その言語で使えない名前、壊れた・他所属のモデル参照、structure・パッケージ・依存行・リポジトリ・復元経路の重複、文脈が宣言していないパッケージの依存行を拒否する。文脈の外のパッケージへの依存は書かれたとおりに保持する。正規モデルは `schema_version: 2` だけを読み、version 1の宣言を新形式として読むことはない。
- 読み込めた宣言に対して単独で実行できる構造検査を追加。必須項目、パッケージごとの依存行、cqrsの文脈におけるクエリ側、読み取りモデル更新を除いたcommand/query境界、両言語の綴りで判定するドメイン層パッケージへのクエリ側依存、集約ごとのfull-constructor復元経路を検査する。
- `ddd-layer-declaration.ts migrate --declaration <path> [--apply]` を追加。節の見出しの下のYAMLブロック1つを変換し、crate名、依存辺、ポート、リポジトリ、復元経路、永続化基盤をその記述言語のまま保持する。パイプラインの本文と隣のCI設定のフェンスはバイト単位でそのまま残す。crate形式が自動で補っていた値（`cqrs`、ポートの種別とverbs、リポジトリの入出力単位・verbs・保存意味、復元経路）は、文書が述べるまで `missing-information` として報告する。
- この段階では本番センサーと生成指示はversion 1のままとし、移行後の宣言は `layer-structure.item` として報告されていた。上記「ゲートが言語共通の成果物を読む」でversion 2を読むようになった。
- `functional-spec.md` のユースケース宣言はそのままにする。言語が綴る名前を持たないため、変換すべき形式版がない。
- 形式、検査、構造検査、コマンド、現在の適用範囲を[レイヤー宣言](docs/users/layer-declaration.ja.md)に記載。

## 未リリース — 予約パッケージ名を名前の全体で照合する

- crate名・パッケージ名と技術分類の予約名の照合を、語ごとではなく名前の全体で行うようにした。モジュール要素の照合と同じ扱いになる。**これまで拒否していた名前が読み込めるようになる。** `invoice-entities` や `invoice_entities` のように予約語で終わるだけの業務名は、`domain-packaging.technical-name` と `schema_version: 2` の写像読込のどちらでも受理する。
- `value-objects`、`ValueObjects`、`@acme/value-objects-domain`、`entities-domain`、`domain` だけの名前は引き続き拒否する。これらは名前そのものが技術分類である。
- これは[パッケージ設計](docs/users/domain-packaging-design.ja.md)が当初から記載していた挙動（部分文字列でも、名前に含まれる一語でも判定しない）であり、crate名・パッケージ名の検査がその記載に反していた。

## 未リリース — 言語共通の実装写像

- `ddd-aggregate-mapping.md` の `schema_version: 2` を追加。業務ID・業務語彙・実行モデル・永続化方式は各エントリの第1階層に残し、言語・パッケージ・モジュールの位置・型・ポート・リポジトリは `code` の下へ移す。各集約は、コマンドと生成操作をメソッドとエラー型へ、業務エラーをケースへ対応付ける。
- 写像文書1件の読込処理を追加。未知のキー、コンパイラID・ソース位置、その言語で使えない名前、壊れた・他所属のモデル参照、パッケージ・型・操作・エラーの写像の不足と重複、技術分類による業務パッケージ名を、RustとTypeScriptの両方で拒否する。正規モデルは `schema_version: 2` だけを読み、version 1の写像を新形式として読むことはない。
- `ddd-aggregate-mapping.ts migrate --mapping <path> [--supplement <path>] [--apply]` を追加。crate/module形式の写像1件を変換し、crate、モジュールの綴り、業務語彙、replayメソッド、実行モデル、永続化方式とその記述言語をすべて保持する。元の情報がない型・操作・エラーケースの名前は、補足入力のファイルで与えるまで `missing-information` として報告する。
- この段階では本番センサーと生成指示はversion 1のままとし、移行後の写像は `mapping-declarations.document` として報告されていた。上記「ゲートが言語共通の成果物を読む」でversion 2を読むようになった。
- 形式、検査、コマンド、現在の適用範囲を[実装写像](docs/users/implementation-mapping.ja.md)に記載。

## 未リリース — 正規モデルの操作ごとのエラー

- `ddd-domain-model-yaml.md` の `schema_version: 2` を追加。DomainErrorは所属を `operation` で名指しし、FactoryRuleは1件以上の `domain_errors` を自身で宣言する。
- 宣言された所属が包含元の操作であることを、コマンドと生成操作の両方で検査。生成操作のエラーを要素索引へ登録し、重複と壊れた参照も索引側で検出する。**新しい所属検査のうち2つは `schema_version: 1` にも適用する。** DomainError の `command` キーが包含元以外の操作を名指ししている場合（直し方: 包含元のコマンドを名指しする）と、生成操作のIDが包含元とは別の集約名を持つ場合（直し方: IDを `factory.<集約>.<操作>` へ直す）は、これまで読み込めていた旧形式のモデルが読込失敗になる。
- 形式は文書からの推測ではなく読込入口で指定する方式にした。この段階では本番センサーは引き続きversion 1を読み、移行後の文書を拒否していた。上記「ゲートが言語共通の成果物を読む」で、同じ読込入口がversion 2を指定するようになった。
- `ddd-domain-model.ts migrate --model <path> [--apply]` を追加。モデル成果物1件を変換し、業務ID・参照・条件本文とその言語をすべて保持する。生成操作のエラーが無い場合は捏造せず `missing-information` として報告する。
- 形式、検査、コマンド、現在の適用範囲を[操作ごとのエラー](docs/users/domain-model-operation-errors.ja.md)に記載。

## 未リリース — リポジトリ引数のgetter例外

- ユースケース層でgetterの値をリポジトリ引数へ渡す場合の誤検出を修正。不変のローカル変数を介した受け渡しも検査する。
- ポート型と宣言済みメソッドを照合し、業務判断・計算・加工や別の利用先がある場合は引き続き拒否。
- 生成用ナレッジと英日設計文書に例外と判定範囲を明記し、回帰ケースを追加。

## 未リリース — Rustモジュールの配置

- プロジェクト直下の `.ddd.toml` で `file` または `mod-rs` を必須選択とし、混在指定や未設定を拒否。
- code-generation・build-and-test・ci-pipelineに独立したblockingセンサーを追加。失敗や検査パッケージ0件で非0終了するCIコマンドも追加。
- ソース申告やドメインモデルに依存せず、所有Cargoパッケージとターゲットを検査。検査対象の各層で論理モジュールの解決を共通化。
- 設定、移行、制約を[配置契約](docs/users/rust-module-layout.ja.md)に記載。

## 未リリース — 導入・更新

- 標準compose hookを使用し、バイナリとcontributionを含めて変更を判定。
- 候補環境で合成・検証し、所有権を確認した差分を導入先へ反映。
- 新規導入・更新・dry-run・失敗時の保護を自動検証。
- インストーラの対象をClaude/Codexへ統一し、説明文を英語化。

## 未リリース — センサー契約の網羅性

- センサー×規則ごとに正常・異常・境界ケースを対応付け、英日対応表を生成。
- 依存規則の全方向・Cargo経路・外部I/O、予約名全件、モデル不正、見出し互換性のケースを追加。
- 形式不正な参照IDをmalformedとして判定。
- 通常承認で対象センサーの監査記録・所見・blocking/advisoryの挙動を確認。
- 契約の網羅性と英日見出しテストをtest:sandboxへ組み込む。

## 未リリース — 文書の言語配置（2026-09-13）

- knowledge、sensors、stages、contributionsを英語へ統一。
- 一般文書は英語の.mdと日本語の.ja.mdに本文を用意。aidlc/の記録は日本語を維持。
- 宣言セクションの英語見出しを追加し、既存の日本語見出しも受理。両言語で重複した宣言は拒否。

## 未リリース — T-07のパッケージング（2026-09-13）

- ユビキタス言語に基づく命名と技術分類の禁止を共有ナレッジ・設計・生成手順へ追加。
- 集約写像のdomain_packagesを必須化し、用語・モデル参照・配置理由を検査。
- 影響するドメインクレートのモジュールをたどり、空・インライン・path属性を含む宣言と実配置を照合。
- Claude/Codexの通常承認テストを追加。移行方法と限界は [契約](docs/users/domain-packaging-design.ja.md)へ記載。

## 未リリース — T-02のRust判定（2026-09-13）

- 集約とVO、具象ユースケースとポートを明示型で区別し、getter名の衝突も解消。
- 別ファイル・traitのimplを収集し、変更メソッドの所在を報告。
- replay_methodsによるreplay契約を追加し、メソッドとイベントを明示的に照合。
- 型照合の限界をnoteと[判定契約](docs/users/rust-sensor-contract.ja.md)へ明記。フレームワーク配布コードの変更なし。

## 未リリース — T-01の通常承認接続（2026-09-13）

- 正規モデルを標準の登録ファイル名へ統一し、ラベル付きYAMLを読み込む。
- 追加宣言を既存レビュー成果物の必須セクションへ移し、欠落も承認開始時に拒否する。
- Claude/Codexの統合テストを追加。単独完了の標準側の不足は別途再現・記録。

## 未リリース — 文書整理（2026-09-13）

- 設計規約・実測・残作業を分離し、[文書一覧](docs/README.ja.md)を追加。
- kimi・opencodeを対応対象から除外する方針を反映。コードの配布経路整理はT-04に残る。
- 失敗・再実行・イベント・RMUの説明と、ナレッジの検査範囲を訂正。
- 以下の0.1.0欄は当時の実装履歴。特に成果物登録を外した判断は、現在の承認接続を保証しない。[現状評価](docs/developers/current-state-assessment.ja.md)を参照。

## [0.1.0] - 2026-09-11

DDDプラグインの初回実装。正規モデルの専用ステージ1本、コアステージへのcontribution4本、センサー9本、ナレッジ8本を提供した。

### 追加

- **domain-modelingステージ**（`stages/inception/ddd-domain-modeling.md`）: inceptionのCONDITIONALステージ。イベントの発見から集約候補・自己点検までを扱い、正規のdomain-model.yamlと派生domain-model.mdを所有した。
- **contribution**: domain-designは正規モデルを読み集約写像を生成。functional-design、infrastructure-design、code-generationにも追加した。設計のcontributionは宣言手順と設計センサー、code-generationは命名・配置・実装規約とRustセンサー3本を接続した。
- **設計センサー**: ddd-model-completeness、ddd-model-presence、ddd-reference-ids、ddd-mapping-declarations、ddd-layer-structureはblocking、ddd-design-advisoriesはadvisory。
- **Rustセンサー**: ddd-rust-domain、ddd-rust-use-case、ddd-rust-interface-adapterはいずれもblocking。規則(a)〜(n)と依存検査(g)を実装した。
- **ライブラリ**: tools/ddd/lib/schemaは正規モデルのローダーと索引、workspaceはCargoの層判定、rustはtree-sitter-rustの構文情報、rulesは言語横断の規則定義とRust評価器、runtimeはセンサーの実行契約を担当。
- **ナレッジ**: knowledge/のshared、architect-agent、developer-agent、aws-platform-agent配下に8文書。
- **同梱資産**: web-tree-sitter@0.25.10（MIT）、tree-sitter-rust WASM（The Unlicense、ABI 14）、由来を記載したNOTICE。

### 補足

- Claudeでaidlc-plugin-test --installが成功。drops 0、ステージのグラフ搭載、2回目のcomposeの冪等性を確認した。
- produces成果物（ddd-aggregate-mapping）を追加したのはdomain-designだけだった。functional-design、infrastructure-design、code-generationはセンサーと手順のみを追加した。追加成果物が全Unit種別へ適用されると、種別で絞られたreview_artifactを持つコアステージのスキーマ検証に失敗するための当時の判断である。

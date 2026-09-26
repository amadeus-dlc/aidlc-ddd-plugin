# Rustの実行モデルと永続化方式の検証

[English](rust-execution-persistence-verification.md) | 日本語 | [開発者向け文書](README.ja.md)

検証日: 2026-09-25。基準コミット: `1621a6d657bccb2b9c0e1809f32c434c43f25bdd`。確認の再実行は 2026-09-26T00:06:29Z に完了しました。各実行の時刻は[実行記録](evidence/rust-execution-persistence-verification.json)にあります。

既存の試験・ゴールデンケース・検証シナリオが、Rustで `programming_model` × `persistence_method` のどの組み合わせを、どのモジュール配置で実際に判定しているかを記録します。既にあるものを洗い出した記録であり、規則を新設せず、判定も変えていません。どのケースも扱っていない組み合わせは未検証として記載し、対応済みとしては記載しません。

## 各軸を読むのはどこか

どのコードが各軸を読み、その値によって答えを変えるかを示します。4行のうち3行がその箇所を挙げており、2行目はRustビューが意図的に運ばない軸を記録したものです。この表は「検証済み」の判定基準ではありません。その語の定義は下の「限界」節に1つだけ置いており、軸がこの表のどこに届くかには依存しません。

| 軸 | 判定のために読む箇所 | 位置 |
|---|---|---|
| `programming_model` | 言語共通の宣言ゲートのみ。2つ以上の集約を対象とし、それがすべて `actor` であるユースケースに対して、複数集約の戦略としてProcess Managerを要求します。 | [`ddd-sensor-mapping-declarations.ts:75`](../../tools/ddd-sensor-mapping-declarations.ts)でMapを構築し、`:109-113`が条件（`:111`で `=== "actor"` を比較）、`:116`で `mapping-declarations.process-manager-required` を報告します |
| `programming_model`（Rustビュー内） | どこも読みません。Rustビューの型がこのフィールドを持たず、投影も写さないため、Rustソース規則からは読めません。 | [`rules/rust/mapping.ts:18-25`](../../tools/ddd/lib/rules/rust/mapping.ts)（型）、`:56-72`（投影） |
| `persistence_method` | Rustソース層。replay例外の成立条件として使います。`event-sourcing` 以外の値では例外が成立せず、メソッドは残りの分岐で順に分類されます。この例外が効く規則は1つではなく2つです。規則 `b` は分類が `undeclared` のときだけ報告し、規則 `c` は分類が `post-init` のときだけ `c-post-init` を報告します。`replay-exempt` はそのどちらの分類よりも先に決まるため、免除されたメソッドは両方から外れます。 | [`rules/rust/symbols.ts:128`](../../tools/ddd/lib/rules/rust/symbols.ts)（`!== "event-sourcing"` でfalseを返す。例外の他の成立条件は `:124-144`）。分類の順序は `:157`（集約の対応が曖昧なら `unknown`）、`:158`（`replay-exempt`）、`:159`（メソッド名が `POST_INIT` にあれば `post-init`。[`rules/lists.ts:7`](../../tools/ddd/lib/rules/lists.ts)）、`:160`（ドメインモデルを読めなければ `unknown`）、`:170`（`declared-command` か `undeclared`）です。消費側は規則 `b` が[`rules/rust/evaluators.ts:68`](../../tools/ddd/lib/rules/rust/evaluators.ts)、規則 `c` が `:127-139` です |
| `.ddd.toml` の `rust.module_layout` | モジュール配置検査のみ。Rustソースセンサーは、この設定ではなく写像とソースツリーからモジュールを解決します。 | [`module-layout/check.ts:151`](../../tools/ddd/lib/module-layout/check.ts) |

下の表で `actor` の行が宣言ゲートと写像の読込・移行の境界に置かれているのは、そこにしかケースが無いからです。集約に `actor` を宣言し、かつ同じ記録にRustソースを書くケースは1件も無いため、どの `actor` のケースもRustソース規則には届きません。そうしたケースを追加したときにRustソースの判定が変わるかどうかは別の問いで、答えも別です。変わりません。Rustビューがこのフィールドを落とすためです。本記録ではこの2つの事実のどちらも他方として扱っていません。

## 「両モジュール配置」は4つの別経路に分かれている

`.ddd.toml` と集約写像を同時に持つゴールデンケースの**定義**はありません。`.ddd.toml` を書くのはモジュール配置の群だけで（[`golden/module-layout/cases.ts:22`](../../tests/golden/module-layout/cases.ts)）、この群は意図的にソース申告もドメインモデルも持ちません（`:19`）。ただし、写像を持つケースの周囲にテスト側が `.ddd.toml` を置くことはでき、ゲート統合試験が実際にそうしています。そのため両配置の検証は4つの経路に分かれており、一方で検証された組み合わせが他方でも検証されたことにはなりません。

| 経路 | 何を持つか | 何を判定するか |
|---|---|---|
| (a) 配置検査 | 両方の宣言モードの `.ddd.toml`。写像は持たない | ソースツリーが宣言された配置と一致するか |
| (b) Rustソース規則 | 写像と実Rustソース。`.ddd.toml` は持たない | 物理的なモジュール配置（`src/<name>.rs`、`src/<name>/mod.rs`、`#[path]`）に対する規則の判定 |
| (c) 解決 | 写像・実ソース・配置設定を同時に持つ | 写像のモジュールが、そのパッケージの配置が置く場所で観測されるか |
| (d) ゲート統合 | 写像・実Rustソース・`.ddd.toml` を、本物のゲートへ通す | そのステージで適用されるセンサー集合全体が記録を受理するか拒否するか |

経路 (d) は[`t1-gate-integration.test.ts:288-313`](../../tests/t1-gate-integration.test.ts)です。`:300` で `layoutConfig("file")` の `.ddd.toml` を、`:306` でケースの写像を、`:307` でケースのRustソースを書き出し、本物のゲートを開きます。このフィクスチャは `ddd-*` のセンサーをすべて適用対象のまま残し（`:67-68`）、[`contributions/construction/code-generation.md`](../../contributions/construction/code-generation.md)が `code-generation` に対して `ddd-rust-module-layout` と `ddd-rust-domain` の両方を挙げているため、ここでは配置検査とRustソース規則が同一実行で判定します。扱うのは宣言された `file` 配置のみ、ケースも2件のみです。この試験は `PACKAGING_CASES` の4件（`:291-294`）を回しますが、うち2件 `clean-packaging-declarations` と `violation-packaging-technical-name` はこの層に到達しません。ステージが `domain-design` であり、そのセンサー集合（[`contributions/inception/domain-design.md`](../../contributions/inception/domain-design.md)）はRustセンサーを1件も含みません。またこの2件は `design()`（[`golden/packaging/cases.ts:83-94`](../../tests/golden/packaging/cases.ts)）が `DESIGN_CASES` のケースを複製したもので、`workspace` を持たないため `:307` は何も書き出しません。(d) の定義を満たすのは `clean-packaging-inline` と `violation-packaging-empty-inline` の2件で、これは下の該当行が根拠にしている2件と一致します。

## 検証済みの組み合わせ

(b) の配置は、ケースが書くモジュールの物理配置です。この層は配置設定を読まないためです。`violation-i-imported-use-case` だけは子ファイルをドメインクレートではなくユースケースクレートに置きます。他はドメインクレートに置きます。層 (b)・(c)・(d) の行の `programming_model` 列は、そのケースの写像が宣言した値であり、Rustソース規則が読む値ではありません。上の表の2行目が記すとおり、Rustビューがこのフィールドを落とすためです。

| `programming_model` | `persistence_method` | モジュール配置 | 層 | 根拠 |
|---|---|---|---|---|
| `class` | `state-sourcing` | クレートルート（子モジュールなし） | (b) | 既定のフィクスチャ写像 [`golden/package-fixture.ts:50-51`](../../tests/golden/package-fixture.ts)。自前の写像を持たないすべての `RUST_CASES` へ [`golden/rust/cases.ts:372-377`](../../tests/golden/rust/cases.ts) で注入されます |
| `class` | `state-sourcing` | `file` | (b) | `violation-b-split-impl`（[`golden/rust/t2-cases.ts:26`](../../tests/golden/rust/t2-cases.ts)、子のパスは `:27`）、`clean-b-split-command` `:39-40`、`violation-b-trait-impl` `:131-132`、`violation-d-split-getter` `:154`、`violation-i-imported-use-case` `:115`、`violation-a-d-module-file`（[`golden/rust/domain-facts-cases.ts:102`](../../tests/golden/rust/domain-facts-cases.ts)）、`clean-packaging-external-module`（[`golden/packaging/cases.ts:243-253`](../../tests/golden/packaging/cases.ts)） |
| `class` | `state-sourcing` | `mod-rs` | (b) | `violation-a-d-mod-rs`（`golden/rust/domain-facts-cases.ts:109-112`、`MOD_RS` は `:15`）、`clean-packaging-mod-rs`（`golden/packaging/cases.ts:255-258`） |
| `class` | `state-sourcing` | `file` と `mod-rs` が同じモジュールを主張する衝突 | (b) | `violation-packaging-ambiguous-source`（`golden/packaging/cases.ts:378-385`）が `domain-packaging.unresolved` を報告します |
| `class` | `state-sourcing` | `#[path]` | (b) | `clean-packaging-path-attribute`（`golden/packaging/cases.ts:267-273`）、`clean-packaging-path-child` `:462-472`、`violation-module-cycle`（[`golden/contract/cases.ts:244-252`](../../tests/golden/contract/cases.ts)） |
| `class` | `state-sourcing` | `file` と `mod-rs` を同一実行で | (c) | [`operation-error-set-languages.test.ts:428-460`](../../tests/operation-error-set-languages.test.ts)が両パッケージを扱い、`:462-469` と `:484-498` が `mod-rs` パッケージの合格側と違反側を扱います。パッケージと配置の対応表は[`operation-error-set-verification/scenario.ts:44-47`](../../tools/ddd/lib/operation-error-set-verification/scenario.ts)、写像は[`fixtures/operation-error-set/records/rust/inception/domain-design/ddd-aggregate-mapping.md:10-11`](../../tests/fixtures/operation-error-set/records/rust/inception/domain-design/ddd-aggregate-mapping.md)です |
| `class` | `event-sourcing` | クレートルート（子モジュールなし） | (b) | `clean-b-declared-replay`（`golden/rust/t2-cases.ts:48`、`persistence_method` は `:59`）と、読める `event-sourcing` 写像を保つ派生5件: `violation-b-replay-wrong-crate`（`:164`）、`-wrong-module`（`:165`）、`-unlisted-method`（`:166`）、`-duplicate-method`（`:167`）、`violation-b-replay-scalar`（`:189-194`）。この行の根拠にしない派生3件は下の注を参照 |
| `class` | `state-sourcing` | 宣言された `file` 配置とインラインモジュール | (d) | `clean-packaging-inline`（`golden/packaging/cases.ts:176-181`）と `violation-packaging-empty-inline`（`:129-134`）。`t1-gate-integration.test.ts:288-313` が本物のゲートへ通します。`mapping()` ヘルパーが `:63` で `class` を与え、replay が無いため `:64` で `state-sourcing` になります |
| `class` | `event-sourcing` | `file` | (b) | `clean-b-split-replay`（`golden/rust/t2-cases.ts:196-201`）。replayメソッドは子ファイル `src/operations.rs`（`:27`）にあります |
| `class` | `event-sourcing` | `#[path]` | (b) | `clean-packaging-path-replay`（`golden/packaging/cases.ts:438-453`）。`:445` の `replay` があることで `mapping()` が `:64` で `event-sourcing` を選びます |
| `class` | `event-sourcing` | なし（写像を読むだけでソースは検査しない） | 写像の読込 | [`rust-mapping-view.test.ts:83-93`](../../tests/rust-mapping-view.test.ts)、`persistence_method` は `:87` |
| `actor` | `state-sourcing` | なし（Rustソースを申告しない） | 宣言ゲート | `violation-process-manager-required`（[`golden/design/cases.ts:674-693`](../../tests/golden/design/cases.ts)。写像は `:682` で `actor` に置換され、`:131` で `language: rust` を持ちます）、`clean-actor-process-manager`（`golden/contract/cases.ts:85-108`）、`clean-multi-aggregate-mapping` `:337-341` |
| `actor` | `state-sourcing` | なし | 写像の読込・移行 | 正規形の写像は[`fixtures/aggregate-mapping/workspace.ts:404-405`](../../tests/fixtures/aggregate-mapping/workspace.ts)、旧形式YAMLは `:219-220`。移行結果は[`aggregate-mapping-migration.test.ts:121-123`](../../tests/aggregate-mapping-migration.test.ts)と[`artifact-set-migration.test.ts:209-211`](../../tests/artifact-set-migration.test.ts)で検証しています |

### `event-sourcing` × クレートルートの行が根拠にしない派生3件

`clean-b-declared-replay` の派生は `golden/rust/t2-cases.ts:162-203` に8件あります。そのうち3件は上の行を支持しないため、8件すべてを数えると根拠を過大に示すことになります。

| 派生ケース | その行の根拠にならない理由 |
|---|---|
| `violation-b-replay-state-sourcing`（`:163`） | 派生のタプルが `persistence_method: event-sourcing` を `state-sourcing` へ置換します。replay例外の成立条件そのものを識別する試験であり、写像は `event-sourcing` ではなく `state-sourcing` です |
| `violation-b-replay-unknown-event`（`:177-188`） | モデルが定義しないイベントをreplayが指すため写像全体が読めなくなります。`:175-176` のコメントが記すとおり、その結果どのreplayメソッドも免除されず、`event-sourcing` の値は規則へ届きません |
| `clean-b-split-replay`（`:196-203`） | `event-sourcing` は保ちますが、replayメソッドを子ファイルへ置くため、この行ではなく `file` 行の根拠です |

### どの試験がどの群を実行するか

ゴールデンの各群には、その群全体を実行する試験が1ファイルずつあります。個々のケースは名前を指定して別の場所からも実行されます。`t1-gate-integration.test.ts` は `:290-297` で `PACKAGING_CASES` の4件を、`:120` と `:151` で `DESIGN_CASES` のケースを実行し、[`install-sandbox.test.ts`](../../tests/install-sandbox.test.ts)は `:77` と `:423` で `DESIGN_CASES` のケースを実行します。`u4-golden.test.ts` は `:31` で `CONTRACT_CASES` と `PACKAGING_CASES` を規則の網羅確認のために読みますが、実行はしません。

| 群 | 実行する試験 |
|---|---|
| `RUST_CASES` | [`u5-golden.test.ts:13-18`](../../tests/u5-golden.test.ts) |
| `DESIGN_CASES` | [`u4-golden.test.ts:18-23`](../../tests/u4-golden.test.ts) |
| `PACKAGING_CASES` | [`t7-domain-packaging.test.ts:7-11`](../../tests/t7-domain-packaging.test.ts) |
| `CONTRACT_CASES` | [`t9-sensor-contract.test.ts:9-13`](../../tests/t9-sensor-contract.test.ts) |
| `MODULE_LAYOUT_CASES` | [`t10-rust-module-layout.test.ts:35-58`](../../tests/t10-rust-module-layout.test.ts) |

### 写像を持たずに両配置を扱う試験

次の試験はモジュール配置の設定を持ちますが、集約写像を宣言しないため、組み合わせを持たず、上の表に行がありません。その設定のどこまでに実際に到達するかは行ごとに異なり、群全体に共通する前提ではありません。行ごとの内訳は `配置` 欄にあります。上2行は宣言された両方の配置に到達し、3行目は `file` にしか到達しません。

| 試験 | 配置 | 写像 |
|---|---|---|
| `golden/module-layout/cases.ts` に対する `t10-rust-module-layout.test.ts:35-58` | `.ddd.toml` の両方の宣言モード | なし（`cases.ts:19`） |
| [`error-contract-rust.test.ts:123-158`](../../tests/error-contract-rust.test.ts)（実行は `:165-194`） | [`error-contract-verification/scenario.ts:16-19`](../../tools/ddd/lib/error-contract-verification/scenario.ts)により、`billing-domain` が `file`、`billing-use-case` が `mod-rs` | なし |
| [`scripts/verify-error-contract.ts`](../../scripts/verify-error-contract.ts) | `:128` に同じ配置表を持ちますが、2箇所の `inspect` 呼び出し（`:165-172`、`:186-193`）はどちらも `billing-domain` を指すため、`mod-rs` の分岐には到達しません | なし |

## 未検証の組み合わせ

次の組み合わせを扱うケースはありません。未検証として記録します。いずれもどの文書でも対応済みとしては記載していません。

| `programming_model` | `persistence_method` | モジュール配置 | 未検証である理由 |
|---|---|---|---|
| `class` | `event-sourcing` | `mod-rs` | 両者を組み合わせたケースは、この結論が拠る2つの走査のどちらから見てもありません。2つの走査は探すものが異なります。1つめは、`tests/` で `event-sourcing` を宣言する写像です。このうちRustソースツリーを伴うのは2件で、`golden/rust/t2-cases.ts:59` はモジュールがクレートルート（`:66`）、派生の `clean-b-split-replay` だけが `:27` の `file` の子です。`golden/packaging/cases.ts:64` で `replay` を持つケースは `clean-packaging-path-replay`（`:438-453`、`replay` は `:445`）の1件だけで、`#[path]` の先に置かれています。残る5件は、Rustソースを1件も書かない写像文書で値を宣言するため、物理配置を主張しません（`rust-mapping-view.test.ts:87`。その `viewOf`（`:58-67`）は記録ファイルだけを書きます。`fixtures/aggregate-mapping/workspace.ts:210` と `:368`、`aggregate-mapping-migration.test.ts:109`、`artifact-set-migration.test.ts:197`）。さらに残る1箇所 `golden/rust/t2-cases.ts:163` は、値を宣言する写像ではなく、値を取り除く派生の置換タプルです。2つめは、`tests/` で集約写像を持つケースが `mod.rs` へ書くモジュールです。ここでの「モジュール配置」は上の表と同じ意味、すなわちケースが書くモジュールの物理配置を指します。集約写像を持たずに `mod.rs` を書くケースは `persistence_method` を宣言しないため、`event-sourcing` と組み合わさることがなく、この走査の対象外です。`golden/module-layout/cases.ts` のモジュール配置の見本（`:19` にドメインモデルを持たないと明記）、`t10-rust-module-layout.test.ts`、`error-contract-rust.test.ts` がこれにあたります。対象は4件あります（`golden/rust/domain-facts-cases.ts:109-112`、`MOD_RS` は `:15`。`golden/packaging/cases.ts:255-258`。`golden/packaging/cases.ts:378-380`（`mod.rs` の隣に `invoice.rs` を残す衝突ケース）。`operation-error-set-languages.test.ts:419`）。4件とも `state-sourcing` であり、2つの集合は交わりません。なお4件のうち3件では、写像が宣言する集約自体はクレートルートにあり（`golden/package-fixture.ts:53`、および `golden/packaging/cases.ts:22-27` の `ROOT_PACKAGE` を `:68` で消費。いずれも `module: []`）、`mod.rs` に載るのは申告済みのソースファイルか、写像されたドメインパッケージです。写像された集約自身のモジュールが `mod.rs` に置かれるのは `operation-error-set-languages.test.ts:419` の1件だけで、その写像も `state-sourcing` です（`fixtures/operation-error-set/records/rust/inception/domain-design/ddd-aggregate-mapping.md:10-11`）。したがって、集約自身の配置という狭い読み方をしても欠落は変わりません。 |
| `actor` | `state-sourcing` | `file` または `mod-rs` | 集約に `actor` を宣言し、かつ同じ記録にRustソースを書くケースが1件もありません。`tests/` にある `actor` の宣言は下の行に挙げたものがすべてで、そのいずれの記録も `.rs` ファイルを1件も持たないため、宣言ゲートか写像の読込・移行の境界までで止まります。別の理由による別の事実として、そうしたケースを追加しても、どのRustソース規則も上の `class` の行と異なる答えは出しません。Rustビューが `programming_model` を落とすためです（`rules/rust/mapping.ts:18-25`、`:56-72`）。組み合わせを通すこと自体は試験ですが、この軸でRustソースの判定を変えることは判定の変更です。 |
| `actor` | `event-sourcing` | 任意（どの層でも） | この組を宣言するケースが1件もありません。`tests/` にある `actor` の宣言はすべて `state-sourcing` です（`golden/design/cases.ts:682`。元は `:128` の `state-sourcing`。`fixtures/aggregate-mapping/workspace.ts:219-220` と `:404-405`、`aggregate-mapping-migration.test.ts:121-123`、`artifact-set-migration.test.ts:209-211`）。残る1箇所 `aggregate-mapping-migration.test.ts:395` は `programming_model` を設定する補足行であり、`aggregate-mapping.unknown-key` で拒否されるため、受理された写像を生みません。 |

## 限界

- これは1コミット時点での既存試験の洗い出しであり、網羅の保証ではありません。スクリプトで再生成されるものではなく、ケースと突き合わせる検査もないため、後から追加されるケースで自動更新されることはありません。
- ここでの「検証済み」は、その組み合わせをケースが通していることを意味し、組み合わせが完全に規定されていることを意味しません。[ドメイン層設計](domain-layer-design.ja.md)が述べるとおり、方式別の詳細検査は未完成であり、宣言だけでコード形状が保証されたとは扱いません。
- `programming_model` と `persistence_method` は独立した選択です（[ユースケース層設計](use-case-layer-design.ja.md)）。上記の欠落は試験の欠落であり、その組み合わせが非対応または不正であるという主張ではありません。
- 宣言された配置と写像された集約を同時に持つゴールデンケースの**定義**はありません。写像・実ソース・配置設定を同時に持つのは (c) と (d) で、どちらも扱うのは `class` × `state-sourcing` のみです。(c) は上の行が記すとおり宣言された `mod-rs` 配置を写像と並べて持ちますが、その設定を使うのは写像のモジュール所在の解決だけで、配置検査は実行しません。`checkModuleLayout`（[`module-layout/check.ts:85-88`](../../tools/ddd/lib/module-layout/check.ts)）が受け取るのは抽出器・プロジェクトルート・予算コールバックだけで、写像は受け取りません。出荷側の呼び出し元は[`ddd-check-rust-module-layout.ts:11`](../../tools/ddd-check-rust-module-layout.ts)と[`ddd-sensor-rust-module-layout.ts:15`](../../tools/ddd-sensor-rust-module-layout.ts)で、それ以外の呼び出しは `t10-rust-module-layout.test.ts` の直接呼び出し（`:68`・`:75`・`:80`・`:87`・`:226`・`:266`・`:414`）のみです。これらは経路 (a) にあたり写像を持ちません。`operation-error-set-verification` はそのいずれにも含まれません。配置検査とRustソース規則を写像に対して同一実行で走らせるのは (d) だけであり、そこで扱うのは宣言された `file` 配置と、上で挙げたパッケージングの2ケースにとどまります。したがって、宣言された `mod-rs` 配置のもとで配置検査を写像と同時に走らせる経路はありません。
- `scripts/verify-error-contract.ts` の `mod-rs` 分岐は上記のとおり未到達です。その解消は業務エラー契約の経路に属し、本記録の対象ではありません。
- すべての実測は `darwin-arm64` で、証跡に記録したバージョンで行いました。

## 再実行して結果を確認する

リポジトリのルートから実行します。

```sh
cd ddd
bun install --frozen-lockfile
bun run check
```

`bun run check` はCIワークフローが使う入口と同じです。上記の組み合わせを判定する試験だけを再実行する場合は次のとおりです。

```sh
cd ddd
bun run prepare:native
bun test tests/u5-golden.test.ts
bun test tests/t7-domain-packaging.test.ts
bun test tests/u4-golden.test.ts
bun test tests/t9-sensor-contract.test.ts
bun test tests/t10-rust-module-layout.test.ts
bun test tests/operation-error-set-languages.test.ts tests/error-contract-rust.test.ts
bun test tests/rust-mapping-view.test.ts
bun test tests/aggregate-mapping-contract.test.ts tests/aggregate-mapping-migration.test.ts tests/artifact-set-migration.test.ts
bun test tests/t1-gate-integration.test.ts
bun run verify:operation-error-set
```

`tests/t1-gate-integration.test.ts` が経路 (d) であり、この中で最も時間がかかります。`bun test tests/` は47のテストファイルすべてを対象にするため、`bun run check` にはこれも含まれています。

[実行記録](evidence/rust-execution-persistence-verification.json)と[残作業](completion-tasks.ja.md)を参照してください。

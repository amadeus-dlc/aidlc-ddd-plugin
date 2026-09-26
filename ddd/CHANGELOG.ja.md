# Changelog

[English](CHANGELOG.md) | 日本語

dddプラグインの主な変更を記録します。形式は[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)に従います。

## 未リリース — ゲートが言語共通の成果物を読む

- **規則 `a`・`d` を判定するゲートは、属性マクロの可能性がある属性を合格させず停止するようにした。** 属性マクロは注釈した項目を置換するため、規則 `a` が報告する公開メンバーや、規則 `d` が報告する getter を追加しうる。従来そうした項目は所見なしで合格していた。ネイティブ抽出器は、組込みでもなく、同じ項目の derive の補助属性として許可リストに載ったものでもない属性をすべて、理由 `attribute-macro` の `unresolved` として、その `#` がある行で記録し、`conditional-compilation` と同じ経路で報告する。許可リストの内容は、`Serialize` と `Deserialize` が宣言する `serde` と、`Default` が宣言する `default` の2行である。そのため、serde のこれらの derive を持つ struct・enum・union（そのフィールドとバリアントを含む）に付いた `#[serde(...)]` と、`Default` を derive した enum のバリアントに付いた `#[default]` は記録せず、対応する derive を持たない項目に付いた同じ補助属性は記録する。`ddd-rust-domain` と `ddd-rust-use-case` は、規則 `a`・`d` の判定元となるファイル（申告ファイルと、プログラム層の全クレートの全ソース。インライン `#[cfg(test)]` モジュールを含む）にその記録があれば、検査不能として停止する。終了コードは 127 で、verdict は返さず、各記録を stderr に示す。それ以外のファイルでは `domain-facts.unresolved` の note にとどめてゲートは verdict を返し、どちらの規則も判定しない `ddd-rust-interface-adapter` も note にとどめる。derive と許可リストの補助属性だけが付いた項目は、従来どおり判定する。`cfg_attr` が適用する中身は `conditional-compilation` の記録にとどまる。protocol は `protocol_version` 7 になり、6 を答えるままの導入先は `native-extractor:protocol-mismatch` として受け付けない。ゴールデンの期待値は変更していない。組込みでない属性マクロを誰も報告しないことを確かめていた回帰試験1件は、式の位置のマクロだけを対象にした。[属性マクロの扱い](docs/developers/rust-syn-spike.ja.md#属性マクロの扱い)と[判定が変わった範囲](docs/developers/rust-syn-spike.ja.md#判定が変わった範囲)を参照。
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

# DDDプラグインの残作業と完了条件

[English](completion-tasks.md) | 日本語

更新: 2026-09-13。[実装調査](current-state-assessment.ja.md)と対応環境方針に基づき、残作業をT番号で管理する。

文書整理とT-01の通常承認への接続を実装した。T-02のRust判定、T-07のドメインパッケージング、T-08のRustモジュール配置検査も実装した。単独完了の標準側の不足、T-03、T-05のモデル実行、T-06の最終照合は残る。

[合意した言語共通の設計](language-independent-design.ja.md)に基づき、T-09〜T-11を追加する。これらは実装予定であり、完了済み機能ではない。

## 完成対象

Claude CodeとCodex上で、共通のDDD契約、Rustの改善、成果物の移行を先に完成させ、続いてTypeScriptへ対応する。kimi・opencodeは対応対象から外し、両環境のためのカスタムビルドも維持しない。そこで使いたかったモデルは、ユーザー方針としてOllama CloudのClaude Codeブリッジ経由で利用する。ブリッジ自体の導入は本プラグインの作業に含めない。他環境への拡大も今回の完成条件に含めない。

完成には、静的検査・既存テストの成功に加え、以下を要求する。

- 必須成果物が欠落または不正なら、通常承認と単独ステージ完了が通らない。
- 正常なVO引数・ポート利用が通り、別ファイルの未宣言変更を見逃さない。
- Claude/Codexのビルド・compose・配布物検査・新規導入・更新を確認する。
- ナレッジ、設計、生成手順、実測が、検査の保証範囲について一致する。

## T-01: 成果物を通常承認・単独完了に接続する

状態: プラグイン側の通常承認への接続は実装済み。標準AI-DLCの単独完了ガードが不足するため、T-01全体は未完了。優先度: 最優先。根拠: F-01/F-02。

正規モデルは標準のMarkdownファイル名へ統一した。ユースケース宣言と層構造宣言は既存レビュー成果物の必須セクションにし、既存のUnit種別を引き継いだ。形式・移行・検証範囲は[成果物契約](../users/artifact-contract.ja.md)を参照。

対象: `stages/`、`contributions/`、`sensors/`、モデルパス解決、統合テスト。標準AI-DLCの拡張契約で表せる方式を先に調べる。コアへの場当たり的な名前変換パッチを前提にしない。

完了条件: compose後のグラフ、実ファイル、`matches` が一致する。欠落・不正・正常の各ケースを承認処理経由で確認し、単独実行も同じ成果物を検証する。Unit種別ごとの対象外ケースも確認する。センサーの直接実行だけで完了にしない。

残る作業: 標準の `report --single` が一般成果物とセンサーを検証するよう共通処理を修正・再検証する。プラグインだけで検査省略を防げるとは扱わない。

依存: 単独完了の保証は標準AI-DLC側の修正。

## T-02: Rustセンサーの誤検知・見逃しを修正する

状態: 実装済み。F-03〜F-06を修正し、getter・別名・trait等の回帰ケースも追加した。[判定契約と限界](../users/rust-sensor-contract.ja.md)を参照。

| 修正 | 必須の回帰ケース |
|---|---|
| h: 集約とVOの区別 | VO引数は成功、集約引数は失敗 |
| i: 別ユースケースとポートの区別 | ポートのexecuteは成功、別ユースケース呼出しは失敗 |
| b: ファイルを跨ぐ型とimplの収集 | 別ファイルでも未宣言変更を検出 |
| replay例外の限定 | 正当なreplayは成功、名前をapplyにした任意代入は失敗 |

getter名の衝突、型の別名・修飾名、trait経由の変更、VOの可変性も調べ、追加検査または明示的制約へ分類する。推測だけでblockingを出さない。

完了条件: 再現ケースと正常ケースがソース・配布物の両方で通り、どの構文を確定的に判定できるか文書化される。一般的な意味証明は要求しない。

replayの明示方式は集約写像のreplay_methodsとして実装した。T-03にはメソッド本体の意味と戻り値・回復契約を残す。

## T-03: 未確定の実装契約を決め、生成手順へ反映する

状態: メソッド・生成時エラーの共通方針は合意済み。残る判断と実装は未完了。優先度: 高。

[ドメイン](domain-layer-design.ja.md)、[ユースケース](use-case-layer-design.ja.md)、[インターフェイスアダプタ](interface-adapter-layer-design.ja.md)の改訂規約を設計入力とする。

replayの明示方法はT-02で決定済み。残る項目は、初回成功・重複成功・拒否の戻り値、複数イベントの扱い、actor/class混在フローの回復宣言、写像欠落時の検査契約。再送期間・RMUの順序条件等を構造化データへ追加するか、本文レビューに置くかも決める。

既存contributionのclass＝再実行限定、全保存方式＝upsertという指示を見直す。ローダー、JSON Schema、生成手順、センサーの追加・変更が必要なら一体で実装する。生成時のエラー集合とメソッド固有の戻り値エラー検査は、共通設計とT-09/T-10の必須事項とする。FactoryRuleの意味的な証明や内部可変性の全検出は別途扱い、レビューと生成コードの動作テストも維持する。

完了条件: 未確定項目ごとに判断と適用範囲があり、実装・宣言・手順の差分が解消する。失敗・再送・重複時の期待結果を具体例とテストで説明できる。

依存: T-01の成果物契約と調整する。

## T-04: 対応環境のビルド・検証経路

状態: 完了。Claude/Codexの現行ツールにビルド・導入・検証経路を統一した。

`framework-compatibility.test.ts` は、両環境へのcompose、グラフ生成、再composeの冪等性を確認する。T-04の測定時点では、全体チェックが726成功・3skip・0失敗だった。skipは標準側の単独完了ガードの任意再現1件と、任意のネットワーク導入2件である。

モデルへの実際のルール到達確認はT-05で扱う。

## T-05: 新規導入・更新と実際の利用経路を検証する

状態: 導入・更新CLIの機械的検証は完了。モデルによる実際のステージ実行・ルール到達は未確認。優先度: 高。

Claude/Codexの新規導入、再導入、通常更新、contributionのみの更新、dry-run、失敗時の保護、所有権、配布対象から外れたファイル、取得指定を自動検証した。ローカル45件とGitHub mainの実取得2件が成功。[検証契約](installation-verification.ja.md)に範囲と実測を記載した。

残る作業: 現行AI-DLCから担当モデルへDDDルールが届き、設計成果物を引き継いで生成・レビューできることを実機確認する。センサー・compose・CLIの成功を、モデル実行の実証とは扱わない。

完了条件: モデル実行を含む利用経路の対象バージョン・結果・未検証範囲を記録する。

依存: T-01〜T-04。

## T-06: 文書・ナレッジと完成時の実測を最終照合する

状態: 文書の旧前提・誤認・重複は整理済み。実装修正後の照合は未完了。

設計規約と現行実装の区別、検査範囲、例の根拠、対応環境を再確認する。既存の正常ケースが対象構造を持たない場合は、その構造の正しさを示す例として扱わない。README、ナレッジ、必要な生成手順、プラグイン説明を揃える。実行用の指示は英語、一般文書は英語.mdと日本語.ja.mdの本文を用意し、aidlc/の記録は日本語を維持する。

完了条件: 共通の判断と、そのリリースに含めるタスクの実測に文書が一致し、リンク切れや現在は使えない手順がない。過去の失敗は履歴として残し、成功の捏造や書換えをしない。

依存: 各リリースに含めるタスク。最初のリリースではT-09/T-10、次のリリースではT-11も照合する。

## T-07: 業務語彙によるドメイン層のパッケージング

状態: 実装済み。[パッケージング契約](../users/domain-packaging-design.ja.md)に宣言・検査範囲・意味レビューの分担を記載した。

aggregate/、impl/、vo/、entities/等の技術分類を避け、パッケージ名をユビキタス言語へ結び付ける。ナレッジで原則を共有し、domain-designで語彙と配置を宣言、code-generationで実体を検査する。物理配置を正規モデルへ混ぜない。

登録済み集約写像へdomain_packagesを追加し、用語・モデル参照・配置理由を必須にした。予約名、root・親階層、実モジュールの宣言漏れ、解析不能を検査する。未実装の将来パッケージは宣言だけ先行できる。直接回帰55件とClaude/Codexの通常承認8件が成功した。

完了条件: 業務語彙の正常例が通り、技術分類・未宣言・参照切れ・配置不一致を検出する。インラインmodと外部所有の参照を区別し、意味的な命名判断を機械で断定しない。通常承認と配布物のテストを追加する。

依存: T-02のモジュール索引を利用できる。第三者フレームワークの変更は前提にしない。

## T-08: Rustモジュールのファイル配置を統一する

状態: 実装済み。[配置契約](../users/rust-module-layout.ja.md)に、プロジェクト直下の設定、file/mod-rsの規約、検査範囲、移行手順を定義した。

所有するCargoパッケージとターゲット全体に、`.ddd.toml` の明示的な方針を適用する。未設定、混在指定、下位での上書き、配置違反、解析不能・未登録のソースを拒否する。検査対象の各層で、宣言をたどるモジュール解決を共通化した。Cargoのeditionと配置方針は別に扱う。

専用センサーをcode-generation・build-and-test・ci-pipelineの承認へ登録した。CIコマンドは同じ検査を使い、失敗または検査パッケージ0件で非0を返す。追加指示では、生成するパイプラインに必須検査を組み込み、単独ステージで直接実行するよう定めた。プラグイン導入だけで外部CIが設定されたり、標準側の単独完了ガードが修正されたりはしない。

両形式、ソース申告・モデルからの独立性、テストと他の層、名前変更・削除後の残骸、明示パス、設定不正、Cargoターゲット、センサーとCLIの判定、両配布物、両環境の通常承認を検証する。[対応表](sensor-coverage.ja.md)と[検証記録](evidence/module-layout-verification.json)を参照。

## T-09: 共通契約を定義し、成果物を移行する

状態: 仕様は合意済み、実装は未完了。最初のリリースまでに完了する。[共通設計](language-independent-design.ja.md)を参照。

T-09は[親Issue #34](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/34)で管理する。親全体を一つのintentとして開始せず、子Issueごとに`plugin-dev`のintentを作る。各子Issueに限定した成果・対象外・試験・文書を持たせ、全体の契約と前提関係は親で維持する。

| 子Issue | 単独で完成させる成果 | 必須の先行Issue |
|---|---|---|
| [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38) | Rust/TypeScriptで状態公開の一規則を共通判定 | なし |
| [#39](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/39) | プロジェクト設定と旧Rust設定の移行 | [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38) |
| [#40](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/40) | Rustの限定した戻り値・エラー参照解決 | [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38)、[#39](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/39) |
| [#41](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/41) | TypeScript Compiler APIによる戻り値・エラー参照解決 | [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38)、[#39](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/39) |
| [#42](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/42) | 正規モデルの操作・生成時エラーと移行 | なし |
| [#43](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/43) | 集約・業務パッケージ・操作の実装写像と移行 | [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38)、[#42](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/42) |
| [#44](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/44) | レイヤー宣言の移行とユースケース宣言の互換確認 | [#43](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/43) |
| [#45](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/45) | 操作・生成時エラー集合の共通照合 | [#40](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/40)、[#41](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/41)、[#42](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/42)、[#43](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/43) |
| [#46](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/46) | 新成果物の利用経路接続・一式移行・既存経路検証 | [#39](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/39)、[#42](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/42)、[#43](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/43)、[#44](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/44)、[#45](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/45) |

最初は#38を実行し、状態公開の一規則・両言語・正常／違反／検査不能までに絞る。移行、パッケージ横断の参照解決、エラー集合照合は含めない。#42も独立して開始できる。表は必須の依存関係を示し、すべてを行順に実行する指定ではない。

各子Issueは実装2〜3 Unitを目安とし、開始前に範囲を確認する。新要件は親へ明示的に記録し、進行中のintentの完了条件へ暗黙に追加しない。個別の読込・変換は最終切替前にも検証可能にする。#46は完成した成果物処理を接続し、形式の再設計や本番ソース解析器の置き換えを含めない。T-09の完了とは別に、T-10/T-11とリリースの完了条件を維持する。

パッケージ、型、メソッド、エラー、検査の共通契約を定義し、言語固有情報は実装写像で保持する。生成時エラーの宣言とエラー所属の一致検査を追加する。設定・成果物のバージョンを定義し、既存Rust成果物の明示的な移行コマンドを実装する。一意に変換できる情報を移し、不足した業務定義はモデルの所有者が補完できるよう報告する。

RustとTypeScriptの比較シナリオを先に定義する。最初のリリースに十分な共通契約と判断する前に、TypeScript Compiler APIを使う小さな実装で共通部分を試す。プロジェクト設定とAST・型情報を使い、コンパイラ固有のオブジェクトを共通契約へ持ち込まない。正規モデル、ローダー・スキーマ、生成指示、移行済みテスト入力を揃える。

[共通検査契約の設計](inspection-contract-design.ja.md)を実装し、Rust＋synの限定したアダプタでも検証する。スナップショットに結び付く識別、解決済み・不在・未解決、完全・不完全な集合、規則ごとの結果、操作・エラーの所属を、同等のTypeScriptケースと比較する。構文解析の試作だけでは共通の参照解決・判定契約を検証したことにならない。最初のリリースに十分と判断する前に、より深いRust意味解析が必要な想定利用ケースを特定する。

完了条件: 共通契約が具体化され、移行で業務の識別と意味を維持し、不完全な入力を報告できる。両言語で契約を試した証跡がある。TypeScriptセンサーの全面対応は、このタスクの完了とは区別する。

## T-10: Rustを共通契約へ適合させる

状態: 作業方針は合意済み、実装は未完了。T-09に依存し、T-01/T-03/T-05/T-06と調整する。最初のリリースに含める。

[試作](rust-syn-spike.ja.md)を踏まえ、Rust＋synの採用方針は承認済み。[検査設計](inspection-contract-design.ja.md)に従い、Rustのネイティブ解析基盤と参照解決の境界を実装する。T-10-01で抽出器を製品パスへ移し配布を確立し、T-10-02で規則`a`・`d`の判定をその事実へ移して、再現した公開タプルフィールドと明示的なreturnを持つgetterの見落としを解消し、起動できない場合はこの2つのゲートを停止するようにした。T-10-03では`ddd-rust-domain`が報告する残りの規則（`b`・`c`・`g`・`domain-packaging.*`）を、その土台となる宣言索引、型解決、依存辺、パッケージ・モジュール解決とともにその事実へ移し、これによりモジュール走査とそのCI用入口も抽出器で判定するようになった。T-10-04では、`ddd-rust-use-case`と`ddd-rust-interface-adapter`だけが報告する4件の列挙（`h`・`l`・`m`・`n`）を`protocol_version` 6のもとでその事実へ移した。これにより両ゲートが報告するすべてのrule_idがその事実で判定され、出荷されるRustソースセンサーのうちモジュール配置検査以外はすべて共通契約に載った。モジュール配置検査そのもの（T-10-05）、tree-sitter資産の削除（T-10-06）、全センサーの互換性、対応環境ごとの配布は未完了であり、試作でもT-10-04でもT-10が完了したわけではない。

ホストとパッケージの分離、可視性と依存方向、明示的な公開、メソッド固有のエラー型・集合、生成メソッドの写像、検査不能時の承認停止を改善する。infrastructure、ホスト、可変参照の分離、既存の変更・生成検査の範囲も点検する。Rustの現状を完成仕様とせず、不足を修正する。

T-10-04では、この5領域について現在の判定の不足を洗い出した。次の不足はT-10-04では修正せず、ここに記録する。いずれも所見を増減させるか、どの規則もまだ読んでいない宣言形式・層・別protocolを接続するものであり、判定入力の差し替えには当たらず、同intentの成果にも不要だった。

| 領域 | 不足 | 位置 | T-10-04で閉じない理由 |
|---|---|---|---|
| ホストとパッケージの分離 | 配置走査がgrouping rootとして`packages`と`modules`のみを認識するため、`apps/`や`workers/`のホストが層に割り当たらない。libターゲットを持ち層suffixのないホストは`layer.unknown`になる。 | [`workspace/resolver.ts`](../../tools/ddd/lib/workspace/resolver.ts) | 層割当規則そのものの変更であり、判定入力の追加ではなく規則の新設にあたる。 |
| ホストとパッケージの分離 | レイヤー宣言の形式にホストのroleがなく（`command`／`query`／`rmu`のみ）、「パッケージはホストへ逆依存しない」を宣言側で検査できない。 | [`layer-declaration/contract.ts`](../../tools/ddd/lib/layer-declaration/contract.ts)、[`layer-declaration/inspection.ts`](../../tools/ddd/lib/layer-declaration/inspection.ts) | 公開契約である宣言形式の変更を伴う。 |
| ホストとパッケージの分離 | ホストとinfrastructureが検査対象プログラムに含まれず抽出器へも渡らない。申告されても`skipped`になる。 | [`rules/rust/program.ts`](../../tools/ddd/lib/rules/rust/program.ts)、[`rules/context.ts`](../../tools/ddd/lib/rules/context.ts) | 検査対象の拡大であり、新しい判定対象の追加にあたる。 |
| 可視性 | protocolは名前付きフィールドにのみ`visibility`を持ち、型・trait・メソッド・`use`・alias・moduleには持たない。 | [`domain-facts/index.ts`](../../tools/ddd/lib/rust/domain-facts/index.ts) | T-10-04で移行した規則はいずれも可視性を読まないため、どの規則にも不要だった。 |
| 可視性 | 運ばれている可視性の唯一の消費者`non_private_field_lines`に読み手がいない。 | [`rules/rust/symbols.ts`](../../tools/ddd/lib/rules/rust/symbols.ts)、[`rules/types.ts`](../../tools/ddd/lib/rules/types.ts) | T-10-04以前から未使用であり、削除はこの変更の帰結ではない。 |
| 明示的な公開 | `pub use`と`use`を区別できない。importの可視性は行の算出にのみ読まれる。 | [`domain_facts.rs`](../../experiments/rust-syn/src/domain_facts.rs)、[`domain-facts/index.ts`](../../tools/ddd/lib/rust/domain-facts/index.ts) | 区別する規則が現在なく、接続は規則の新設にあたる。 |
| 明示的な公開 | 規則`l`は最後の`::`より後ろの字面でimportを照合するため、パスがドメイン型の名前だけで終わる場合しか見ない。glob再公開（`use a::*`）はnoteなしで落ち、別名（`use a::Invoice as Bill;`）と複数名グループ（`use a::{Invoice, Ledger};`）はいずれも何にも一致しない最終セグメントを残す。query側がこの3形式のいずれかでドメイン型を取り込む場合を見ない。 | [`rules/rust/program.ts`](../../tools/ddd/lib/rules/rust/program.ts)、[`rules/rust/evaluators.ts`](../../tools/ddd/lib/rules/rust/evaluators.ts) | 従来出なかった所見が出るため、入力の変更ではなく結論の変更になる。 |
| メソッド固有のエラー型・集合 | `error-contract/1`（`protocol_version` 3）と操作エラー集合の照合が、どのセンサーにも、両ゲートのどのrule_idにも接続されていない。 | [`operation-error-set.md`](operation-error-set.ja.md)、[`sensors/`](../../sensors) | 接続は新しい検査の追加にあたる。 |
| メソッド固有のエラー型・集合 | Rust規則が読む写像viewが`operations`を落とすため、宣言された`code.error_type`とそのエラー集合が規則へ届かない。 | [`rules/rust/mapping.ts`](../../tools/ddd/lib/rules/rust/mapping.ts) | 同様に、規則へ届けることは判定内容の変更にあたる。 |
| 生成メソッドの写像 | 宣言されたfactoryの`code.method`が規則`n`へ届かず、コンストラクタはRust側の推定のみで決まる。 | [`aggregate-mapping/contract.ts`](../../tools/ddd/lib/aggregate-mapping/contract.ts)、[`rules/rust/mapping.ts`](../../tools/ddd/lib/rules/rust/mapping.ts) | 宣言由来の束縛は規則`n`の結論を動かす。 |
| 生成メソッドの写像 | `constructors_by_type`が型名のみをキーにするため、別クレート・別モジュールの同名型がコンストラクタ集合を共有する。 | [`rules/rust/symbols.ts`](../../tools/ddd/lib/rules/rust/symbols.ts) | 結論を変える。T-10-04は記号表を変更していない。 |
| 生成メソッドの写像 | 規則`n`は修飾パスの構築箇所をnoteなしで落とすが、`d`・`h`・`i`は`syntax.unresolved`を残す。 | [`rules/rust/evaluators.ts`](../../tools/ddd/lib/rules/rust/evaluators.ts) | noteの追加は出力の変更。T-10-04は同じ構築事実を保つ。 |
| 生成メソッドの写像 | 宣言側の復元経路（`layer-structure.n`）とコード側の規則`n`が突き合わされない。 | [`layer-declaration/inspection.ts`](../../tools/ddd/lib/layer-declaration/inspection.ts) | 新しい突き合わせは規則の新設にあたる。 |
| 生成メソッドの写像 | 宣言の走査は、項目や構築が立ちうる位置のすべてには届かない。そのためT-10-04が移した4件の列挙は、届かない位置にあるものを取り落とす。以下は現時点で確認できた位置であり、網羅ではない。traitの関連定数の既定値では、構築は`n`から、そこのブロックが宣言する項目は`m`（`struct`）・`l`（`use`）・`h`（自由関数）から見えない。置き換えたtree-sitterの列挙は、この位置ではいずれも記録していた。残りは、結論が動いた範囲としてではなく、走査が届かない位置として記録する。置き換えた列挙がそこで何を報告していたかは、このリポジトリからは確定できないからである。enumのバリアントの判別値——`Item::Enum`のアームは`syn::Fields::Unit`を渡すだけで`node.variants`を読まない——、型構文の内部に書かれた式（配列型`[T; expr]`の長さなど。宣言が持つ型は範囲の文字列として記録する）、constジェネリックの既定値（`generics`は型別名が型引数を取るかどうかを答えるために1度読むだけ）、および式のパスへ書かれたconstジェネリック引数（`Wrap::<{ struct FooRepository; 1 }>::new()`・`x.get::<{ ... }>()`・`Wrap::<{ ... }> { v: 0 }`。`Expr::Path`は裸の識別子しかたどらず、`call`はturbofishが素の関連呼び出しではないと判定するためだけに型引数を読み、`method_call`はturbofishを読まず、`Expr::Struct`はパスを文字列として記録する）である。本体を書くtraitメソッド内のものと、`impl`ブロックの関連定数の既定値に書かれたものは、どちらも記録される。規則`a`が読む公開メンバーも別のパスが記録するため影響を受けない。 | [`domain_facts.rs`](../../experiments/rust-syn/src/domain_facts.rs) | 規則`c`と`d`が同じバッチ（`constructions`・`impls`・`calls`）を読むため、走査範囲を広げるとこれらの結論も動く。どちらもT-10-04が引き継いだ4件の列挙に含まれない。 |

完了条件: Rustの宣言・移行・ナレッジ・ステージ・センサー・既存の回帰テスト・実アプリの振る舞いが整合する。両モジュール配置を扱い、実際に検証した集約実行モデルと永続化方式の組み合わせを記録する。単独完了とモデル実行の既存残件にも、それぞれの完了条件を適用する。

## T-11: 同じ契約でTypeScriptへ対応する

状態: 次のリリースで行う方針に合意済み。全面実装は未完了。T-09/T-10に依存する。

構文・シンボル・型の解決にTypeScript Compiler APIを使い、対応APIバージョンとプロジェクトの互換範囲を記録する。パッケージ・exports・型だけの依存、両ドメイン表現、クロージャ・ブランドと#フィールドによる状態隠蔽、メソッド固有のResultエラー、所有の検査、両ファイル配置を実装する。Resultはinfrastructureに置き、neverthrow・Effect・fp-tsとの個別統合は対象外とする。サーバー側のNode.jsでESMのNext.js統合を検証する。

完了条件: ソース・配布物・承認・CI・共通の振る舞いテストで、両配置と両表現を検証する。追加した共通要件はRustでも実装・検証する。集約の実行モデル、永続化、コード表現を独立させ、未検証のホスト環境や組み合わせを対応済みと表示しない。

## その他の拡張

検査器生成のひな型、より高度な言語解析、保存基盤別の追加センサー、他環境対応は別計画とする。T-07の実装は完了した。T-01の残件は第三者コードへの直接修正ではなく上流向けの再現報告として扱い、T-03の残る仕様判断は独立して進められる。

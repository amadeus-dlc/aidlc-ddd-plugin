# DDDプラグインのテスト

[English](README.md) | 日本語

更新: 2026-09-27。プラグインルートで `bun test tests/` を実行します。規則ごとの網羅性は[契約対応表](../docs/developers/sensor-coverage.ja.md)で管理します。通常実行では、標準側の単独完了ガードの再現1件と、ネットワークを使う導入2件をskipします。それぞれ明示的な実行オプションがあります。

## 各テストの役割

| ファイル | 対象 |
|---|---|
| t1-model-artifacts / t1-gate-integration | 正規成果物の直接検査、Claude/Codexの通常承認開始 |
| t7-domain-packaging | 業務語彙による宣言と実モジュールの照合、技術分類・解析不能の検出 |
| t10-rust-module-layout | プロジェクト設定、両配置規約、センサー直接実行、CI終了コード、共通の論理モジュール解決、抽出器を起動できない場合のゲートとCI用入口それぞれの挙動 |
| t11-typescript-module-layout | TypeScriptの配置設定、パッケージの `src` に対する両配置規約、解決できない構成（曖昧・欠落・リンク・配置できない名前・入れ子のパッケージ・読めないディレクトリ）、センサー直接実行とCI用入口が同じ判定を返すこと、CI終了コード、TypeScriptを持たないプロジェクトに何も報告しないこと |
| t11-typescript-generation-samples | 両コード表現・両配置のTypeScript生成見本。ドメインゲートとモジュール配置ゲートが所見0件で通ること、モジュール配置のCI用入口が終了コード0で終わること、コンパイラの診断が0件であること、親モジュールを配置どおりのファイルに置くこと |
| t9-sensor-contract | センサー×規則の網羅性、正常・異常・境界例、依存方向表、予約名全件、対応表の更新漏れ |
| t8-declaration-language | 英語見出し・従来の日本語見出しの受理と、両言語の重複セクションの拒否 |
| u1-sensor-foundation | 正規モデルのローダー・ID・参照、完全性、所見と実行契約 |
| domain-model-operations / domain-model-migration | 正規モデルの操作ごとのエラー、モデル成果物1件のpreview・適用による移行 |
| aggregate-mapping-contract / aggregate-mapping-migration | Rust/TypeScriptの言語共通の集約写像の読込と拒否、補足入力を使ったcrate/module形式の写像1件のpreview・適用による移行、移行前は写像を拒否し移行後は受理する本番ゲート |
| layer-declaration-contract / layer-declaration-migration | Rust/TypeScriptの言語共通のレイヤー宣言の読込・拒否・構造検査（Unit配下とステージ直下の両方）、`cicd-pipeline.md` のDDD節の見出しの下のYAMLブロック1つのpreview・適用による移行、バイト単位で保たれる周囲の本文とCI設定のフェンス、移行前は宣言を拒否し移行後は受理する本番ゲート、変更されないユースケース宣言 |
| artifact-set-migration | プロジェクト1件の成果物一式のpreview・適用・再実行・書込の途中失敗、移行前に記録を拒否していたゲートとCIコマンドが移行後に受理すること |
| rust-mapping-view | 言語共通の写像を、Rustソースセンサーが照合するcrate名・モジュール列・replayメソッドへ投影し、他言語を渡さないこと |
| generation-instructions | 実行用指示ディレクトリの全YAML/TOML例を、ゲートと同じ読込処理で読むこと、TypeScriptの例をすべて生成見本のファイルと一致させ、両コード表現を示すこと、およびそれらのディレクトリを英語に保つこと |
| u2-rust-analysis-foundation | Cargoワークスペースの走査、crateの層・CQRS側の判定、ファイル分類、依存許可表 |
| u3-plugin-scaffold | プラグインの構成、接頭辞、コマンド、拡張宣言 |
| u4-design-sensors / u4-golden | 設計センサーの正常・違反入力、宣言規則と出力の比較 |
| u5-rust-code-sensors / u5-golden | Rustセンサーの正常・違反入力、規則h・l・m・nの各所見が読み手を送る行 |
| t10-rust-domain-facts / t10-domain-facts-contract | ネイティブ抽出器で判定する規則。報告するメンバー名・序数・宣言行、implブロックの外で宣言された関数、抽出器を起動できない場合の各ゲートの挙動、規則a・dの判定元に属性マクロの可能性がある属性がある場合の各ゲートの挙動、ファイルの事実に載る属性マクロの行、空の事実集合として読まずに拒否する応答 |
| t10-rust-domain-decision-base | ネイティブ抽出器で判定する規則b・c・gとdomain-packaging。所見が持つ行、マクロ本体・文字列・コメント内の同じ字面が何も宣言しないこと、モジュール解決の解決・未解決の対、判定元プログラムのソースを抽出器が読めない場合に空として読まずゲートを停止すること |
| install / install-sandbox | 取得元ヘルパー、実CLIでの導入・更新・dry-run・失敗時の保護。導入後と更新後のツリーからTypeScriptの事実抽出を起動できること。ネットワーク取得は任意実行 |
| typescript-compiler-launch | 同梱したTypeScript Compiler APIの起動分類。起動できない各条件が固有のsubjectと理由コードを持つこと、複数成立時の固定順、センサーを検査不能として止めること、同梱したcompilerが固定した版と記録したdigestに一致すること |
| t11-typescript-domain-facts | TypeScriptの事実の契約。宣言、メンバーと可視性、型だけのものを区別したimportとexport、呼び出し、構築、位置、未解決の各理由、構文エラー、関数宣言の引数、getterの結果を変更せずに渡した先の呼び出しと、どこにも渡さない各使い方、TypeScriptパッケージに届かない場所へ複製したtoolsツリーからの起動 |
| t11-typescript-domain-sensor / u5-golden | class表現とcompanion表現の両方でのTypeScriptドメインゲート。TypeScriptのゴールデンケースを同一プロセスと入口の両方で判定し、各所見が名指すメンバー・メソッド・行、Rustのドメインゲートの同じ場面と同じ意味になること、state-evidenceの検査と同じ状態隠蔽の判定、事実や規則で決まらない構文によるゲートの停止、起動できないcompilerによるT-11-01と同じ停止を確認する。 |
| t11-typescript-layer-sensors / u5-golden | ドメインのclass表現とcompanion表現の両方でのTypeScriptのユースケースゲートとインターフェースアダプタゲート。ゴールデンケースを同一プロセスと入口の両方で判定し、各所見が名指すファイル・行・文言、各場面が`ddd-rust-use-case`・`ddd-rust-interface-adapter`の同じ場面と同じ意味になること、command/queryの境界と型だけの依存、各ゲートが規則の判定に使うソースだけを読むこと、どちらのゲートも決められない構文で停止すること、起動できないcompilerで停止することを確認する。 |
| framework-compatibility | 標準ツールによるClaude/Codexへのcompose、グラフ生成、再composeの冪等性 |
| error-contract-contract | 業務エラー契約の語彙、Cargo条件とTypeScript条件を含む要求識別、応答検証 |
| error-contract-cargo | 境界でのCargo条件解決と、ロックファイルを変更しないこと |
| error-contract-rust | 両モジュール配置での対応書式のネイティブ解決、限界ケース、パッケージ識別、ビルド条件の変更 |
| error-contract-project | 境界でのTypeScriptプロジェクト条件解決、継承したコンパイラ設定、プロジェクトを変更しないこと |
| error-contract-typescript | 両モジュール配置・両コード表現での対応書式のCompiler API解決、限界ケース、シンボル識別、プロジェクト条件の変更 |
| operation-error-set-contract | 手書きの業務エラー契約の応答を使った操作エラー集合の照合。要求識別、拒否する入力、不足・余分・別操作所属のケース、結果契約の所見、未解決の事実、変更後に古い観測を使わないこと、照合器に言語固有のimportがないこと、TypeScript の観測がプロジェクト設定の置く写像モジュールのファイルを指すこと |
| operation-error-set-languages | Rust・TypeScript class・TypeScriptコンパニオンの3経路で共通シナリオを解決し、同じ照合で判定すること。写像・モデル・スナップショットを変えたとき、古い観測から判定しないこと。Rust と TypeScript の両方のモジュール配置で観測し、同じ判定になること |

## 配布物の検査

```sh
bun run build:claude
bun run build:codex
bun scripts/verify-dist.ts claude codex
```

配布物の検査は各620ケースを実行します。ランナーは一時ディレクトリを作り、実センサースクリプトを子プロセスとして呼びます。通常の承認処理や、モデルによるコード生成を実行するテストではありません。

`bun run test:sandbox` は、英日見出し・契約ケース・対応表の検査、Claude/Codexのビルド、一時コピーへのcompose・グラフ生成・冪等性、各620件の配布物検査、通常承認の統合検査を順に実行します。規則表から選んだ207入力を各環境の承認経路へ通し、監査記録と所見の規則IDも確認します。既存の結合検査40件も維持し、判定できないTypeScriptのドメイン・ユースケース・インターフェースアダプタの各ゲートが各環境で承認を閉じたままにすることも確認します。

## 回帰で確認した範囲と残る検証

承認開始時の欠落・不正・正常はt1-gate-integrationで検証済みです。VO・ポート・別ファイル・replayはT-02で回帰テストを追加しました。T-07は直接回帰55件と通常承認8件を追加しました。既存の正常ケースに対象構造が存在しない場合、その構造を正しく検査できる根拠にはしません。

パッケージングの代表的な7配置はrustc 1.95.0でもコンパイルしました。全ゴールデン入力のコンパイルや業務動作の証明ではありません。新規導入・更新CLIは[検証済み](../docs/developers/installation-verification.ja.md)です。実際のモデル実行とルール到達は引き続き確認が必要です。

[残作業](../docs/developers/completion-tasks.ja.md)と[実測](../docs/developers/current-state-assessment.ja.md)を参照してください。テスト結果の更新時は対象バージョンと範囲を添えます。

## 対応表の更新

ケースと規則の対応は `golden/contract/coverage.ts`、追加ケースは `golden/contract/` に記載します。`bun scripts/report-sensor-coverage.ts --write` で英日両版を生成し、`bun run test:coverage` で参照切れや未検証項目を検出します。表は実装の全分岐・全Rust構文・業務上の意味の網羅率ではありません。

`bun run test:install` は通常のサンドボックスにも含まれる。実取得は `bun run test:install:remote` で実行する。

## 状態公開の共通検査

`bun run prepare:native` の後に `bun run test:state-exposure` と `bun run verify:state-exposure` を実行します。通常の `bun test tests/` にも両言語の実抽出試験を含むため、製品パスに準備済みのバイナリが必要です。[必要ツール・全コマンド・対応範囲](../docs/developers/state-exposure-verification.ja.md)を参照してください。

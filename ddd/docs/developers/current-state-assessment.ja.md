# DDDプラグインの現状評価

[English](current-state-assessment.md) | 日本語

調査日: 2026-09-13。対象は `ddd/` と、この作業コピーのAI-DLC 2.8.2。測定時のHEADは `97a6244`、Bunは `1.3.13`。

**初回調査時点では中核は実装されていたが、承認時検査の接続とRustの判定精度に不具合が残っていた。** 本書は実測と根拠を保持する。現行の設計規約は[文書一覧](../README.ja.md)、実装の進行は[残作業](completion-tasks.ja.md)を参照する。

調査後に設計・案内・ナレッジを整理したが、この初回調査時点ではセンサーや生成手順のコードは修正していなかった。T-01・T-02・T-07の後続修正は末尾へ追記する。以下の実測値は文書整理前の値であり、修正後の再測定と混同しない。

## 1. モデルからコード検査までの骨格は存在する

専用ステージ1本、contribution 4本、設計センサー6本、Rustセンサー3本、ナレッジ8本を持つ。手書きの正規モデルローダー、ID・系譜・参照解決、Cargoの層判定、tree-sitterのRust解析、配布・導入スクリプトも存在する。

実体は[ステージ](../../stages/inception/ddd-domain-modeling.md)、[追加手順](../../contributions)、[スキーマ](../../tools/ddd/lib/schema)、[解析](../../tools/ddd/lib/rust/analyzer.ts)、[規則](../../tools/ddd/lib/rules/rust/evaluators.ts)、[インストーラ](../../scripts/install.ts)にある。

## 2. 承認時検査には接続不良がある

### F-01: 正規モデルの論理名と実ファイル名が不一致

一時コピーへCodex用プラグインをcomposeし、生成後のグラフと[artifactFilename](../../../.codex/tools/aidlc-artifact-vocabulary.ts)の解決結果を確認した。

| 論理名・指定元 | 実際の解決名・要求名 |
|---|---|
| `ddd-domain-model` | `ddd-domain-model.md` |
| `ddd-domain-model-yaml` | `ddd-domain-model-yaml.md` |
| ステージ本文と下流読込み | `domain-model.md`、`domain-model.yaml` |
| モデル完全性センサー | `**/ddd-domain-modeling/domain-model.yaml` |

本文どおりに生成すると完了時の存在確認と食い違い、解決名どおりに生成するとセンサーの一致条件に合わない。生成・参照・レビュー・検査を一体で修正する必要がある。

### F-02: ユースケース宣言と層構造宣言が未登録

両contributionは文書生成を指示するが `produces` に登録しない。[existingDeclaredArtifactPaths / fireGateSensors](../../../.codex/tools/aidlc-state.ts) は登録済みの既存ファイルだけを承認時検査へ渡す。未登録ファイルは単に置いても検査されず、`--artifacts` でも補えない。

| compose後のステージ | DDDセンサーに一致する登録済み成果物 |
|---|---|
| ddd-domain-modeling | 0件 |
| domain-design | components.md、ddd-aggregate-mapping.md |
| functional-design | 0件 |
| infrastructure-design | 0件 |

これはcompose後のデータと承認コードの照合であり、実際に承認を最後まで実行した検証ではない。T-01で欠落・不正・正常の統合検証を追加する。

## 3. Rustの追加ケースで誤検知と見逃しを再現した

既存の[ケース表](../../tests/golden/rust/cases.ts)を複製し、[ランナー](../../tests/golden/runner.ts)で一時ディレクトリから実センサースクリプトを呼んだ。

| ID | 入力 | 実測 | 原因 |
|---|---|---|---|
| F-03 | 値型Amountをexecuteの引数にする | hでblocking | ドメイン層の型名を集約と区別していない |
| F-04 | PaymentPortのport.execute()を呼ぶ | iでblocking | executeという名前だけで別ユースケースと判定 |
| F-05 | Invoiceのstructと未宣言set_amountのimplを別ファイルに分け、両方を申告 | 所見なし | 同一ファイル内のstructとimplしか結び付けない |
| F-06 | 未宣言の任意代入をapplyと命名する | 所見なし | 名前だけでreplay例外と判定 |

F-03/F-04は[evaluators.ts](../../tools/ddd/lib/rules/rust/evaluators.ts)のruleH/ruleI、F-05/F-06は[symbols.ts](../../tools/ddd/lib/rules/rust/symbols.ts)の収集処理とclassifyMutatorが根拠。T-02で回帰テストにする。

再現時は、F-03にviolation-hを使い、ドメイン型を `pub struct Amount { value: i64 }`、引数をAmountに変更した。F-04はviolation-iにPaymentPort traitとexecuteを置いた。F-05はclean-domainへ `mod operations;` と別ファイルの代入メソッドを追加し、source-manifestにも追記した。F-06はclean-domainに任意代入のapplyを定義した。

## 4. 文書上の過大な保証は訂正した

### F-07: ナレッジの強制範囲

調査時のナレッジは、全不変条件の検証を規則c、他集約の埋め込み禁止をb、decide/apply分離をcが強制すると記載していた。現在の検査処理はそれぞれの意味を保証しない。

文書整理で、規則IDを維持しながら「設計規約」「機械検査の範囲」「レビュー・動作テスト」を区別した。これはナレッジの訂正であり、センサーの検出範囲が増えたという意味ではない。

旧設計の失敗範囲、upsertと冪等性、直前ID保持、初回成功と重複成功、サーガとアクターモデル、RDB選定、Streamsの順序保証も設計3文書で訂正した。具体的な戻り値やreplay宣言はT-03に残す。

## 5. 旧タスク表の誤認を訂正した

Fable5.1の旧completion-tasks.mdには、次の問題があった。現在の[タスク表](completion-tasks.ja.md)はこれらを訂正済み。

| 旧記述・提案 | 確認結果 |
|---|---|
| Domain Error必須が未実装 | [loader.ts](../../tools/ddd/lib/schema/loader.ts)が空配列をschema.command-no-errorで拒否。[専用テスト](../../tests/u1-sensor-foundation.test.ts)も成功 |
| インストーラ表にcopilot/cursor/kiroがない | 実装済み。対象表の重複と廃止対象の残存は別の問題 |
| 互換性テストをファイルごと削除 | 同じファイルの現行Claude/Codex composeテストは維持する必要がある |
| audit方針を改めて選ぶ | 現行AGENTS.mdと.gitignoreはコミット方針 |
| 既存テストを通せば完成に近い | F-01〜F-06の接続と判定の問題が未掲載だった |

## 6. 検証結果と限界

| 検証 | 調査時の結果 | 範囲 |
|---|---|---|
| bun run check | Biome成功、validateはVALID、141成功・20失敗 | 失敗は旧bridgeや削除済み参照先等の前提に依存 |
| validate警告 | compose hook未同梱1件 | ビルド時に標準hookを注入するため、それ自体は異常ではない |
| Claude/Codex composeテスト | 両方成功 | 一時コピーへの合成、グラフ搭載、再合成の冪等性 |
| bun run test:sandbox | kimiビルドで停止 | Claude/Codexビルド後。後続の一括compose・配布物検査には未到達 |
| bun scripts/verify-dist.ts claude codex | 各62ケース成功 | 再ビルドした配布物内のセンサーを直接実行 |
| 追加Rust入力 | 誤検知2件・見逃し2件 | F-03〜F-06 |
| 一時コピーのcompose後グラフ | F-01/F-02確認 | 解決名・センサー一致条件の照合 |

通常ライフサイクルの承認、現在のCodexモデルへのルール転送、インストーラの新規導入・更新・失敗回復は、この調査では検証していない。Rust入力を業務アプリケーションとしてコンパイル・実行する検証もしていない。

kimi・opencodeは調査後のユーザー判断で対応対象から外れた。失敗するkimi経路を復旧するのではなく、不要なビルド・検証・導入経路を整理する。完成までの順序と完了条件はT-01〜T-06へ集約した。

## 7. T-01修正後の追記

正規モデルの登録名へファイル名を揃え、追加宣言を既存レビュー成果物の必須セクションに移した。F-01/F-02の通常承認への接続は修正済み。詳細は[成果物契約](../users/artifact-contract.ja.md)に記載した。

- Claude/Codexの承認開始処理とUnit適用範囲: 新規統合テスト32件成功。
- 新しいモデル形式の直接検査: 6件成功。
- 全体: 179成功・1skip・既存の旧環境依存20件失敗。Biomeとプラグイン検証は成功。
- 任意実行の単独完了再現テスト: 標準2.8.2が成果物なしでdoneを返すため失敗。通常実行ではこの1件だけskip。

この追記は通常承認の検査接続の実測であり、実際のモデル実行・人間の承認までの一連の確認ではない。T-01の単独完了保証とT-02以降は未完了である。

## 8. T-02修正後の追記

F-03〜F-06を修正し、型別名、修飾型、フィールド経由の呼出し、trait実装、getter名衝突、シャドーイング、replay宣言の不正ケースも追加した。判定条件と未検査範囲は[Rustセンサー契約](../users/rust-sensor-contract.ja.md)に記載した。

- 新規回帰ケース37件成功（Rust34件、設計宣言3件）。
- 全体は216成功・1skip・既存の旧環境依存20件失敗。Biome・プラグイン構造検証は成功。
- Claude/Codexの配布物は設計・Rustの各99ケースが成功。
- `.claude/tools/`・`.codex/tools/` の差分がないことを確認した。

型推論やtraitの実装選択等は保証範囲に含めず、未検査のnoteを直接実行のJSONに残す。T-02の予定した修正は完了し、T-01の標準側制約とT-03以降の残作業は継続する。

## 9. T-07修正後の追記

パッケージ名とユビキタス言語の対応をdomain_packagesへ宣言し、ナレッジ・ステージ手順・既存センサーで扱う。技術分類の予約名、宣言の欠落・重複・参照切れ、実モジュールの宣言漏れ、解析不能を検査する。詳細は [パッケージング契約](../users/domain-packaging-design.ja.md)を参照。

- 新規直接回帰55件と、Claude/Codexの通常承認開始8件が成功。
- `bun run check`: 279成功・1skip・20失敗。失敗は既知の旧bridge・削除済みfixture依存の20件で、新規失敗なし。Biome・プラグイン構造検証は成功。
- Claude/Codexを再ビルドし、配布物の設計・Rust検査が各154ケース成功。
- 通常の外部mod、mod.rs、path属性、インライン内path、インラインのディレクトリ指定、raw文字列path、path指定先の子modの7構成をrustc 1.95.0でコンパイルして確認した。
- ナレッジは9本になった。専用ステージ1本、contribution4本、センサー9本は増やしていない。
- `.claude/tools/`・`.codex/tools/` の差分なし。第三者配布コードを変更していない。

rustcで確認したのは代表的な配置の構文・解決であり、全回帰入力を業務アプリケーションとして実行した検証ではない。単独完了の標準側制約、実際のモデル実行と新規導入・更新の確認は残る。T-07は完了し、T-03〜T-06を継続する。

## 10. サンドボックス一括検証

`build:all`、`test:sandbox`、`test:dist`をClaude/Codexへ限定し、サンドボックスの末尾に通常承認開始の統合テストを追加した。`cd ddd && bun run test:sandbox` が終了コード0で完走した。[実測結果](evidence/sandbox-verification.json)を保存している。

- 両環境のビルド成功。
- 一時コピーへのcomposeは両方CLEAN。drops 0、グラフ生成成功、再composeの冪等性を確認。
- 配布物の検査はClaude/Codexそれぞれ154件成功。
- 通常承認開始の統合テストは40成功・1skip・0失敗。skipは既知の標準側単独完了ガードの任意再現ケース。
- Biomeとプラグイン構造検証も成功。第三者のフレームワーク配布コードに差分なし。

これはプラグインのビルド・合成・センサーと承認接続のサンドボックス検証である。実際のモデル実行やインストーラの新規導入・更新の実証とは区別する。全体テストに残る旧依存20件はこの検証では変更していない。

## 11. 文書の言語統一後の検証

knowledge、sensors、stages、contributionsは英語へ統一した。一般文書18組に英語・日本語の本文を用意し、言語切替と同じ言語の文書へのリンクを整えた。aidlc/の日本語記録と第三者のフレームワーク配布ファイルは変更していない。

- 指定4ディレクトリの日本語残存は0件。ローカル文書リンクはすべて解決した。
- ナレッジの規則IDと実行用のfrontmatterに変更なし。
- 宣言の言語テスト6件成功。英語・既存の日本語見出しを受理し、両言語の重複セクションは拒否する。
- 全体チェックは285成功・1skip・既知の旧依存20件失敗。Biomeとプラグイン検証は成功。
- サンドボックスは終了コード0。両環境のビルド・compose、各154件の配布物検査が成功し、承認統合は40成功・1skip・0失敗。主要fixtureは英語のセクション見出しを使う。

単独完了の再現ケースのskipと、導入・モデル実行の未検証範囲は前述のとおり残る。

## 12. センサー契約の網羅性

[契約対応表](sensor-coverage.ja.md)で9センサー・70規則項目を管理する。68項目は所見を直接確認し、2項目はローダーの先行拒否を確認する。各項目に正常・異常・境界ケースを対応付け、別センサーの同じ規則IDでは代用しない。

- 配布物はClaude/Codexそれぞれ277ケース成功。
- 承認経路は各環境138入力を追加。既存の結合検査40件と合わせ、316成功・1skip・0失敗。
- 契約・英日見出しの自動検査135件成功。対応表の参照切れと生成文書の更新漏れも検出する。
- 基礎・インストーラ45件、既存センサー等の回帰88件も成功。
- 一時環境は各テスト終了時に削除する。一括スクリプトは終了コード0で完走した。

[実行結果](evidence/sensor-contract-verification.json)を保存した。形式不正な参照IDが未定義扱いになる不具合も、malformedとして報告するよう修正した。実装の全分岐・全Rust構文・業務上の意味の網羅を主張するものではない。単独完了ガードの再現1件と、既知の旧依存20件は別課題として残る。

## 13. 導入・更新CLIの検証

[導入・更新の検証](installation-verification.ja.md)として、ローカル45件とGitHub mainの実取得2件が成功した。標準compose hookの呼出し、バイナリのハッシュ、contributionの変更検出、候補環境での合成、所有権と失敗時の保護を修正した。test:installは通常のサンドボックスにも含まれる。モデルによるステージ実行は未確認。

## 14. 現行ツールによる全体チェック

`bun run check` は726成功・3skip・0失敗で完了した。Biomeとプラグイン構造検証も成功。Claude/Codexのcompose検証2件を含む現行のテスト構成で確認している。

skipは標準側の単独完了ガードの任意再現1件と、任意のネットワーク導入2件。モデル実行の確認はT-05に残る。以前の節の数値は各時点の測定値である。[現在の実行記録](evidence/current-check-verification.json)を参照。

## T-08の検証 — 2026-09-13

プロジェクト共通のfile/mod-rs選択、モデルに依存しない3つの通常承認での配置検査、失敗時に非0終了するCIコマンドを実装した。所有Cargoターゲットと未登録Rustファイルを対象とし、検査対象の全層で宣言をたどるモジュール解決へ統一した。

全体チェックは865件成功、既存の任意実行3件をskip、失敗0件だった。両配布物で327ケースずつ成功した。配置関連の追加テストは109件、通常承認はcode-generation・build-and-test・ci-pipelineを通じてClaude/Codex合計30件が成功した。両配置の代表例はrustc 1.95.0でedition 2015・2018・2021・2024それぞれのコンパイルにも成功した（計8件）。

[検証記録](evidence/module-layout-verification.json)と[利用者向け契約](../users/rust-module-layout.ja.md)を参照。これらの結果は外部CIの設定やモデルによる実行を証明するものではなく、標準側の単独完了ガードの不足も残る。

# Changelog

[English](CHANGELOG.md) | 日本語

dddプラグインの主な変更を記録します。形式は[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)に従います。

## 未リリース — 予約パッケージ名を名前の全体で照合する

- crate名・パッケージ名と技術分類の予約名の照合を、語ごとではなく名前の全体で行うようにした。モジュール要素の照合と同じ扱いになる。**これまで拒否していた名前が読み込めるようになる。** `invoice-entities` や `invoice_entities` のように予約語で終わるだけの業務名は、`domain-packaging.technical-name` と `schema_version: 2` の写像読込のどちらでも受理する。
- `value-objects`、`ValueObjects`、`@acme/value-objects-domain`、`entities-domain`、`domain` だけの名前は引き続き拒否する。これらは名前そのものが技術分類である。
- これは[パッケージ設計](docs/users/domain-packaging-design.ja.md)が当初から記載していた挙動（部分文字列でも、名前に含まれる一語でも判定しない）であり、crate名・パッケージ名の検査がその記載に反していた。

## 未リリース — 言語共通の実装写像

- `ddd-aggregate-mapping.md` の `schema_version: 2` を追加。業務ID・業務語彙・実行モデル・永続化方式は各エントリの第1階層に残し、言語・パッケージ・モジュールの位置・型・ポート・リポジトリは `code` の下へ移す。各集約は、コマンドと生成操作をメソッドとエラー型へ、業務エラーをケースへ対応付ける。
- 写像文書1件の読込処理を追加。未知のキー、コンパイラID・ソース位置、その言語で使えない名前、壊れた・他所属のモデル参照、パッケージ・型・操作・エラーの写像の不足と重複、技術分類による業務パッケージ名を、RustとTypeScriptの両方で拒否する。正規モデルは `schema_version: 2` だけを読み、version 1の写像を新形式として読むことはない。
- `ddd-aggregate-mapping.ts migrate --mapping <path> [--supplement <path>] [--apply]` を追加。crate/module形式の写像1件を変換し、crate、モジュールの綴り、業務語彙、replayメソッド、実行モデル、永続化方式とその記述言語をすべて保持する。元の情報がない型・操作・エラーケースの名前は、補足入力のファイルで与えるまで `missing-information` として報告する。
- 本番センサーと生成指示はversion 1のまま。移行後の写像は `mapping-declarations.document` として報告される。
- 形式、検査、コマンド、現在の適用範囲を[実装写像](docs/users/implementation-mapping.ja.md)に記載。

## 未リリース — 正規モデルの操作ごとのエラー

- `ddd-domain-model-yaml.md` の `schema_version: 2` を追加。DomainErrorは所属を `operation` で名指しし、FactoryRuleは1件以上の `domain_errors` を自身で宣言する。
- 宣言された所属が包含元の操作であることを、コマンドと生成操作の両方で検査。生成操作のエラーを要素索引へ登録し、重複と壊れた参照も索引側で検出する。**新しい所属検査のうち2つは `schema_version: 1` にも適用する。** DomainError の `command` キーが包含元以外の操作を名指ししている場合（直し方: 包含元のコマンドを名指しする）と、生成操作のIDが包含元とは別の集約名を持つ場合（直し方: IDを `factory.<集約>.<操作>` へ直す）は、これまで読み込めていた旧形式のモデルが読込失敗になる。
- 形式は文書からの推測ではなく読込入口で指定する方式にした。本番センサーは引き続きversion 1を読み、移行後の文書は拒否する。
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

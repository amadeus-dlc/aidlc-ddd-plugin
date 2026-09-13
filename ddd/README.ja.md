# DDDプラグイン

[English](README.md) | 日本語

AI-DLCに正規ドメインモデルの設計手順と、設計・Rustコードの検査を追加します。識別子は `ddd`、現在のバージョンは `0.1.0` です。

**開発中です。** センサーの直接実行と通常承認への接続を検証しました。単独完了の標準側ガードには不足があり、Rustの型推論等は検査範囲外です。[現状評価](docs/current-state-assessment.ja.md)と[完成までのタスク](docs/completion-tasks.ja.md)を参照してください。

## 構成

| 種類 | 内容 |
|---|---|
| ステージ1本 | `ddd-domain-modeling` が集約境界までの正規モデルを所有 |
| contribution 4本 | domain-design、functional-design、infrastructure-design、code-generationへの追加 |
| 設計センサー6本 | モデルの読み込み・完全性・参照、写像、層構造、助言 |
| Rustセンサー3本 | ドメイン、ユースケース、インターフェイスアダプタの構文・依存検査 |
| ナレッジ9本 | 言語横断の設計原則とRust規約 |

ソースは `stages/`、`contributions/`、`sensors/`、`knowledge/`、`tools/`。実装は [schema](tools/ddd/lib/schema/)、[Rust解析](tools/ddd/lib/rust/)、[規則](tools/ddd/lib/rules/) に分かれます。

## 検査範囲

| センサー | 実装している検査 |
|---|---|
| ddd-model-completeness | YAMLローダー、集約の不変条件、状態効果、参照、MarkdownのID・不変条件本文。Domain Error必須はローダーで検査 |
| ddd-model-presence | 実行対象のモデルの存在・読み込み。SKIP/absentでは注記して通過 |
| ddd-reference-ids | 未定義・廃止・種別・不正IDと置換関係 |
| ddd-mapping-declarations | 集約の2軸、ユースケース宣言、複数集約戦略、加算型コマンドの冪等性宣言、業務語彙によるパッケージ宣言 |
| ddd-layer-structure | 層構造の必須項目、依存方向、命名、復元宣言 |
| ddd-design-advisories | 複数集約、リポジトリ範囲、保存宣言への助言 |
| ddd-rust-domain | a/b/c/d/g、層診断、パッケージ宣言と実配置の照合 |
| ddd-rust-use-case | g/h/i/d |
| ddd-rust-interface-adapter | k/l/m/n/gとクエリ側の検査 |

助言センサー以外のマニフェストはblockingを指定しています。正規モデルは登録名へ統一し、追加宣言は既存レビュー成果物の必須セクションとして通常承認へ接続しました。単独完了の制約は[成果物契約](docs/artifact-contract.ja.md)を参照してください。

Rust検査は構文と名前に基づき、型推論・実行を行いません。T-02でVO・ポート・別ファイル・replayの判定を修正しました。[Rustセンサー契約](docs/rust-sensor-contract.ja.md)に明示型の照合範囲と未検査の注記をまとめています。不変条件の意味、回復フロー全体、内部可変性を網羅的に検証するものではありません。

パッケージ名はユビキタス言語へ結び付け、aggregate/、impl/、vo/、entities/等の技術分類を禁止します。設計宣言と実モジュールを検査し、用語の意味はレビューします。[パッケージング契約](docs/domain-packaging-design.ja.md)を参照してください。

## 開発時の検証

前提はBunと `../.codex/tools/` のAI-DLC開発ツールです。調査基準はBun 1.3.13、AI-DLC 2.8.2。

```sh
cd ddd
bun install
bun run validate
bun run build:claude
bun run build:codex
bun scripts/verify-dist.ts claude codex
```

全テストは `bun run check` です。既知の旧環境依存20件は残ります。規則ごとの正常・異常・境界例は[契約対応表](docs/sensor-coverage.ja.md)で確認できます。`build:all`、`test:sandbox`、引数なしの `test:dist` はClaude/Codexだけを対象にします。`bun run test:sandbox` は契約の網羅性・英日見出し・ビルド・一時環境へのcompose・配布物・通常承認開始をまとめて検証します。

## 導入と対応環境

完成時の対象はClaude Code（`.claude`）とCodex（`.codex`、スキルは `.agents/skills`）。kimi・opencodeは対象外です。インストーラもこの2環境だけを受理します。

利用先はAI-DLC導入済みである必要があります。ローカルソースによる事前確認:

```sh
bun ddd/scripts/install.ts --project /path/to/project --from /path/to/aidlc-ddd-plugin --harness claude --dry-run
```

実導入は `--dry-run` を外す形式です。スクリプトにはソース取得、ビルド、compose、provenance記録、更新処理がありますが、新規導入・更新・失敗時の保護は[自動検証済み](docs/installation-verification.ja.md)です。最新タグの存在やリリース済みであることは、この文書では前提にしません。

## 設計と残作業

[文書一覧](docs/README.ja.md)を入口とし、設計規約と実測を区別してください。層・CQRSの命名規約は[ドメイン層設計](docs/domain-layer-design.ja.md)、再実行と保存は[ユースケース層設計](docs/use-case-layer-design.ja.md)、復元とRMUは[インターフェイスアダプタ層設計](docs/interface-adapter-layer-design.ja.md)にあります。

不具合は[GitHub Issues](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues)へ、再現条件と対象バージョンを添えて報告してください。

## ライセンス

[MIT](../LICENSE)。`web-tree-sitter` とRust文法の同梱ライセンスは [vendor](tools/ddd/lib/rust/vendor/) と [wasm/LICENSE](tools/ddd/wasm/LICENSE) にあります。

# aidlc-ddd-plugin

[English](README.md) | 日本語

AI-DLCに、集約・不変条件・Domain Primitiveの設計手順と、設計成果物・Rustコードの検査を追加するプラグインです。本体は [ddd/](ddd/README.ja.md) にあります。

現在は完成に向けた修正中です。Claude/Codexのサンドボックス検証が成功し、通常承認のDDD検査、Rust判定の修正、業務語彙によるパッケージング検査を実装しました。単独完了の標準側ガードとモデル実行の確認には残件があります。[現状評価](ddd/docs/developers/current-state-assessment.ja.md)と[残作業](ddd/docs/developers/completion-tasks.ja.md)を参照してください。

## 提供するもの

専用ステージ1本、既存ステージへの追加4本、設計センサー6本、Rustセンサー3本、ナレッジ9本を持ちます。設計は同じ正規モデルのIDを参照します。Rust解析には同梱のtree-sitterを使い、解析自体にCargoは不要です。生成したRustアプリケーションのビルド・テストには別途Rust環境が必要です。

完成時の検証対象はClaude CodeとCodexです。kimi・opencodeは対象外とし、両環境向けカスタムビルドは維持しません。

## 開発を始める

Bunと、AI-DLCの開発ツールが導入されたこの作業コピーを使います。

```sh
cd ddd
bun install
bun run validate
bun run test:sandbox
```

サンドボックスはClaude/Codexのビルド、compose、配布物の各277ケース、通常承認開始の統合検査を実行します。[検証結果](ddd/docs/developers/evidence/current-check-verification.json)は成功です。全体の検査は `bun run check` で実行します。

## 利用先への導入

AI-DLC導入済みの検証用プロジェクトで、まず導入スクリプトの事前確認を行います。

```sh
bun ddd/scripts/install.ts --project /path/to/project --from /path/to/aidlc-ddd-plugin --harness codex --dry-run
```

Claude Codeでは `--harness claude` を指定します。新規導入・更新CLIは[検証済み](ddd/docs/developers/installation-verification.ja.md)です。モデルによるステージ実行は未確認です。[利用ガイド](docs/usage.ja.md)を確認してください。

## 文書と開発

- [文書一覧](ddd/docs/README.ja.md): 利用者向けの契約とプラグイン開発者向けの文書
- [プラグイン構成と検証](ddd/README.ja.md)
- [構成概要](docs/architecture.ja.md)
- [テストの実行方法](ddd/tests/README.ja.md)
- [変更履歴](ddd/CHANGELOG.ja.md)

実行用のナレッジ・センサー・ステージ・contributionは英語のみです。一般文書は英語の `.md` と日本語の `.ja.md` に本文を用意します。`aidlc/` の記録は日本語を維持します。

## 問い合わせ

不具合の報告先は[GitHub Issues](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues)です。実行したコマンド、AI-DLC/Bunのバージョン、対象環境、再現条件を添えてください。

## ライセンス

[MIT](LICENSE)。同梱ライブラリのライセンスは [tree-sitter](ddd/tools/ddd/lib/rust/vendor/) と [Rust文法](ddd/tools/ddd/wasm/LICENSE) を参照してください。

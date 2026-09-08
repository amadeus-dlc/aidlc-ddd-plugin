# DDD プラグイン

AI-DLC v2 の追加合成プラグインです。識別子は `ddd`、初期バージョンは `0.1.0` です。
現時点では空の拡張領域を持つひな型で、ワークフローの動作は追加しません。

## 拡張する場所

| パス | 内容 |
| --- | --- |
| `.aidlc-plugin/plugin.json` | AI-DLC 用マニフェスト。`core` に依存 |
| `stages/inception/`, `stages/construction/` | 追加ステージ |
| `contributions/inception/`, `contributions/construction/` | 既存ステージへの追加定義 |
| `sensors/` | 成果物を検査するセンサー |
| `knowledge/` | DDD の参照知識 |
| `tools/` | ハーネスへ配布するツール |
| `src/`, `scripts/`, `tests/` | 実装・開発スクリプト・テスト |
| `docs/` | 設計・利用手順 |

空ディレクトリは `.gitkeep` で保持しています。
マニフェスト、Biome 設定、TypeScript 設定、Git 除外設定を参照元からコピーしています。
TypeScript 設定は将来の実装用です。型検査を導入する際は TypeScript と Bun の型定義を開発依存へ追加してください。

## 検証とビルド

このディレクトリで実行します。

```sh
bun install
bun run prepare:harnesses
bun run check
bun run build:claude
bun run build:codex
```

`.codex-plugin/plugin.json` などのホスト固有マニフェストは、AI-DLC のビルダーが `dist/` に生成します。
ソース側のマニフェストは `.aidlc-plugin/plugin.json` で管理します。

サンドボックスでの組み込み検証は、リポジトリ直下の `.claude/`・`.codex/`・`.agents/` を元に実行します。
ツールが環境を一時ディレクトリへコピーし、検証後に削除します。元の環境に変更がないことも検査します。

```sh
bun run test:sandbox
```

`bun run check` にはアダプターの回帰テストと両ハーネスのサンドボックス検証を含めています。
[互換性パッチと検証](docs/framework-compatibility.md) に修正内容と再適用手順を記載しています。

## 検証上の制約

AI-DLC 標準の validate と Claude Code・Codex 向け build は成功しています。
ただし、Codex 用の汎用 `plugin-creator` 検証器では、生成マニフェストに `interface` がないため失敗します。
これは参照元と同じフレームワークの出力形式によるもので、Codex アプリへの導入互換性は未確認です。

Codex実機ではBashセッション付与と、SubagentStart経由の子エージェントへのルール転送を確認済みです。[実機検証結果](docs/codex-host-verification.md) を参照してください。

# Technology Stack — `ddd`

## 言語

| 言語 | 用途 | 備考 |
|---|---|---|
| TypeScript | `scripts/`, `tests/`（実装は5ファイルのみ） | ESM（`"type": "module"`）。**`typescript` パッケージ自体は未導入** |
| Markdown | `README.md`, `docs/`, 将来のステージ／センサー定義 | プラグイン貢献物の主要形式 |
| JSON | `plugin.json`, `package.json`, `biome.json`, `docs/evidence/` | — |

## ランタイム／ツールチェーン

| 名称 | バージョン | 用途 | 備考 |
|---|---|---|---|
| bun | **固定なし** | ランタイム／テストランナー／パッケージマネージャ | `package.json` に `engines` 指定なし。`bun.lock` は `lockfileVersion: 1` |
| `@biomejs/biome` | `2.5.12` | lint / format / import 整理 | **唯一の devDependency** |
| TypeScript | **未導入** | 型検査 | `tsconfig.json` は存在し strict 一式（`noUnusedLocals` / `noUnusedParameters` / `noImplicitOverride`）＋ `noEmit` ＋ `types: ["bun"]` を指定するが、`typescript` も `@types/bun` も devDependencies に無く**型検査を実行できない**。README も未対応を明記 |
| `bun:test` | bun 同梱 | テストフレームワーク（`describe` / `test` / `expect`） | — |
| AI-DLC エンジンツール | 親リポジトリ管理 | `aidlc-plugin-validate.ts` / `-build.ts` / `-test.ts` | バージョン管理は親側 |
| Codex CLI | `0.153.4` | `test:host` の実機検証 | 外部前提。モデル `gpt-6-astra`、180 秒タイムアウトをハードコード |

## フレームワーク

アプリケーションフレームワーク（Web / DI / ORM 等）は使用していない。`ddd` は AI-DLC v2 のプラグイン機構そのものが唯一の「フレームワーク」であり、コードではなくマニフェストとディレクトリ規約で結合する。

## 設定ファイル

`package.json` / `tsconfig.json` / `biome.json` / `bun.lock` / `.gitignore` / `.aidlc-plugin/plugin.json`。各々の役割は `code-structure.md` 参照。

## バージョン固定の状況

| 対象 | 固定 |
|---|---|
| `@biomejs/biome` | あり（`2.5.12` 完全固定） |
| bun | **なし**（engines 未指定 = 実行環境依存） |
| Codex CLI / モデル | スクリプト内ハードコード（`0.153.4` / `gpt-6-astra`） |
| AI-DLC エンジンツール | なし（親リポジトリの現在の内容に追随） |

## Sources

- `ddd/package.json`, `ddd/tsconfig.json`, `ddd/biome.json`, `ddd/bun.lock`, `ddd/README.md`
- `developer-scan-ddd.md`（Build System / Frameworks & Libraries）

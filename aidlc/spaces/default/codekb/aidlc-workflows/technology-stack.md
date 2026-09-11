# 技術スタック — aidlc-workflows

## 言語・ランタイム

| 項目 | バージョン | 用途 |
|---|---|---|
| TypeScript | ^6.0.3 | **型検査のみ**。実行時トランスパイルは bun が担う |
| bun | — | ランタイム兼テストランナー（型定義 `bun-types` ^1.3.13） |
| Markdown + YAML frontmatter | — | 宣言レイヤ（ステージ / スコープ / エージェント / センサー / コントリビューション） |
| Python | 3.12+ | ドキュメントサイト専用 |

## ビルド／品質ツール

| ツール | バージョン | 用途 |
|---|---|---|
| `@biomejs/biome` | 2.4.16 | linter。**formatter は無効化**。`dist/**` と一部 fixture を除外 |
| knip | 6 | 未使用コード検出。`knip.json` の schema 参照。devDependencies には未記載でオンデマンド実行と推定 |
| zensical | 0.0.51 | ドキュメントサイト生成（Python） |

## ライブラリ

| ライブラリ | バージョン | 用途 |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` | 0.3.158 | ハーネス統合 / e2e |
| `@xterm/headless` | ^5.5.0 | 端末レンダリング e2e テスト |
| `node-pty` | 1.1.0 | 同上 |
| `smol-toml` | 1.7.0 | Codex / Kimi の TOML 設定生成 |

**ランタイム依存は実質ゼロ。** 標準ライブラリ + bun API のみで動く設計であり、上記はいずれも開発・テスト・投影のためのもの。

## 設定ファイル

| ファイル | 内容 |
|---|---|
| `package.json` | private、`type: module`。scripts は `typecheck` / `lint` / `check` の 3 本のみ |
| `tsconfig.json` / `tsconfig.tests.json` / `tsconfig.adapters.json` | `target: ESNext`, `module: ESNext`, `types: ["bun-types"]` |
| `biome.json` | linter のみ有効 |
| `knip.json` | entry は `core/tools/*.ts`, `core/hooks/*.ts`, `harness/*/manifest.ts`, `harness/*/emit.ts`, `scripts/package.ts` 等 |
| `bun.lock` | ロックファイル |
| `mise.toml` | 親リポジトリ側 |
| `pyproject.toml` + `uv.lock` + `zensical.toml` | ドキュメントサイト専用 |

## ビルドの性質

バンドラは介在しない。「TypeScript をそのまま bun で実行 + `scripts/package.ts` によるハーネス投影生成」がビルドの全体。

`bun run check` = `package.ts` → `package.ts --check`（二重生成で決定性を検証）→ `typecheck` → `lint`。この**バイト単位の決定性要求**がプラグイン投影にも及び、`aidlc-plugin-test` の 2 回目バイト安定条件の根拠になっている。

## テストスタック

| 項目 | 内容 |
|---|---|
| フレームワーク | `bun:test`（`describe` / `test` / `expect`） |
| ランナー | `tests/run-tests.ts`（+ `run-tests.sh` ラッパ） |
| tier フラグ | `--smoke` / `--unit` / `--integration` / `--e2e` |
| プロファイル | `--ci`（smoke+unit+integration）/ `--release`（+e2e） |
| その他フラグ | `--parallel N`, `--filter`, `--debug` |
| LLM 遮断 | `AIDLC_NO_LLM=1` |

## 本件（DDD プラグイン）で採るスタック

新規に持ち込むランタイム依存は不要。プラグインは Markdown 宣言 + `tools/` 配下の TypeScript（bun 実行）だけで構成でき、コアと同じ biome / typecheck 規律に乗る。テストは `bun:test` と `tests/harness/plugin-kit.ts` の再利用キットを使う（`dependencies.md` 参照）。

## 出典

- 開発者スキャン（`developer-scan-aidlc-workflows.md`）の Build System / Frameworks & Libraries / Test Coverage 節

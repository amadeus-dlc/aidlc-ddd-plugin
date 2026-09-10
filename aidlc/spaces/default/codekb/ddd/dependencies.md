# Dependencies — `ddd`

## 外部パッケージ依存

| パッケージ | バージョン | 種別 | 用途 |
|---|---|---|---|
| `@biomejs/biome` | `2.5.12` | devDependency | lint / format / import 整理 |

**production dependencies はゼロ**。`node_modules/` には `@biomejs` のみが存在する。

## 未導入だが設定が前提としているもの

| パッケージ | 状況 | 影響 |
|---|---|---|
| `typescript` | 未導入 | `tsconfig.json` の strict 設定が実行されない |
| `@types/bun` | 未導入 | `types: ["bun"]` が解決できない |

## 親リポジトリへの依存（相対パス結合）

`ddd` は独立して動作しない。以下を親リポジトリ（`/Users/j5ik2o/orca/workspaces/aidlc-ddd-plugin/base`）から相対参照する。

| 参照先 | 参照元 | 性質 |
|---|---|---|
| `../.codex/tools/aidlc-plugin-validate.ts` | `package.json` `validate` | 実行時依存 |
| `../.codex/tools/aidlc-plugin-build.ts` | `package.json` `build:claude` / `build:codex` | 実行時依存 |
| `../.codex/tools/aidlc-plugin-test.ts` | `package.json` `test:sandbox` | 実行時依存 |
| `.claude/hooks/aidlc-deliver-stage-rules.ts` ほか | `patches/installed-harnesses.patch` | **書き込み依存**（パッチ適用） |
| `.codex/hooks/aidlc-codex-adapter.ts`, `.codex/hooks.json` | 同上、および `tests/` | 書き込み依存＋検証対象 |
| `.claude/tools/data/plugin-hooks-template/compose.ts` および `.codex/tools/` の同ファイル | `patches/installed-harnesses.patch` | 書き込み依存 |
| 新規 `.codex/hooks/aidlc-codex-dispatch.ts`（169行） | 同パッチが追加 | 書き込み依存 |

マニフェスト上の宣言依存は `plugin.json` の `dependencies: ["core"]`。

## `aidlc-workflows/` サブモジュール

- **リビジョン**: `a277af218f0df7f325d3b8be7b6d90fce2c5bd40`
- **性質**: **読み取り専用**。書き込み・パッチ適用は禁止
- **参照元**:
  - `tests/codex-dispatch-bridge.test.ts` — `aidlc-workflows/dist/codex/aidlc` をフィクスチャとして複製し、`inception.md` に検証トークンを追記して確認
  - `tests/framework-compatibility.test.ts` — `aidlc-workflows/plugins/test-pro` を使い、Codex が `.agents/skills/<name>/SKILL.md` にランナーを生成することを検証
  - `scripts/verify-codex-host.ts` — 実機検証のフィクスチャ供給元
- **リスク**: テストと実機検証の双方がこのサブモジュールのフィクスチャに依存しており、リビジョン更新はテストの前提を変える。保護（ファイル権限・ACL・ローカル Git 設定）は clone に引き継がれず、別作業コピーでは失われる（`docs/reference-read-only.md`）

## 外部サービス／環境依存

| 依存 | 用途 | 必須性 |
|---|---|---|
| Codex CLI `0.153.4` + `~/.codex/auth.json` | `test:host` | opt-in |
| ネットワーク（モデル `gpt-6-astra`） | `test:host` | opt-in |
| git | `apply-harness-patches.ts` の `git apply --check` | 必須 |

## Sources

- `ddd/package.json`, `ddd/bun.lock`, `ddd/.aidlc-plugin/plugin.json`, `ddd/docs/reference-read-only.md`
- `developer-scan-ddd.md`（Build System / Frameworks & Libraries / Technical Debt Signals / Risks）

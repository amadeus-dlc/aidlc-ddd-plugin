# API Documentation — `ddd`

ネットワーク API（HTTP / REST / GraphQL / gRPC）は**存在しない**。サーバ実装もエンドポイントもない。実際に存在する「表面」は次の4種である。

## 1. `package.json` スクリプトパイプライン

開発者が叩く唯一の実行インタフェース。各スクリプトと呼び出し先。

| スクリプト | 実行内容 | 呼び出すエンジンツール／外部 |
|---|---|---|
| `validate` | プラグインマニフェストの検証 | `bun ../.codex/tools/aidlc-plugin-validate.ts .` |
| `build:claude` | Claude ハーネス向け射影 | `bun ../.codex/tools/aidlc-plugin-build.ts . claude` |
| `build:codex` | Codex ハーネス向け射影 | `bun ../.codex/tools/aidlc-plugin-build.ts . codex` |
| `check` | 品質ゲート（直列） | `check:biome` → `validate` → `test` |
| `check:biome` | lint / format 検査 | `biome check --error-on-warnings .` |
| `format` | 自動整形 | `biome format --write .` |
| `test` | 単体テスト | `bun test tests/` |
| `test:sandbox` | 使い捨てコピー上での install 検証（2連） | `bun ../.codex/tools/aidlc-plugin-test.ts . --install .. --harness claude` および `--harness codex` |
| `test:host` | 実機 Codex CLI 検証（opt-in） | `bun scripts/verify-codex-host.ts` |
| `prepare:harnesses` | 親リポジトリへのパッチ適用 | `bun scripts/apply-harness-patches.ts` |

**契約上の注意**: `validate` / `build:*` / `test:sandbox` は親リポジトリ相対の `../.codex/tools/` を参照する。`ddd` 単独 clone では動作しない。

## 2. `plugin.json` マニフェスト契約

`ddd/.aidlc-plugin/plugin.json`。AI-DLC コアが読む唯一の宣言。

| フィールド | 値 | 意味 |
|---|---|---|
| `name` | `ddd` | プラグイン識別子（`dist/claude/.claude-plugin/plugin.json` では `aidlc-ddd`） |
| `version` | `0.1.0` | — |
| `dependencies` | `["core"]` | コアフレームワークに依存 |
| `aidlc.contributes.stages` | `stages/` | 新設ステージのルート |
| `aidlc.contributes.overlays` | `contributions/` | 既存ステージへの追加 overlay のルート |
| `aidlc.contributes.sensors` | `sensors/` | センサーマニフェスト（`aidlc-<id>.md`、フラット走査） |
| `aidlc.contributes.knowledge` | `knowledge/` | `<agent-slug>/` 単位のナレッジ |
| `aidlc.contributes.tools` | `tools/` | センサー実行スクリプト |

**宣言済み5面すべてに提供実体が0件**（`architecture.md` の「宣言と実装のギャップ」参照）。

## 3. ハーネスフック契約（テストが検証している境界）

`ddd` が提供するものではなく、`tests/` が親リポジトリ側の挙動として検証している契約。

- 対象: `.codex/hooks/aidlc-codex-adapter.ts`
- ターゲット: `bind-bash-session` / `deliver-stage-rules` / `start-stage-rules` / `finish-stage-rules` / `plan-approval-guard`
- イベント: `PreToolUse` / `PostToolUse` / `SubagentStart`
- ツール名マッチャー: `spawn_agent`、`collaborationspawn_agent`
- 応答フィールド: `permissionDecision`（`allow` / `deny` / `ask`）、`additionalContext`、`updatedInput`、`timeout_ms`、環境変数 `AIDLC_SESSION_OVERRIDE`

## 4. エクスポート関数

リポジトリ内で共有される唯一の関数 API。

```ts
copyReferenceFixture(source, destination): void   // scripts/copy-reference-fixture.ts
```

`tests/codex-dispatch-bridge.test.ts` と `scripts/verify-codex-host.ts` の双方から利用され、`aidlc-workflows/dist/codex/aidlc` をフィクスチャとして複製する。

## Sources

- `ddd/package.json`, `ddd/.aidlc-plugin/plugin.json`, `ddd/scripts/copy-reference-fixture.ts`
- `developer-scan-ddd.md`（Build System / APIs Discovered）

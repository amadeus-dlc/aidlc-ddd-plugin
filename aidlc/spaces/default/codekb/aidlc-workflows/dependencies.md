# 依存関係 — aidlc-workflows

バージョン一覧は `technology-stack.md` に一元管理する。本書は依存の**構造**（誰が誰に依存するか、どの方向に流れるか）を記録する。

## 外部依存

**ランタイム依存は実質ゼロ。** 標準ライブラリと bun API のみで動く設計であり、`package.json` の依存はすべて開発・テスト・投影に閉じる。

| 依存 | 依存する側 | 性質 |
|---|---|---|
| bun / `bun-types` | 全体 | ランタイム。置き換え不能 |
| TypeScript | 全体 | 型検査のみ。実行経路には乗らない |
| `@biomejs/biome` | CI / `bun run lint` | 品質ゲート。`plugins/` も対象 |
| `@anthropic-ai/claude-agent-sdk` | `tests/e2e`, ハーネス統合 | テスト・統合限定 |
| `@xterm/headless`, `node-pty` | `tests/e2e` | 端末レンダリング検証限定 |
| `smol-toml` | Codex / Kimi ハーネス投影 | TOML 生成限定 |
| knip | オンデマンド | 未使用コード検出 |
| zensical（Python） | `docs/` サイト | TypeScript 側から完全に独立 |

外部ネットワークサービスへの依存はない。プラグイン doctor もセンサーもローカルプロセスとして起動される。

## 内部依存グラフ（ビルド時）

```
core/aidlc-common/stages/*.md ─┐
core/scopes/*.md               ├─→ aidlc-graph compile ─→ tools/data/stage-graph.json
core/sensors/*.md              ┘                          tools/data/scope-grid.json
                                     ↑
plugins/<name>/                      │
  stages|contributions|scopes|sensors ─→ hooks/compose.ts ─┘
  .aidlc-plugin/plugin.json ─→ aidlc-plugin-validate.ts ─→ aidlc-plugin-emit.ts

scripts/package.ts ─→ harness/<name>/manifest.ts ─→ dist/<harness>/            (gitignore)
scripts/package.ts ─→ plugins/<name>/ ─→ aidlc-plugin-emit.ts ─→ dist/plugins/<name>/<harness>/
scripts/package.ts ─→ tools/data/plugin-targets.json ─→ aidlc-plugin-build.ts  (オフライン経路)
```

`tools/data/plugin-targets.json` を介した経路が要点で、これにより**外部プラグインリポジトリがフレームワークチェックアウトなしにビルドできる**。DDD プラグインを別リポジトリに置く選択肢はこの経路に依存する。

## 内部依存（宣言レイヤ間）

| 依存元 | 依存先 | 参照キー |
|---|---|---|
| ステージ | エージェント | `lead_agent`, `support_agents[]`, `reviewer` |
| ステージ | センサー | `sensors[]` |
| ステージ | スコープ | `scopes[]` |
| ステージ | ステージ | `requires_stage[]`（**順序辺を張る唯一の手段**） |
| ステージ | 成果物 | `produces[]` / `consumes[]`（フラット名前空間） |
| コントリビューション | ステージ | `target` |
| ナレッジディレクトリ | エージェント | ディレクトリ名 == エージェントスラグ（完全一致） |
| センサーマニフェスト | ツール | `command` |

## 成果物名前空間の衝突制約

成果物論理名はフラット名前空間（`/^[a-z][a-z0-9-]*$/`）。プラグインは `<plugin>-` 接頭辞必須で、`core-*` は予約。既存の `components` / `decisions` / `traceability` と衝突する名前、および `domain-model` のような無接頭辞名は compile が拒否する。DDD プラグインの成果物命名はここに縛られる。

## プラグイン作者向けの再利用依存

`tests/harness/plugin-kit.ts` がプラグイン作者向けキットを export する。

| export | 用途 |
|---|---|
| `validatePluginContent` | プラグイン内容の検証（`plugins/test-pro/tests/plugin.test.ts` は空配列を返すことを要求） |
| `walkMarkdownFiles` | Markdown 走査 |
| `buildPluginProjection` | 投影のビルド |
| `composePluginFixture` | compose フィクスチャ生成 |
| `readPluginDropLogs` | **drop ログの読み取り** — `adds.requires_stage` などが落ちたことを検出する手段 |
| `pluginAgentRoster` | エージェント一覧 |
| `invokeHarness` | ハーネス起動 |

DDD プラグインのテストはこのキットに依存させるのが素直。特に `readPluginDropLogs` は、意図せぬ drop（unknown anchor、未実装 `adds.*`、スコープ所有権違反）を回帰テストで捕まえる唯一の手段になる。

## 未読の依存

`dependencies` フィールドと `aidlc.lock.json` は **composer に読まれない**。プラグイン間のバージョン制約による活性化・順序制御には依存できない。

## 出典

- 開発者スキャン（`developer-scan-aidlc-workflows.md`）の Build System / Frameworks & Libraries / Test Coverage / Handoff Summary 節

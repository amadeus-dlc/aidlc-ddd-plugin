# コード構成 — aidlc-workflows

## リポジトリ構成

単一リポジトリ・単一 private package（`aidlc-workflows-dev`）。サブパッケージ分割はなく、トップレベルディレクトリが論理モジュール境界を兼ねる。

```
aidlc-workflows/
  core/
    tools/          TypeScript CLI 88 ファイル（決定論レイヤの全体）
      data/         生成物・静的データ（plugin-targets.json 等）
    hooks/          ハーネスのライフサイクルフック
    aidlc-common/
      protocols/    正典契約（stage-definition.md ほか）
      stages/<phase>/<slug>.md    5 フェーズ 33 ステージ
    sensors/        センサーマニフェスト 6 本
    scopes/         スコープ定義 11 本
    agents/         エージェントペルソナ 14 本
    knowledge/<agent-slug>/       Tier 1 方法論ナレッジ、15 ディレクトリ
    memory/         空間 memory シードのひな型（org/team/project + phases/）
    templates/      テンプレート
    skills/         スキル定義
  harness/<name>/   8 ハーネス投影定義（manifest.ts、一部 emit.ts）
  plugins/test-pro/ 参照プラグイン（唯一の同梱プラグイン、17 ファイル）
  scripts/          package.ts / plugin-hooks-template/compose.ts / インストーラ
  tests/            smoke / unit / integration / e2e ほか、*.test.ts 494 ファイル
  docs/             guide / harness-engineering / reference（20 章）
```

## ファイル分類

| 分類 | 置き場所 | 形式 | 役割 |
|---|---|---|---|
| プロトコル | `core/aidlc-common/protocols/` | Markdown | 正典契約。ステージ frontmatter スキーマの規範定義 |
| ステージ | `core/aidlc-common/stages/<phase>/<slug>.md` | Markdown + YAML frontmatter | ライフサイクルの 1 単位。frontmatter が契約、本文が Step 手順 |
| スコープ | `core/scopes/<name>.md` | Markdown + YAML | どのステージを EXECUTE / SKIP するかのグリッド |
| エージェント | `core/agents/aidlc-<role>-agent.md` | Markdown + YAML | ペルソナ定義。`lead_agent` / `support_agents` / `reviewer` から参照される |
| センサー | `core/sensors/aidlc-<id>.md` | Markdown + YAML | 決定論チェックの宣言。`command` が実体を指す |
| ナレッジ | `core/knowledge/<agent-slug>/*.md` | Markdown | Tier 1 方法論リファレンス。ディレクトリ名 == エージェントスラグ |
| ツール | `core/tools/aidlc-*.ts` | TypeScript | 決定論処理。全ファイル `aidlc-` 接頭辞 |
| フック | `core/hooks/aidlc-*.ts` | TypeScript | 状態同期・監査追記・グラフ再コンパイル |
| ハーネス投影 | `harness/<name>/manifest.ts` | TypeScript | 投影の真実源 |
| プラグイン | `plugins/<name>/` | 混在 | 下記「プラグインの内部構成」参照 |
| テスト | `tests/**/*.test.ts` | TypeScript | `bun:test` |

## プラグインの内部構成（本件の作業対象になる形）

`plugins/test-pro/` が唯一の完全な実例（17 ファイル）。正準ディレクトリは `aidlc.contributes` の値と完全一致でなければならない。

```
plugins/<name>/
  .aidlc-plugin/plugin.json      manifest。name/version/description/author/dependencies + aidlc.contributes
  stages/<phase>/<slug>.md       新規ステージ           contributes: stages: "stages/"
  contributions/<phase>/<slug>.md 既存ステージへの overlay  contributes: overlays: "contributions/"
  scopes/<plugin>-<name>.md      スコープ               contributes: scopes: "scopes/"
  agents/<plugin>-<name>-agent.md エージェント          contributes: agents: "agents/"
  sensors/aidlc-<id>.md          センサーマニフェスト     contributes: sensors: "sensors/"
  knowledge/<agent-slug>/*.md    Tier 1 ナレッジ         contributes: knowledge: "knowledge/"
  tools/<plugin>-doctor.ts       doctor / センサー実体   contributes: tools: "tools/"
  tests/                         プラグイン自身のテスト
  hooks/compose.ts               scaffold には含まれない。BUILD が注入する
  README.md
```

## コードパターン

- **1 ファイル 1 宣言** — ステージ・スコープ・エージェント・センサーはいずれも Markdown 1 ファイルが 1 エンティティ。frontmatter が機械可読契約、本文が人間向け手順。
- **スラグとファイル名の一致を機械検証** — ステージは `slug` == ファイル名 stem、プラグインの scope/agent は frontmatter `name` == ファイル stem、センサーは `SENSOR_FILE_REGEX = /^aidlc-([a-z][a-z0-9-]*)\.md$/`。名前が規約を外れると「compose は通るが発火しない」ではなく **compose が拒否して degraded drop を記録する**（旧 compose が既に配置したファイルは沈黙する既知の落とし穴あり）。
- **接頭辞による名前空間** — フレームワークファイルは `aidlc-*`。プラグインの成果物論理名は `<plugin>-` 接頭辞必須で、`core-*` は予約。成果物名はフラット名前空間（`/^[a-z][a-z0-9-]*$/`）なので、`components` / `decisions` / `traceability` のような既存名や無接頭辞の `domain-model` は compile が拒否する。
- **生成物を書き出す CLI と、それを読むだけの CLI の分離** — `scripts/package.ts` と `aidlc-plugin-emit.ts` が書き手、`aidlc-plugin-build.ts` は `tools/data/plugin-targets.json` を読むだけでオフライン動作する。
- **コメント密度が高い** — `compose.ts` は仕様の根拠（RFC 番号や §）まで注記しており、実装の意図を追える。

## コアステージ `domain-design` の構造（コントリビューション対象）

`core/aidlc-common/stages/inception/domain-design.md`。`lead_agent: aidlc-architect-agent`、`produces: [components, decisions, traceability]`、`review_artifact: components`、本文は Step 1–8 構成。Step 番号が安定しているため `after-step:4`（コンポーネントカタログ生成の直後）が DDD 散文の自然な差し込み位置になる。詳細な差し込み設計は `api-documentation.md` の contribution スキーマ節を参照。

## 出典

- 開発者スキャン（`developer-scan-aidlc-workflows.md`）の Scan Coverage / Packages Found / Code Quality Indicators 節
- `core/aidlc-common/protocols/stage-definition.md`、`docs/reference/15-stage-definition.md`、`18-plugin-mechanism.md`

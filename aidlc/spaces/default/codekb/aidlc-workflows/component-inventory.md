# コンポーネント一覧 — aidlc-workflows

深掘りスキャンで確認できた論理コンポーネントのみを記載する。skim のみの領域（`core/hooks/`, `harness/*/manifest.ts` の投影実装、`tests/`, `core/memory/`, `core/skills/`, `core/templates/`, `docs/guide/`, `docs/harness-engineering/`）は本一覧に含めない。契約の詳細は `api-documentation.md`、制約 C1–C8 は `architecture.md` を参照。

## core-tools

**責務** — 決定論レイヤの全体。TypeScript 88 ファイル、全ファイル `aidlc-` 接頭辞。状態機械、監査ログ、グラフコンパイル、センサーディスパッチ、プラグイン検証・投影、ナレッジ管理を担う。判断を含まない処理だけをここに閉じ込める。

**主要ファイル**

| ファイル | 役割 |
|---|---|
| `aidlc-graph.ts` | ステージ YAML をコンパイルし `stage-graph.json` / `scope-grid.json` を生成 |
| `aidlc-stage-schema.ts` | ステージ frontmatter スキーマの実装側正典 |
| `aidlc-plugin.ts`（1484 行） | `plugin list` / `sync` / `select`。inventory 比較、composition stamp、トランザクショナル同期 |
| `aidlc-plugin-create.ts` | scaffold 生成（空ディレクトリ限定、6 ファイル） |
| `aidlc-plugin-validate.ts` | オフライン検証 |
| `aidlc-plugin-build.ts` | 検証 + 1 ハーネス投影 |
| `aidlc-plugin-test.ts` | candidate プロジェクトで実 compose を 2 回走らせる検証 |
| `aidlc-plugin-emit.ts`（680 行） | 共有エミッタ |
| `aidlc-sensor*.ts` | センサーディスパッチャ |

**依存** — `core/tools/data/`（静的データ・生成物）。`core/aidlc-common/`（読み取り対象）。外部ランタイム依存は実質ゼロ。

**本件での使い方** — `create` → `validate` → `build` → `test` が DDD プラグイン開発の主ループ。`aidlc-plugin-build.ts` は `tools/data/plugin-targets.json` を読むのみで動くため、外部リポジトリからのビルドが可能。

## core-aidlc-common

**責務** — プロトコル（正典契約）とステージ定義。`protocols/stage-definition.md` が frontmatter の規範定義、`stages/<phase>/<slug>.md` が 5 フェーズ 33 ステージ。

**本件での焦点** — `stages/inception/domain-design.md`。`lead_agent: aidlc-architect-agent`、`produces: [components, decisions, traceability]`、`review_artifact: components`、Step 1–8 構成。Step 番号が安定しているため `after-step:4`（コンポーネントカタログ生成の直後）が DDD 散文の差し込み位置として自然。

**依存** — `core-agents`（`lead_agent` / `support_agents` / `reviewer` 参照）、`core-sensors`（`sensors[]` 参照）、`core-scopes`（`scopes[]` による相互参照）。`core-tools` の `aidlc-graph.ts` に消費される。

## core-sensors

**責務** — センサーマニフェスト 6 本（Markdown + YAML）。決定論チェックの宣言。

**依存** — `core-tools` の `aidlc-sensor*.ts`（ディスパッチャ）、`core-aidlc-common`（`sensors[]` から参照される）。

**注記** — コア 6 本の `matches` glob は旧成果物ツリー路 `**/{aidlc-docs,intents}/**` を引きずっている（ドキュメントが verbatim で認めている）。新規センサーはこれを踏襲しないこと。

## core-scopes

**責務** — スコープ定義 11 本。どのステージを EXECUTE / SKIP するかのグリッドを決める。`aidlc-feature.md` を全文精読済み。

**依存** — `core-aidlc-common`（ステージ frontmatter の `scopes[]` と相互参照）、`core-tools`（`aidlc-graph` が `scope-grid.json` を生成）。

**本件での制約** — プラグインの `adds.scopes` は「自プラグインが所有するスコープのみ」かつ「対象スコープファイルがインストール済み」でなければ drop される。コアの `feature` / `enterprise` に DDD ステージを載せたい場合は、contribution ではなく**自ステージの `scopes:` にコアスコープ名を書く**経路になる。

## core-agents

**責務** — エージェントペルソナ 14 本。`aidlc-architect-agent.md` の frontmatter を精読済み。

**依存** — `core-aidlc-common`（ステージから参照される）、`harness` 投影（ディスパッチ面の生成先）。

**本件での制約** — 独自エージェントを立てると `mode` / `reviewer` の組み合わせ次第でハーネス依存が発生する（`architecture.md` C3）。

## core-knowledge

**責務** — Tier 1 方法論ナレッジ。エージェントスラグ別 15 ディレクトリ。

**依存** — エージェントスラグとディレクトリ名の**完全一致**が投影条件。

**本件での重複リスク** — `core/knowledge/aidlc-architect-agent/ddd-patterns.md` が既に存在する。プラグイン側 `knowledge/aidlc-architect-agent/` に DDD ナレッジを置くとコアと二重になるため、「コアの `aidlc-architect-agent` に足す」のか「自前の `<plugin>-<role>-agent` を立てる」のかを設計初期に決める必要がある。

## plugins

**責務** — プラグインツリー。同梱は `test-pro` のみ（17 ファイル: manifest / stage / scope / contribution / sensor / agent / doctor / tests をすべて含む唯一の完全な参照実装）。

**依存** — `core-tools`（検証・投影）、`scripts`（compose フック注入とパッケージング）。

**注記** — `plugins/` は既に biome の lint 対象に含まれている（`bun run lint` = `biome check --error-on-warnings core harness scripts plugins tests`）。新規プラグインを本リポジトリ内に置く場合、lint がそのまま効く。

## scripts

**責務** — パッケージング / リリース / インストーラ。

| ファイル | 行数 | 役割 |
|---|---|---|
| `package.ts` | 1757 | 全ハーネス投影の入口。`harness/<name>/manifest.ts` を読み `dist/<harness>/` を生成。`tools/data/plugin-targets.json` も書き出す |
| `plugin-hooks-template/compose.ts` | 2489 | 配布される compose フック本体。`adds.*` の実装分岐（`IMPLEMENTED_ADDS`, `:2191`）と anchor 解決（`locateAnchor`, `:1749`）の真実源 |
| `aidlc-plugin-compose.ts` | — | compose の補助 |
| `ci-changelog-guard.ts` | — | CHANGELOG 記載の強制 |

**依存** — `harness/<name>/manifest.ts`、`core/tools/aidlc-plugin-emit.ts`、`plugins/`。

**本件での重要度** — プラグイン挙動の「宣言と実装のズレ」を確認したいときに読むべき唯一の場所が `plugin-hooks-template/compose.ts`。ドキュメントとコードが食い違った場合はこちらが真。

## docs-reference

**責務** — 開発者リファレンス 20 章 + サブディレクトリ。

| 章 | 行数 | 内容 |
|---|---|---|
| `18-plugin-mechanism.md` | 613 | **プラグインの正典**。§6/§7/§9 に deferred 事項が明記 |
| `15-stage-definition.md` | 599 | ステージ定義 |
| `07-sensor-system.md` | 450 | センサーシステム |
| `10-knowledge-system.md` | — | ナレッジシステム |
| `16-artifact-vocabulary.md` | — | 成果物語彙・命名規約 |
| `examples/test-pro/` | — | `marketplace.json` / `managed-settings.json` の実例 |

**依存** — なし（ドキュメント）。ただし実装との一致は CI で保証されていないため、compose 実装が最終判断基準。

## 出典

- 開発者スキャン（`developer-scan-aidlc-workflows.md`）の Packages Found / APIs Discovered / Code Quality Indicators / Handoff Summary 節

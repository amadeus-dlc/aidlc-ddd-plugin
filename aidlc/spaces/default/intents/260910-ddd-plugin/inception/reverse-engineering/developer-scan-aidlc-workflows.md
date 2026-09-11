# aidlc-workflows コードスキャン（focused / plugin 機構）

- 対象リポジトリ: `aidlc-workflows/`（git submodule、AI-DLC v2 エンジン本体）
- コミット: `16341f82`（2026-09-10, "Merge pull request #2 from j5ik2o/upstream-sync-2-8-1"）
- スキャン目的: AI-DLC v2 向け DDD プラグインを設計・実装するために、プラグイン拡張機構を深掘りする

## Developer Code Scan Results

### Scan Coverage

- **Analyzed deeply**:
  - `core/tools/`（特に `aidlc-plugin.ts` / `aidlc-plugin-create.ts` / `aidlc-plugin-validate.ts` / `aidlc-plugin-build.ts` / `aidlc-plugin-test.ts` / `aidlc-plugin-emit.ts` / `aidlc-graph.ts` / `aidlc-stage-schema.ts` / `aidlc-sensor*.ts` の役割・行数・公開契約）
  - `core/tools/data/`
  - `core/aidlc-common/protocols/stage-definition.md`（stage frontmatter の正典）
  - `core/aidlc-common/stages/`（5 フェーズ 33 ステージのファイル一覧、`inception/domain-design.md` は frontmatter と Step 見出しまで精読）
  - `core/sensors/`（6 マニフェスト）
  - `core/scopes/`（11 スコープ、`aidlc-feature.md` は全文）
  - `core/agents/`（14 エージェント、`aidlc-architect-agent.md` の frontmatter）
  - `core/knowledge/`（Tier 1 ディレクトリ構成、`aidlc-architect-agent/` と `aidlc-developer-agent/` のファイル一覧）
  - `plugins/`（`test-pro` の全 17 ファイル。manifest / stage / scope / contribution / sensor / agent / doctor / tests を精読）
  - `scripts/`（`package.ts`、`plugin-hooks-template/compose.ts` と `aidlc-plugin-compose.ts` の anchor 解決・`adds.*` 実装分岐）
  - `docs/reference/`（`18-plugin-mechanism.md` 全文、`15-stage-definition.md`、`07-sensor-system.md`、`10-knowledge-system.md`、`16-artifact-vocabulary.md` の該当節）
- **Skimmed only**:
  - `core/hooks/`, `core/memory/`, `core/skills/`, `core/templates/`
  - `harness/`（8 ハーネスのディレクトリ構成のみ。`claude/manifest.ts`・`kimi/manifest.ts` は grep のみ）
  - `tests/`（tier 構成・ファイル数・`tests/harness/plugin-kit.ts` の export 一覧のみ）
  - `docs/guide/`, `docs/harness-engineering/`（`10-authoring-a-plugin.md` は見出しのみ）
  - `assets/`, `CHANGELOG.md`, `roadmap.html`, `.github/workflows/`（ファイル名のみ）
  - `node_modules/` は指示どおり未読

### Packages Found

単一リポジトリ・単一 private package（`aidlc-workflows-dev`）で、サブパッケージ分割はない。論理モジュールは以下。

- `core/tools` — CLI ツール群（TypeScript, 88 ファイル）— 状態機械、監査ログ、グラフコンパイル、センサー、プラグイン、ナレッジ等の決定論的処理をすべて担う
- `core/hooks` — ハーネスのライフサイクルフック（TypeScript）— 状態同期・監査追記・グラフ再コンパイル
- `core/aidlc-common` — プロトコルとステージ定義（Markdown）— `protocols/` が正典契約、`stages/<phase>/<slug>.md` が 33 ステージ
- `core/sensors` — センサーマニフェスト 6 本（Markdown+YAML）
- `core/scopes` — スコープ定義 11 本（Markdown+YAML）
- `core/agents` — エージェントペルソナ 14 本（Markdown+YAML）
- `core/knowledge` — Tier 1 方法論ナレッジ（エージェントスラグ別 15 ディレクトリ）
- `core/memory` — 空間 memory シードのひな型（`org/team/project` + `phases/`）
- `harness/<name>` — 8 ハーネス投影定義（`claude`, `codex`, `copilot`, `cursor`, `kimi`, `kiro`, `kiro-ide`, `opencode`）。各 `manifest.ts`（+ 一部 `emit.ts`）が投影の真実源
- `plugins/test-pro` — 参照プラグイン（唯一の同梱プラグイン）
- `scripts` — パッケージング／リリース／インストーラ。`package.ts`（1757 行）が全ハーネス投影の入口、`plugin-hooks-template/compose.ts`（2489 行）が配布される compose フック本体
- `tests` — smoke / unit / integration / e2e の 4 tier、`*.test.ts` 494 ファイル
- `docs` — `guide`（利用者）/ `harness-engineering`（ハーネス実装者）/ `reference`（開発者、20 章 + サブディレクトリ）

### Build System

- **Type**: bun（Node 互換ランタイム）。ビルドは「TypeScript をそのまま bun で実行 + `scripts/package.ts` によるハーネス投影生成」であり、バンドラは介在しない
- **Config Files**:
  - `package.json`（private, `type: module`。scripts は `typecheck` / `lint` / `check` の 3 本のみ）
  - `tsconfig.json` / `tsconfig.tests.json` / `tsconfig.adapters.json`（`target: ESNext`, `module: ESNext`, `types: ["bun-types"]`）
  - `biome.json`（linter のみ有効、formatter は無効。`dist/**` と一部 fixture を除外）
  - `knip.json`（未使用コード検出。entry は `core/tools/*.ts`, `core/hooks/*.ts`, `harness/*/manifest.ts`, `harness/*/emit.ts`, `scripts/package.ts` 等）
  - `bun.lock`, `mise.toml`（親リポジトリ側）, `pyproject.toml` + `uv.lock` + `zensical.toml`（ドキュメントサイト専用、Python 3.12+ / zensical 0.0.51）
- **Build Dependencies**:
  - `scripts/package.ts` → `harness/<name>/manifest.ts`（投影レコード）→ `dist/<harness>/`（gitignore）
  - `scripts/package.ts` → `plugins/<name>/` → `core/tools/aidlc-plugin-emit.ts` → `dist/plugins/<name>/<harness>/`
  - `scripts/package.ts` → `tools/data/plugin-targets.json` を書き出し、`core/tools/aidlc-plugin-build.ts` がオフラインでそれを読む（外部プラグインリポジトリからのビルドを可能にする経路）
  - stage YAML → `aidlc-graph compile` → `tools/data/stage-graph.json` + `scope-grid.json`（生成物であり、ソース管理には置かれない）
  - `bun run check` = `package.ts` → `package.ts --check`（二重生成で決定性を検証）→ `typecheck` → `lint`

### APIs Discovered

外部ネットワーク API は持たない。契約はすべて CLI サブコマンド・ファイルスキーマ・JSON verdict の形をとる。

- **CLI（プラグイン系）** — `core/tools/aidlc-plugin*.ts`、6 系統
  - `aidlc-plugin-create.ts <name> [targetDir]` — 空ディレクトリにのみ scaffold を生成。出力は `.aidlc-plugin/plugin.json`, `stages/construction/<name>-example.md`, `scopes/<name>-example.md`, `agents/<name>-example-agent.md`, `tests/README.md`, `README.md` の 6 ファイル（`hooks/compose.ts` は意図的に含めない — BUILD が注入する）
  - `aidlc-plugin-validate.ts <plugin-root>` — オフライン検証。AI-DLC プロジェクトもフレームワークチェックアウトも不要
  - `aidlc-plugin-build.ts <plugin-root> <harness> [outDir]` — 検証してから 1 ハーネス分を投影。既定出力 `<plugin-root>/dist/<harness>/`
  - `aidlc-plugin-test.ts <plugin-root> --install <project-root> [--harness <name>]` — 使い捨て candidate に投影を入れ、実 compose を 2 回走らせて「1 回目 drop なし・グラフに stage/scope が載る・2 回目バイト安定」を要求
  - `aidlc-plugin.ts`（1484 行）— `plugin list` / `plugin sync` / `plugin select`（inventory 比較、composition stamp、トランザクショナル同期）
  - `aidlc-plugin-emit.ts`（680 行）— 共有エミッタ。`package.ts` と standalone builder の両方が呼ぶ
- **プラグインマニフェスト**: `.aidlc-plugin/plugin.json`
  - 最上位は寛容（未知キー保持）: `name`（kebab-case、`core`/`aidlc`/`aidlc-*` は予約、ディレクトリ名と一致必須）、`version`（semver）、`description`、`author`、`dependencies`（**宣言のみ。composer は読まない**）
  - `aidlc.contributes` は厳格（未知キー拒否）。キーは `stages`/`overlays`/`agents`/`scopes`/`sensors`/`knowledge`/`tools`/`memory` の 8 種で、値は正準ディレクトリ文字列と完全一致必須（`stages: "stages/"`, `overlays: "contributions/"` 等）。`memory` は投影未実装のため宣言しただけで拒否される
- **ステージ frontmatter スキーマ**（`core/tools/aidlc-stage-schema.ts` / `protocols/stage-definition.md`）: `slug`（ファイル名 stem と一致）, `name?`, `phase`, `execution`(`ALWAYS`|`CONDITIONAL`), `condition`, `lead_agent`, `support_agents[]`, `mode`(`inline`|`subagent`|`pipeline`|`mob`|`agent-team` ※`agent-team` は予約で compose が拒否), `reviewer?`, `review_artifact?`, `reviewer_max_iterations?`, `review_class?`(`adversarial`|`advisory`), `summary_confirmation?`(`required`|`if-present`), `for_each?`, `workspace_requires?`, `produces[]`, `consumes[]`(`{artifact, required, conditional_on?}`), `requires_stage[]`, `scopes[]`, `sensors[]`, `inputs`, `outputs`。加えてプラグイン専用に `plugin`, `number`(表示専用), `when`(パースのみ・未評価)。`display_order` は compile 時算出
- **contribution スキーマ**（`contributions/<phase>/<slug>.md`）: `target`, `plugin`, `adds.{produces|consumes|sensors|scopes|required_sections}`, `fragments[].{anchor, order}`。本文は `## fragment: <anchor>` 見出しで区切る
- **センサーマニフェストスキーマ**（`sensors/aidlc-<id>.md`）: 必須 `id`/`kind`(`deterministic` のみ)/`command`/`default_severity`(`advisory`|`blocking`)/`description`、任意 `fire_on`(`write` 既定 | `gate`)/`category`/`matches`(glob)/`input_schema`/`output_schema`/`timeout_seconds`
- **センサーディスパッチ契約**: `<command> --stage <slug> --output-path <file>`（document 系）または `--file-path <file>`（code 系）。ディスパッチャは terminal 監査行のあとに compact JSON verdict を 1 行出力する（`fire_id`, `sensor_id`, `stage`, `output_path`, `result`, `detail_path`, 任意 `note`）
- **プラグイン doctor 契約**: `tools/<plugin>-doctor.ts` が stdout に `{"checks":[{pass, label, fix, severity}]}` を 1 オブジェクト出力。`AIDLC_PROJECT_DIR`/`AIDLC_HARNESS_DIR`/`AIDLC_PLUGIN_NAME` が渡される。既定 10 秒タイムアウト、行数 50 / stdout 256KiB / label・fix 300 文字の上限
- **選択 API**: `<harness-dir>/tools/data/harness.json` の `plugins` 配列（省略時は全プラグイン有効）。`aidlc engine plugin select <names>` が変更する
- **compose フック**: `hooks/compose.ts`（ハーネス非依存）。`CLAUDE_PLUGIN_ROOT | PLUGIN_ROOT | AIDLC_PLUGIN_ROOT`、`CLAUDE_PROJECT_DIR | AIDLC_PROJECT_DIR | PWD`、`AIDLC_HARNESS_DIR` から解決

### Frameworks & Libraries

- bun — ランタイム兼テストランナー（`bun-types` ^1.3.13）
- TypeScript ^6.0.3 — 型検査のみ（実行時トランスパイルは bun）
- `@biomejs/biome` 2.4.16 — linter（formatter は無効化）
- `@anthropic-ai/claude-agent-sdk` 0.3.158 — ハーネス統合／e2e 用
- `@xterm/headless` ^5.5.0 + `node-pty` 1.1.0 — 端末レンダリング e2e テスト用
- `smol-toml` 1.7.0 — Codex/Kimi の TOML 設定生成
- knip 6（`knip.json` の schema 参照。devDependencies には未記載でオンデマンド実行と推定）
- zensical 0.0.51（Python, ドキュメントサイト）
- ランタイム依存は実質ゼロ。標準ライブラリ＋bun API のみで動く設計

### Test Coverage

- **Test Directories**: `tests/smoke`, `tests/unit`, `tests/integration`, `tests/e2e`, `tests/hooks`, `tests/lib`, `tests/harness`, `tests/fixtures`, `tests/evidence`、加えて各プラグインの `plugins/<name>/tests/`
- **Test Frameworks**: `bun:test`（`describe`/`test`/`expect`）。ランナーは `tests/run-tests.ts`（+ `run-tests.sh` ラッパ）で tier フラグ `--smoke|--unit|--integration|--e2e`、プロファイル `--ci`（smoke+unit+integration）/`--release`（+e2e）、`--parallel N`、`--filter`、`--debug` を持つ。`AIDLC_NO_LLM=1` でライブモデル依存を閉じる
- **Coverage Config**: 行カバレッジ閾値の設定は見当たらない（`tests/gen-coverage-registry.ts` によるテスト↔要件のカバレッジレジストリ生成はある）。プラグイン機構は個別テスト ID で担保: `t188-plugin-compose`, `t224-plugin-selection`, `t242-plugin-state`, `t300-plugin-kit`, `t313-plugin-doctor-checks`, `t314-plugin-validate`, `t315-plugin-build`, `t316-plugin-test`, `t317-plugin-create`, `t327-plugin-author-routes`
- プラグイン作者向けの再利用キットが `tests/harness/plugin-kit.ts` にあり、`validatePluginContent`, `walkMarkdownFiles`, `buildPluginProjection`, `composePluginFixture`, `readPluginDropLogs`, `pluginAgentRoster`, `invokeHarness` などを export する。`plugins/test-pro/tests/plugin.test.ts` がその利用例（`validatePluginContent(PLUGIN_ROOT)` が空配列を返すことを要求）

### Code Quality Indicators

- **Linting**: biome 2.4.16。`bun run lint` = `biome check --error-on-warnings core harness scripts plugins tests`。`plugins/` が既に lint 対象に含まれている点は、新規プラグインを本リポジトリ内に置く場合に重要
- **CI/CD**: `.github/workflows/` に `ci.yml`, `codebuild.yml`, `docs.yml`, `markdownlint.yml`, `pull-request-lint.yml`, `release.yml`, `release-pr.yml`, `dispatch-v1-release.yml`, `security-scanners.yml`。`scripts/ci-changelog-guard.ts` により CHANGELOG 記載も強制される
- **Documentation**: 極めて厚い。`docs/reference/` 20 章（`18-plugin-mechanism.md` 613 行がプラグインの正典、`15-stage-definition.md` 599 行、`07-sensor-system.md` 450 行）、`docs/harness-engineering/10-authoring-a-plugin.md` に作者向けウォークスルー、`docs/reference/examples/test-pro/` に `marketplace.json`/`managed-settings.json` 等の実例。`core/tools/*.ts` のコメント密度も高く、`compose.ts` は仕様の根拠まで注記している
- 命名規約が機械的に強制される: フレームワークファイルは `aidlc-*` 接頭辞、センサーは `SENSOR_FILE_REGEX = /^aidlc-([a-z][a-z0-9-]*)\.md$/`、プラグインの scope/agent は `<plugin>-<name>.md` かつ frontmatter `name` == ファイル stem、成果物名は `/^[a-z][a-z0-9-]*$/` のフラット名前空間

### Technical Debt Signals

プラグイン作者に直接効く「宣言できるが効かない」ギャップが複数ある。いずれも `docs/reference/18-plugin-mechanism.md` §6/§7/§9 に明記されている（隠れた debt ではなく、文書化済みの deferred）。

1. `adds.requires_stage` は未マージ — contribution で宣言すると compose は drops ログに記録するだけ。`scripts/plugin-hooks-template/compose.ts:2191` の `IMPLEMENTED_ADDS = new Set(["produces","sensors","consumes","scopes","required_sections"])` が実装済みキーの唯一の真実源。DDD プラグインが「コアステージの前に自分のステージを差し込む」ことは contribution ではできず、自前ステージ側の `requires_stage` で表現するしかない
2. `required_sections` は「マージされるが機械的に強制されない」— コンパイル済みノードまで届かず、同梱の required-sections センサーはテンプレート由来の期待値で動く。宣言だけでは章の欠落を落とせない
3. `when:` 述語はパースのみで評価器がない（`aidlc-graph` が将来の実装先とだけ書かれている）。`when:` を持つステージは宣言スコープ下で無条件 EXECUTE になる
4. `after-questions` フラグメント anchor は未実装 — `locateAnchor` に case がなく "unknown anchor" として drop される（`compose.ts:1749`）。実効的に使えるのは `after-step:<n>` / `before-step:<n>` / `end-of-steps` / `in:<Compartment>` の 4 種
5. プラグインの `memory/` サブツリーは投影されない — フェーズ規約やチーム規約をプラグインから配ることは今日できない
6. `dependencies` と `aidlc.lock.json` は読まれない — バージョン制約による活性化・順序制御に依存できない
7. `aidlc.contributes` の値はディレクトリ規約と完全一致しか許されず、任意パスへのルーティングは未実装（宣言はあるが実体は規約探索）
8. 上位ルート `aidlc plugin create|test` は RFC #723 §2e で保留、`aidlc-plugin-test --dist` は RFC #722 milestone 2 まで予約
9. Kiro の folder-drop 経路にはインストール時の信頼ゲートがない（ドキュメントが security note として明示）。compose フックはユーザ権限で実行される
10. `blocking` センサーは `fire_on: gate` でのみ強制され、`fire_on: write` の blocking 宣言は当リリースでは advisory 止まり。`test-pro` の 2 センサーもその制約下で advisory として設計されている
11. センサーマニフェストのファイル名が `aidlc-<id>.md` でないと「compose は通るが発火しない」— 現在は compose が拒否＋degraded drop を記録するようになったが、旧 compose が既に配置したファイルは沈黙する既知の落とし穴
12. `test-pro` の 2 センサーマニフェストの `matches` は旧成果物ツリー路 `**/{aidlc-docs,intents}/**` を引きずっており、コアの 6 マニフェストも同じ legacy glob のまま（ドキュメントが verbatim で認めている）

## Handoff Summary

- **Intent-relevant finding**: DDD プラグインが必要とする拡張点は 3 つとも実装済みで、いずれも `plugins/test-pro/` に動く実例がある。(a) 新規ステージは `plugins/<name>/stages/<phase>/<slug>.md` に `plugin: <name>` と `scopes:` を書けば、compose 後にオーケストレータが即ルーティングする（`plugins/test-pro/stages/construction/test-pro-integration.md` が `number: 3.85` / `requires_stage: [build-and-test]` / `scopes:` 6 個の完全形）。(b) コアの `domain-design`（`core/aidlc-common/stages/inception/domain-design.md`、`lead_agent: aidlc-architect-agent`、`produces: [components, decisions, traceability]`、Step 1–8 構成、`review_artifact: components`）は contribution の理想的な target で、Step 番号が安定しているため `after-step:4`（コンポーネントカタログ生成の直後）に集約・エンティティ・値オブジェクト・境界づけられたコンテキストの散文を差し込み、`adds.produces` で DDD 成果物を足す形が素直に取れる。(c) 方法論ナレッジは `plugins/<name>/knowledge/<agent-slug>/` に置けば Tier 1 に投影されるが、**ディレクトリ名がエージェントスラグと完全一致していること**が条件で、コアの `aidlc-architect-agent` に足すのか自前の `<plugin>-<role>-agent` を立てるのかを先に決める必要がある（コアには既に `core/knowledge/aidlc-architect-agent/ddd-patterns.md` が存在し、重複設計になりうる）。
- **Risks / follow-up**:
  1. contribution では順序辺を張れない（`adds.requires_stage` が deferred）。DDD ステージをコアの `domain-design` と `units-generation` の間に置きたい場合、その順序はプラグイン自身のステージ frontmatter の `requires_stage` でしか表現できず、逆向き（コアステージを自分の後ろに回す）は原理的に不可能。ステージ配置はこの制約を前提に設計すること。
  2. `adds.scopes` は「自プラグインが所有するスコープのみ」かつ「対象スコープファイルが既にインストール済み」でなければ drop される。コアの `feature`/`enterprise` に DDD ステージを載せたい場合は contribution ではなく、自ステージの `scopes:` にコアスコープ名を書く経路になる。
  3. 成果物論理名は `<plugin>-` 接頭辞が必須（`core-*` は予約）。既存の `components` / `decisions` / `traceability` と衝突する名前は compile が拒否する。`domain-model` のような無接頭辞名は使えない。
  4. `required_sections` を宣言しても章の欠落は落ちない。DDD 成果物の章構造を強制したいなら、自前センサー（`sensors/aidlc-<id>.md` + `tools/aidlc-sensor-<id>.ts`、`fire_on: gate` + `default_severity: blocking`）を書く必要がある。書き込み時発火の blocking は当リリースでは効かない。
  5. プラグインが独自エージェントを立て、そのステージが `mode: mob|pipeline|subagent` またはいずれかの `reviewer:` を使う場合、Kiro CLI / Codex / OpenCode では**ハーネス固有のディスパッチ面**（agent-v1 JSON + `trustedAgents` 登録 / `aidlc-*-agent.toml` / `.opencode/agents/`）を手書きしない限り compose がそのステージを拒否する。`mode: inline` に寄せるか、対象ハーネスを Claude に限定するかを早期に決めること。
  6. スキャンは deep パス集合の内側に限定した。`core/hooks/`、`harness/*/manifest.ts` の投影実装、`tests/` 本体は skim のみで、ハーネス投影の細部を根拠に据える設計判断が出た場合は追加スキャンが要る。

# API ドキュメント — aidlc-workflows

**外部ネットワーク API は存在しない。** 契約はすべて (a) CLI サブコマンド、(b) ファイルスキーマ、(c) プロセス間の JSON verdict、の 3 形態をとる。本件（DDD プラグイン開発）に効く順に記す。

## 1. プラグインマニフェスト `.aidlc-plugin/plugin.json`

### 最上位（寛容 — 未知キーは保持される）

| キー | 制約 |
|---|---|
| `name` | kebab-case。`core` / `aidlc` / `aidlc-*` は予約。**ディレクトリ名と一致必須** |
| `version` | semver |
| `description` | 文字列 |
| `author` | 文字列 |
| `dependencies` | **宣言のみ。composer は読まない**（`aidlc.lock.json` も同様） |

### `aidlc.contributes`（厳格 — 未知キー拒否）

キーは 8 種。値は正準ディレクトリ文字列と**完全一致**必須（任意パスへのルーティングは未実装）。

| キー | 正準値 | 状態 |
|---|---|---|
| `stages` | `"stages/"` | 実装済み |
| `overlays` | `"contributions/"` | 実装済み |
| `agents` | `"agents/"` | 実装済み（ただしハーネス依存あり、後述） |
| `scopes` | `"scopes/"` | 実装済み |
| `sensors` | `"sensors/"` | 実装済み |
| `knowledge` | `"knowledge/"` | 実装済み（ディレクトリ名がエージェントスラグと完全一致であること） |
| `tools` | `"tools/"` | 実装済み |
| `memory` | — | **投影未実装。宣言しただけで拒否される** |

## 2. ステージ frontmatter スキーマ

正典: `core/tools/aidlc-stage-schema.ts` と `core/aidlc-common/protocols/stage-definition.md`。

| フィールド | 値 / 注記 |
|---|---|
| `slug` | ファイル名 stem と一致必須 |
| `name?` | 表示名 |
| `phase` | ideation / inception / construction / operation / initialization |
| `execution` | `ALWAYS` \| `CONDITIONAL` |
| `condition` | `CONDITIONAL` 時の条件 |
| `lead_agent` | エージェントスラグ |
| `support_agents[]` | エージェントスラグ配列 |
| `mode` | `inline` \| `subagent` \| `pipeline` \| `mob` \| `agent-team`（`agent-team` は予約で compose が拒否） |
| `reviewer?` | レビュアーエージェント |
| `review_artifact?` | レビュー対象成果物 |
| `reviewer_max_iterations?` | 数値 |
| `review_class?` | `adversarial` \| `advisory` |
| `summary_confirmation?` | `required` \| `if-present` |
| `for_each?` | 反復対象 |
| `workspace_requires?` | ワークスペース前提 |
| `produces[]` | 成果物論理名。`<plugin>-` 接頭辞必須 |
| `consumes[]` | `{artifact, required, conditional_on?}` |
| `requires_stage[]` | **順序辺を張る唯一の手段** |
| `scopes[]` | 有効化するスコープ名。コアスコープ名も書ける |
| `sensors[]` | 発火させるセンサー id |
| `inputs` / `outputs` | 説明 |
| `plugin` | プラグイン専用。プラグイン名 |
| `number` | プラグイン専用。**表示専用**（例: `3.85`） |
| `when` | プラグイン専用。**パースのみ・未評価** |
| `display_order` | compile 時に算出される（手書きしない） |

実例: `plugins/test-pro/stages/construction/test-pro-integration.md` が `number: 3.85` / `requires_stage: [build-and-test]` / `scopes:` 6 個の完全形。

## 3. contribution（overlay）スキーマ

配置: `contributions/<phase>/<slug>.md`。

| フィールド | 意味 |
|---|---|
| `target` | 対象ステージの slug（例: `domain-design`） |
| `plugin` | プラグイン名 |
| `adds.produces` | 成果物を追加。**実装済み** |
| `adds.consumes` | 入力を追加。**実装済み** |
| `adds.sensors` | センサーを追加。**実装済み** |
| `adds.scopes` | スコープを追加。**実装済み（条件付き）** — 自プラグインが所有するスコープのみ、かつ対象スコープファイルがインストール済みでなければ drop |
| `adds.required_sections` | マージされる**が機械的に強制されない** |
| `adds.requires_stage` | **未実装。drops ログに記録して破棄される** |
| `fragments[].anchor` | 差し込み位置 |
| `fragments[].order` | 同一 anchor 内の順序 |

本文は `## fragment: <anchor>` 見出しで区切る。

### `adds.*` の enforced / deferred

実装済みキーの唯一の真実源は `scripts/plugin-hooks-template/compose.ts:2191`:

```ts
IMPLEMENTED_ADDS = new Set(["produces","sensors","consumes","scopes","required_sections"])
```

`required_sections` はこの集合に**入っているがコンパイル済みノードまで届かない**ため、「マージはされるが強制はされない」という中間状態にある。`requires_stage` は集合外なので完全に破棄される。

### 利用可能な anchor

| anchor | 状態 |
|---|---|
| `after-step:<n>` | 実装済み |
| `before-step:<n>` | 実装済み |
| `end-of-steps` | 実装済み |
| `in:<Compartment>` | 実装済み |
| `after-questions` | **未実装。`locateAnchor` に case がなく unknown anchor として drop（`compose.ts:1749`）** |

## 4. センサーマニフェストスキーマ `sensors/aidlc-<id>.md`

| フィールド | 必須 | 値 |
|---|---|---|
| `id` | 必須 | ファイル名と一致（`SENSOR_FILE_REGEX = /^aidlc-([a-z][a-z0-9-]*)\.md$/`） |
| `kind` | 必須 | `deterministic` のみ |
| `command` | 必須 | 実体スクリプトの起動コマンド |
| `default_severity` | 必須 | `advisory` \| `blocking` |
| `description` | 必須 | 文字列 |
| `fire_on` | 任意 | `write`（既定）\| `gate` |
| `category` | 任意 | 分類 |
| `matches` | 任意 | glob |
| `input_schema` / `output_schema` | 任意 | スキーマ |
| `timeout_seconds` | 任意 | タイムアウト |

**強制されるのは `fire_on: gate` + `blocking` の組み合わせのみ。** `fire_on: write` の `blocking` 宣言は当リリースでは advisory 止まり（`test-pro` の 2 センサーもその制約下で advisory として設計されている）。

### センサーディスパッチ契約

呼び出し:

```
<command> --stage <slug> --output-path <file>   # document 系
<command> --stage <slug> --file-path   <file>   # code 系
```

戻り: ディスパッチャは terminal 監査行のあとに **compact JSON verdict を 1 行**出力する。フィールド: `fire_id`, `sensor_id`, `stage`, `output_path`, `result`, `detail_path`, 任意 `note`。

## 5. プラグイン doctor 契約

`tools/<plugin>-doctor.ts` が stdout に 1 オブジェクトを出力する。

```json
{"checks":[{"pass":true,"label":"...","fix":"...","severity":"..."}]}
```

環境変数 `AIDLC_PROJECT_DIR` / `AIDLC_HARNESS_DIR` / `AIDLC_PLUGIN_NAME` が渡される。既定タイムアウト 10 秒、上限は行数 50 / stdout 256KiB / `label`・`fix` 各 300 文字。

## 6. プラグイン CLI（`core/tools/aidlc-plugin*.ts`、6 系統）

| コマンド | 契約 |
|---|---|
| `aidlc-plugin-create.ts <name> [targetDir]` | **空ディレクトリにのみ** scaffold を生成。出力 6 ファイル: `.aidlc-plugin/plugin.json`, `stages/construction/<name>-example.md`, `scopes/<name>-example.md`, `agents/<name>-example-agent.md`, `tests/README.md`, `README.md`。`hooks/compose.ts` は意図的に含めない（BUILD が注入） |
| `aidlc-plugin-validate.ts <plugin-root>` | オフライン検証。AI-DLC プロジェクトもフレームワークチェックアウトも不要 |
| `aidlc-plugin-build.ts <plugin-root> <harness> [outDir]` | 検証してから 1 ハーネス分を投影。既定出力 `<plugin-root>/dist/<harness>/` |
| `aidlc-plugin-test.ts <plugin-root> --install <project-root> [--harness <name>]` | 使い捨て candidate に投影を入れ、実 compose を 2 回走らせる。要求: 1 回目 drop なし / グラフに stage・scope が載る / 2 回目バイト安定 |
| `aidlc-plugin.ts`（1484 行） | `plugin list` / `plugin sync` / `plugin select`。inventory 比較、composition stamp、トランザクショナル同期 |
| `aidlc-plugin-emit.ts`（680 行） | 共有エミッタ。`scripts/package.ts` と standalone builder の両方が呼ぶ |

上位ルートの `aidlc plugin create|test` は RFC #723 §2e で保留、`aidlc-plugin-test --dist` は RFC #722 milestone 2 まで予約。

## 7. プラグイン選択 API

`<harness-dir>/tools/data/harness.json` の `plugins` 配列（省略時は全プラグイン有効）。`aidlc engine plugin select <names>` が変更する。

## 8. compose フック契約

`hooks/compose.ts`（ハーネス非依存、BUILD が注入する）。解決順:

- プラグインルート: `CLAUDE_PLUGIN_ROOT` → `PLUGIN_ROOT` → `AIDLC_PLUGIN_ROOT`
- プロジェクト: `CLAUDE_PROJECT_DIR` → `AIDLC_PROJECT_DIR` → `PWD`
- ハーネス: `AIDLC_HARNESS_DIR`

## 9. ハーネス投影モデル（エージェント導入時の制約）

投影の真実源は `harness/<name>/manifest.ts`（8 ハーネス: `claude`, `codex`, `copilot`, `cursor`, `kimi`, `kiro`, `kiro-ide`, `opencode`）。

プラグインが独自エージェントを立て、そのステージが `mode: inline` 以外（`subagent` / `pipeline` / `mob`）または任意の `reviewer:` を使う場合、**Kiro CLI / Codex / OpenCode ではハーネス固有のディスパッチ面を手書きしない限り compose がそのステージを拒否する。**

| ハーネス | 必要な手書きディスパッチ面 |
|---|---|
| Kiro CLI | agent-v1 JSON + `trustedAgents` 登録 |
| Codex | `aidlc-*-agent.toml` |
| OpenCode | `.opencode/agents/` |

したがって「`mode: inline` に寄せる」か「対象ハーネスを Claude に限定する」かを、エージェント設計より先に決める必要がある。

## 出典

- 開発者スキャン（`developer-scan-aidlc-workflows.md`）の APIs Discovered / Technical Debt Signals / Handoff Summary 節
- `docs/reference/18-plugin-mechanism.md` §6/§7/§9、`15-stage-definition.md`、`07-sensor-system.md`、`10-knowledge-system.md`、`16-artifact-vocabulary.md`
- `scripts/plugin-hooks-template/compose.ts:1749`, `:2191`

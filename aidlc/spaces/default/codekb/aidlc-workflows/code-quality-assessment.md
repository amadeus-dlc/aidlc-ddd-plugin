# コード品質評価 — aidlc-workflows

## テストカバレッジ

**テストディレクトリ** — `tests/smoke`, `tests/unit`, `tests/integration`, `tests/e2e`, `tests/hooks`, `tests/lib`, `tests/harness`, `tests/fixtures`, `tests/evidence`、加えて各プラグインの `plugins/<name>/tests/`。`*.test.ts` は 494 ファイル。

**フレームワークとランナー** — `bun:test`。ランナー・フラグは `technology-stack.md` を参照。

**カバレッジ設定** — 行カバレッジ閾値の設定は**見当たらない**。代わりに `tests/gen-coverage-registry.ts` がテストと要件のカバレッジレジストリを生成する（要件トレーサビリティ型のカバレッジ管理）。

**プラグイン機構の担保** — 個別テスト ID で押さえられている: `t188-plugin-compose`, `t224-plugin-selection`, `t242-plugin-state`, `t300-plugin-kit`, `t313-plugin-doctor-checks`, `t314-plugin-validate`, `t315-plugin-build`, `t316-plugin-test`, `t317-plugin-create`, `t327-plugin-author-routes`。

**本件への含意** — `plugin-dev` スコープは 80% 行カバレッジ床の対象外だが、既存スイートは green のままでなければならない。テスト方法論は未確定のため既定の test-after（各テスト可能レイヤを実装してから、そのレイヤのテストを書いて実行する）が適用される。

## Lint / フォーマット

biome 2.4.16。`bun run lint` = `biome check --error-on-warnings core harness scripts plugins tests`。

**`plugins/` が既に lint 対象に含まれている点は本件に直接効く。** DDD プラグインを本リポジトリ内に置くなら、その TypeScript は初日から `--error-on-warnings` の下に入る。formatter は無効化されているため整形は強制されない。

## CI/CD

`.github/workflows/` に 9 本: `ci.yml`, `codebuild.yml`, `docs.yml`, `markdownlint.yml`, `pull-request-lint.yml`, `release.yml`, `release-pr.yml`, `dispatch-v1-release.yml`, `security-scanners.yml`。`scripts/ci-changelog-guard.ts` により CHANGELOG 記載も強制される。

決定性ゲートとして `bun run check` が二重生成を検証する（`technology-stack.md` 参照）。

## ドキュメント品質

**極めて厚い。** `docs/reference/` 20 章（`18-plugin-mechanism.md` 613 行がプラグインの正典、`15-stage-definition.md` 599 行、`07-sensor-system.md` 450 行）、`docs/harness-engineering/10-authoring-a-plugin.md` に作者向けウォークスルー、`docs/reference/examples/test-pro/` に `marketplace.json` / `managed-settings.json` の実例。`core/tools/*.ts` のコメント密度も高く、`compose.ts` は仕様の根拠まで注記している。

命名規約が機械的に強制される点もドキュメントと実装の一致に寄与している（`code-structure.md` の「コードパターン」参照）。

## 技術的負債

以下はすべて `docs/reference/18-plugin-mechanism.md` §6/§7/§9 に明記された **deferred**（隠れた debt ではない）。ただしプラグイン作者にとっては「宣言できるが効かない」ギャップとして実害がある。C 番号は `architecture.md` の制約と対応する。

| # | 内容 | 影響 | 対応 |
|---|---|---|---|
| D1 (C1) | `adds.requires_stage` は**未マージ**。contribution で宣言すると compose は drops ログに記録するだけ。実装済みキーの唯一の真実源は `scripts/plugin-hooks-template/compose.ts:2191` の `IMPLEMENTED_ADDS = new Set(["produces","sensors","consumes","scopes","required_sections"])` | **高** — コントリビューションから順序辺を張れない。「コアステージを自分のステージの後ろに回す」は原理的に不可能 | 自ステージの `requires_stage` だけで配置を表現できる設計に畳む |
| D2 (C2) | `adds.required_sections` はマージされる**が機械的に強制されない**。コンパイル済みノードまで届かず、同梱の required-sections センサーはテンプレート由来の期待値で動く | **高** — DDD 成果物の章構造を宣言だけでは保証できない | 自前センサー（`sensors/aidlc-<id>.md` + `tools/aidlc-sensor-<id>.ts`、`fire_on: gate` + `default_severity: blocking`）を書く |
| D3 (C2) | `blocking` センサーは `fire_on: gate` でのみ強制され、`fire_on: write` の blocking 宣言は当リリースでは **advisory 止まり**。`test-pro` の 2 センサーもその制約下で advisory として設計されている | 中 | 強制したい検証は必ず `fire_on: gate` に置く |
| D4 (C3) | 独自エージェント + `mode: subagent\|pipeline\|mob` または `reviewer:` は、Kiro CLI / Codex / OpenCode で**手書きのディスパッチ面**（agent-v1 JSON + `trustedAgents` 登録 / `aidlc-*-agent.toml` / `.opencode/agents/`）がないと compose がステージを拒否する | **高** — エージェント導入がそのままハーネス依存になる | `mode: inline` に寄せるか、対象ハーネスを Claude に限定するかを設計初期に決める |
| D5 (C8) | `core/knowledge/aidlc-architect-agent/ddd-patterns.md` が**既に存在する**。プラグイン側 `knowledge/aidlc-architect-agent/` に DDD ナレッジを置くとコアと二重になる | **高**（本件固有） — 内容の食い違いが生じると、どちらが正典か実行時に判別できない | 「コアの `aidlc-architect-agent` に足す」か「自前の `<plugin>-<role>-agent` を立てる」かを設計初期に決める。前者を採るなら既存ファイルとの重複箇所を明示的に洗い出す |
| D6 (C4) | `when:` 述語はパースのみで評価器がない（`aidlc-graph` が将来の実装先とだけ書かれている） | 中 — `when:` を持つステージは宣言スコープ下で**無条件 EXECUTE** | 条件分岐を `when:` に頼らない |
| D7 (C5) | `after-questions` フラグメント anchor は未実装。`locateAnchor` に case がなく "unknown anchor" として drop（`compose.ts:1749`） | 中 | 実効的に使えるのは `after-step:<n>` / `before-step:<n>` / `end-of-steps` / `in:<Compartment>` の 4 種のみ |
| D8 (C6) | プラグインの `memory/` サブツリーは投影されない（`aidlc.contributes.memory` は宣言しただけで拒否される） | 中 | フェーズ規約やチーム規約をプラグインから配ることは今日できない |
| D9 (C7) | `dependencies` と `aidlc.lock.json` は読まれない | 低 | バージョン制約による活性化・順序制御に依存しない |
| D10 | `aidlc.contributes` の値はディレクトリ規約と完全一致しか許されず、任意パスへのルーティングは未実装（宣言はあるが実体は規約探索） | 低 | 正準ディレクトリ名を守る |
| D11 | 上位ルート `aidlc plugin create\|test` は RFC #723 §2e で保留、`aidlc-plugin-test --dist` は RFC #722 milestone 2 まで予約 | 低 | `core/tools/aidlc-plugin-*.ts` を直接呼ぶ |
| D12 | Kiro の folder-drop 経路にはインストール時の**信頼ゲートがない**（ドキュメントが security note として明示）。compose フックはユーザ権限で実行される | 中（セキュリティ） | プラグイン配布経路の信頼性を運用で担保する。DDD プラグインが任意コードを含む `tools/` を配る以上、この経路の性質は配布時に説明する必要がある |
| D13 | センサーマニフェストのファイル名が `aidlc-<id>.md` でないと従来は「compose は通るが発火しない」状態になった。現在は compose が拒否 + degraded drop を記録するが、**旧 compose が既に配置したファイルは沈黙する**既知の落とし穴 | 低 | 命名を厳守し、`readPluginDropLogs` で回帰を張る |
| D14 | `test-pro` の 2 センサーマニフェストの `matches` は旧成果物ツリー路 `**/{aidlc-docs,intents}/**` を引きずっており、コアの 6 マニフェストも同じ legacy glob のまま（ドキュメントが verbatim で認めている） | 低 | 新規センサーの `matches` は現行ツリーに合わせる。`test-pro` を丸写ししない |

## スキャン範囲の限界（品質評価の信頼度に影響）

本評価は深掘りパス集合の内側に限る。以下は skim のみであり、これらを根拠に据える設計判断が出た場合は追加スキャンが必要。

- `core/hooks/` — フックの実装
- `harness/*/manifest.ts` の投影実装 — D4 の詳細な回避策を詰めるにはここを読む必要がある
- `tests/` 本体 — tier 構成・ファイル数・`tests/harness/plugin-kit.ts` の export 一覧のみ確認
- `core/memory/`, `core/skills/`, `core/templates/`, `docs/guide/`, `docs/harness-engineering/`, `assets/`, `CHANGELOG.md`, `.github/workflows/`（ファイル名のみ）

## 総評

エンジンとしての品質規律は高い（決定性検証、命名の機械強制、厚いリファレンス、494 テストファイル、9 本の CI ワークフロー）。一方でプラグイン拡張機構には**文書化された未実装領域が集中しており**、そのすべてがプラグイン作者の設計自由度を直接削る。D1 / D2 / D4 / D5 の 4 点は DDD プラグインの設計判断を先に固定してしまう性質のもので、設計着手前に方針を決めるべき項目である。

## 出典

- 開発者スキャン（`developer-scan-aidlc-workflows.md`）の Test Coverage / Code Quality Indicators / Technical Debt Signals / Handoff Summary 節
- `docs/reference/18-plugin-mechanism.md` §6/§7/§9
- `scripts/plugin-hooks-template/compose.ts:1749`, `:2191`

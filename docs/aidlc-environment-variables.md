# AI-DLC の環境変数

AI-DLC（aidlc 2.8.2）が読む環境変数と、その設定場所・優先順位をまとめる。公式ドキュメントに網羅的な一覧はないため、`.claude/tools/` と `.claude/hooks/` のソースから読み取った（2026-09-13 時点）。フレームワークを更新したら、この文書も `grep -rhoE "AIDLC_[A-Z0-9_]+" .claude/tools .claude/hooks | sort -u` の結果と突き合わせて見直すこと。

秘密値をここに書かない（`aidlc/spaces/default/memory/team.md` の Deployment 節）。

## 1. どこで設定するか

同じ変数を複数の場所で設定できる。優先順位は次のとおりで、上が勝つ。

| 優先 | 場所                                                                                          | 用途                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1    | プロセスの環境変数（シェル、Claude Code の `settings.json` / `settings.local.json` の `env`） | キーが存在すれば値を問わず最優先。`resolveProjectFlag` は env にキーがあれば記録済みの答えを見ない     |
| 2    | `aidlc.settings.local.json`（リポジトリ直下、個人用）                                         | `aidlc config ... --local` が書く。**`.gitignore` に入っていないので、置くなら自分で ignore すること** |
| 3    | `aidlc.settings.json`（リポジトリ直下、コミット対象）                                         | `aidlc config ... --project` が書く。チーム方針                                                        |
| 4    | `~/.local/share/aidlc/aidlc.settings.json`（マシン共通）                                      | `aidlc config ... --global` が書く                                                                     |

2〜4 は machine → project → local の順に浅くマージされ、後の層が勝つ。現在このリポジトリには 2〜4 のファイルはなく、`aidlc config flags --harness claude --show` はすべて `inherit [shipped default]` を返す。

### 記録できる変数は限られる

`aidlc config flags` で記録できるのは次の 4 つの設定値と 9 つのバイパスだけ。それ以外の変数は環境変数でしか設定できない。

```sh
aidlc config flags --harness claude --default-scope <scope> --project --yes
aidlc config flags --harness claude --bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --local --yes
aidlc config flags --harness claude --clear-bypass AIDLC_DISABLE_PLAN_APPROVAL_GUARD --local --yes
aidlc config flags --harness claude --show
```

ハーネスが 2 つ（claude / codex）あるので `--harness` は必須。`aidlc doctor` は記録されたバイパスを把握できるが、`settings.json` の `env` に直書きしたものは把握できない。常設するなら記録する方を選ぶ。

### Claude Code の `env` で設定するとき

- `.claude/settings.json` の `env` はコミットされ、全員の Claude Code プロセスと、そこから起動する hook・Bash に渡る。
- `.claude/settings.local.json` の `env` は gitignore 対象で、`settings.json` より優先する。
- どちらも **Claude Code の起動時に読まれる**。変更したら Claude Code を完全に再起動する（`/clear` では反映されない）。hook は毎回新しいプロセスとして起動し、そのときの環境変数を読む。
- nix 環境などで非対話シェルの PATH を変えられなくても、対話シェルから起動した Claude Code の環境は hook に引き継がれる。`aidlc doctor` の「aidlc は対話 PATH でしか解決できない」は診断上の警告で、実際の hook は動く。

## 2. 動作設定（記録可能）

| 変数                      | 値                             | 効果                                                                                                                                                                          |
| ------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AWS_AIDLC_DEFAULT_SCOPE` | `feature` `mvp` `classic` など | `/aidlc` がスコープを自動判定できないときの既定スコープ。ワークフロー作成時にだけ効く。2.8.2 の出荷 `settings.json` は `classic` を入れてくるが、このリポジトリでは外している |
| `AIDLC_USE_SWARM`         | `1`                            | Construction の自律スウォームで Dynamic Workflow（Workflow ツール）を使う。Workflow ツールが無いハーネスでは無視され、サブエージェント fan-out にフォールバックする           |
| `AIDLC_HOOK_DEBUG`        | `1`                            | 各 hook の判断経路を `<record>/.aidlc-hooks-health/hook-debug.log` に追記する。既定はオフ（書き込みコストゼロ）。hook が期待どおり止めない・止めすぎるときに使う              |
| `AIDLC_SENSOR_TIMEOUT_MS` | 正の整数                       | センサー（`.claude/sensors/`）1 本あたりのタイムアウト                                                                                                                        |

## 3. ガードのバイパス（記録可能）

いずれも値は文字列 `"1"` のときだけ有効。**外しても承認や質問が自動化されるわけではない**。ガードは「順序や証拠を機械的に確認する」層であり、それを外すと人間の判断だけが残る。多くは監査台帳に痕跡（`GUARD_DISABLED`、`PLAN_APPROVAL_BLOCKED` など）を残す。

| 変数                                    | 止めているもの                                                                                                                                                                                        | 外すとどうなるか                                                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `AIDLC_DISABLE_PLAN_APPROVAL_GUARD`     | code-generation の「計画 → Approve Plan → 実装」の順序。承認前のコード書き込みと開発者エージェント dispatch を PreToolUse hook が拒否する。承認後に計画を変えると指紋が合わなくなり再承認が必要になる | 順序が強制されなくなる。Approve Plan の質問自体は出続ける。ワークフローがある間は `GUARD_DISABLED` を記録                                  |
| `AIDLC_DISABLE_REVIEW_FREEZE_HOOK`      | レビュー要求（`REVIEW_REQUESTED`）から判定までの間、対象ソースの変更を PreToolUse hook が拒否する                                                                                                     | 凍結が効かなくなる。判定側の「ソースが変わった」拒否は別ガード（下の `AIDLC_SKIP_SOURCE_FRESHNESS`）なので、これだけ外しても判定は通らない |
| `AIDLC_DISABLE_REVIEWER_SCOPE_HOOK`     | レビュアー・サブエージェントの読み取り範囲を dispatch 記録のスコープに制限する PreToolUse hook                                                                                                        | レビュアーがスコープ外を読めるようになる                                                                                                   |
| `AIDLC_SKIP_ARTIFACT_GUARD`             | ステージ完了・承認時に `produces` の成果物が存在すること。コード生成ステージでは `aidlc/` とハーネス外に実ファイルがあることも要求                                                                    | 成果物なしで完了扱いにできる                                                                                                               |
| `AIDLC_SKIP_SUMMARY_CONFIRMATION_GUARD` | 質問フェーズの「PRE-GENERATION SUMMARY STOP」で、人間が要約を確認した受領（questions ファイルの `[Answer]:` が 1 つ）が成果物生成前にあること                                                         | 確認なしで成果物を書ける                                                                                                                   |
| `AIDLC_SKIP_HUMAN_PRESENCE_GUARD`       | approve / answer が、人間のプロンプト送信ターン（`record-human-turn` hook が記録）に紐づくこと                                                                                                        | 人間のターンなしで承認・回答を記録できる。CI で fixture を回す用途                                                                         |
| `AIDLC_SKIP_REVISION_BACKSTOP`          | approve 時に、承認対象がゲートの最新の revise / reject と整合していることの照合                                                                                                                       | 古い版を承認できてしまう                                                                                                                   |
| `AIDLC_DISABLE_ENSEMBLE_EVIDENCE`       | mob / pipeline などアンサンブル型ステージで、各協力者の貢献ファイル（先頭行 `**Collaborator:** <agent-slug>`）を証拠として要求                                                                        | 証拠なしで通る。ソースのコメントでは「正しく実行されたのにファイルを失ったステージの復旧にだけ使う」                                       |
| `AIDLC_DISABLE_USAGE_TRACKING`          | トークン使用量の集計（`fold-usage` hook、`STAGE_COMPLETED` / `WORKFLOW_COMPLETED` の rollup）                                                                                                         | 集計を止める。他の挙動には影響しない                                                                                                       |

## 4. 環境変数でしか設定できないもの

| 変数                                                                        | 値                       | 効果                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AIDLC_SKIP_SOURCE_FRESHNESS`                                               | `1`                      | `workspace_requires` なステージで、レビュー受領・判定が現在のソース指紋と一致することの検査を外す。2026-09-13 に code-generation の判定が「workspace source changed after REVIEW_REQUESTED」で通らなかったのはこの検査                                                  |
| `AIDLC_ALLOW_DIRECT_STATE_TRANSITIONS`                                      | `1`                      | `aidlc-state.ts` の遷移動詞（`approve` `advance` `complete-workflow` など）をエンジン（`aidlc-orchestrate.ts report`）を経由せず直接呼べる。ツール本体の拒否だけを外す。Claude Code の `state-transition-guard` hook は別に止めるので、人間が自分のシェルで実行する用途 |
| `AIDLC_ALLOW_DIRECT_AUDIT_EVENTS`                                           | `1`                      | 所有者限定の監査イベントを CLI から直接追記できる。テスト用                                                                                                                                                                                                             |
| `AIDLC_SKIP_REVIEWER_GATE_GUARD`                                            | `1`                      | テスト専用。完了経路では無視される                                                                                                                                                                                                                                      |
| `AIDLC_UNATTENDED`                                                          | `1`                      | 自動化ドライバが立てる。プロンプト送信を人間のターンとして記録しなくなるので、**対話中に立てると approve が通らなくなる**                                                                                                                                               |
| `AIDLC_OFFLINE`                                                             | `1` / `0`                | `aidlc update` などのネットワーク到達を止める（`--offline` 相当）。`0` で明示的に許可                                                                                                                                                                                   |
| `AIDLC_TIER_CAP`                                                            | 階層名                   | エージェントのモデル階層の上限を 1 回の起動に限って下げる。恒久設定は `aidlc/spaces/default/memory/*.md` の frontmatter `tier_cap:`                                                                                                                                     |
| `AIDLC_GATE_SENSOR_DISPATCH_TIMEOUT_MS`                                     | ms                       | 承認ゲートで走るセンサー dispatch のタイムアウト                                                                                                                                                                                                                        |
| `AIDLC_LOCK_STALE_MS`                                                       | ms（既定 10 分）         | `aidlc doctor` が「古いロック」と判定する閾値。自動取得は生きているロックを奪わない                                                                                                                                                                                     |
| `AIDLC_AUDIT_LOCK_RETRIES`                                                  | 回数（既定 200 × 100ms） | 監査台帳ロックの取得リトライ回数。並列 Bolt の競合向け                                                                                                                                                                                                                  |
| `AIDLC_METRICS_ENDPOINT` / `AIDLC_METRICS_HEADERS` / `AIDLC_METRICS_PREFIX` | URL など                 | 監査イベントを外部メトリクスへ送る。既定は未設定で何も送らない。認証値はシェル環境または gitignore 対象の `.claude/settings.local.json` にのみ設定し、コミット対象の `.claude/settings.json` には置かない                                                                                                                                                               |
| `AIDLC_CA_BUNDLE`                                                           | パス                     | CLI が HTTPS で使う CA バンドル                                                                                                                                                                                                                                         |
| `AIDLC_GH_BIN`                                                              | パス                     | リリース操作で使う `gh` の場所                                                                                                                                                                                                                                          |
| `AIDLC_RULES_DIR`                                                           | パス                     | メソッド（org / team / project / phases）の置き場。Codex 用に `.codex/config.toml` が `aidlc/spaces/default/memory` を設定している。Claude 側は `@` import で読むので不要                                                                                               |

## 5. 触らない変数

次はエンジンや hook が自分の子プロセスに渡す内部用、またはテスト用で、利用者が設定するものではない。設定すると診断が狂う。

- 位置解決: `AIDLC_PROJECT_DIR` `AIDLC_HARNESS_DIR` `AIDLC_HARNESS_NAME` `AIDLC_RUNTIME_ROOT` `AIDLC_INSTALL_ROOT` `AIDLC_*_DIR`（`SCOPES` `STAGES` `AGENTS` `SENSORS` `TEMPLATES` など。ただし、設定可能な `AIDLC_RULES_DIR` は除く）
- 権限トークン: `AIDLC_STATE_TRANSITION_OWNER`（エンジンが `orchestrate:<pid>` を子に渡す）`AIDLC_WORKSPACE_LOCK_OWNER_PID` `AIDLC_STOP_HOOK_PROBE` `AIDLC_SESSION_OVERRIDE`
- ルーティング: `AIDLC_ROUTE_*` `AIDLC_DISPATCH_*` `AIDLC_PLUGIN_*` `AIDLC_COMPILED_EXECUTABLE`
- テスト: `AIDLC_TEST_*` `AIDLC_EXPORT_FIXTURE`

## 6. Claude Code 側の変数（出荷設定が扱うもの）

AI-DLC ではなく Claude Code が読む変数。2.8.2 の出荷 `.claude/settings.json` は次を `env` に入れてくるが、**このリポジトリでは Amazon Bedrock を使わない方針（2026-09-13）** で、コミット済みの `settings.json` からは外してある。`aidlc config` で refresh したあとは、この `env` ブロックが復活していないか確認すること。

| 変数                                                | 出荷値                                | 意味                                                                       |
| --------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `CLAUDE_CODE_USE_BEDROCK`                           | `1`                                   | Claude Code を Bedrock 経由にする。このリポジトリでは設定しない            |
| `AWS_REGION` / `AWS_PROFILE`                        | `us-east-1` / なし                    | Bedrock 用。Claude Code は `~/.aws` を読まない。Bedrock を使わないなら不要 |
| `ANTHROPIC_DEFAULT_{FABLE,OPUS,SONNET,HAIKU}_MODEL` | Bedrock のモデル ID                   | モデル名の解決先。Bedrock を使わないなら設定しない                         |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`                   | `85`（`settings.local.json.example`） | コンテキスト自動圧縮を始める割合                                           |

Codex 側は `.codex/config.toml` の `model_provider` / `[model_providers.amazon-bedrock.aws]` を同じ理由でコメントアウトしてある。

## 7. このリポジトリの現状と判断の指針

- 記録済みの flag / bypass はない。`.claude/settings.local.json`（個人）に `AIDLC_DISABLE_PLAN_APPROVAL_GUARD=1` が残っているが、`260910-mobile-article-cms` のワークフローは完了済みなのでガードは何もしていない。次のワークフローを始める前に外すのが妥当。
- バイパスを常設しない。必要になったら `--local` に記録し、済んだら `--clear-bypass` する。`settings.json` の `env` に直書きするのは、`aidlc doctor` から見えなくなるので避ける。
- 詰まったときの順序は「修復 → 再提示 → break-glass」。計画承認の受領が通らないときは、エンジンが出す修復手順を先に試し、最後の手段は人間がチャットに `Override Plan Approval: <理由>` と打つ（エージェントからは提案も実行もできない）。
- 参考: 2026-09-13 の経緯。承認済み計画の修正で指紋が合わなくなり、Request Changes による再承認経路も動かなかった（awslabs/aidlc-workflows の #1021 相当）。そのときの逃げ道として `AIDLC_DISABLE_PLAN_APPROVAL_GUARD=1` を `settings.local.json` に置き、Claude Code を再起動した。

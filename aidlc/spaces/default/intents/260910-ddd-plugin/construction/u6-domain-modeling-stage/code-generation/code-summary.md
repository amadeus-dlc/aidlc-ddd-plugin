# Code Summary — U6 domain-modeling ステージ（u6-domain-modeling-stage）

## Sources

- `construction/u6-domain-modeling-stage/code-generation/code-generation-plan.md`（承認済み計画。Step 1〜10、Testing Contract、要件表、事前申告の乖離 5 点）
- `construction/u6-domain-modeling-stage/code-generation/unit-test-instructions.md`（Unit 限定コマンド 2 つと全体確認 3 つ）
- `construction/u6-domain-modeling-stage/functional-design/functional-spec.md`（§1 frontmatter 確定値、§2 本文構成、WF1〜WF4、§5 md の構成）
- `construction/u6-domain-modeling-stage/functional-design/rules.md`（BR1.1〜BR7.2）
- `construction/u6-domain-modeling-stage/functional-design/entities.md`（StageDefinition）
- `inception/requirements-analysis/requirements.md` 56〜64 行目（FR1.1〜FR1.9）
- `inception/units-generation/unit-of-work.md`（U6 の境界）
- 実装: `ddd/stages/inception/ddd-domain-modeling.md`、`ddd/.aidlc-plugin/plugin.json`、`ddd/package.json`
- テスト: `ddd/tests/framework-compatibility.test.ts`（compose 2 件）、`ddd/tests/u3-plugin-scaffold.test.ts`（FR11.2 2 件）
- compose の実測: `bun ../.codex/tools/aidlc-plugin-test.ts . --install .. --harness claude --json` の出力と、その使い捨てコピーから読んだ `stage-graph.json` / `scope-grid.json`（後述）
- エンジン: `.claude/tools/aidlc-graph.ts` 冒頭コメント（新規ステージの番号付け規則）

## 本 Unit の性質と作業の立場

U6 は kind: spec の Unit であり、実装は既存のステージ定義 `ddd/stages/inception/ddd-domain-modeling.md` 1 本である。本ステージ（Code Generation Part 2）では **`ddd/` 配下を一切改変せず**、既存実装を承認済み計画の Step 1〜10 に沿って検証し、結果を本書と `traceability.json` / `source-manifest.json` に記録した。作成物は記録 3 ファイルのみである。

## 記録したファイル

| パス | 所有 | 役割 |
|---|---|---|
| `ddd/stages/inception/ddd-domain-modeling.md` | U6（本 Unit） | ステージ定義。YAML frontmatter ＋ 英語本文（Constraints / Steps 1〜7 / Sensors / Learn） |
| `ddd/.aidlc-plugin/plugin.json` | U3 | `contributes.stages: "stages/"` を宣言。`agents` は宣言していない（FR1.3） |
| `ddd/tests/framework-compatibility.test.ts` | U9 | claude / codex の compose テスト 2 件 |
| `ddd/tests/u3-plugin-scaffold.test.ts` | U3 | `ddd-` 接頭辞テスト 2 件（FR11.2） |

`source-manifest.json` に列挙したのは本 Unit が所有する 1 ファイルだけである。

## 主要な判断

1. **実装を書き換えない。** 仕様本文と実装の差はすべて下記「計画からの逸脱」に記録し、テストの緩和や期待値の削除は行っていない。
2. **`ddd-` 接頭辞の slug を正とみなす。** FR11.2 のテストが `stages/` 配下の全ファイル名に `ddd-` 接頭辞を強制しており、センサー `ddd-model-completeness` の `matches` も `**/ddd-domain-modeling/domain-model.yaml` である。仕様本文の `domain-modeling` 表記は接頭辞規約より前の字面と判断した（unit-test-instructions.md「失敗時の扱い」の方針と一致）。
3. **compose 後の `stage-graph.json` / `scope-grid.json` は使い捨てコピーから直接読んだ。** `aidlc-plugin-test.ts` は `finally` で作業ディレクトリを削除するため、JSON 出力にはファイルパスが含まれない。そこで scratchpad にツールの写し（相対 import を絶対パスに置換し、`rmSync` 呼び出しをパス出力に置換したもの）を置き、`TMPDIR` を scratchpad に向けて実行した。`.codex/` と `ddd/` は改変していない。
4. **FR1.4 と FR1.5 は Gap と判定した。** 前者は `scope-grid.json` の実測で `plugin-dev` が EXECUTE になっており、受け入れ基準「6 スコープのみ EXECUTE」を満たさない。後者は本文に standalone の判定と語彙トピックが無く、受け入れ基準の「対話でドメインの語彙を引き出す」指示が欠けている。

## テスト実測

作業ディレクトリはすべて `ddd/`。

| コマンド | pass | fail | 終了コード | 備考 |
|---|---|---|---|---|
| `bun test tests/framework-compatibility.test.ts --test-name-pattern "composes"` | 2 | 0 | 0 | 7 件 filtered out。claude / codex とも `errors: []`、`graph.compiled: true`、`idempotent: true`、`drops: []` |
| `bun test tests/u3-plugin-scaffold.test.ts --test-name-pattern "FR11.2"` | 2 | 0 | 0 | 4 件 filtered out。ファイル名と `produces` 論理名の接頭辞 |
| `bun test tests/`（全体） | 149 | 12 | 1 | 161 件 / 10 ファイル。fail 12 件はすべて `tests/codex-dispatch-bridge.test.ts`（`aidlc-workflows/dist/codex/aidlc` の scandir ENOENT） |
| `bun run validate` | — | — | 0 | Errors: 0、warnings: 1（`compose-hook-absent`。対処不要と明記） |
| `bun run build:claude` | — | — | 0 | 出力 `ddd/dist/claude`。`dist/claude/stages/inception/ddd-domain-modeling.md` が投影された |
| `bun run build:codex` | — | — | 0 | 出力 `ddd/dist/codex`。同様に投影された |
| `bun run check` | 149 | 12 | 1 | `biome check`: 51 ファイル、指摘なし。`validate`: 0。`test` 段が上記 12 件で落ちる（既知の前提条件、計画の乖離 5） |

本 Unit の契約を踏むテストは 4 件で、すべて緑である。

**全体スイートの件数について（2026-09-12 に再実測）**: 本記録の初版は
「142 pass / 12 fail、154 件」と書いていた。その後 U4（ゴールデンケース 4 件）と
U5（層診断ケース 3 件）が同じ周回でテストを追加したため、**149 pass / 12 fail、161 件**に
増えている。**fail の 12 件は同一**で、原因も同じ既知のフィクスチャ欠落である。
本 Unit の契約を踏む 4 件は増減しておらず、いずれも緑のままである。
上表は再実測後の値に更新した。

## compose の確認結果

`bun ../.codex/tools/aidlc-plugin-test.ts . --install .. --harness claude --json`（終了コード 0）:

- `errors: []`、`drops: []`、`idempotent: true`
- `graph.compiled: true`、`graph.expectedStages: ["ddd-domain-modeling"]`、`graph.presentStages: ["ddd-domain-modeling"]`、`graph.missingStages: []`
- `warnings` は `compose-hook-absent` 1 件のみ

使い捨てコピー（`candidate/.claude/tools/data/`）から読んだ内容:

- `stage-graph.json`: `ddd-domain-modeling` が `plugin: ddd`、`phase: inception`、番号 `2.10` で載る。`lead_agent: aidlc-architect-agent`、`support_agents: [aidlc-product-agent]`、`mode: inline`、`summary_confirmation: required`、`produces` 2 件、`requires_stage: [requirements-analysis, user-stories]`、`sensors: [ddd-model-completeness]`、`reviewer: aidlc-architecture-reviewer-agent`、`review_class: advisory`、`consumes` 4 件（すべて `required: false`、後者 2 件 `conditional_on: brownfield`）、`rules_in_context` 4 件。`sensors_applicable` に `aidlc-ddd-model-completeness.md`（`fire_on: gate`、`default_severity: blocking`、`matches: **/ddd-domain-modeling/domain-model.yaml`）が束ねられている。
- `scope-grid.json` の `ddd-domain-modeling` 列: `classic` / `enterprise` / `feature` / `mvp` / `refactor` / `workshop` / **`plugin-dev`** が EXECUTE、`bugfix` / `express` / `infra` / `poc` / `security-patch` が SKIP。**EXECUTE は 7 スコープ**（FR1.4 の受け入れ基準「6 スコープのみ」を満たさない）。
- `.claude/aidlc-common/stages/inception/ddd-domain-modeling.md` が配置され、`.claude/sensors/` に `aidlc-ddd-*.md` 9 本が配置されている。drops ログのファイルは無い。

## frontmatter の照合（functional-spec.md §1、BR1）

| 項目 | 仕様 §1 | 実装 | 判定 |
|---|---|---|---|
| `slug` / ファイル名 | `domain-modeling` / `stages/inception/domain-modeling.md` | `ddd-domain-modeling` / `stages/inception/ddd-domain-modeling.md` | 乖離 1（FR11.2 規約側が正） |
| `plugin` | `ddd` | `ddd` | 適合 |
| `phase` | `inception` | `inception` | 適合 |
| `execution` / `condition` | `CONDITIONAL` / 英語一文 | `CONDITIONAL` / "Execute when the domain concepts change. …" | 適合 |
| `lead_agent` | `aidlc-architect-agent` | 同じ | 適合（FR1.3） |
| `support_agents` | `[aidlc-product-agent]` | 同じ | 適合 |
| `mode` / `summary_confirmation` | `inline` / `required` | 同じ | 適合（FR1.3） |
| `reviewer` / `review_artifact` / `review_class` / `reviewer_max_iterations` | `aidlc-architecture-reviewer-agent` / `ddd-domain-model` / `advisory` / `1` | 同じ | 適合（BR6.3） |
| `produces` | `[ddd-domain-model, ddd-domain-model-yaml]` | 同じ | 適合（BR1.4、FR1.7） |
| `consumes` | 4 件、すべて `required: false`、後者 2 件 `conditional_on: brownfield` | 同じ | 適合（BR1.5） |
| `requires_stage` | `[requirements-analysis, user-stories]` | 同じ | 適合（BR1.2、FR1.2） |
| `scopes` | 6 スコープ | 7 スコープ（`plugin-dev` を含む） | 乖離 2（BR1.3、FR1.4） |
| `sensors` | `[ddd-model-completeness]` | 同じ | 適合（BR1.4） |
| `inputs` / `outputs` | 英語一文 | 英語一文 | 適合 |
| `plugin.json` の `agents` 宣言 | 無し | 無し（`contributes` は stages / overlays / sensors / knowledge / tools） | 適合（FR1.3） |

## 本文の読み合わせ（BR1〜BR7）

| BR | 要点 | 本文の対応箇所 | 判定 |
|---|---|---|---|
| BR1.1 | 確定値、配置パス | frontmatter | 乖離 1（slug / パスのみ。他の値は適合） |
| BR1.2 | `requires_stage` 2 件 | frontmatter | 適合 |
| BR1.3 | scopes 6 つだけ | frontmatter | 乖離 2 |
| BR1.4 | produces 2 件、sensors 1 件 | frontmatter | 適合 |
| BR1.5 | consumes 全件任意 | frontmatter | 適合 |
| BR2.1 | Step 1 で with-input / standalone / rerun を判定し分岐を書く | Step 1 は with-input（"when produced"）と rerun、brownfield を書く | 乖離 3（standalone の判定と `mode_applicability` の分岐が無い） |
| BR2.2 | standalone の vocabulary トピック、回答を D<n> として出典に | 該当記述なし | 乖離 3（FR1.5 の受け入れ基準に関わる） |
| BR2.3 | brownfield は照合材料、差分は open questions | Step 1、Step 3 末尾 | 適合 |
| BR3.1 | イベント → Command → 集約候補の順 | Step 2、Step 3 | 適合（FR1.6） |
| BR3.2 | 不変条件の仮説、持てない候補は統合・格下げ | Step 3 | 適合 |
| BR3.3 | 跨がる流れは Process Manager 候補 | Step 3、Step 4 | 適合（境界の引き直しを先に提案する旨は無いが、必須化しない方針には反しない） |
| BR3.4 | Command の effect / state_effect / Domain Error / idempotency | Step 4 | 適合（`accumulation` → `command-id-memory` の指示は無い。追加所見 A） |
| BR4.1 | ID は英語小文字ケバブ、非 ASCII は id-slugs トピックで確認 | Step 4 "ID slugs when non-ASCII terms appear" | 部分適合（`proposed_slug` の提示と英語小文字ケバブの明記が無い。追加所見 B） |
| BR4.2 | rerun で ID 維持、lineage に記録 | Constraints 4 点目、Step 1、Step 5 | 適合 |
| BR4.3 | 質問ファイルに DerivationTrace / 候補表を残す | Step 2、Step 3 | 適合 |
| BR5.1 | yaml は U1 の形が正 | 冒頭、Step 5 | 適合 |
| BR5.2 | md に element_id、statement 全文、見出し「<name>（<element_id>）」、stateDiagram-v2 | Constraints 3 点目、Step 5（9 節の列挙） | 部分適合（見出し形式と stateDiagram-v2 ＋テキスト代替の指示が無い。追加所見 C） |
| BR5.3 | モジュール・デプロイ・ユースケースを書かない | 冒頭、Constraints 1 点目 | 適合（FR1.9） |
| BR5.4 | 本文は英語 | 全文 | 適合 |
| BR6.1 | (i)〜(v) の自己点検表を md 末尾に | Step 6 | 適合（FR1.8） |
| BR6.2 | Sensors 節に rule_id と修正箇所 | Sensors 節（`.schema` / `.i` / `.ii` / `.iv` / `.f-*` / `.f-absent`） | 適合 |
| BR6.3 | advisory 1 回 | frontmatter、Step 7 | 適合 |
| BR7.1 | ナレッジ 3 本を名指し | Step 1（3 本を名指し。`ddd/knowledge/` に実在） | 適合 |
| BR7.2 | コードを書かない | 全文（yaml 断片も無し） | 適合 |

## 計画からの逸脱（全件）

計画で事前申告した 5 点は、いずれも実測で確認した。加えて読み合わせで 3 点（A〜C）、compose の確認で 1 点（D）を見つけた。**いずれも実装は書き換えていない。**

1. **slug とファイル名が `ddd-domain-modeling`（仕様本文と FR1.1 は `domain-modeling`）。** FR11.2 テスト（`ddd-` 接頭辞の強制）が緑であり、センサーの `matches` パスとも整合する。実装が正しく、仕様本文の字面が古いと判断する。FR1.1 は「compose 後の `stage-graph.json` に載る」という趣旨で OK と判定した。
2. **`scopes` が 7 スコープ（`plugin-dev` を含む）。** `scope-grid.json` の実測で `plugin-dev` が EXECUTE になった。FR1.4 の受け入れ基準「6 スコープのみ EXECUTE」を満たさないため、FR1.4 を **Gap** と判定した。判断（`plugin-dev` を意図的に加えるなら要件・仕様の改訂、そうでなければ実装から除く）は承認ゲートに委ねる。
3. **standalone モードの判定と vocabulary トピックが本文に無い（BR2.1、BR2.2）。** 質問ファイル自体はコアの質問フローで生成されるが、「入力がないとき対話でドメインの語彙を引き出す」指示が無い。FR1.5 の受け入れ基準に関わるため FR1.5 を **Gap** と判定した。`consumes` が全件任意で `--single` 実行を妨げない点（BR1.5）は適合している。
4. **本 Unit の契約を踏む既存テストが 4 件で、Standard の床（5 件）を 1 件下回る。** 4 件は全部緑。本文の手順は散文で機械検査の対象外であり、本ステージで新設はしていない（記録の立場、plugin-dev の床は「既存スイートが緑」のみ）。床の不足として残す。
5. **`bun run check` が終了コード 1。** `tests/codex-dispatch-bridge.test.ts` の 12 件が `aidlc-workflows/dist/codex/aidlc` の fixture を要求し、未生成のため落ちる。本 Unit のテストは影響を受けない。修正もテストの緩和もしていない。
- **A（BR3.4、軽微）** Step 4 は effect / state_effect / Domain Error / idempotency を問うが、`accumulation` のとき idempotency の `strategy` を `command-id-memory` にする指示が無い。U1 のスキーマ検査（idempotency.j）で止まる設計なので機械的には補完されるが、手順としては欠けている。
- **B（BR4.1、軽微）** 非 ASCII 用語のときの id-slugs トピックは書かれているが、`proposed_slug` の提示と「名前セグメントは英語小文字ケバブ」の明記が無い。
- **C（BR5.2、軽微）** md の 9 節は列挙されているが、見出し形式「<name>（<element_id>）」と、transitions を持つ Aggregate への stateDiagram-v2 ＋テキスト代替の指示が無い。U4 の `.f-*` 検査は ID と statement の一致を見るため、形式の欠落で機械検査が落ちることはないが、仕様 §5 との差である。
- **D（U6 の所有外、懸念として記録）** compose 後の `stage-graph.json` で `ddd-domain-modeling` は inception の末尾 `2.10`（`delivery-planning` 2.9 の後）に置かれる。エンジンは新規ステージをフェーズ末尾に連番で追加する（`aidlc-graph.ts` 冒頭コメント）ため、`requires_stage` は「後に置く」ことは保証するが「前に置く」ことは保証しない。一方 `domain-design`（2.6）は U7 の contribution により `ddd-domain-model-yaml` を `required: true` で消費する。直列実行では `domain-design` が `ddd-domain-modeling` より先に来るため、ステージ本体の宣言（FR1.2）は満たしているものの、線形順序の意図（ADR-007、FR1.2 の「順序強制は FR3.1 と FR6.4」）は U7 / U9 の統合確認で検証する必要がある。本 Unit の乖離ではないが、承認時に把握されたい。

### Step 11 — レビュー所見 R-01・R-02 の記録（2026-09-12）

前回レビューの未解決 2 件について、実測した事実を記録する。
**アプリケーションソースには一切触れていない。**

#### E（R-01・Major）: `matches` パスの正が 2 か所で食い違っている — **承認ゲートに上げる**

逸脱 1 で「センサーの `matches` パスとも整合する」と書いたのは**実装**についてである。
**仕様本文は矛盾を抱えたままである。** 4 か所を実測した。

| 主体 | 記述 | 値 |
|---|---|---|
| U4 の仕様 | `u4-design-sensors/functional-design/functional-spec.md:20` | `**/domain-modeling/domain-model.yaml`（接頭辞なし） |
| U4 の実装 | `ddd/sensors/aidlc-ddd-model-completeness.md:9` | `**/ddd-domain-modeling/domain-model.yaml` |
| U5 の仕様 | `u5-rust-code-sensors/functional-design/rules.md:120` | `inception/domain-modeling/domain-model.yaml` |
| U5 の実装 | `ddd/tools/ddd/lib/rules/context.ts:96,104` | `"ddd-domain-modeling"` |

**U4・U5・U6 の 3 Unit すべてが「仕様は接頭辞なし・実装は接頭辞あり」という同じ形**を持つ。
FR11.2 の `ddd-` 接頭辞規約（U3 のテスト `FR11.2: stage files sit under stages/ with the
ddd- prefix` が強制）に照らして**実装が正しい**。

**恒久的な解消には functional-design ステージへの変更依頼が要る。** 仕様本文は
他ステージの成果物であり、code-generation から書き換えるのは範囲外である。
U4 と U5 はそれぞれ自分の `code-summary.md` にこの乖離を逸脱として記録済みで、
本 Unit も同じ判断（実装が正しい）をしている。3 Unit で判断は一致しており、
**残っているのは仕様本文の字面だけ**である。

#### F（R-02・Minor）: 所見自体が不正確である — 実測の根拠を添えて記録する

R-02 は本 Unit の「U4・U5 の同種の乖離と整合する」という主張について、
「U5 は読み取り範囲外で検証できず、U4 については整合していない」とする。
しかし実測では**本 Unit の主張は両方とも真**である。

- 「U4・U5 が**読む**パス」は実装を指す。U4（`aidlc-ddd-model-completeness.md:9`）も
  U5（`context.ts:96,104`）も接頭辞付きを読む。上表のとおり。
- 「同種の乖離」も真で、U4・U5・U6 の 3 Unit すべてが同じ形の乖離を持つ。

R-02 は「U4 の**仕様 対 実装**の矛盾」（U4 自身が逸脱として記録済み）と、
「本 Unit の主張が指す U4 の**実装**との整合」を混同している。

**所見を否定するために書いているのではない。** R-02 が指摘した「検証できない主張を
書くべきでない」という指摘自体は正しく、本 Unit の初版はその根拠を示していなかった。
本項で根拠（4 か所の実測）を添えたことで、主張は検証可能になった。

## 完了条件の確認

- `source-manifest.json` に本 Unit 所有の 1 パスを列挙し、実在を確認した。
- `traceability.json` の `OK` の `target` はすべてワークスペース根からの相対パスで実在する。FR1.4 と FR1.5 は `Gap`。
- `ddd/` 配下への改変は無い（`git status` の変更ファイルは他 Unit のもので、本ステージの作業では触れていない）。
  Step 11 も記録のみで、アプリケーションソースを 1 行も変更していない。
- 見つけた乖離は上記に全件記録した（計画時 5 件、読み合わせ 3 件、compose 1 件、
  レビュー所見 2 件 = E・F）。
- **レビュー所見 R-01 を逸脱 E として記録した。** `matches` パスの正が 2 か所で食い違っている
  事実と、恒久的な解消に functional-design への変更依頼が要ることを明記した。
  承認ゲートに上げる。
- **レビュー所見 R-02 について、本 Unit の主張が実測で真であることの根拠を逸脱 F に記録した。**
  4 か所を実測して示した。

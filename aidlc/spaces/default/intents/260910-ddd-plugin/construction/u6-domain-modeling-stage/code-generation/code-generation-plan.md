# Code Generation Plan — U6 domain-modeling ステージ（u6-domain-modeling-stage）

## この計画の位置づけ

本 Unit の実装は **すでに作業ツリー上に存在する**。ステージ定義
`ddd/stages/inception/ddd-domain-modeling.md`（frontmatter と英語の本文: Constraints / Steps 1〜7 /
Sensors / Learn）がそれにあたり、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。U6 は kind: spec の
Unit であり、実行時のコードを持たない。統合点は frontmatter の宣言（`produces` / `sensors` /
`requires_stage` / `scopes`）と、compose 後の `stage-graph.json` に載ることである。

そこで本計画は、**既存のステージ定義を code-generation ステージの成果として記録し、仕様に照らして
検証する**ための計画とする。既存ファイルの改変も、本文の書き起こしも行わない。
U3・U4・U5 と同じ立場をとる。

判断が要るのは**検証で仕様との乖離が見つかったとき**である。本計画は乖離を隠さず
`code-summary.md` の逸脱欄に記録し、目標を下げて通すことはしない。乖離が要件の未達に
あたる場合は承認ゲートに上げる。

## 対象と根拠

| 種別 | パス |
|---|---|
| Unit 定義 | `inception/units-generation/unit-of-work.md`（U6 = DomainModelingStage、kind: spec） |
| 要件 | `inception/requirements-analysis/requirements.md`（FR1、FR1.1〜FR1.9） |
| 機能仕様 | `construction/u6-domain-modeling-stage/functional-design/functional-spec.md`（§1 frontmatter 確定値、§2 本文構成、WF1〜WF4、SM1・SM2、§5 md の構成） |
| 規則 | `construction/u6-domain-modeling-stage/functional-design/rules.md`（BR1〜BR7） |
| 型 | `construction/u6-domain-modeling-stage/functional-design/entities.md`（StageDefinition / ConsumeEntry / StageBody / StageStep / AggregateCandidate / DerivationTrace / IdProposal / DomainModelDocument / DocumentSection） |
| 上流の設計 | `inception/domain-design/components.md`、`inception/domain-design/decisions.md`（ADR-004、ADR-006、ADR-007、ADR-010） |
| 依存する Unit の設計 | U1 `construction/u1-sensor-foundation/functional-design/functional-spec.md`（yaml の形と ID 文法、SM2）、U4 `construction/u4-design-sensors/functional-design/functional-spec.md`（WF2 model-completeness） |

実装は Markdown（YAML frontmatter ＋ 英語本文）。検証は bun で行い、compose は
`../.codex/tools/aidlc-plugin-test.ts`（`bun run validate` / `bun run build:*` と同じツール群）で確認する。
テストランナーは `bun:test`（追加依存なし）。

## Testing Contract

以下は `bun .claude/tools/aidlc-testing-posture.ts render` の出力をそのまま貼り付けたものである。
Part 2 において権威を持つのはこの契約であり、実装者は memory を独自に再解決・再解釈しない。

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "org",
  "ordering": "implement each applicable testable layer, then write and run",
  "scope": "plugin-dev",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:0dbdec58e08cf5020b398132d8493de8d1b9bd5cefa4770cb5aeb68c85cd934a",
  "contract_sha256": "sha256:8d7f1a7f51e8e641623b1e21dc4fed305238daeae0eb70f0d7e8c9b1a833a386"
}
```

### この契約を U6 に適用する

`methodology: test-after`、`ordering: implement each applicable testable layer, then write and run`。
U6 は Markdown のステージ定義 1 本であり、実行時コードを持たない spec Unit である。契約の
`testable_layers` のうち該当するのは **データモデル相当（frontmatter の宣言 = 論理名・依存・
スコープ・センサー束縛）** と **API／エンドポイント相当（compose に載り、drops が無く、2 回目の compose が
冪等であること = フレームワークとの統合契約）** の 2 層である。ビジネスロジック相当（本文の手順）は
リードが従う散文であり、機械テストの対象にならない（仕様に照らした読み合わせで検証する）。
リポジトリ／データアクセス層とフロントエンド層は成立しない。

`runner_step` の要求どおり、最初のテストステップより前に既存ランナーの疎通と Unit 限定
コマンドの確定を行う（Step 2）。`runner_ready_before_first_test: true` を満たす。

**テスト量について**: Standard 戦略は「コンポーネントあたり 5〜8 件」を求める。
U6 のコンポーネントは **DomainModelingStage** の 1 つである。本 Unit に専用のテストファイルは無く、
既存テストのうち本ステージの契約を踏むものは、`tests/framework-compatibility.test.ts` の compose テスト
（claude / codex の 2 件: drops 無し・graph.compiled・冪等）、`tests/u3-plugin-scaffold.test.ts` の
FR11.2 テスト 2 件（`stages/` 配下の `ddd-` 接頭辞、`produces` 論理名の接頭辞）の **計 4 件**である。
これは Standard の床（5 件）を **1 件下回る**。本 Unit は既存実装の記録であるためテストを新設しないが、
この不足は逸脱として `code-summary.md` に記録し、承認時に確認されたい（目標を下げて通さない）。

## Sources

- `inception/units-generation/unit-of-work.md`（U6 = DomainModelingStage、kind: spec）
- `inception/units-generation/unit-of-work-story-map.md`（U6 の割当: FR1、FR1.1〜FR1.9）
- `inception/requirements-analysis/requirements.md`（FR1 domain-modeling ステージ）
- `construction/u6-domain-modeling-stage/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `ddd/stages/inception/ddd-domain-modeling.md`（既存）
- `ddd/tests/framework-compatibility.test.ts`、`ddd/tests/u3-plugin-scaffold.test.ts`（既存。本ステージの契約を踏むテスト）
- `ddd/tests/README.md`（既存スイートの前提条件）

## 実装ステップ

契約の `plan_profile.steps` を U6 に射影したものである。「実装」と付くステップは既存実装の
**検証**を指す（本 Unit は実装を書き起こさない）。

### 基盤

- [x] **Step 1: プロジェクト構造と本番構成の骨格** — ステージ定義が `ddd/stages/inception/` に
      1 本置かれ、ファイル名が `ddd-` 接頭辞を持ち（FR11.2、U3 の規約）、`plugin.json` の
      `contributes` が `stages/` 面を宣言していることを確認する。frontmatter が `slug` / `plugin: ddd` /
      `phase: inception` / `execution: CONDITIONAL` / `condition` / `lead_agent` / `support_agents` /
      `mode: inline` / `summary_confirmation: required` / `produces` / `consumes` / `requires_stage` /
      `sensors` / `reviewer` / `review_artifact` / `review_class` / `reviewer_max_iterations` /
      `scopes` / `inputs` / `outputs` を持つことを確認する（entities.md の StageDefinition）。
- [x] **Step 2: テストランナーの疎通確認と Unit 限定コマンドの確定** — 既存の `bun:test` を確認し、
      Unit 限定コマンド `bun test tests/framework-compatibility.test.ts --test-name-pattern "composes"` と
      `bun test tests/u3-plugin-scaffold.test.ts --test-name-pattern "FR11.2"` を
      `unit-test-instructions.md` に記録する。追加依存を導入しない。

### データモデル層（frontmatter の宣言）

- [x] **Step 3: データモデル層の実装** — frontmatter の各値を `functional-spec.md` §1 の確定値と
      照合する: `lead_agent: aidlc-architect-agent`、`support_agents: [aidlc-product-agent]`、
      `mode: inline`（FR1.3、ADR-007）、`produces` が `ddd-domain-model` と `ddd-domain-model-yaml` の
      2 つだけ（BR1.4、FR1.7）、`sensors` が `ddd-model-completeness` だけ（BR1.4）、`requires_stage` が
      `[requirements-analysis, user-stories]`（BR1.2、FR1.2）、`consumes` の 4 件がすべて
      `required: false` で後者 2 件が `conditional_on: brownfield`（BR1.5、FR1.5）、`reviewer` が
      advisory 1 回（BR6.3）、`scopes` の一覧（BR1.3、FR1.4）。差分は逸脱として記録する。
- [x] **Step 4: データモデル層のテストを実装後に書いて実行** — `tests/u3-plugin-scaffold.test.ts` の
      FR11.2 テスト 2 件が本ステージのファイル名と `produces` 論理名の接頭辞を検査することを確認し、
      実行する。

### ビジネスロジック層（本文の手順 — 読み合わせ）

- [x] **Step 5: ビジネスロジック層の実装** — 本文の区画が Constraints / Steps / Sensors / Learn の
      4 つで、Steps が Step 1 Load context → Step 2 Discover events → Step 3 Derive aggregate
      candidates → Step 4 Questions and confirmation → Step 5 Write the canonical model →
      Step 6 Self-check → Step 7 Completion の 7 段であること（§2、FR1.6）、Constraints が所有権の境界
      （Aggregate 境界まで、コードを書かない、yaml が正）を書くこと（BR5.3、BR7.2、FR1.9）、Step 1 が
      with-input / standalone / rerun の 3 モードを判定し（BR2.1）、standalone の vocabulary トピック
      （BR2.2、FR1.5）、brownfield の照合材料の扱い（BR2.3）、rerun の lineage（BR4.2）を書くこと、
      Step 4 の質問トピック 7 種（BR3.4、BR4.1）、Step 5 の md 構成 9 節（§5、BR5.2）、Step 6 の
      自己点検表 (i)〜(v)（BR6.1、FR1.8）、Sensors 節の rule_id と修正箇所の案内（BR6.2）、Step 1 の
      ナレッジ 3 本の名指し（BR7.1）、本文が英語であること（BR5.4）を読み合わせる。
- [x] **Step 6: ビジネスロジック層のテストを実装後に書いて実行** — 本文は散文であり機械テストの
      対象ではない。Step 5 の読み合わせ結果（各 BR に対する適合／乖離）を `code-summary.md` の表に
      記録する。

### API／エンドポイント層（compose との統合契約）

- [x] **Step 7: API／エンドポイント層の実装** — `bun run validate` がステージ定義を受理し、
      `bun run build:claude` / `bun run build:codex` が投影できることを確認する。compose 後の
      `stage-graph.json` にステージが載り、drops ログに `requires_stage` 関連の drop が無いことを
      `aidlc-plugin-test.ts --install --json` の出力で確認する（FR1.1、FR1.2）。`scope-grid.json` で
      EXECUTE になるスコープの集合を確認する（FR1.4）。
- [x] **Step 8: API／エンドポイント層のテストを実装後に書いて実行** —
      `tests/framework-compatibility.test.ts` の compose テスト（claude / codex）を実行し、
      `errors: []`、`graph.compiled: true`、`idempotent: true`、`drops: []` を確認する。

### 構成と文書

- [x] **Step 9: 環境・ビルド構成** — `bun run validate` / `bun run build:claude` / `bun run build:codex`
      の終了コードを記録する。`bun run check` は既知の前提条件（下記）で終了コード 0 にならない
      見込みであり、結果を記録するだけで修正やテストの緩和はしない。
- [x] **Step 11: レビュー所見 R-01・R-02 を記録する（記録のみ）** —
      前回レビューの未解決 2 件について、実測した事実を `code-summary.md` の逸脱欄に記録する。
      **アプリケーションソースには一切触れない。**

  - [x] **R-01 — `matches` パスの正が 2 か所で食い違っている（承認ゲートに上げる）**

        | 主体 | 記述 | 値 |
        |---|---|---|
        | U4 の仕様 | `u4-design-sensors/functional-design/functional-spec.md:20` | `**/domain-modeling/domain-model.yaml`（接頭辞なし） |
        | U4 の実装 | `ddd/sensors/aidlc-ddd-model-completeness.md:9` | `**/ddd-domain-modeling/domain-model.yaml` |
        | U5 の仕様 | `u5-rust-code-sensors/functional-design/rules.md:120` | `inception/domain-modeling/domain-model.yaml` |
        | U5 の実装 | `ddd/tools/ddd/lib/rules/context.ts:96,104` | `"ddd-domain-modeling"` |

        3 Unit すべてが「仕様は接頭辞なし・実装は接頭辞あり」という同じ形をしている。
        FR11.2 の `ddd-` 接頭辞規約（U3 のテストが強制）に照らして**実装が正しい**。
        **恒久的な解消には functional-design ステージへの変更依頼が要る**
        （仕様本文は他ステージの成果物であり、code-generation の範囲外）。
        本 Unit はこの矛盾を逸脱として明示的に記録し、承認ゲートに上げるところまでを担う。

  - [x] **R-02 — レビュー所見自体が不正確であることを実測とともに記録する**

        R-02 は「『U4・U5 の同種の乖離と整合する』という主張は、U5 が読み取り範囲外で
        検証できず、U4 については整合していない」とする。しかし実測では
        **本 Unit の主張は両方とも真**である。

        - 「U4・U5 が**読む**パス」は実装を指しており、U4（`aidlc-ddd-model-completeness.md:9`）も
          U5（`context.ts:96,104`）も接頭辞付きを読む。
        - 「同種の乖離」も真で、U4・U5・U6 の 3 Unit すべてが同じ形の乖離を持つ。

        R-02 は「U4 の**仕様 対 実装**の矛盾」（U4 自身が逸脱として記録済み）と
        「本 Unit の主張が指す U4 の**実装**との整合」を混同している。
        **所見を否定するのではなく、実測の根拠を添えて記録し、ゲートの判断材料にする。**

- [x] **Step 10: ドキュメントとトレーサビリティ** — `code-summary.md` に作成物と判断を記録し、
      `traceability.json` に本 Unit の 10 要件 ID と実装の対応を、
      `source-manifest.json` に本 Unit が所有する全パスを列挙する。

## 要件 → 実装ステップの対応

| 要件 | 内容 | ステップ | 対象 |
|---|---|---|---|
| FR1 | domain-modeling ステージの提供 | Step 1, 5, 7 | `ddd/stages/inception/ddd-domain-modeling.md` |
| FR1.1 | `stages/inception/` に置き `plugin: ddd`、compose 後の `stage-graph.json` に載る | Step 1, 7, 8 | frontmatter、compose テスト |
| FR1.2 | `requires_stage` に `requirements-analysis`、drops 無し | Step 3, 7, 8 | frontmatter `requires_stage`、compose テスト |
| FR1.3 | `lead_agent: aidlc-architect-agent`、`mode: inline`、独自エージェント無し | Step 3 | frontmatter、`plugin.json`（U3 が `agents` を宣言しない） |
| FR1.4 | `scopes` は 6 スコープ | Step 3, 7 | frontmatter `scopes`、`scope-grid.json` |
| FR1.5 | `consumes` は `required: false`、`--single` で単独実行、入力なしなら語彙の対話 | Step 3, 5 | frontmatter `consumes`、本文 Step 1・4 |
| FR1.6 | イベント逆算 → 集約候補の手順が Step として存在 | Step 5 | 本文 Step 2・3 |
| FR1.7 | 成果物 2 本、論理名は `ddd-` 接頭辞 | Step 3, 4 | frontmatter `produces`、U3 FR11.2 テスト |
| FR1.8 | 完了条件 (i)〜(v) と人間承認 (vi) | Step 5 | 本文 Step 6・7、Sensors 節、`sensors: [ddd-model-completeness]` |
| FR1.9 | Aggregate 境界までの所有権 | Step 5 | 本文冒頭と Constraints |

FR1.8 の**検査実体**は U4 の `ddd-model-completeness` が所有し、本 Unit は `sensors:` で束ねる
（unit-of-work.md の U6 境界）。yaml のスキーマは U1、ナレッジ 3 本は U8、compose 全体の緑は U9 が所有する。

## テスト方針（Unit 限定）

- **実行コマンド**:
  - `bun test tests/framework-compatibility.test.ts --test-name-pattern "composes"`（`ddd/` を作業ディレクトリとする）
  - `bun test tests/u3-plugin-scaffold.test.ts --test-name-pattern "FR11.2"`（同上）
- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit の契約を踏む既存テストは 4 件で床を
  1 件下回る（逸脱として記録）
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であること
- **品質目標**: 契約の床を緩和しない。届かない分は目標を下げずに乖離として報告する
- **前提**: compose テストは `../.codex/tools/aidlc-plugin-test.ts` を子プロセスで起動し、使い捨ての
  コピーに対して compose する。ネットワークは使わない

## 検証

承認後、Step 1・3・5・7 は**既存実装の検証**、Step 2・4・6・8・9・10 は
**テストの実行と記録**として実施する。いずれも結果は `code-summary.md` に記録する。

- 上記 2 コマンドの実測（pass / fail 件数）
- `bun test tests/` 全体の実測（既存スイートの状態を含む）
- `bun run validate` / `bun run build:claude` / `bun run build:codex` の実測（終了コードを含む）
- compose 出力の `stage-graph.json` に本ステージが載ること、`drops` が空であること
- frontmatter の各値と `functional-spec.md` §1 の照合、本文の各区画と BR1〜BR7 の読み合わせ
- センサー `required-sections` / `linter` / `type-check` / `traceability` の本 Unit 成果物に対する判定
- `source-manifest.json` の全パスが実在し、未申告の変更が無いこと

### 計画時に判明している乖離（正直な申告）

独自の読み取りで、仕様と実装の間に次の乖離を見つけている。**いずれも実装を書き換えず、
`code-summary.md` の逸脱欄に記録する**。承認時にはこの 5 点を確認されたい。

**1. slug とファイル名が `ddd-domain-modeling` である（仕様本文は `domain-modeling`）。**
仕様 §1 と BR1.1、要件 FR1.1 は `slug: domain-modeling`、`stages/inception/domain-modeling.md` と書くが、
実装は `slug: ddd-domain-modeling`、`stages/inception/ddd-domain-modeling.md` である。FR11.2 の
`ddd-` 接頭辞規約（U3 のテスト `FR11.2: stage files sit under stages/ with the ddd- prefix` が強制）と、
U4・U5 が読む `inception/ddd-domain-modeling/domain-model.yaml` のパスに整合しており、
**実装が正しく仕様本文・FR1.1 の字面が接頭辞規約より前に書かれたもの**である。U4・U5 の同種の乖離と整合する。

**ただし U4 の仕様本文はこの矛盾を抱えたままである**（レビュー所見 R-01。Step 11 で明示的に記録する）。
`u4-design-sensors/functional-design/functional-spec.md:20` は `ddd-model-completeness` の
`matches` を `**/domain-modeling/domain-model.yaml`（接頭辞なし）と書くが、実装の
`ddd/sensors/aidlc-ddd-model-completeness.md:9` は `**/ddd-domain-modeling/domain-model.yaml` である。
本 Unit の記述は U4・U5 の**実装**との整合を述べたものであって、U4 の仕様本文との整合ではない。

**2. `scopes` に `plugin-dev` が含まれ 7 スコープである（仕様・FR1.4 は 6 スコープ）。**
BR1.3 と FR1.4 は enterprise / feature / mvp / classic / workshop / refactor の 6 つ「だけ」を求めるが、
実装は `plugin-dev` を加えた 7 つを列挙している。FR1.4 の判定「`scope-grid.json` で上記 6 スコープのみ
EXECUTE になる」に対する差であり、compose の実測で確認する。

**3. standalone モードの語彙トピックと 3 モードの明示的な判定が本文に無い（BR2.1、BR2.2、FR1.5）。**
仕様 WF2 と BR2.2 は、入力が無いとき vocabulary トピック（業務の主体、扱う「もの」、起きる出来事、
守るべき約束）を質問ファイルの先頭に置き、回答を DerivationTrace の出典にすることを求め、BR2.1 は
Step 1 で with-input / standalone / rerun を判定して以降のステップに分岐を書くことを求める。実装の本文は
rerun（既存 yaml の読み込みと lineage）と brownfield は扱うが、**standalone の判定と語彙トピックを
書いていない**。FR1.5 の受け入れ基準「入力なしで単独実行したとき質問ファイルが生成されて対話が始まる」は
コアの質問フローで質問ファイル自体は生成されるものの、「ドメインの語彙を引き出す」指示が無い。
**要件の受け入れ基準に関わる乖離**として承認時に確認されたい。

**4. 本 Unit の契約を踏む既存テストが 4 件で、Standard の床（5 件）を 1 件下回る。**
専用テストは無く、compose テスト 2 件と U3 の FR11.2 テスト 2 件が本ステージの宣言を検査する。
本文の手順（BR2〜BR7）を検査するテストは無い（散文であり機械検査の対象外）。記録の立場から
テストを新設しないが、床の不足として記録する。

**5. `bun run check` は終了コード 0 にならない見込みである。**
U3〜U5 と同じ理由（`tests/codex-dispatch-bridge.test.ts` の 12 件が要求する
`aidlc-workflows/dist/codex/aidlc` の fixture が未生成）である。本計画は要件本文に照らして判定し、
実測値と生の証拠を `code-summary.md` に併記する。

## 完了条件

- 本 Unit が所有する全アプリケーションソースが `source-manifest.json` に列挙されている
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスである
- Step 1・3・5・7 は既存実装に対する改変を行っていない。本 Unit の作成物は
  記録（`code-summary.md` / `traceability.json` / `source-manifest.json`）のみである
- 検証で見つかった乖離がすべて `code-summary.md` の逸脱欄に記録されている
- **レビュー所見 R-01 が逸脱として記録され、`matches` パスの正が 2 か所で食い違っている事実と、
  恒久的な解消に functional-design への変更依頼が要ることが明記されている**（Step 11）
- **レビュー所見 R-02 について、本 Unit の主張が実測で真であることの根拠が記録されている**（Step 11）
- Step 11 はアプリケーションソースを 1 行も変更していない

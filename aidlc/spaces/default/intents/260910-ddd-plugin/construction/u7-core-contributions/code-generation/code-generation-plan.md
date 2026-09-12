# Code Generation Plan — U7 コアステージ contribution（u7-core-contributions）

## この計画の位置づけ

本 Unit の実装は **すでに作業ツリー上に存在する**。4 本の contribution
（`ddd/contributions/inception/domain-design.md`、`ddd/contributions/construction/functional-design.md`、
`ddd/contributions/construction/infrastructure-design.md`、`ddd/contributions/construction/code-generation.md`）
がそれにあたり、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。U7 は kind: spec の Unit であり、
実行時のコードを持たない。統合点は frontmatter の `adds`（consumes / produces / sensors）と
`fragments`（anchor）、および compose 後のコアステージ本文に fragment が現れることである。

そこで本計画は、**既存の contribution を code-generation ステージの成果として記録し、仕様に照らして
検証する**ための計画とする。既存ファイルの改変も、本文の書き起こしも行わない。
U3〜U6 と同じ立場をとる。

判断が要るのは**検証で仕様との乖離が見つかったとき**である。本計画は乖離を隠さず
`code-summary.md` の逸脱欄に記録し、目標を下げて通すことはしない。乖離が要件の未達に
あたる場合は承認ゲートに上げる。

## 対象と根拠

| 種別 | パス |
|---|---|
| Unit 定義 | `inception/units-generation/unit-of-work.md`（U7 = 4 つの contribution、kind: spec） |
| 要件 | `inception/requirements-analysis/requirements.md`（FR3、FR3.1〜FR3.5、FR4、FR4.1〜FR4.3、FR5、FR5.1〜FR5.3、FR8.3） |
| 機能仕様 | `construction/u7-core-contributions/functional-design/functional-spec.md`（§1 contribution 一覧、§2 宣言成果物の指示内容、WF1〜WF5、SM1・SM2） |
| 規則 | `construction/u7-core-contributions/functional-design/rules.md`（BR1〜BR6） |
| 型 | `construction/u7-core-contributions/functional-design/entities.md`（Contribution / ContributionAdds / ConsumeEntry / Fragment / DeclarationInstruction / QuestionTopicAddition / ConventionsFragment） |
| 上流の設計 | `inception/domain-design/components.md`、`inception/domain-design/decisions.md`（ADR-003、ADR-005、ADR-007、ADR-008、ADR-009） |
| 依存する Unit の設計 | U4 `construction/u4-design-sensors/functional-design/functional-spec.md` §1〜§2（マニフェスト ID と宣言成果物の形式）、U5 `construction/u5-rust-code-sensors/functional-design/functional-spec.md` §1・§7（Rust マニフェスト ID と規約の要点） |

実装は Markdown（YAML frontmatter ＋ 英語の fragment 本文）。検証は bun で行い、compose は
`../.codex/tools/aidlc-plugin-test.ts` で確認する。テストランナーは `bun:test`（追加依存なし）。

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

### この契約を U7 に適用する

`methodology: test-after`、`ordering: implement each applicable testable layer, then write and run`。
U7 は Markdown の contribution 4 本であり、実行時コードを持たない spec Unit である。契約の
`testable_layers` のうち該当するのは **データモデル相当（frontmatter の `adds` と `fragments` の宣言）** と
**API／エンドポイント相当（compose に載り、drops が無く、合成後のノードに consumes / produces / sensors が
載り、fragment 本文が現れること）** の 2 層である。ビジネスロジック相当（fragment 本文の手順）は
リードが従う散文であり、仕様（BR2〜BR6）との読み合わせで検証する。
リポジトリ／データアクセス層とフロントエンド層は成立しない。

`runner_step` の要求どおり、最初のテストステップより前に既存ランナーの疎通と Unit 限定
コマンドの確定を行う（Step 2）。`runner_ready_before_first_test: true` を満たす。

**テスト量について**: Standard 戦略は「コンポーネントあたり 5〜8 件」を求める。U7 のコンポーネントは
4 つの contribution（DomainDesignContribution / FunctionalDesignContribution /
InfrastructureDesignContribution / CodeGenerationContribution）である。専用テストは無く、
本 Unit の契約を踏む既存テストは `tests/framework-compatibility.test.ts` の compose テスト 2 件
（claude / codex: drops 無し・冪等）と `tests/u3-plugin-scaffold.test.ts` の 2 件
（FR11.2 `adds.produces` 論理名の接頭辞、FR11.5 `adds.requires_stage` / `when:` 等の非依存）の **計 4 件**で、
コンポーネントごとの床（5 件）を満たさない。本 Unit は既存実装の記録であるためテストを新設しないが、
この不足は逸脱として `code-summary.md` に記録し、承認時に確認されたい（目標を下げて通さない）。

## Sources

- `inception/units-generation/unit-of-work.md`（U7 = 4 つの contribution、kind: spec）
- `inception/units-generation/unit-of-work-story-map.md`（U7 の割当: FR3〜FR5、FR8.3 の 15 件）
- `inception/requirements-analysis/requirements.md`（FR3 domain-design、FR4 functional-design、FR5 infrastructure-design、FR8.3 code-generation へのバインド）
- `construction/u7-core-contributions/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `ddd/contributions/inception/domain-design.md`、`ddd/contributions/construction/{functional-design,infrastructure-design,code-generation}.md`（既存）
- `ddd/tests/framework-compatibility.test.ts`、`ddd/tests/u3-plugin-scaffold.test.ts`（既存。本 Unit の契約を踏むテスト）
- `ddd/CHANGELOG.md`（v0.1.0 の Notes: design contribution が `produces` を持たない理由）
- `ddd/tests/README.md`（既存スイートの前提条件）

## 実装ステップ

契約の `plan_profile.steps` を U7 に射影したものである。「実装」と付くステップは既存実装の
**検証**を指す（本 Unit は実装を書き起こさない）。

### 基盤

- [x] **Step 1: プロジェクト構造と本番構成の骨格** — contribution が `contributions/<phase>/<target>.md` に
      1 ステージ 1 ファイルで置かれ（BR1.1）、`plugin.json` の `contributes` が `contributions/` 面を宣言し、
      各ファイルの frontmatter が `target` / `plugin: ddd` / `adds` / `fragments` を持つことを確認する。
      `adds` が consumes / produces / sensors の 3 面だけを使い（BR1.2）、anchor が 4 種のうちのもので
      `<n>` がコアの現行ステップ番号に合うこと（BR1.3、FR3.4）を、コアのステージ定義
      （`.claude/aidlc-common/stages/inception/domain-design.md`、`.../construction/functional-design.md`、
      `.../construction/infrastructure-design.md`、`.../construction/code-generation.md`）の Steps 見出しと
      照合して確認する。
- [x] **Step 2: テストランナーの疎通確認と Unit 限定コマンドの確定** — 既存の `bun:test` を確認し、
      Unit 限定コマンド `bun test tests/framework-compatibility.test.ts --test-name-pattern "composes"` と
      `bun test tests/u3-plugin-scaffold.test.ts --test-name-pattern "FR11.2|FR11.5"` を
      `unit-test-instructions.md` に記録する。追加依存を導入しない。

### データモデル層（`adds` と `fragments` の宣言）

- [x] **Step 3: データモデル層の実装** — 4 本の `adds` を `functional-spec.md` §1 の表と照合する:
      domain-design は consumes `ddd-domain-model-yaml`（required: true）、produces `ddd-aggregate-mapping`、
      sensors 3 本（BR2.1、BR2.2、BR2.4、FR3.1、FR3.5）; functional-design は produces
      `ddd-use-case-declarations`、sensors 3 本（BR3.1、BR3.3）; infrastructure-design は produces
      `ddd-layer-structure`、sensors 2 本（BR4.1、BR4.3）; code-generation は sensors 3 本のみ（BR5.1、FR8.3）。
      fragments の anchor が §1 の表（after-step:2 / 4、after-step:2 / 4、after-step:2 / 5、
      after-step:1 / in:Sensors）と一致すること、論理名がすべて `ddd-` 接頭辞であること（BR6.4）を確認する。
      差分は逸脱として記録する。
- [x] **Step 4: データモデル層のテストを実装後に書いて実行** — `tests/u3-plugin-scaffold.test.ts` の
      FR11.2（`adds.produces` の接頭辞）と FR11.5（`adds.requires_stage` / `when:` / `after-questions` に
      依存しない）の 2 件を実行する。

### ビジネスロジック層（fragment 本文 — 読み合わせ）

- [x] **Step 5: ビジネスロジック層の実装** — 各 fragment の本文を読み合わせる: 見出しが
      `### Step <n>x (ddd): <title>`（`in:Sensors` は見出しなし）で英語（BR1.6）、40 行目安（BR1.5）、
      追加のみで上書き・削除の表現が無い（BR1.4）。domain-design の Step 2x が 2 軸と写像先の質問を含み
      （BR2.3、FR3.3）、Step 4x が `ddd-aggregate-mapping.md` を U4 の形式（各行の必須項目）で書かせ、
      再定義を禁じる（BR2.2、BR6.2、FR3.2）。functional-design の Step 2x が規約 5 点・進行役・
      整合性境界・再実行可能性の手順と 6 項目の質問を含み（BR3.2、FR4.1、FR4.2）、Step 4x が
      `ddd-use-case-declarations.md` を U4 の形式で書かせ、対象のない Unit は `use_cases: []`（BR3.1、BR6.3）、
      複数集約は advisory と案内する（BR3.4）。infrastructure-design の Step 2x が層構造・ポート規約・
      永続化基盤・RMU の手順を含み（BR4.2、FR5.1〜FR5.3）、Step 5x が `ddd-layer-structure.md` を
      U4 の形式で書かせる（BR4.1）。code-generation の Step 1x が命名・配置規約と (a)〜(n) の要点、
      replay 名、I/O クレート一覧を含み（BR5.2）、`in:Sensors` が 3 マニフェストの契機・rule_id の意味・
      直し方を案内する（BR5.3）。宣言成果物の共通規約（fenced yaml が正、`schema_version: 1` と
      `model_ref`、人間向けの表の併記。BR6.1）が指示されていることを確認する。
- [x] **Step 6: ビジネスロジック層のテストを実装後に書いて実行** — 本文は散文であり機械テストの
      対象ではない。Step 5 の読み合わせ結果（各 BR に対する適合／乖離）を `code-summary.md` の表に記録する。

### API／エンドポイント層（compose との統合契約）

- [x] **Step 7: API／エンドポイント層の実装** — `bun run validate` が 4 本を受理し、
      `bun run build:claude` / `bun run build:codex` が投影できることを確認する。compose 後の
      `stage-graph.json` の 4 ノードに consumes / produces / sensors が載り（FR3.1、FR3.5、FR4.3、FR5.4 の
      検査実体側、FR8.3）、drops ログに unknown anchor が無く（FR3.4）、合成後の本文に fragment が現れること
      （FR4.2、FR5.2、FR5.3）を `aidlc-plugin-test.ts --install --json` の出力で確認する。
- [x] **Step 8: API／エンドポイント層のテストを実装後に書いて実行** —
      `tests/framework-compatibility.test.ts` の compose テスト（claude / codex）を実行し、
      `errors: []`、`graph.compiled: true`、`idempotent: true`、`drops: []` を確認する。

### 構成と文書

- [x] **Step 9: 環境・ビルド構成** — `bun run validate` / `bun run build:claude` / `bun run build:codex` の
      終了コードを記録する。`bun run check` は既知の前提条件（下記）で終了コード 0 にならない見込みであり、
      結果を記録するだけで修正やテストの緩和はしない。
- [x] **Step 11: レビュー所見 R-01・R-02 を記録し、引き取り先を明示する（記録のみ）** —
      前回レビューの未解決 2 件はいずれも**本 Unit の所有外**にある。
      実測した事実と引き取り先を `code-summary.md` に記録する。
      **アプリケーションソースには一切触れない。**

  - [x] **R-01 — `reviewer-scope` フックの字面判定がアンカーされていない（フレームワークの欠陥）**

        レビュアーが `ddd/contributions/construction/functional-design.md` と
        `ddd/contributions/construction/infrastructure-design.md` を読もうとして拒否された件。
        原因を `.claude/hooks/aidlc-reviewer-scope.ts` で特定した。

        `judgeLexicalPath`（313-322 行）は `construction` という名前の**パス要素を
        位置に関係なく**探し、見つかった位置から `judgeOccurrence`（228-239 行）に渡す。
        `judgeOccurrence` は次の要素が担当 Unit でなければ拒否する。したがって
        `ddd/contributions/construction/<file>` は、記録の
        `<record>/construction/<unit>/` とは無関係であるにもかかわらず拒否される。

        同じファイル内の `judgeResolvedPath`（324 行〜）は
        `scope.constructionRoot`（記録配下の construction）に正しくアンカーされている。
        **字面判定だけがアンカーを欠いている。**

        - **本 Unit の成果物の欠陥ではない。** `.claude/hooks/` はフレームワークの
          ファイルで、DDD プラグイン（`ddd/`）にも本 Unit の `source-manifest.json`
          （4 パス）にも含まれない。
        - 回避手段は無い。`ddd/dist/{claude,codex}/contributions/construction/...` も
          同じ要素を含むため同様に拒否される。
        - **引き取り先はフレームワーク側の修正**であり、本ワークフローの範囲外である。
          この Unit は原因の特定までを記録として残す。

  - [x] **R-02 — `CHANGELOG.md` の文言が実装の非対称性と食い違う（引き取り先は U9）**

        `ddd/CHANGELOG.md:43-46` は「The design contributions deliberately bind sensors
        and instructions without adding a `produces` artifact」と複数形で一般化するが、
        実測では `produces` を持つのは 4 本中 1 本である。

        | contribution | `produces` |
        |---|---|
        | `contributions/inception/domain-design.md:8` | **あり**（`ddd-aggregate-mapping`） |
        | `contributions/construction/functional-design.md` | なし |
        | `contributions/construction/infrastructure-design.md` | なし |
        | `contributions/construction/code-generation.md` | なし |

        同じ `CHANGELOG.md:17-18` は `domain-design` について
        「consumes the canonical model, produces the aggregate mapping」と正しく書いており、
        **同一文書内で読み方が割れる**。43 行目の「design contributions」が
        `functional-design` と `infrastructure-design` の 2 本だけを指すのか、
        `domain-design` を含む全体を指すのかが文面から決まらない。

        - **`ddd/CHANGELOG.md` は U9 所有である**（`u9-release-quality` の
          `source-manifest.json` に含まれ、本 Unit の 4 パスには含まれない）。
        - **引き取り先は U9**。本 Unit は contribution 側の実態（1 本のみ `produces` を持つ）が
          正しいことを実測で確認し、文言の是正を U9 への申し送りとして記録する。
        - 4 本の contribution 自体に欠陥は無い。非対称性は意図されたもので、
          その理由（contributed artifact が全 unit kind に適用され、kind で刈られた
          `review_artifact` を持つコアステージのスキーマ検査を落とすため）は
          `CHANGELOG.md:44-46` が正しく説明している。

- [x] **Step 10: ドキュメントとトレーサビリティ** — `code-summary.md` に作成物と判断を記録し、
      `traceability.json` に本 Unit の 15 要件 ID と実装の対応を、
      `source-manifest.json` に本 Unit が所有する 4 パスを列挙する。

## 要件 → 実装ステップの対応

| 要件 | 内容 | ステップ | 対象 |
|---|---|---|---|
| FR3 | domain-design への contribution | Step 1, 3, 5, 7 | `contributions/inception/domain-design.md` |
| FR3.1 | `adds.consumes` に正規モデル（required） | Step 3, 7 | domain-design の `adds.consumes` |
| FR3.2 | 写像先に参照 ID 必須、再定義しない | Step 5 | domain-design Step 4x |
| FR3.3 | 集約ごとの 2 軸の宣言 | Step 5 | domain-design Step 2x・4x |
| FR3.4 | fragments で手順挿入、anchor は 4 種のみ | Step 1, 5, 7 | 4 本の `fragments` |
| FR3.5 | `adds.sensors` で参照 ID 検査と正規モデル存在検査をバインド | Step 3, 7 | domain-design の `adds.sensors` |
| FR4 | functional-design への contribution | Step 1, 3, 5, 7 | `contributions/construction/functional-design.md` |
| FR4.1 | ユースケース定義の 6 項目 | Step 5 | functional-design Step 2x・4x |
| FR4.2 | 規約 5 点・進行役・整合性境界・再実行可能性の手順 | Step 5, 7 | functional-design Step 2x |
| FR4.3 | `adds.sensors` で (g)(h)(i)(d)(j) をバインド | Step 3, 7 | functional-design の `adds.sensors`（設計側 (j)。(g)(h)(i)(d) は code-generation。仕様 §8） |
| FR5 | infrastructure-design への contribution | Step 1, 3, 5, 7 | `contributions/construction/infrastructure-design.md` |
| FR5.1 | 層構造の宣言（非 CQRS / CQRS、RMU） | Step 5 | infrastructure-design Step 2x・5x |
| FR5.2 | ポート・リポジトリ規約の手順 | Step 5, 7 | infrastructure-design Step 2x |
| FR5.3 | 永続化基盤と RMU 設計の手順 | Step 5, 7 | infrastructure-design Step 2x |
| FR8.3 | Rust センサーを code-generation に `adds.sensors` でバインド | Step 3, 7 | `contributions/construction/code-generation.md` の `adds.sensors` |

FR4.4・FR5.4・FR5.5（設計側センサーの検査実体）は U4 が、FR7（コード側）は U5 が所有する。
宣言成果物の形式は U4、規約の値は U2 / U5、根拠のナレッジは U8 が所有し、本 Unit は参照するだけである。

## テスト方針（Unit 限定）

- **実行コマンド**:
  - `bun test tests/framework-compatibility.test.ts --test-name-pattern "composes"`（`ddd/` を作業ディレクトリとする）
  - `bun test tests/u3-plugin-scaffold.test.ts --test-name-pattern "FR11.2|FR11.5"`（同上）
- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit の契約を踏む既存テストは 4 件で、
  4 コンポーネントの床を満たさない（逸脱として記録）
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
- compose 出力の 4 ノードの consumes / produces / sensors、`drops` が空であること、fragment 本文の出現
- 4 本の frontmatter と `functional-spec.md` §1 の照合、fragment 本文と BR1〜BR6 の読み合わせ
- センサー `required-sections` / `linter` / `type-check` / `traceability` の本 Unit 成果物に対する判定
- `source-manifest.json` の全パスが実在し、未申告の変更が無いこと

### 計画時に判明している乖離（正直な申告）

独自の読み取りで、仕様と実装の間に次の乖離を見つけている。**いずれも実装を書き換えず、
`code-summary.md` の逸脱欄に記録する**。承認時にはこの 5 点を確認されたい。

**1. functional-design と infrastructure-design の contribution が `adds.produces` を持たない。**
仕様 §1・BR3.1・BR4.1 は `adds.produces` に `ddd-use-case-declarations` / `ddd-layer-structure` を加えることを
求めるが、実装の 2 本は `adds.sensors` だけを宣言し、宣言成果物の書き出しは fragment（Step 4x / 5x）の
指示だけで行う。`ddd/CHANGELOG.md` v0.1.0 の Notes は理由を「contributed artifact は全 Unit kind に
適用され、kind で刈り込まれた `review_artifact` を持つコアステージがスキーマ検査に失敗するため、
意図的に produces を足さずセンサーと指示だけを束ねた」と記す。フレームワーク制約に起因する**意図的な
乖離**だが、`stage-graph.json` の 2 ノードに produces が載らないため、宣言成果物はコアの `produces` 契約の
外にある（ゲートの必須成果物にならない）。domain-design は produces を持つ。承認時に確認されたい。

**2. FR8.3 の `matches: **/*.rs` は満たしていない（意図的、ADR-003）。**
FR8.3 は Rust センサーの `matches:` を `**/*.rs` とするが、U5 のマニフェストは `**/code-summary.md` を契機に
申告ソースを検査する（ADR-003、U5 BR1.1）。本 Unit の責務（`adds.sensors` で 3 本をバインド）は満たしており、
`matches` の値は U5 が所有する。要件の字面との差として記録する。

**3. FR4.3 の (g)(h)(i)(d) は functional-design ではなく code-generation に束ねている（仕様 §8）。**
FR4.3 は 5 つの規則 ID を functional-design にバインドすると読めるが、(g)(h)(i)(d) はコード規則で、
functional-design のゲートには Rust コードが無い。仕様 §8 と BR3.3 のとおり、(j) と 6 項目を設計側
（`ddd-mapping-declarations` / `ddd-design-advisories`）で、(g)(h)(i)(d) を code-generation の 3 本で満たす。
要件の字面との差はゲートで人間の判断に委ねる。

**4. 本 Unit の契約を踏む既存テストが 4 件で、Standard の床（コンポーネントあたり 5 件）を満たさない。**
専用テストは無く、compose テスト 2 件と U3 の FR11.2 / FR11.5 テスト 2 件のみ。fragment 本文が合成後に
現れること（FR4.2、FR5.2、FR5.3 の受け入れ基準）を固定するテストは無く、compose 出力の目視確認で代替する。
記録の立場からテストを新設しないが、床の不足として記録する。

**5. `bun run check` は終了コード 0 にならない見込みである。**
U3〜U6 と同じ理由（`tests/codex-dispatch-bridge.test.ts` の 12 件が要求する
`aidlc-workflows/dist/codex/aidlc` の fixture が未生成）である。本計画は要件本文に照らして判定し、
実測値と生の証拠を `code-summary.md` に併記する。

## 完了条件

- 本 Unit が所有する全アプリケーションソース（4 本）が `source-manifest.json` に列挙されている
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスである
- Step 1・3・5・7 は既存実装に対する改変を行っていない。本 Unit の作成物は
  記録（`code-summary.md` / `traceability.json` / `source-manifest.json`）のみである
- 検証で見つかった乖離がすべて `code-summary.md` の逸脱欄に記録されている
- **レビュー所見 R-01 の原因が `.claude/hooks/aidlc-reviewer-scope.ts` の
  `judgeLexicalPath`（313-322 行）のアンカー欠如として特定され、本 Unit の成果物の欠陥では
  ないこと、引き取り先がフレームワーク側であることが記録されている**（Step 11）
- **レビュー所見 R-02 について、`produces` を持つ contribution が 4 本中 1 本であるという
  実測と、`ddd/CHANGELOG.md` が U9 所有であるため引き取り先が U9 であることが
  記録されている**（Step 11）
- Step 11 はアプリケーションソースを 1 行も変更していない

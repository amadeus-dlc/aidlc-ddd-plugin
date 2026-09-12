# Code Generation Plan — U3 プラグイン足場（u3-plugin-scaffold）

## この計画の位置づけ

本 Unit の足場は **すでに作業ツリー上に存在する**。`ddd/.aidlc-plugin/plugin.json`、
`ddd/package.json`、`ddd/biome.json`、`ddd/.gitignore` と、`plugin.json` が指す 5 つの面
（`stages/`、`contributions/`、`sensors/`、`knowledge/`、`tools/`）がそれにあたり、
`ddd/CHANGELOG.md` の v0.1.0 に含まれている。

そこで本計画は、**既存の足場を code-generation ステージの成果として記録する**ための計画とする。
Step 1・3・5・7・8 は既存の足場の検証であり、新しい足場を書き起こすことも既存ファイルを
改変することもない。

ただし U3 には**本 Unit に属するテストファイルが存在しない**。Standard 戦略は
「コンポーネントあたり 5〜8 件」を求めるため、本計画は Step 4・6 として
`ddd/tests/u3-plugin-scaffold.test.ts` を**新規に追加**し、足場の契約を固定する。
これが本 Unit で唯一新しく書くアプリケーションソースである。

**本改訂で Step 8b を追加した（未実施）。** 前回レビューの未解決 Major 所見 R-02 —
`traceability.json` の FR11.2 が他 Unit（U6）所有のファイルを `target` に据えており、
`code-summary.md` の逸脱 5 の説明文が実データと食い違っている — を記録の修正として直す。
アプリケーションソースには触れない。

## 対象と根拠

| 種別 | パス |
|---|---|
| Unit 定義 | `inception/units-generation/unit-of-work.md`（U3 = PluginPackaging、kind: packaging、複雑度 S） |
| 要件 | `inception/requirements-analysis/requirements.md`（FR11.1、FR11.2、FR11.3、FR11.5） |
| 参照設計 | `inception/domain-design/decisions.md`（ADR-007）、`inception/domain-design/components.md` |
| 既存の足場 | `ddd/.aidlc-plugin/plugin.json`、`ddd/package.json`、`ddd/biome.json`、`ddd/.gitignore` |

U3 は packaging の Unit であり、機能設計（`functional-design/`）を持たない。
上流は `unit-of-work.md` と `requirements.md` の 2 つだけである。

実装言語は TypeScript、ランタイムは bun、フォーマッタ／リンタは Biome 2.5.12。
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

### この契約を U3 に適用する

`methodology: test-after`、`ordering: implement each applicable testable layer, then write and run`。
U3 は packaging であり、UI・HTTP・DB を持たない。契約の `testable_layers` のうち該当するのは
**データモデル相当（プラグインが宣言する 5 面と、各面が指すディレクトリの実在）** と
**ビジネスロジック相当（検証・ビルドの配線と、成果物論理名の接頭辞規約）** の 2 層である。
API/endpoint と frontend の層は成立せず、リポジトリ／データアクセス層も存在しない。

`runner_step` の要求どおり、最初のテストステップより前に既存ランナーの疎通と
Unit 限定コマンドの確定を行う（Step 2）。`runner_ready_before_first_test: true` を満たす。

**テスト量について**: Standard 戦略は「コンポーネントあたり 5〜8 件」を求める。
U3 のコンポーネントは **PluginPackaging の 1 つ**であり、既存のテストファイルが無いため、
本計画で `ddd/tests/u3-plugin-scaffold.test.ts` を新設し、**6 件**を置く（Step 4・6）。
6 件は床（5 件）を満たす。既存の `framework-compatibility.test.ts`、`install.test.ts`、
`codex-dispatch-bridge.test.ts` には触れない。

## Sources

- `inception/units-generation/unit-of-work.md`（U3 = PluginPackaging、kind: packaging、複雑度 S）
- `inception/requirements-analysis/requirements.md`（FR11.1、FR11.2、FR11.3、FR11.5）
- `ddd/.aidlc-plugin/plugin.json`（既存の足場）
- `ddd/package.json`、`ddd/biome.json`、`ddd/.gitignore`（既存の配線）
- `ddd/tests/README.md`（既存スイートの前提条件）

## 実装ステップ

### 基盤

- [x] **Step 1: プロジェクト構造と本番構成の骨格** — `ddd/.aidlc-plugin/plugin.json` に
      `aidlc.contributes` の 5 面（`stages/`、`contributions/`、`sensors/`、`knowledge/`、
      `tools/`）を宣言し、`agents` と `scopes` は宣言しない（FR11.1、FR11.5）。
      成果物の論理名はフラット名前空間で `ddd-` を接頭辞とする規約をここで固定する（FR11.2）。
- [x] **Step 2: テストランナーの疎通確認と Unit 限定コマンドの確定** — 既存の `bun:test` を確認し、
      Unit 限定コマンド `bun test tests/u3-plugin-scaffold.test.ts` を
      `unit-test-instructions.md` に記録する。追加依存を導入しない。

### データモデル層（宣言された 5 面）

- [x] **Step 3: データモデル層の実装** — `plugin.json` の `contributes` を 5 面のパスとして確定し、
      面ごとのディレクトリ（`stages/`、`contributions/`、`sensors/`、`knowledge/`、`tools/`）を
      置く。`name` / `version` / `dependencies` を宣言する。
- [x] **Step 4: データモデル層のテストを実装後に書いて実行** — 3 件。
      **FR11.1** として 5 面が過不足なく宣言され `agents` / `scopes` を含まないこと、
      **FR11.1** として 5 面が指すディレクトリがすべて実在し空でないこと、
      **FR11.2** として `stages/` 配下のステージファイル名が `ddd-` 接頭辞を持つことを確認する。

### ビジネスロジック層（検証・ビルドの配線と接頭辞規約）

- [x] **Step 5: ビジネスロジック層の実装** — `package.json` に `validate` / `build:claude` /
      `build:codex` / `check` を配線し（FR11.3）、`check` を `check:biome` → `validate` → `test` の
      順に束ねる。`biome.json` の `files.includes` に対象を列挙し、`formatter.lineWidth` を 120、
      `linter.rules.preset` を `recommended` に固定する。`ddd/.gitignore` がビルド成果物
      （`dist/`）と依存（`node_modules/`）を管理外にする。
- [x] **Step 6: ビジネスロジック層のテストを実装後に書いて実行** — 3 件。
      **FR11.3** として 4 スクリプトが存在し `check` が 3 段を順に含むこと、
      **FR11.2** として `stages/` と `contributions/` の `produces` に出る論理名が
      `ddd-` で始まり無接頭辞名を含まないこと、
      **FR11.5** として足場が未実装機構（`requires_stage`、`when:`、`after-questions`、
      `required_sections`、`memory/` の配布）に依存していないことを確認する。

### 構成と文書

- [x] **Step 7: 環境・ビルド構成** — `.gitignore` が `dist/` と `node_modules/` を除外し、
      `biome.json` の `files.includes` が `!!src/entries/data`、`!!tests/fixtures`、
      `!!tools/ddd/lib/rust/vendor` を除外していることを確認する。検証とビルドは
      ワークスペース直下の `.codex/tools/` を参照し、プラグイン本体に実行時依存を増やさない。
- [x] **Step 8: ドキュメントとトレーサビリティ** — `code-summary.md` に作成物と判断を記録し、
      `traceability.json` に FR11.1〜FR11.3・FR11.5 と足場の対応を、`source-manifest.json` に
      本 Unit が作成・変更した全パスを列挙する。
- [x] **Step 9: テスト構成** — `bun:test` を既定のまま使い、専用設定ファイルを追加しない。
      新設するテストは `ddd/` を作業ディレクトリとし、`plugin.json` と `package.json` を
      **実物のまま読む**。マニフェストをモックしない（宣言そのものが検証対象だからである）。

### レビュー所見への対応（R-02・記録の修正）

- [ ] **Step 8b: `traceability.json` の FR11.2 の `target` を本 Unit 所有の検証物に直す** —
      現在の `target` は `ddd/stages/inception/ddd-domain-modeling.md` だが、これは
      U6（domain-modeling ステージ）が所有するファイルで、本 Unit の `source-manifest.json`
      （5 パス）に含まれない。FR11.2（論理名の `ddd-` 接頭辞）を本 Unit が最も直接に検証して
      いるのは自分のテストであり、`ddd/tests/u3-plugin-scaffold.test.ts` の 2 件
      （`:141` stage files sit under stages/ with the ddd- prefix、
      `:161` logical artifact names produced by stages and contributions are prefixed）が
      それにあたる。`target` をこのテストファイルに改める。
  - [ ] 併せて `code-summary.md` の逸脱 5 の説明文を実データに一致させる。現在の説明は
        「FR11.1 / FR11.5 は宣言そのもの（`plugin.json`）、FR11.2 は接頭辞規約を固定するテスト」
        と書くが、実際の `traceability.json` は FR11.5 → テストファイル、
        FR11.1 → `plugin.json` であり、説明と割り当てが一致していない。
        修正後の正しい対応は次のとおりで、4 件すべてが本 Unit 所有のパスを指す。

        | 要件 | `target` | 種別 |
        |---|---|---|
        | FR11.1 | `ddd/.aidlc-plugin/plugin.json` | 宣言そのもの |
        | FR11.2 | `ddd/tests/u3-plugin-scaffold.test.ts` | 接頭辞規約を固定するテスト 2 件 |
        | FR11.3 | `ddd/package.json` | 配線（GAP） |
        | FR11.5 | `ddd/tests/u3-plugin-scaffold.test.ts` | 未実装機構への非依存を固定するテスト |

      アプリケーションソースは変更しない。本ステップは記録のみの修正である。

## 要件 → 実装ステップの対応

| 要件 | 内容 | ステップ | 対象 |
|---|---|---|---|
| FR11.1 | `contributes` は stages / overlays / sensors / knowledge / tools の 5 面。agents・scopes は宣言しない | Step 1, 3, 4 | `.aidlc-plugin/plugin.json`、5 面のディレクトリ |
| FR11.2 | 成果物の論理名はフラット名前空間で `ddd-` 接頭辞 | Step 1, 4, 6, 8b | `stages/`、`contributions/`、テスト |
| FR11.3 | `validate` / `build:claude` / `build:codex` / `check` が成功する | Step 5, 6, 検証 | `package.json` |
| FR11.5 | 未実装の機構に依存しない（`requires_stage`、`when:`、`after-questions`、`required_sections`、`memory/` 配布、`dependencies` によるバージョン制御） | Step 1, 6 | `plugin.json`、`stages/`、`contributions/` |

FR11.4（compose 統合テスト）と FR11.6（README）は U9 が所有する。本 Unit では扱わない。
NFR4 の「既存テスト 2 本は緑のまま」は、既存スイートに触れないことで満たす。

## テスト方針（Unit 限定）

- **実行コマンド**: `bun test tests/u3-plugin-scaffold.test.ts`（`ddd/` を作業ディレクトリとする）
- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit は PluginPackaging の 1 コンポーネントに 6 件
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であること
- **品質目標**: 契約の coverage floor を緩和しない。落ちた場合は目標を下げずに乖離を報告する

## 検証

承認後、Step 1・3・5・7・8 は**既存の足場の検証**、Step 2・4・6・9 は**テストの追加**、
Step 8b は**記録の修正**として実行する。いずれも結果は `code-summary.md` に記録する。

- `bun test tests/u3-plugin-scaffold.test.ts` の実測（pass / fail 件数）
- `bun test tests/` 全体の実測（既存スイートの状態を含む）
- `bun run validate` / `bun run build:claude` / `bun run build:codex` / `bun run check` の
  4 コマンドの実測（終了コードを含む）
- センサー `required-sections` / `linter` / `type-check` / `traceability` の本 Unit 成果物に対する判定
- `source-manifest.json` の全パスが実在し、未申告の変更が無いこと

**FR11.3 の見込みについて（正直な申告）**: 既存の `tests/codex-dispatch-bridge.test.ts` は
`aidlc-workflows/dist/codex/aidlc` の fixture を必要とし、`ddd/tests/README.md` が
「the two pre-existing harness-adapter suites need the `aidlc-workflows` dist fixture」
「skip-fail when that dist is not built」として既知の前提条件に挙げている。
`aidlc-workflows/` は読み取り専用のサブモジュールであり、明示的な指示なしには再生成しない。
したがって **`bun run check` は終了コード 0 にならない見込み**である。実測値を記録し、
FR11.3 の 4 コマンドのうち `check` だけが環境の前提条件で未達であることを明記する。
目標を下げて通すことはしない。

## 完了条件

- 本 Unit が作成・変更した全アプリケーションソースが `source-manifest.json` に列挙されている
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスである
- `traceability.json` のすべての `target` が**本 Unit 所有のパス**である。すなわち
  `source-manifest.json` の 5 パスのいずれかを指しており、他 Unit 所有のファイルを
  `target` に据えていない（Step 8b）
- `code-summary.md` の逸脱 5 の説明文が `traceability.json` の実データと一致している（Step 8b）
- Step 1・3・5・7・8 は既存の足場に対する改変を行っていない。アプリケーションソースの改変は
  Step 2・4・6・9 のテスト新設のみで、そのパスは `source-manifest.json` に含める。
  Step 8b は記録のみの修正であり、アプリケーションソースを変更しない

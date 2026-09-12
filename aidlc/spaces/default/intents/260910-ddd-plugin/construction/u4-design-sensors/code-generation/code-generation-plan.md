# Code Generation Plan — U4 設計センサー（u4-design-sensors）

## この計画の位置づけ

本 Unit の実装は **すでに作業ツリー上に存在する**。6 本のマニフェスト
（`ddd/sensors/aidlc-ddd-*.md`）、6 本の実行スクリプト（`ddd/tools/ddd-sensor-*.ts`）、
宣言成果物の解析器（`ddd/tools/ddd/lib/sensors/`）、ゴールデンケースのランナーと設計ケース
（`ddd/tests/golden/`）、および 2 本のテストファイル（`ddd/tests/u4-*.test.ts`）がそれにあたり、
いずれも `ddd/CHANGELOG.md` の v0.1.0 に含まれている。

そこで本計画は、**既存の実装を code-generation ステージの成果として記録し、仕様に照らして
検証する**ための計画とする。Step 1〜11 は既存の実装の検証であり、実装の書き起こしは行わない。
U3（`u3-plugin-scaffold`）と同じ立場をとる。

**本改訂で Step 12 を追加した（未実施）。** 前回レビューで未解決のまま残った乖離 2 —
3 本のマニフェストがスクリプトの発行する rule_id を 4 つ宣言しておらず、うち 3 つは
blocking でゲートを閉じうる — について、承認ゲートで「マニフェストに宣言する」判断を得た。
Step 12 はその判断を実行する。既存ファイルへの改変はこの 1 ステップに限られる。

判断が要るのは**検証で仕様との乖離が見つかったとき**である。本計画は乖離を隠さず
`code-summary.md` の逸脱欄に記録し、目標を下げて通すことはしない。乖離が要件の未達に
あたる場合は承認ゲートに上げる。

## 対象と根拠

| 種別 | パス |
|---|---|
| Unit 定義 | `inception/units-generation/unit-of-work.md`（U4 = DesignSensorSuite + GoldenCaseSuite（規約と設計センサー分）、kind: library、複雑度 L） |
| 要件 | `inception/requirements-analysis/requirements.md`（FR4.4、FR5.4、FR5.5、FR6、FR6.1〜FR6.6、FR8.1、FR8.2、FR8.7、NFR4） |
| 機能仕様 | `construction/u4-design-sensors/functional-design/functional-spec.md`（WF1〜WF8、SM1・SM2、§1 マニフェスト、§2 成果物形式） |
| 規則 | `construction/u4-design-sensors/functional-design/rules.md`（BR1〜BR8 の全規則） |
| 型 | `construction/u4-design-sensors/functional-design/entities.md`（SensorManifest / DesignCheck / DeclarationDocument / GoldenCase / ExpectedVerdict） |
| 上流の設計 | `inception/domain-design/components.md`、`inception/domain-design/decisions.md`（ADR-002、ADR-004、ADR-008、ADR-009） |
| 依存する Unit の設計 | `construction/u1-sensor-foundation/functional-design/functional-spec.md`（`runSensor` / `loadDomainModel` / `checkCompleteness` / `readStageStatus` / `index.resolve`） |

実装言語は TypeScript、ランタイムは bun。テストランナーは `bun:test`（追加依存なし）。
フォーマッタ／リンタは Biome 2.5.12（`biome check --error-on-warnings .`）。

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

### この契約を U4 に適用する

`methodology: test-after`、`ordering: implement each applicable testable layer, then write and run`。
U4 は UI・HTTP・DB を持たないライブラリである。契約の `testable_layers` のうち該当するのは
**データモデル相当（マニフェストと宣言成果物の解析契約）**、**ビジネスロジック相当（6 本の検査）**、
**API／エンドポイント相当（センサースクリプトの起動契約 = `--stage` / `--output-path` と
1 行 JSON verdict）** の 3 層である。リポジトリ／データアクセス層とフロントエンド層は成立しない。

`runner_step` の要求どおり、最初のテストステップより前に既存ランナーの疎通と Unit 限定
コマンドの確定を行う（Step 2）。`runner_ready_before_first_test: true` を満たす。

**テスト量について**: Standard 戦略は「コンポーネントあたり 5〜8 件」を求める。
U4 のコンポーネントは **DesignSensorSuite（6 センサー）と GoldenCaseSuite（規約と設計センサー分）**
である。既存のテストは 2 本（`ddd/tests/u4-design-sensors.test.ts` に 17 件、
`ddd/tests/u4-golden.test.ts` に 40 件のゴールデンケース＋3 件の規約テスト）で、
いずれのコンポーネントも床（5 件）を満たす。**本 Unit でテストを新設しない**（既存実装の記録であるため）。

## Sources

- `inception/units-generation/unit-of-work.md`（U4 = DesignSensorSuite + GoldenCaseSuite、kind: library、複雑度 L）
- `inception/units-generation/unit-of-work-story-map.md`（U4 の割当: FR4.4、FR5.4、FR5.5、FR6、FR6.1〜FR6.6、FR8.1、FR8.2、FR8.7、NFR4）
- `inception/requirements-analysis/requirements.md`（FR6 設計検査、FR8.1〜FR8.2 マニフェスト、FR8.7 ゴールデンケース、NFR4）
- `construction/u4-design-sensors/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `ddd/sensors/aidlc-ddd-*.md`（6 本、既存）
- `ddd/tools/ddd-sensor-*.ts`、`ddd/tools/ddd/lib/sensors/`（既存）
- `ddd/tests/golden/runner.ts`、`ddd/tests/golden/design/cases.ts`、`ddd/tests/u4-design-sensors.test.ts`、`ddd/tests/u4-golden.test.ts`（既存）
- `ddd/tests/README.md`（既存スイートの前提条件）

## 実装ステップ

契約の `plan_profile.steps` を U4 に射影したものである。「実装」と付くステップは既存実装の
**検証**を指す（本 Unit は実装を書き起こさない）。

### 基盤

- [x] **Step 1: プロジェクト構造と本番構成の骨格** — 6 マニフェストを `ddd/sensors/` に
      フラット配置し（`aidlc-<id>.md`、`id: ddd-<name>`）、1 マニフェストにつき
      `tasks` ではなく **1 本の実行スクリプト**を `ddd/tools/ddd-sensor-<name>.ts` に対応させる
      （FR8.1、entities.md の SensorManifest / DesignCheck）。各マニフェストが
      `id` / `kind: deterministic` / `command` / `default_severity` / `fire_on: gate` /
      `matches` / `description` / `category` / `timeout_seconds` / `checks` を持つことを確認する。
- [x] **Step 2: テストランナーの疎通確認と Unit 限定コマンドの確定** — 既存の `bun:test` を確認し、
      Unit 限定コマンド `bun test tests/u4-design-sensors.test.ts` と
      `bun test tests/u4-golden.test.ts` を `unit-test-instructions.md` に記録する。
      追加依存を導入しない。

### データモデル層（宣言成果物の解析契約）

- [x] **Step 3: データモデル層の実装** — 3 つの `ddd-` 宣言成果物
      （`ddd-aggregate-mapping`、`ddd-use-case-declarations`、`ddd-layer-structure`）の
      **解析契約を U4 が所有する**（entities.md: 「解析契約の所有者は U4」）。Markdown の最初の
      fenced yaml を正とし、`schema_version: 1` と `model_ref` を要求し、
      `aggregate_mappings` / `use_cases` / `layer_structures` を entities.md の属性どおりに読む
      （`ddd/tools/ddd/lib/sensors/declaration.ts`、ADR-008）。
- [x] **Step 4: データモデル層のテストを実装後に書いて実行** — 解析の正常系・異常系
      （fence 無し、`schema_version` 不一致、`model_ref` 欠落）と、`line` の算出を
      `tests/u4-design-sensors.test.ts` が踏むことを確認する。

### ビジネスロジック層（6 本の検査）

- [x] **Step 5: ビジネスロジック層の実装** — 6 本の検査を実装する。すべて U1 の `runSensor` に
      評価コールバックを渡す薄いファイルとし、正規モデルの読み込み・完全性検査・参照解決・
      状態ファイルの読み取りは U1 に委ねる（functional-spec.md §7）。
      model-completeness（BR2 / WF2）、model-presence（BR3 / WF3）、reference-ids（BR4 / WF4）、
      mapping-declarations（BR5 / WF5）、layer-structure（BR6 / WF6）、design-advisories（BR7 / WF7）。
      ある検査の失敗が他の検査を止めないこと、意味判断を扱わないこと（FR6.6）、
      layer-structure が Rust と Cargo を読まないこと（BR6.6）を確認する。
- [x] **Step 6: ビジネスロジック層のテストを実装後に書いて実行** — 6 センサーそれぞれに
      正常系と違反系のテストがあることを確認する。加えてゴールデンケース（Step 9）が
      規則ごとの違反系を網羅する。

### API／エンドポイント層（センサーの起動契約）

- [x] **Step 7: API／エンドポイント層の実装** — 全スクリプトが
      `--stage <slug> --output-path <path>` で起動され、標準出力に **1 行の compact JSON
      verdict**（`pass` / `findings_count` / `findings[].{rule_id,file,line}` / 任意の `note`）を出し、
      成功で終了コード 0、資産欠落で 127 を返すことを確認する（FR8.5、BR7）。
      severity はマニフェストの宣言（blocking 5 本、advisory 1 本）を転記するだけで、
      U4 はゲートの開閉を決めない（FR8.2、BR7.4）。
- [x] **Step 8: API／エンドポイント層のテストを実装後に書いて実行** — テストは
      **スクリプトを子プロセスとして起動する**（`import` すると `process.exit` がテストを巻き込むため。
      `ddd/tests/README.md` の注記）。正常系・違反系・決定性（3 回実行して一致）を確認する。

### ゴールデンケース

- [x] **Step 9: ゴールデンケースのランナーと設計ケース** — ランナーが
      `tests/golden/<suite>/` のケースを一時ディレクトリに実体化し、
      **実運用と同じ引数**でスクリプトを起動し、`pass` と findings の
      `(rule_id, file)` 集合を完全一致で比較する（BR8.2、BR8.4）。fixture は `tests/` 配下に置き
      `tools/` には置かない（BR8.6）。設計ケースが全マニフェストを覆い、
      網羅性（宣言された各 rule_id に違反ケースが 1 件以上。BR8.3）と決定性（BR8.5）を
      テストで確認する。U5 が同じランナーを `tests/golden/rust/` に使えることを確認する（functional-spec.md §7）。

### 構成と文書

- [x] **Step 10: 環境・ビルド構成** — `bun run validate` が 6 マニフェストを受理し、
      `bun run build:claude` / `bun run build:codex` が `{{HARNESS_DIR}}` を展開して
      投影できることを確認する。`bunx` などの追加ツールチェーンを要求しない（NFR2 の精神、
      `ddd/tests/README.md`）。
- [x] **Step 11: ドキュメントとトレーサビリティ** — `code-summary.md` に作成物と判断を記録し、
      `traceability.json` に本 Unit の 14 要件 ID と実装の対応を、
      `source-manifest.json` に本 Unit が所有する全パスを列挙する。

### レビュー所見への対応（乖離 2 — 未宣言の 4 経路）

- [x] **Step 12: 未宣言の 4 つの rule_id を、所有する 3 本のマニフェストに宣言する** —
      スクリプトは発行するがマニフェストの `checks:` に無い次の 4 つを宣言に加える。
      対象はいずれも「宣言ブロックが壊れている／正規モデルが読めない」という**不正入力の
      ハンドリング経路**であり、同じ形の `reference-ids.document` / `.model` は
      `rules.md` BR4.1 に明記され、マニフェストにも宣言済みである。
      **本ステップはスクリプトの振る舞いを一切変えない**。宣言を実装の実態に合わせるだけである。

      | rule_id | マニフェスト | スクリプト | `requirement` | `inputs` |
      |---|---|---|---|---|
      | `mapping-declarations.document` | `sensors/aidlc-ddd-mapping-declarations.md` | `:27` | ADR-008 | `[ddd-aggregate-mapping, ddd-use-case-declarations]` |
      | `mapping-declarations.model` | 同上 | `:31` | FR6.1 | `[ddd-domain-model-yaml, U1 loadDomainModel]` |
      | `layer-structure.model` | `sensors/aidlc-ddd-layer-structure.md` | `:39` | FR6.1 | `[ddd-domain-model-yaml, U1 loadDomainModel]` |
      | `design-advisories.document` | `sensors/aidlc-ddd-design-advisories.md` | `:21` | ADR-008 | `[ddd-use-case-declarations, ddd-layer-structure]` |

      `requirement` / `inputs` は `reference-ids` の同種の宣言に揃える
      （`reference-ids.document` → ADR-008、`reference-ids.model` → FR6.1）。
      `outcome` は既存の全宣言と同じく `finding` とする。
  - [x] **ゴールデンケースを 4 件追加して 4 経路を踏ませる** — `tests/u4-golden.test.ts` の
        「every declared rule has a violation case」は、宣言された rule_id ごとに
        `violation-` で始まるケースを 1 件以上要求する（`UNREACHABLE` に挙げたものを除く）。
        宣言を足すだけではこのテストが落ちるため、`tests/golden/design/cases.ts` に
        `violation-document` / `violation-model` 相当の 4 件を加える。
        既存の `ddd-reference-ids` の `violation-document`（宣言 yaml を `# no yaml\n` に差し替え）と
        `violation-model`（`model_ref` を実在しないパスに差し替え）を雛形とする。
  - [x] **`rules.md` への仕様化は本 Unit では行わない** — この 4 経路は `rules.md` の
        BR5・BR6・BR7 のいずれにも現れない（grep で 0 件）。仕様本文への追記は
        functional-design ステージの成果物への変更であり、code-generation の範囲外である。
        本 Unit は宣言と実装を一致させるところまでを担い、**仕様と宣言の乖離は逸脱として残す**。
        恒久的な解消には functional-design への変更依頼が要る旨を `code-summary.md` に記録する。

## 要件 → 実装ステップの対応

| 要件 | 内容 | ステップ | 対象 |
|---|---|---|---|
| FR4.4 | 複数集約に跨がるユースケースを advisory で報告する | Step 5, 9 | `design-advisories.multi-aggregate` |
| FR5.4 | 層構造の (k)(l)(m)(n) を宣言のみから検査する | Step 5, 9 | `layer-structure.k/.l/.m-name/.m-media/.n` |
| FR5.5 | リポジトリスコープと store の意味を advisory で報告する | Step 5, 9 | `design-advisories.repository-scope/.store-upsert` |
| FR6 | 設計成果物のセンサー群 | Step 1, 5, 7, 9 | 6 マニフェストと 6 スクリプト |
| FR6.1 | (e) 未定義 ID・廃止 ID・循環置換を下流成果物との間で検出する | Step 3, 5, 9 | `reference-ids.undefined/.deprecated/.cycle` |
| FR6.2 | (f) `domain-model.md` と yaml の不整合を yaml を正として検出する | Step 5, 9 | `model-completeness.f-missing/.f-unknown/.f-invariant/.f-absent` |
| FR6.3 | (j) 非冪等操作の冪等性戦略の欠落・過少を検出する | Step 5, 9 | `mapping-declarations.j` |
| FR6.4 | `domain-modeling` が EXECUTE のとき正規モデルの存在と全参照解決を blocking で検査し、SKIP なら pass にする | Step 5, 9 | `model-presence.missing/.invalid/.unresolved`、SKIP の note |
| FR6.5 | `domain-modeling` の機械完了条件 (i)〜(v) を検査する | Step 5, 9 | `model-completeness.schema/.i/.ii/.iv` と (f) 群 |
| FR6.6 | 意味判断が要る指摘は止めずに報告する | Step 5, 9 | `design-advisories`（advisory） |
| FR8.1 | マニフェストと実行スクリプトの対で提供する | Step 1, 3, 7 | `sensors/aidlc-ddd-*.md`、`tools/ddd-sensor-*.ts` |
| FR8.2 | blocking は `fire_on: gate` ＋ `default_severity: blocking`、advisory は別マニフェスト | Step 1, 7 | 6 マニフェストの宣言 |
| FR8.7 | 各センサーに違反あり／なしのゴールデンケースを同梱し、テストで通過を確認する | Step 9 | `tests/golden/`、`tests/u4-golden.test.ts` |
| NFR4 | 各センサーにゴールデンケース、スキーマに適合／不適合サンプル、compose 統合テスト。既存テスト 2 本は緑のまま | Step 4, 6, 8, 9 | `tests/`、`tests/fixtures/` |

FR1.8 / FR3.5 / FR4.3 / FR8.3 は **横断要件**であり、本 Unit はその**検査実体**を提供する。
マニフェストをどのステージに束ねるかは U6・U7 が宣言する（unit-of-work.md の U4 境界）。
Rust コードセンサー（FR7、FR8.3、NFR1、NFR3）は U5 が所有し、本 Unit では扱わない。

## テスト方針（Unit 限定）

- **実行コマンド**:
  - `bun test tests/u4-design-sensors.test.ts`（`ddd/` を作業ディレクトリとする）
  - `bun test tests/u4-golden.test.ts`（同上）
- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit のコンポーネントは
  DesignSensorSuite（6 センサー）と GoldenCaseSuite で、既存テストが床を満たす
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であること
- **品質目標**: 契約の coverage floor を緩和しない。落ちた場合は目標を下げずに乖離を報告する
- **テストの起動方法**: センサースクリプトを `import` せず**子プロセスとして起動する**。
  スクリプトが `process.exit` を呼ぶため、直接 import するとテストランナーごと終了してしまう
  （`ddd/tests/README.md` の注記）。これは実運用のディスパッチャ契約と同じ経路でもある

## 検証

承認後、Step 1・3・5・7・9・10 は**既存実装の検証**、Step 2・4・6・8・11 は
**テストの実行と記録**、Step 12 は**宣言とゴールデンケースの追加**として実施する。
いずれも結果は `code-summary.md` に記録する。

- `bun test tests/u4-design-sensors.test.ts` の実測（pass / fail 件数）
- `bun test tests/u4-golden.test.ts` の実測（pass / fail 件数）。Step 12 の後、
  「every declared rule has a violation case」が緑であること（追加した 4 件が踏まれている）
- `bun test tests/` 全体の実測（既存スイートの状態を含む）
- `bun run validate` / `bun run build:claude` / `bun run build:codex` の実測（終了コードを含む）。
  Step 12 でマニフェストを変更するため、`validate` が 6 マニフェストを引き続き受理すること
- 6 本のマニフェストが宣言する rule_id と、6 本のスクリプトが実際に発行する rule_id の照合。
  **Step 12 の後、この差が 0 件であること**
- センサー `required-sections` / `linter` / `type-check` / `traceability` の本 Unit 成果物に対する判定
- `source-manifest.json` の全パスが実在し、未申告の変更が無いこと

### 計画時に判明している乖離（正直な申告）

独自の読み取りで、仕様と実装の間に次の乖離を見つけている。**いずれも実装を書き換えず、
`code-summary.md` の逸脱欄に記録する**。承認時にはこの 3 点を確認されたい。

**1. ゴールデンケースの構成規約が仕様と異なる。**
仕様 BR8.1 / WF8.1〜8.2 / SM2 は
`tests/golden/<suite>/<sensor-id>/<case-name>/` に `record/` と `expected.json` を置き、
ランナーがディレクトリを列挙して `expected.json` を読む形を要求している。
実装は `tests/golden/design/cases.ts` の **TypeScript の表**でケースを持ち、
`files` / `state` を一時ディレクトリに実体化してからスクリプトを起動する。
`expected.json` は存在せず、`record/` のディレクトリ列挙も無い（したがって SM2 の
「構成規約違反 → Invalid」経路も無い）。
一方で BR8.2 の比較（`pass` と `(rule_id, file)` 集合の完全一致）、BR8.3 の網羅性、
BR8.4 の実引数起動、BR8.5 の決定性、BR8.6 の fixture 配置は満たしている。

**2. 3 本のマニフェストが、スクリプトの発行する rule_id を 4 つ宣言していない。**
**→ 本改訂の Step 12 で解消する。**
`mapping-declarations.document` / `mapping-declarations.model` / `layer-structure.model` /
`design-advisories.document` はスクリプトが発行するが、各マニフェストの `checks:` に無い。
BR1.1 / BR1.2 はマニフェストが自分の検査を宣言することを求めており、
宣言の無い所見は `requirement` / `inputs` / `outcome` を持たない。
またゴールデンケースの網羅性テストは「宣言された rule_id」を起点にするため、
この 4 つは網羅性の検査対象から外れる。
`reference-ids` は同種の `.document` / `.model` を宣言しており、他 3 本は揃っていない。

前回周回では「実装を書き換えず記録にとどめる」方針だったが、
うち 3 つ（`mapping-declarations.document` / `.model`、`layer-structure.model`）は
センサーの `default_severity: blocking` を受けるため、**不正入力のときに
`requirement` も `inputs` も持たない blocking 所見でゲートが閉じうる**。
承認ゲートで「マニフェストに宣言する」判断を得たため、Step 12 で宣言を実装に一致させる。
ただし `rules.md` への仕様化は functional-design の範囲であり、本 Unit では行わない。

**3. model-presence が読む正規モデルのパスが、仕様本文の記載と異なる。**
仕様 WF3.3 は `<record>/inception/domain-modeling/domain-model.yaml` と書くが、
実装は `<record>/inception/ddd-domain-modeling/domain-model.yaml` を読む。
ステージ slug は `ddd-domain-modeling`（`ddd/stages/inception/ddd-domain-modeling.md` の
frontmatter `slug`）であり、FR11.2 の `ddd-` 接頭辞規約からも**実装が正しく仕様本文が不正確**である。
マニフェストの `matches` も `**/ddd-domain-modeling/domain-model.yaml` で一貫している。

### `bun run check` の扱いについて（正直な申告）

`bun run check` は `test` 段を含むため、U3 と同じ理由で **終了コード 0 にならない見込み**である
（`tests/codex-dispatch-bridge.test.ts` の 12 件が要求する `aidlc-workflows/dist/codex/aidlc` の
fixture が未生成。`ddd/tests/README.md` が既知の前提条件として記載し、`aidlc-workflows/` は
読み取り専用のサブモジュール）。

本 Unit の FR8.7 と NFR4 の**検証欄**は `bun run check` の緑を挙げているが、
**要件本文**が求めているのは「各センサーに違反あり／なしのゴールデンケースが同梱され、
テストで通過すること」（FR8.7）と「既存テスト 2 本は緑のまま」（NFR4）である。
本計画は要件本文に照らして判定し、上記の実測値と生の証拠を `code-summary.md` に併記する。
`check` コマンドそのものの緑は U9 が所有し、U3 は `FR11.3` として既に GAP を記録している。

## 完了条件

- 本 Unit が所有する全アプリケーションソースが `source-manifest.json` に列挙されている
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスである
- Step 1・3・5・7・9・10 は既存実装に対する改変を行っていない
- 既存ファイルへの改変は Step 12 に限られる。すなわち 3 本のマニフェスト
  （`sensors/aidlc-ddd-{mapping-declarations,layer-structure,design-advisories}.md`）への
  宣言 4 件の追加と、`tests/golden/design/cases.ts` へのゴールデンケース 4 件の追加である。
  いずれのパスも `source-manifest.json` に既に含まれている
- **6 本のスクリプトが発行する rule_id が、すべて対応するマニフェストの `checks:` に
  宣言されている**（未宣言 0 件）
- `bun test tests/u4-golden.test.ts` の「every declared rule has a violation case」が緑である
- Step 12 はセンサースクリプトの振る舞いを変えていない
- 検証で見つかった乖離がすべて `code-summary.md` の逸脱欄に記録されている。
  4 経路が `rules.md` に未定義である点は、functional-design への変更依頼が要る旨とともに残る

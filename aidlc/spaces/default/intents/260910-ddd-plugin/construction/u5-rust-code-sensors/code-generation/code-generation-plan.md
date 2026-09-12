# Code Generation Plan — U5 Rust コードセンサー（u5-rust-code-sensors）

## この計画の位置づけ

本 Unit の実装は **すでに作業ツリー上に存在する**。3 本のマニフェスト
（`ddd/sensors/aidlc-ddd-rust-{domain,use-case,interface-adapter}.md`）、3 本の実行スクリプト
（`ddd/tools/ddd-sensor-rust-*.ts`）、規則モジュール（`ddd/tools/ddd/lib/rules/` と
`ddd/tools/ddd/lib/rules/rust/`）、Rust 用ゴールデンケース（`ddd/tests/golden/rust/cases.ts`）、
および 2 本のテストファイル（`ddd/tests/u5-rust-code-sensors.test.ts`、`ddd/tests/u5-golden.test.ts`）
がそれにあたり、いずれも `ddd/CHANGELOG.md` の v0.1.0 に含まれている。

そこで本計画は、**既存の実装を code-generation ステージの成果として記録し、仕様に照らして
検証する**ための計画とする。実装の書き起こしは行わない。
U3（`u3-plugin-scaffold`）・U4（`u4-design-sensors`）と同じ立場をとる。

**既存ファイルへの改変は Step 12・12b の 2 パスに限られる**
（`ddd/tests/golden/rust/cases.ts` と `ddd/tools/ddd/lib/rules/evaluate.ts`）。
Step 1〜11 は検証と記録のみである。

判断が要るのは**検証で仕様との乖離が見つかったとき**である。本計画は乖離を隠さず
`code-summary.md` の逸脱欄に記録し、目標を下げて通すことはしない。乖離が要件の未達に
あたる場合は承認ゲートに上げる。

## 対象と根拠

| 種別 | パス |
|---|---|
| Unit 定義 | `inception/units-generation/unit-of-work.md`（U5 = RustCodeSensorSuite + GoldenCaseSuite（Rust センサー分）、kind: library、複雑度 XL） |
| 要件 | `inception/requirements-analysis/requirements.md`（FR7、FR7.1〜FR7.13、FR9.5、NFR1、NFR3） |
| 機能仕様 | `construction/u5-rust-code-sensors/functional-design/functional-spec.md`（WF1〜WF7、SM1・SM2、§1 マニフェスト、§2 規則モジュール） |
| 規則 | `construction/u5-rust-code-sensors/functional-design/rules.md`（BR1〜BR10 の全規則） |
| 型 | `construction/u5-rust-code-sensors/functional-design/entities.md`（RustSensorManifest / RuleDefinition / RustRuleEvaluator / InspectionContext / DomainSymbolTable / DependencyEdge / RustGoldenCase） |
| 上流の設計 | `inception/domain-design/components.md`、`inception/domain-design/decisions.md`（ADR-001、ADR-002、ADR-003、ADR-005、ADR-009） |
| 依存する Unit の設計 | U1 `construction/u1-sensor-foundation/functional-design/functional-spec.md`（`runSensor` / `readSourceClaims` / `readStageStatus` / `loadDomainModel` / `index.resolve` / `index.commandsOf`）、U2 `construction/u2-rust-analysis-foundation/functional-design/functional-spec.md`（`scanWorkspace` / `assignLayers` / `classifyFile` / `isAllowed` / `parse`）、U4 `construction/u4-design-sensors/functional-design/functional-spec.md`（マニフェストの形、ゴールデンケースのランナー） |

実装言語は TypeScript、ランタイムは bun。構文解析は U2 が同梱する `web-tree-sitter` と
`tree-sitter-rust` の WASM を使う。テストランナーは `bun:test`（追加依存なし）。
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

### この契約を U5 に適用する

`methodology: test-after`、`ordering: implement each applicable testable layer, then write and run`。
U5 は UI・HTTP・DB を持たないライブラリである。契約の `testable_layers` のうち該当するのは
**データモデル相当（規則定義・固定リスト・検査文脈の型）**、**ビジネスロジック相当（規則 (a)〜(n)
と依存方向 (g)(k) の判定器、名前一覧、依存辺）**、**API／エンドポイント相当（3 本のセンサースクリプトの
起動契約 = `--stage` / `--output-path` と 1 行 JSON verdict）** の 3 層である。
リポジトリ／データアクセス層とフロントエンド層は成立しない。

`runner_step` の要求どおり、最初のテストステップより前に既存ランナーの疎通と Unit 限定
コマンドの確定を行う（Step 2）。`runner_ready_before_first_test: true` を満たす。

**テスト量について**: Standard 戦略は「コンポーネントあたり 5〜8 件」を求める。
U5 のコンポーネントは **RustCodeSensorSuite（3 センサー）と GoldenCaseSuite（Rust センサー分）**
である。既存のテストは 2 本（`ddd/tests/u5-rust-code-sensors.test.ts` に 10 件、
`ddd/tests/u5-golden.test.ts` にゴールデンケース 18 件＋規約テスト 2 件。Step 12 の追加後。
是正前の実測は 15 件で、前周回の本文が書いていた「16 件」は誤りだった）で、
いずれのコンポーネントも床（5 件）を満たす。**本 Unit でテストを新設しない**（既存実装の記録であるため）。

## Sources

- `inception/units-generation/unit-of-work.md`（U5 = RustCodeSensorSuite + GoldenCaseSuite（Rust センサー分）、kind: library、複雑度 XL）
- `inception/units-generation/unit-of-work-story-map.md`（U5 の割当: FR7、FR7.1〜FR7.13、FR9.5、NFR1、NFR3）
- `inception/requirements-analysis/requirements.md`（FR7 Rust コードセンサー群、FR9.5 依存方向、NFR1 決定性、NFR3 性能）
- `construction/u5-rust-code-sensors/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `ddd/sensors/aidlc-ddd-rust-*.md`（3 本、既存）
- `ddd/tools/ddd-sensor-rust-*.ts`（3 本、既存）、`ddd/tools/ddd/lib/rules/`（既存）
- `ddd/tests/golden/runner.ts`（U4 所有）、`ddd/tests/golden/rust/cases.ts`、`ddd/tests/u5-rust-code-sensors.test.ts`、`ddd/tests/u5-golden.test.ts`（既存）
- `ddd/tests/README.md`（既存スイートの前提条件）

## 実装ステップ

契約の `plan_profile.steps` を U5 に射影したものである。「実装」と付くステップは既存実装の
**検証**を指す（本 Unit は実装を書き起こさない）。

### 基盤

- [x] **Step 1: プロジェクト構造と本番構成の骨格** — 3 マニフェストを `ddd/sensors/` に
      フラット配置し（`aidlc-ddd-rust-<layer>.md`、`id: ddd-rust-<layer>`）、1 マニフェストにつき
      **1 本の実行スクリプト**を `ddd/tools/ddd-sensor-rust-<layer>.ts` に対応させる（BR1.1）。
      各マニフェストが `kind: deterministic` / `default_severity: blocking` / `fire_on: gate` /
      `matches: "**/code-summary.md"` / `timeout_seconds: 10` / `checks` を持ち、
      3 本の `checks` の rule_id 集合が `functional-spec.md` §1 の表と一致することを確認する。
      規則モジュールが `lib/rules/`（言語非依存: `definitions.ts` / `lists.ts` / `context.ts` /
      `evaluate.ts` / `types.ts`）と `lib/rules/rust/`（Rust 固有: `symbols.ts` / `edges.ts` /
      `evaluators.ts`）に分かれていることを確認する（BR9.1、ADR-001）。
- [x] **Step 2: テストランナーの疎通確認と Unit 限定コマンドの確定** — 既存の `bun:test` を確認し、
      Unit 限定コマンド `bun test tests/u5-rust-code-sensors.test.ts` と
      `bun test tests/u5-golden.test.ts` を `unit-test-instructions.md` に記録する。
      追加依存を導入しない。

### データモデル層（規則定義・固定リスト・検査文脈）

- [x] **Step 3: データモデル層の実装** — `definitions.ts` の `RuleDefinition` が
      a / b / c / d / g / h / i / k / l / m / n の 11 件を `rule_id` / `name` / `statement` /
      `target_layers` / `requires_model` / `facts` / `source` / `per_file` で持ち、判定ロジックを
      持たないことを確認する（entities.md、BR9.1）。`lists.ts` の固定リスト（replay 除外名、
      後付け初期化名、媒体語、I/O クレート denylist）が 1 か所にあり、媒体語が U4 の
      `layer-structure` と同じ値であることを確認する（BR9.2、ADR-009）。`types.ts` の
      `InspectionContext` / `InspectionTarget` / `ModelAvailability` / `DomainSymbolTable` /
      `DomainTypeSymbol` / `MutatorSymbol` / `DependencyEdge` が entities.md の属性に対応する
      ことを確認する。
- [x] **Step 4: データモデル層のテストを実装後に書いて実行** — 名前変換
      （PascalCase → ケバブ、snake_case → ケバブ）と denylist 照合が
      `tests/u5-rust-code-sensors.test.ts` またはゴールデンケース経由で踏まれることを確認する。

### ビジネスロジック層（規則の判定器・名前一覧・依存辺）

- [x] **Step 5: ビジネスロジック層の実装** — `context.ts` が WF1 の手順 2〜6
      （申告 .rs の解決、空申告の pass、Cargo workspace の根の決定、U2 の走査と層判定、
      分類と振り分け、`readStageStatus` / `loadDomainModel` による ModelAvailability、
      名前一覧の作成）を実装することを確認する（BR2、BR3.4）。`symbols.ts` が WF2
      （ドメイン層全クレートの列挙、DomainTypeSymbol の要約、`&mut self` の分類
      replay-exempt → post-init → unknown → declared-command / undeclared）を実装することを
      確認する（BR3.1〜BR3.3、SM2）。`edges.ts` が WF6（use の先頭セグメントと Cargo.toml からの
      依存辺、`isAllowed` と denylist による verdict、整列と重複統合）を実装することを確認する（BR6.1）。
      `evaluators.ts` が (a)(b)(c)(d)(g)(h)(i)(k)(l)(m)(n) を `PER_FILE_EVALUATORS` /
      `CONTEXT_EVALUATORS` として実装し、`evaluate.ts` がマニフェストの rule_id 一覧だけを
      評価して (file, line, rule_id) で統合し、ファイル境界で予算を確認することを確認する
      （BR4〜BR7、BR8.2）。すべての判定が構文的事実だけから行われ、型推論・実行を含まないこと
      （FR7.12、BR7.2）を確認する。
- [x] **Step 6: ビジネスロジック層のテストを実装後に書いて実行** — 3 センサーそれぞれに
      正常系と違反系のテストがあることを確認する。加えてゴールデンケース（Step 9）が
      宣言された rule_id ごとの違反系を網羅する。

### API／エンドポイント層（センサーの起動契約）

- [x] **Step 7: API／エンドポイント層の実装** — 3 スクリプトが U1 の `runSensor` に
      `sensor_id` / `severity: blocking` / `budget_ms: 9000` / `evaluate` を渡す薄いファイルであり、
      `--stage <slug> --output-path <path>` で起動され、標準出力に **1 行の compact JSON verdict**
      を出し、成功で終了コード 0、tree-sitter ランタイム欠落で `ToolUnavailableError`（127）を
      返すことを確認する（FR8.5、BR1.1、BR7.1）。severity はマニフェストの blocking を転記する
      だけで、U5 はゲートの開閉を決めない。
- [x] **Step 8: API／エンドポイント層のテストを実装後に書いて実行** — テストは
      **スクリプトを子プロセスとして起動する**（`import` すると `process.exit` がテストを巻き込むため。
      `ddd/tests/README.md` の注記）。正常系・違反系・正規モデル SKIP 時の note・
      決定性（3 回実行して一致）を確認する（NFR1、BR8.1）。

### ゴールデンケース

- [x] **Step 9: Rust 用ゴールデンケース** — U4 のランナー（`tests/golden/runner.ts`）が
      `tests/golden/rust/cases.ts` のケースを一時ディレクトリに実体化し、record/ と
      workspace/ を同じ根に置き、**実運用と同じ引数**でスクリプトを起動し、`pass` と findings の
      `(rule_id, file)` 集合を完全一致で比較することを確認する（BR10.1、BR10.4）。
      網羅性テスト（宣言された各 rule_id に violation ケースが 1 件以上。BR10.2）、
      正規モデル無しのケース（BR10.3）、決定性（3 回実行。BR10.4）が `tests/u5-golden.test.ts`
      にあることを確認する。

### 構成と文書

- [x] **Step 10: 環境・ビルド構成** — `bun run validate` が 3 マニフェストを受理し、
      `bun run build:claude` / `bun run build:codex` が `{{HARNESS_DIR}}` を展開して
      投影できることを確認する。センサーが cargo もネットワークも使わないこと（BR1.4）を
      確認する。
- [x] **Step 11: ドキュメントとトレーサビリティ** — `code-summary.md` に作成物と判断を記録し、
      `traceability.json` に本 Unit の 17 要件 ID と実装の対応を、
      `source-manifest.json` に本 Unit が所有する全パスを列挙する。

### レビュー所見への対応（R-01・R-03）

- [x] **Step 12: 層診断 3 経路の violation ケースを追加する（R-03 の一部）** —
      BR10.2 は violation ケースを 19 種、clean ケースを 7 種列挙するが、
      `tests/golden/rust/cases.ts` の実測は **15 ケース**（violation 12・clean 3）で
      **12 種が不足**している。うち `layer.unknown` / `layer.conflict` /
      `layer.mixed-targets` の 3 経路は、`tests/u5-golden.test.ts` の網羅性テストが
      `NOT_IN_RUST_SUITE`（`layer.*` と `model.invalid`）で除外しているため
      **どのテストでも一度も踏まれていない**。不足の中で最もリスクが高いのはここである。

      本ステップでこの 3 件を追加する。発火条件は `lib/workspace/resolver.ts` の実測による。

      | ケース名 | 発火条件（`resolver.ts`） | fixture の作り |
      |---|---|---|
      | `violation-layer-mixed-targets` | `:405` 同一クレートが bin と lib の両ターゲットを持つ | 1 クレートに `src/lib.rs` と `src/main.rs` を両方置く |
      | `violation-layer-conflict` | `:456` 名前の接尾辞が指す層と配置ディレクトリが指す層が食い違う | `packages/use-case/billing-domain`（接尾辞 `-domain` 対 配置 `use-case`） |
      | `violation-layer-unknown` | `:476` 層の接尾辞も層ディレクトリも無い | `packages/misc/billing-thing` |

      - センサーは `ddd-rust-domain`（`report_layer_diagnostics: true`）。
        診断は `blocking(...)` で **クレートの `Cargo.toml`** に付くため、
        `expect.files` は `src/lib.rs` ではなく `<crate path>/Cargo.toml` を指す。
        既存ケースが使う `withFiles` ヘルパは `src/lib.rs` を前提にしているので、
        本 3 件は `expect.files` を明示的に組む。
      - `project()` ヘルパは 1 クレートにつき `src/lib.rs` だけを書く。
        `mixed-targets` は `src/main.rs` も要るため、**`project()` を拡張するか
        当該ケースだけ `workspace` を直接組む**。既存ケースの挙動は変えない。
      - 追加後、`tests/u5-golden.test.ts` の `NOT_IN_RUST_SUITE` から `layer.*` を
        外せるかを検討する。外せない場合（`layer.*` はワイルドカードの宣言であり、
        実際の findings は `layer.unknown` など具体名で出るため、宣言名と findings 名が
        一致しない）は、**除外を残す理由を `code-summary.md` に明記する**。
        除外を残す場合でも、追加した 3 ケース自体は個別テストとして実行される。
  - [x] **残る 9 種は `Deferred` として明示的に残す** — violation の
        `c-post-init` / `d（use-case）`/ `g（use-case → IA）`/ `g（domain → use-case）`/
        `g（external-io）`の 5 種と、clean の `(c)` ES replay（`apply_event`）/
        `(d)` IA 層からの getter 呼び出し / `(k)` rmu からの両側依存 / `(h)` Id 型引数の
        4 種である。**不足の一覧と、各々が BR10.2 のどの項目かを `code-summary.md` に
        列挙する。**「網羅している」とは書かない。

- [x] **Step 12b: 層診断の rule_id の二重接頭辞を除去する（Step 12 の実装中に発見）** —
      `lib/rules/evaluate.ts:38` が `rule_id: \`layer.${diagnostic.code}\`` と組み立てるが、
      `DiagnosticCode`（`lib/workspace/resolver.ts:27-35`）は **8 種すべてが既に
      名前空間接頭辞を持つ**（`layer.unknown` / `layer.conflict` / `layer.mixed-targets` /
      `layer.unowned` / `cqrs.conflict` / `cqrs.query-domain` / `workspace.unreadable` /
      `workspace.no-members`）。したがって発行される rule_id は
      `layer.layer.unknown` / `layer.cqrs.conflict` のように**必ず二重**になる。
      接頭辞が正しくなるコードは 1 つも存在しない。

      Step 12 のゴールデンケースを実行して実測で確認した。

      ```
      unexpected finding layer.layer.unknown       @ packages/misc/billing-thing/Cargo.toml
      unexpected finding layer.layer.conflict      @ packages/use-case/billing-domain/Cargo.toml
      unexpected finding layer.layer.mixed-targets @ packages/domain/billing-domain/Cargo.toml
      ```

      マニフェストの宣言は `layer.*` であり、二重接頭辞の ID とは永久に一致しない。
      `tests/u5-golden.test.ts` の `NOT_IN_RUST_SUITE` がこの 3 つを網羅性検査から
      除外している理由はこれだと考えられる（除外のコメントは「U2 テストと domain センサーの
      他ケースでカバー」と書いているが、実際には宣言名と発行名が一致しないためである）。

      **修正は 1 行**である。

      ```
      rule_id: `layer.${diagnostic.code}`   →   rule_id: diagnostic.code
      ```

      - `layer.layer.*` / `layer.cqrs.*` / `layer.workspace.*` に依存するコード・文書・
        fixture は `ddd/` 全体に **1 件も無い**ことを grep で確認済み。現状これらの ID は
        どこにも消費されていない。
      - 修正後、層診断は `layer.unknown` / `layer.conflict` / `layer.mixed-targets` として
        発行され、マニフェストの `layer.*` 宣言の意図と一致する。
      - **判定器（`definitions.ts` の規則評価）と 3 センサーのスクリプトは変更しない。**
        変更するのは `evaluate.ts` の診断転送 1 行のみである。
      - `cqrs.conflict` / `cqrs.query-domain` / `workspace.unreadable` /
        `workspace.no-members` は修正後も**どのマニフェストにも宣言されていない**。
        これは U4 の未宣言 rule_id と同種のギャップであり、**本 Unit では直さず
        `code-summary.md` に記録する**（宣言の追加はマニフェストの検査面の設計判断を伴う）。
      - 修正後に `bun test tests/u5-rust-code-sensors.test.ts tests/u5-golden.test.ts` と
        `bun test tests/` 全体を実測し、二重接頭辞に依存していたテストが無いことを確認する。

- [x] **Step 13: 計画本文のケース数を実測に合わせる（R-01）** —
      本計画 L117・L296 と `unit-test-instructions.md` L44 は「ゴールデンケース 16 件」と
      記載しているが、実測は **15 件**である。前周回は両ファイルが承認フィンガープリントで
      凍結されていたため訂正できなかった。本改訂で計画を再提示するため、
      **この機会に実測値へ直す**。Step 12 で 3 件を追加した後は **18 件**になるため、
      追加後の値を書く。

## 要件 → 実装ステップの対応

| 要件 | 内容 | ステップ | 対象 |
|---|---|---|---|
| FR7 | Rust コードセンサー群 | Step 1, 5, 7, 9 | 3 マニフェストと 3 スクリプト |
| FR7.1 | (a) ドメイン型の公開フィールド | Step 5, 9 | `evaluators.ts` ruleA、`violation-a` |
| FR7.2 | (b) 正規モデルに Command として宣言のない状態変更メソッド | Step 5, 9 | `symbols.ts` classifyMutator、ruleB、`violation-b` |
| FR7.3 | (c) 不完全な生成経路（literal / default / post-init）、replay は対象外 | Step 5, 9 | ruleC、`violation-c-literal` / `violation-c-default` |
| FR7.4 | (d) ドメイン層・ユースケース層からの getter 呼び出し | Step 5, 9 | ruleD、`violation-d` |
| FR7.5 | (g) ユースケース層の DIP 違反 | Step 5, 9 | `edges.ts`、ruleG、`violation-g` |
| FR7.6 | (h) `execute` が集約を直接受け取る | Step 5, 9 | ruleH、`violation-h` |
| FR7.7 | (i) ユースケース間呼び出し | Step 5, 9 | ruleI、`violation-i` |
| FR7.8 | (k) コマンド側とクエリ側の相互参照 | Step 5, 9 | ruleK、`violation-k` |
| FR7.9 | (l) クエリ側からのドメイン型・リポジトリポート参照 | Step 5, 9 | ruleL、`violation-l` |
| FR7.10 | (m) リポジトリ命名違反 | Step 5, 9 | ruleM、`violation-m-media` / `clean-repository` |
| FR7.11 | (n) 完全コンストラクタを経由しない構築 | Step 5, 9 | ruleN、`violation-n` |
| FR7.12 | 判定は構文解析ベース、意味判断を混入させない | Step 5 | `lib/rules/` 全体（U2 の事実のみを入力） |
| FR7.13 | 所見は規則 ID・ファイル・行・一文説明の 4 項目 | Step 5, 7 | `FindingInput`、U1 の verdict 出力 |
| FR9.5 | 依存方向違反の安全網 (g) | Step 5, 9 | `edges.ts`、ruleG（3 マニフェスト） |
| NFR1 | 確定性: 同一入力に同一 verdict | Step 8, 9 | 決定性テスト（3 回実行） |
| NFR3 | 性能: 200 ファイルで 10 秒目安、予算超過は budget-exceeded | Step 5 | `evaluate.ts` の `checkBudget`、`budget_ms: 9000` |

FR8.3（`adds.sensors` でのバインド）は **横断要件**であり、本 Unit はその**検査実体**を提供する。
マニフェストをどのステージに束ねるかは U7 が宣言する（unit-of-work.md の U5 境界）。
設計側の (k)(l)(m)(n)（FR5.4）は U4 が所有し、本 Unit では扱わない（ADR-009）。

## テスト方針（Unit 限定）

- **実行コマンド**:
  - `bun test tests/u5-rust-code-sensors.test.ts`（`ddd/` を作業ディレクトリとする）
  - `bun test tests/u5-golden.test.ts`（同上）
- **戦略**: Standard — コンポーネントあたり 5〜8 件。本 Unit のコンポーネントは
  RustCodeSensorSuite（3 センサー）と GoldenCaseSuite（Rust センサー分）で、既存テストが床を満たす
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であること
- **品質目標**: 契約の coverage floor を緩和しない。落ちた場合は目標を下げずに乖離を報告する
- **テストの起動方法**: センサースクリプトを `import` せず**子プロセスとして起動する**。
  スクリプトが `process.exit` を呼ぶため、直接 import するとテストランナーごと終了してしまう
  （`ddd/tests/README.md` の注記）。これは実運用のディスパッチャ契約と同じ経路でもある

## 検証

承認後、Step 1・3・5・7・9・10 は**既存実装の検証**、Step 2・4・6・8・11 は
**テストの実行と記録**として実施する。いずれも結果は `code-summary.md` に記録する。

- `bun test tests/u5-rust-code-sensors.test.ts` の実測（pass / fail 件数）
- `bun test tests/u5-golden.test.ts` の実測（pass / fail 件数）
- `bun test tests/` 全体の実測（既存スイートの状態を含む）
- `bun run validate` / `bun run build:claude` / `bun run build:codex` の実測（終了コードを含む）
- 3 本のマニフェストが宣言する rule_id と、3 本のスクリプトが `evaluateSensor` に渡す rule_id 一覧の照合
- センサー `required-sections` / `linter` / `type-check` / `traceability` の本 Unit 成果物に対する判定
- `source-manifest.json` の全パスが実在し、未申告の変更が無いこと

### 計画時に判明している乖離（正直な申告）

独自の読み取りで、仕様と実装の間に次の乖離を見つけている。**いずれも実装を書き換えず、
`code-summary.md` の逸脱欄に記録する**。承認時にはこの 4 点を確認されたい。

**1. Rust 判定器の配置が仕様の「1 規則 1 ファイル」と異なる。**
仕様 `functional-spec.md` §2 は `lib/rules/rust/` に `a-public-field.ts … n-restoration-bypass.ts` と
規則ごとのファイルを置く形を書いている。実装は `lib/rules/rust/evaluators.ts` の **1 ファイル**に
11 個の判定器関数（ruleA〜ruleN）を置き、`PER_FILE_EVALUATORS` / `CONTEXT_EVALUATORS` の表で
rule_id に対応づける。定義（`definitions.ts`）と判定器の分離（BR9.1）、判定器が U2 の事実だけを
入力にすること（BR7.2）、`per_file` による評価単位の区別は満たしている。ファイル分割の差であり、
第 2 言語の追加が判定器の追加だけで済む（FR8.6）という設計意図は保たれている。

**2. ゴールデンケースの構成規約が仕様と異なる（U4 と同じ乖離）。**
仕様 BR10.1 は `tests/golden/rust/<sensor-id>/<case-name>/` に `record/`、`workspace/`、
`expected.json` を置く形を要求している。実装は `tests/golden/rust/cases.ts` の **TypeScript の表**で
ケースを持ち、Cargo.toml と最小クレート群を一時ディレクトリに実体化してからスクリプトを起動する。
`expected.json` は無い。一方で record/ と workspace/ を同じ根に置くこと、実引数での起動、
`(rule_id, file)` 集合の完全一致比較、決定性は満たしている。U4 の同じ乖離と整合する。

**3. ゴールデンケースの網羅が仕様 BR10.2〜BR10.4 の列挙に届いていない。**
仕様は clean ケース 7 種（(c) の replay 経路、(d) の IA 層からの getter、(k) の rmu からの両側依存、
(m) の InMemory 実装名、(h) の Id 型引数、(b) の宣言済み Command、(a) の private フィールド）と
violation ケース 19 種（c-post-init、d（use-case）、g の 3 変種、layer.unknown / conflict /
mixed-targets を含む）、model.invalid ケース（BR10.3）、200 ファイル規模の性能計測ケース（BR10.4）を
求めている。実装のケースは **15 件**で（前周回の本文は「16 件」と書いていたが誤り。R-01）、
clean は `clean-domain`（(a)(b) の例外）、`clean-model-skipped`、
`clean-repository`（(m) の実装名）の 3 件、violation は a / b / c-literal / c-default / d（domain）/
g（domain → IA）/ h / i / k / l / m-media / n の 12 件である。**宣言された rule_id ごとに 1 件以上の
violation ケース**（網羅性テストが検査する範囲）は満たしているが、c-post-init、d（use-case）、
g（use-case → IA、external-io）、layer.* 診断、model.invalid、性能計測ケースは無い
（`u5-golden.test.ts` は `layer.*` と `model.invalid` を「U2 テストと domain センサーの他ケースで
カバー」として網羅性検査から除外している）。c-post-init と model.invalid は判定器・文脈組み立てに
実装されているが fixture が無い。**FR7.3 の受け入れ基準「replay 経路を含む fixture が pass する」と
FR7.4 の「IA 層からの呼び出しを含む fixture が pass する」に対応する clean ケースが無い**点は
要件の検証欄に関わるため、承認時に確認されたい。

**本改訂での扱い**: 不足 12 種のうち、**`layer.unknown` / `layer.conflict` /
`layer.mixed-targets` の 3 種を Step 12 で追加する**（追加後 18 件）。この 3 つは
網羅性テストの除外対象であり、どのテストでも一度も踏まれていないため、不足の中で
最もリスクが高い。残る 9 種（violation 5・clean 4）は `Deferred` として
`code-summary.md` に一覧で明示し、「網羅している」とは書かない。

**4. 正規モデルのパスが仕様本文の記載と異なる（U4 と同じ乖離）。**
仕様 BR3.4 は `<record>/inception/domain-modeling/domain-model.yaml` と書くが、実装（`context.ts`）は
`readStageStatus(run, "ddd-domain-modeling")` と `inception/ddd-domain-modeling/domain-model.yaml` を
読む。ステージ slug は `ddd-domain-modeling` であり、FR11.2 の `ddd-` 接頭辞規約からも
**実装が正しく仕様本文が不正確**である。

### `bun run check` の扱いについて（正直な申告）

`bun run check` は `test` 段を含むため、U3・U4 と同じ理由で **終了コード 0 にならない見込み**である
（`tests/codex-dispatch-bridge.test.ts` の 12 件が要求する `aidlc-workflows/dist/codex/aidlc` の
fixture が未生成。`ddd/tests/README.md` が既知の前提条件として記載）。
本計画は要件本文（FR7.x の「違反あり／なしのゴールデンケースで期待どおりの verdict」、
NFR1 の「同一ソースに対して常に同一の verdict」）に照らして判定し、実測値と生の証拠を
`code-summary.md` に併記する。

## 完了条件

- 本 Unit が所有する全アプリケーションソースが `source-manifest.json` に列挙されている
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスである
- Step 1・3・5・7・9・10 は既存実装に対する改変を行っていない
- 既存ファイルへの改変は Step 12・12b に限られる。すなわち
  `ddd/tests/golden/rust/cases.ts` へのゴールデンケース 3 件の追加
  （`Crate.bin` と `project()` の拡張を含む）と、
  `ddd/tools/ddd/lib/rules/evaluate.ts` の診断転送 1 行である。
  いずれのパスも `source-manifest.json` に含める
- **層診断の rule_id が二重接頭辞でない**。`layer.unknown` / `layer.conflict` /
  `layer.mixed-targets` として発行され、`layer.layer.*` は 1 件も出ない（Step 12b、実測）
- `bun test tests/u5-golden.test.ts` が緑で、**ケース数が 18 件**である
- 追加した 3 件が実際に `layer.unknown` / `layer.conflict` / `layer.mixed-targets` を
  発火させ、`expect.rules` と findings が完全一致する（`expect.files` は当該クレートの
  `Cargo.toml` を指す）
- Step 12 は 3 センサーのスクリプトと判定器を 1 行も変えていない
- **BR10.2 の不足 9 種が `code-summary.md` に一覧で明示され、`Deferred` として記録されている**。
  「網羅している」という記述は無い
- 計画本文と `unit-test-instructions.md` のケース数が実測と一致している（Step 13）
- 検証で見つかった乖離がすべて `code-summary.md` の逸脱欄に記録されている

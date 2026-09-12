# Code Generation Plan — U9 公開品質（u9-release-quality）

## この計画の位置づけ

本 Unit の実装は **すでに作業ツリー上に存在する**。`ddd/README.md`（拡張ポイント、センサー一覧、
インストール、対応ハーネス、導入手順、命名・配置規約、同梱ライセンス、既知の制約、ライセンス）、
`ddd/CHANGELOG.md`（v0.1.0）、compose の 3 条件を確認する統合テスト
`ddd/tests/framework-compatibility.test.ts`（claude / codex の compose と Codex アダプタ互換）、
その補助文書 `ddd/docs/framework-compatibility.md`・`ddd/docs/codex-host-verification.md` と
検証スクリプト `ddd/scripts/verify-dist.ts`・`ddd/scripts/verify-codex-host.ts` がそれにあたる。
U9 は kind: packaging の Unit であり、各コンポーネントの実体は U1〜U8 が所有する。

そこで本計画は、**既存の公開品質成果物を code-generation ステージの成果として記録し、要件に照らして
検証する**ための計画とする。書き起こしは行わない。U3〜U7 と同じ立場をとる。

**既存ファイルへの改変は Step 8 の 1 パスに限られる**（`ddd/CHANGELOG.md` の 1 文）。
Step 7 は記録のみ、Step 1〜6 は検証と記録のみである。

判断が要るのは**検証で要件との乖離が見つかったとき**である。本計画は乖離を隠さず
`code-summary.md` の逸脱欄に記録し、目標を下げて通すことはしない。乖離が要件の未達に
あたる場合は承認ゲートに上げる。

## 対象と根拠

| 種別 | パス |
|---|---|
| Unit 定義 | `inception/units-generation/unit-of-work.md`（U9 = 公開品質、kind: packaging、複雑度 S。README / CHANGELOG / LICENSE / 統合テスト / 両ハーネスでの投影確認） |
| 要件 | `inception/requirements-analysis/requirements.md`（FR11.3、FR11.4、FR11.6、NFR5、NFR6、NFR10） |
| 上流の設計 | `inception/domain-design/components.md`（PluginPackaging）、`inception/domain-design/decisions.md` |
| 参照する Unit | U3（`plugin.json` と 4 スクリプトの配線、FR11.3 の GAP 記録）、U4 / U5（README のセンサー一覧の出典）、U2（命名・配置規約の出典） |

U9 には functional-design ステージの成果物が無い（kind: packaging のため設計チェーンが刈り込まれる）。
検証の基準は要件本文と unit-of-work.md の責務記述である。実装は Markdown と TypeScript、ランタイムは bun、
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

### この契約を U9 に適用する

`methodology: test-after`、`ordering: implement each applicable testable layer, then write and run`。
U9 は公開文書と統合テストからなる packaging Unit である。契約の `testable_layers` のうち該当するのは
**API／エンドポイント相当（フレームワークとの統合契約 = compose の 3 条件と両ハーネスでの投影、
Codex アダプタ互換）** の 1 層である。README / CHANGELOG / LICENSE は文書であり、要件 FR11.6 / NFR10 の
節の存在を読み合わせで検証する。データモデル層・リポジトリ層・ビジネスロジック層・フロントエンド層は成立しない。

`runner_step` の要求どおり、最初のテストステップより前に既存ランナーの疎通と Unit 限定
コマンドの確定を行う（Step 2）。`runner_ready_before_first_test: true` を満たす。

**テスト量について**: Standard 戦略は「コンポーネントあたり 5〜8 件」を求める。U9 のコンポーネントは
**IntegrationTest（compose の 3 条件と Codex アダプタ互換）** の 1 つで、`tests/framework-compatibility.test.ts`
が Codex アダプタ互換 **6 件**（`deny` / `ask` のループで 2 件を生むため）・compose 2 件（claude / codex）・
Codex ランナー生成 1 件の**計 9 件**を持ち、床（下限 5 件）を満たす。
前周回の本文は「5 件・計 8 件」と書いていたが誤りだった（Step 7 で是正）。
**本 Unit でテストを新設しない**（既存実装の記録であるため）。

## Sources

- `inception/units-generation/unit-of-work.md`（U9 = 公開品質、kind: packaging、複雑度 S）
- `inception/units-generation/unit-of-work-story-map.md`（U9 の割当: FR11.3、FR11.4、FR11.6、NFR5、NFR6、NFR10）
- `inception/requirements-analysis/requirements.md`（FR11.3 4 コマンド、FR11.4 compose の 3 条件、FR11.6 README の 5 節、NFR5 ハーネス互換、NFR6 決定性ビルド、NFR10 公開品質）
- `ddd/README.md`、`ddd/CHANGELOG.md`、`ddd/tests/framework-compatibility.test.ts`、`ddd/docs/framework-compatibility.md`、`ddd/docs/codex-host-verification.md`、`ddd/scripts/verify-dist.ts`、`ddd/scripts/verify-codex-host.ts`（既存）
- `LICENSE`（ワークスペース根、既存）
- `construction/u3-plugin-scaffold/code-generation/code-summary.md`（FR11.3 の GAP 記録）
- `ddd/tests/README.md`（既存スイートの前提条件）

## 実装ステップ

契約の `plan_profile.steps` を U9 に射影したものである。「実装」と付くステップは既存実装の
**検証**を指す（本 Unit は実装を書き起こさない）。

### 基盤

- [x] **Step 1: プロジェクト構造と本番構成の骨格** — `ddd/README.md`、`ddd/CHANGELOG.md`、
      `ddd/tests/framework-compatibility.test.ts` が存在し、`ddd/package.json` に `validate` /
      `build:claude` / `build:codex` / `check` / `test:sandbox` / `test:dist` / `test:host` が配線されている
      ことを確認する。LICENSE の所在（`ddd/LICENSE` の有無とワークスペース根 `LICENSE`）を確認する（NFR10）。
- [x] **Step 2: テストランナーの疎通確認と Unit 限定コマンドの確定** — 既存の `bun:test` を確認し、
      Unit 限定コマンド `bun test tests/framework-compatibility.test.ts` を `unit-test-instructions.md` に
      記録する。追加依存を導入しない。

### API／エンドポイント層（compose の 3 条件と両ハーネスでの投影）

- [x] **Step 3: API／エンドポイント層の実装** — `tests/framework-compatibility.test.ts` の compose テストが
      claude / codex の両ハーネスで `aidlc-plugin-test.ts --install --json` を実引数で起動し、
      `errors: []`（drop なし）、`graph.compiled: true`（グラフに載る）、`idempotent: true`（2 回目がバイト安定）
      の 3 条件を検査すること（FR11.4、NFR5、NFR6）、Codex アダプタ互換 5 件と Codex ランナー生成 1 件が
      `docs/framework-compatibility.md` / `docs/codex-host-verification.md` の記述と対応することを確認する。
      `bun run validate` / `bun run build:claude` / `bun run build:codex` / `bun run check` を実測し、
      FR11.3 の 4 コマンドの終了コードを記録する。
- [x] **Step 4: API／エンドポイント層のテストを実装後に書いて実行** — `bun test tests/framework-compatibility.test.ts`
      を実行し、pass / fail 件数を記録する。`bun test tests/` 全体も実測し、既存スイートの状態を記録する。

### 構成と文書

- [x] **Step 5: 環境・ビルド構成** — `bun run test:dist`（`scripts/verify-dist.ts`）が `build:all` 後の
      `dist/` を検証する配線であること、`test:sandbox` が 4 ハーネス（claude / codex / kimi / opencode）で
      `aidlc-plugin-test` を回すことを読み合わせる（実行は `build:all` を要するため、実測は `validate` /
      `build:claude` / `build:codex` に留め、`test:sandbox` は配線の確認とする）。
- [x] **Step 6: ドキュメントとトレーサビリティ** — `ddd/README.md` に FR11.6 の 5 節（拡張ポイント一覧、
      対応ハーネス、層判定の命名規約、センサー一覧 (a)〜(n)、導入手順）と NFR10 の既知の制約・ライセンスの節が
      あること、センサー一覧が U4 の 6 本と U5 の 3 本の ID・規則と一致すること、`CHANGELOG.md` が
      Keep a Changelog 形式で v0.1.0 を記すことを読み合わせる。`code-summary.md` に作成物と判断を記録し、
      `traceability.json` に本 Unit の 6 要件 ID と実装の対応を、`source-manifest.json` に本 Unit が所有する
      全パスを列挙する。

### レビュー所見と申し送りへの対応

- [x] **Step 7: テスト件数の記載を実測に合わせる（R-01・記録のみ）** —
      本計画 L112・L183 と `unit-test-instructions.md` L41・L56 は
      「Codex アダプタ互換 5 件・compose 2 件・Codex ランナー生成 1 件の**計 8 件**」と書くが、
      `tests/framework-compatibility.test.ts` の実測は **9 件**である。

      | 区分 | 位置 | 件数 |
      |---|---|---|
      | Codex アダプタ互換 | `:57` `:69` `:88`（`for (const decision of ["deny", "ask"])` で 2 件）`:100` `:116` | **6** |
      | compose の 3 条件 | `:122`（`for (const harness of ["claude", "codex"])` で 2 件） | 2 |
      | Codex ランナー生成 | `:136` | 1 |
      | | | **計 9** |

      前周回は両ファイルが承認フィンガープリントで凍結されていて直せなかった。
      本改訂で計画を再提示する機会に **9 件**へ直す。Standard の床（5〜8 件）に対して
      9 件は上限を 1 件超えるが、床は下限の要求であり超過は不足ではない。
      IntegrationTest の 1 コンポーネントとして床を満たす旨も実測値に合わせて書き直す。

- [x] **Step 8: `CHANGELOG.md` の `produces` に関する一般化を直す（U7 からの申し送り）** —
      U7 のレビュー所見 R-02。`ddd/CHANGELOG.md:43-46` は

      > The design contributions deliberately bind sensors and instructions without
      > adding a `produces` artifact, …

      と複数形で一般化するが、実測では `produces` を持つのは **4 本中 1 本**である
      （`ddd/contributions/inception/domain-design.md:8`）。同じ文書の 17-18 行は
      `domain-design` について「produces the aggregate mapping」と正しく書いており、
      **同一文書内で読み方が割れる**。

      `ddd/CHANGELOG.md` は**本 Unit 所有**（`source-manifest.json` の 9 パスに含まれる）なので、
      本 Unit で直す。43 行の主語を実態に合わせ、どの contribution が `produces` を持ち
      どれが持たないかを名指しする。理由の説明（44-46 行の「contributed artifact は
      全 unit kind に適用され、kind で刈られた `review_artifact` を持つコアステージの
      スキーマ検査を落とす」）は**正しいので変えない**。

      - 変更は `CHANGELOG.md` の当該 1 文に限る。17-18 行、v0.1.0 の他の項目、
        Keep a Changelog 形式には触れない。
      - 4 本の contribution（U7 所有）には触れない。非対称性は意図されたものである。
      - 変更後に `bun run validate` と `bun test tests/framework-compatibility.test.ts` を実測する。

## 要件 → 実装ステップの対応

| 要件 | 内容 | ステップ | 対象 |
|---|---|---|---|
| FR11.3 | `validate` / `build:claude` / `build:codex` / `check` の 4 コマンドが終了コード 0 | Step 1, 3 | `ddd/package.json`、実測 |
| FR11.4 | `aidlc-plugin-test --install` の 3 条件（drop なし、グラフに載る、バイト安定） | Step 3, 4 | `ddd/tests/framework-compatibility.test.ts` の compose テスト |
| FR11.6 | README の 5 節 | Step 6 | `ddd/README.md` |
| NFR5 | Claude Code と Codex CLI の両方で compose が拒否しない | Step 3, 4 | compose テスト（claude / codex） |
| NFR6 | ビルド・投影の 2 回実行がバイト単位で一致 | Step 3, 4 | compose テストの `idempotent`、`scripts/verify-dist.ts` |
| NFR10 | LICENSE、README、CHANGELOG、既知の制約の明記 | Step 1, 6 | `ddd/README.md`、`ddd/CHANGELOG.md`、`LICENSE` |

NFR4（各センサーのゴールデンケース等）は U4 / U5 が、NFR7（biome）は U3 の `check:biome` 配線が実体を持つ。
`bun run check` の緑（FR11.3、NFR4 の検証欄）は本 Unit の割当だが、その阻害要因は本 Unit 所有外の
既知の前提条件（下記）である。

## テスト方針（Unit 限定）

- **実行コマンド**: `bun test tests/framework-compatibility.test.ts`（`ddd/` を作業ディレクトリとする）
- **戦略**: Standard — コンポーネントあたり 5〜8 件。IntegrationTest の **9 件**で床（下限 5 件）を満たす。
  上限 8 件を 1 件超えるが、床は下限の要求であり超過は不足ではない（Step 7 で実測に是正）
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であること
- **品質目標**: 契約の床を緩和しない。落ちた場合は目標を下げずに乖離を報告する
- **前提**: compose テストは `../.codex/tools/aidlc-plugin-test.ts` を子プロセスで起動し、使い捨ての
  コピーに対して compose する。Codex アダプタ互換テストは `.codex/` の投影済みアダプタを使う。ネットワークは使わない

## 検証

承認後、Step 1・3・5 は**既存実装の検証**、Step 2・4・6 は**テストの実行と記録**として実施する。
いずれも結果は `code-summary.md` に記録する。

- `bun test tests/framework-compatibility.test.ts` の実測（pass / fail 件数）
- `bun test tests/` 全体の実測（既存スイートの状態を含む）
- `bun run validate` / `bun run build:claude` / `bun run build:codex` / `bun run check` の終了コード（FR11.3 の判定）
- README の 5 節と既知の制約・ライセンス節の存在、センサー一覧と U4 / U5 のマニフェスト ID の照合
- センサー `required-sections` / `linter` / `type-check` / `traceability` の本 Unit 成果物に対する判定
- `source-manifest.json` の全パスが実在し、未申告の変更が無いこと

### 計画時に判明している乖離（正直な申告）

独自の読み取りで、要件と実装の間に次の乖離を見つけている。**いずれも実装を書き換えず、
`code-summary.md` の逸脱欄に記録する**。承認時にはこの 3 点を確認されたい。

**1. FR11.3 は未達である（`bun run check` が終了コード 0 にならない）。**
`check` は `check:biome` → `validate` → `test` を束ね、`test` 段で `tests/codex-dispatch-bridge.test.ts` の
12 件が `aidlc-workflows/dist/codex/aidlc` の fixture 未生成で落ちる（`ddd/tests/README.md` が既知の
前提条件として記載。`aidlc-workflows/` は読み取り専用のサブモジュール）。U3 が FR11.3 を GAP として
記録済みであり、本 Unit も同じ判定を引き継ぐ。他 3 コマンドは 0 の見込み。**目標を下げて通さず、
`traceability.json` で FR11.3 を Gap として記録する。**

**2. `ddd/LICENSE` が無い（ワークスペース根の `LICENSE` と README の「ライセンス」節で代替している）。**
unit-of-work.md の U9 責務と NFR10 は `plugins/ddd/LICENSE` の同梱を挙げるが、`ddd/` 直下に LICENSE ファイルは
無く、README の「ライセンス」節が参照元の MIT を引き継ぐ旨を記し、`同梱ライセンス` 節が vendored assets
（web-tree-sitter MIT、tree-sitter-rust Unlicense）を記す。リポジトリ根には `LICENSE` がある。
プラグイン単体で配布するときにライセンスファイルが同梱されない点は NFR10 の受け入れ基準「上記ファイルが
存在する」に関わるため、承認時に確認されたい。

**3. README の対応ハーネスが要件の 2 つ（Claude Code、Codex CLI）を超えて kimi / opencode に触れる可能性がある。**
`package.json` の `test:sandbox` は 4 ハーネスで回す配線を持つ。要件 FR11.6 / NFR5 は Claude Code と
Codex CLI の 2 つを求めており、超過分は要件を弱めないが、README の記述と統合テスト（claude / codex のみ）の
対象範囲が一致しているかを読み合わせで確認し、差があれば記録する。

## 完了条件

- 本 Unit が所有する全アプリケーションソースが `source-manifest.json` に列挙されている
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対パスであり、FR11.3 は Gap として記録されている
- Step 1・3・5 は既存実装に対する改変を行っていない
- **既存ファイルへの改変は Step 8 の 1 パスに限られる** — `ddd/CHANGELOG.md` の
  43 行の 1 文のみ。同ファイルの 17-18 行、v0.1.0 の他の項目、Keep a Changelog 形式、
  および U7 所有の 4 本の contribution には触れていない。
  当該パスは `source-manifest.json` に既に含まれている
- **計画本文と `unit-test-instructions.md` のテスト件数が実測（9 件）と一致している**（Step 7）
- **`ddd/CHANGELOG.md` の `produces` に関する記述が実態と一致している** — どの contribution が
  `produces` を持ち、どれが持たないかが名指しされ、同一文書内で読み方が割れない（Step 8）
- Step 8 の後も `bun run validate` と `bun test tests/framework-compatibility.test.ts` が
  是正前と同じ結果である
- 検証で見つかった乖離がすべて `code-summary.md` の逸脱欄に記録されている

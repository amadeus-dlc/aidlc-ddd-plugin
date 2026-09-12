# Code Generation Plan — U8 ナレッジ（u8-knowledge-pack）

## この計画の位置づけ

本 Unit の実装は **すでに作業ツリー上に存在する**。8 本のナレッジ文書
（`ddd/knowledge/<agent-slug>/ddd-*.md`）がそれにあたり、`ddd/CHANGELOG.md` の v0.1.0 に含まれている。

本計画は、**既存の実装を code-generation ステージの成果として記録し、仕様に照らして検証し、
検証で見つかった未達と逸脱を本パスの中で修正する**ための計画である。実装の書き起こし
（ゼロからの再生成）は行わない。

**本パスで修正するもの**:

| # | 区分 | 内容 | ステップ |
|---|---|---|---|
| 1 | 要件の未達 | FR10.2 の `module-visibility` に対応する規則が無い | Step 10 |
| 2 | 要件の未達 | FR10.4 の Conflicts 節 4 行が ADR-010 の 4 件と一致しない | Step 11 |
| 3 | BR 逸脱 | BR4.1: 規則 ID が `K.<topic>.<n>` でなく、Statement が ALWAYS / NEVER / PREFER で始まらない | Step 12 |
| 4 | BR 逸脱 | Principles 節の項目が `RuleEntry` になっていない | Step 12 |
| 5 | BR 逸脱 | Enforcement の `severity` 欠落 3 件と、実在しない anchor 1 件（`after-step:3`） | Step 13 |
| 6 | BR 逸脱 | example-index が実在パスでなく、`projection_note` が BR6.2 の内容を持たない | Step 14 |
| 7 | BR 逸脱 | BR7.1: 出典が U1／U2 の Unit 設計を指していない。BR5.2 の引用が無い | Step 15 |

**この修正は 8 本すべてに及ぶ。** 3・4 は全 83 規則の ID と文型、5 は Enforcement 列、
6 は Examples (index) 節、7 は Sources 節と Source 列の書き換えであり、
結果として 8 本の中身は**全面的に書き換わる**（ファイル名・配置・節構成・本文の主張は変えない）。
修正前後の全文は `code-summary.md` に記録する。

判断が要るのは**検証で仕様との乖離が見つかったとき**である。本計画は乖離を隠さず
`code-summary.md` の逸脱欄に記録し、目標を下げて通すことはしない。
**要件の未達は本パス内で修正する**（Step 10・11）。

U8 は kind `spec` の Unit で、実行時の型もテストランナーも持たない。本計画の「実装ステップ」は
**既存文書の検証**（Step 10〜15 のみ**改変**）を指し、「テストを書いて実行」のステップは
**既存の検証経路の実行と記録**を指す。

## 対象と根拠

| 種別 | パス |
|---|---|
| Unit 定義 | `inception/units-generation/unit-of-work.md`（U8 = DddKnowledgePack、kind: spec、複雑度 M） |
| 要件 | `inception/requirements-analysis/requirements.md`（FR10、FR10.1〜FR10.6） |
| ストーリーマップ | `inception/units-generation/unit-of-work-story-map.md`（U8 の割当 7 ID。先に固めるのは FR10.3・FR10.4） |
| 機能仕様 | `construction/u8-knowledge-pack/functional-design/functional-spec.md`（§1 文書集合、§2 トピック対応表、§3 節構成、WF1〜WF4、SM1、ER 図、§8 統合点、§9 未決事項） |
| 規則 | `construction/u8-knowledge-pack/functional-design/rules.md`（BR1〜BR8 の全規則） |
| 型 | `construction/u8-knowledge-pack/functional-design/entities.md`（KnowledgeFile / KnowledgeSection / RuleEntry / Enforcement / ConflictEntry / ExampleIndexEntry / RetiredRule / SourceRef / PlacementCheck） |
| 上流の設計 | `inception/domain-design/components.md`、`inception/domain-design/decisions.md`（ADR-006、ADR-010） |
| トピックの出典 | `ddd/docs/domain-layer-design.md` §9、`ddd/docs/use-case-layer-design.md` §9、`ddd/docs/interface-adapter-layer-design.md` §9 |
| 依存する Unit の設計 | U1 `construction/u1-sensor-foundation/functional-design/`（スキーマ・ID 文法）、U2 `construction/u2-rust-analysis-foundation/functional-design/`（クレート命名・配置・Rust 解析） |
| 依存する Unit の実装 | U4（設計センサーの規則 ID と clean ケース）、U5（Rust センサーの規則 (a)〜(n) と clean ケース）、U6／U7（fragment anchor） |

言語は Markdown（本文は英語）。テストランナーは `bun:test`（追加依存なし）。
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

### この契約を U8 に適用する

`methodology: test-after`、`ordering: implement each applicable testable layer, then write and run`。
U8 は Markdown 文書の集合で、UI・HTTP・DB・リポジトリを持たない。契約の `testable_layers` のうち
該当するのは **データモデル相当（entities.md が定める文書構造の契約）**、**ビジネスロジック相当
（規則の内容とトピックの網羅）**、**API／エンドポイント相当（配置と投影の契約 =
`knowledge/<agent-slug>/` が compose でどう届くか）** の 3 層である。リポジトリ／データアクセス層と
フロントエンド層は成立しない。

`runner_step` の要求どおり、最初のテストステップより前に既存ランナーの疎通と Unit 限定
コマンドの確定を行う（Step 2）。`runner_ready_before_first_test: true` を満たす。

**テスト量について**: Standard 戦略は「コンポーネントあたり 5〜8 件」を求める。U8 のコンポーネントは
**KnowledgePack（8 本）** の 1 つである。ただし **U8 は kind `spec` で、テストの所有者ではない**。
functional-spec.md §4 WF4 と rules.md BR8.1／BR8.2 は、8 本の存在・命名・衝突なし・Sources 節の存在・
`inline_context_paths` の実在・example-index の実在の検証を **U9 の統合テスト**（`bun run check`）に
課している。entities.md も `PlacementCheck` を「U9 の統合テストが実行する」と明記する。
したがって **本 Unit でテストを新設しない**。U9 が引き受ける検証項目を `code-summary.md` に
申し送りとして列挙する。

## Sources

- `inception/units-generation/unit-of-work.md`（U8 = DddKnowledgePack、kind: spec、複雑度 M）
- `inception/units-generation/unit-of-work-story-map.md`（U8 の割当: FR10、FR10.1〜FR10.6）
- `inception/requirements-analysis/requirements.md`（FR10.1〜FR10.6）
- `construction/u8-knowledge-pack/functional-design/functional-spec.md`、`rules.md`、`entities.md`
- `inception/domain-design/decisions.md`（ADR-006、ADR-010）
- `construction/u1-sensor-foundation/functional-design/`、`construction/u2-rust-analysis-foundation/functional-design/`（スキーマ・ID 文法・クレート命名の出典）
- `ddd/knowledge/aidlc-architect-agent/ddd-*.md`（4 本、既存）
- `ddd/knowledge/aidlc-developer-agent/ddd-*.md`（2 本、既存）
- `ddd/knowledge/aidlc-aws-platform-agent/ddd-interface-adapter-conventions.md`（既存）
- `ddd/knowledge/aidlc-shared/ddd-layer-boundaries.md`（既存）
- `ddd/tests/golden/design/cases.ts`、`ddd/tests/golden/rust/cases.ts`（example-index の索引先）
- `ddd/contributions/**`（fragment anchor の実在確認）
- `ddd/.aidlc-plugin/plugin.json`、`ddd/tests/u3-plugin-scaffold.test.ts`（配置と検証経路の実体）

## 実装ステップ

契約の `plan_profile.steps` を U8 に射影したものである。「実装」と付くステップは既存実装の
**検証**を指し、「テストを書いて実行」と付くステップは**既存の検証経路の実行と記録**を指す
（本 Unit は実装もテストも書き起こさない）。Step 10〜15 は**改変**を伴う。

### 基盤

- [x] **Step 1: プロジェクト構造と本番構成の骨格** — 8 本を
      `knowledge/aidlc-architect-agent/`（4 本）、`knowledge/aidlc-developer-agent/`（2 本）、
      `knowledge/aidlc-aws-platform-agent/`（1 本）、`knowledge/aidlc-shared/`（1 本）に配置する。
      ディレクトリ名が消費エージェントの slug と完全一致すること（CON6、BR1.1、BR1.4）、
      ファイル名が `ddd-` 接頭辞を持ちコアの既存名と衝突しないこと（BR1.2）、
      `plugin.json` の `contributes.knowledge` が `knowledge/` を指すこと（FR11.1）を確認する。
      **ファイル名と配置は本パスで変更しない。**
- [x] **Step 2: テストランナーの疎通確認と Unit 限定コマンドの確定** — 既存の `bun:test` を確認し、
      U8 に適用できる Unit 限定コマンドを `unit-test-instructions.md` に記録する。
      追加依存を導入しない。`bun test tests/`（プロジェクト全体）は使わない。

### データモデル層（entities.md が定める文書構造の契約）

- [x] **Step 3: データモデル層の実装** — 8 本が `KnowledgeFile` として、
      `agent_dir`（4 値の enum）・`topic`・`language`（`en`）・`title`・`sections`・`sources` を持ち、
      `KnowledgeSection` の `kind`（purpose / principles / rules / rationale / conflicts /
      example-index / retired / meta / sources）が functional-spec.md §3 の節構成と一致することを
      確認する。先頭が Purpose、末尾が Sources であること（BR3.2）。
      **節の順序と種別は本パスで変更しない**（内容のみ書き換える）。
- [x] **Step 4: データモデル層のテストを書いて実行** — 本 Unit ではテストを新設しない。
      Step 3 で確認した構造を `code-summary.md` に表として記録し、U9 に申し送る
      （`PlacementCheck` と BR8.2 の実行主体は U9）。

### ビジネスロジック層（規則の内容とトピックの網羅）

- [x] **Step 5: ビジネスロジック層の実装** — FR10.1（基盤 19 トピック）と FR10.2（Rust 11 トピック）の
      網羅を functional-spec.md §2 の対応表に照らして 1 トピックずつ確認する（BR2.1〜BR2.3）。
      続いて BR4（規則の書き方）、BR5（コアとの矛盾）、BR6（例の索引）、BR7（出典と失効）の
      各規則に対する適合を確認する。Enforcement 列の参照先（U4 の rule_id、U5 の (a)〜(n)、
      U6／U7 の fragment anchor、U1 のスキーマ属性）が**実在すること**を実装側で照合する（BR4.2）。
      Step 12〜15 はこの照合で見つかった不適合を直すステップである。
- [x] **Step 6: ビジネスロジック層のテストを書いて実行** — 本 Unit ではテストを新設しない。
      Step 5 の照合結果を `code-summary.md` に記録する。網羅性の機械的な近似
      （functional-spec.md §4 WF4.3「§2 の対応表の各トピックの見出し語がファイル内に現れる」）は
      U9 が実行する。

### 配備契約層（配置と投影）

- [x] **Step 7: 配備契約層の実装** — `bun run validate` / `build:claude` / `build:codex` が 8 本を
      `dist/<harness>/knowledge/<agent-slug>/` に投影することを確認する（FR10.3）。
      対象 5 ステージ（ddd-domain-modeling / domain-design / functional-design /
      infrastructure-design / code-generation）の lead／support エージェントが 4 つの slug で
      あることを確認し、`inline_context_paths` がどのように導出されるかを
      `.claude/tools/aidlc-orchestrate.ts` の実装で確かめる。
- [x] **Step 8: 配備契約層のテストを書いて実行** — 本 Unit ではテストを新設しない。
      観測した投影結果と、BR8.1 の検証（compose 後の `inline_context_paths`）が U9 の
      `aidlc-plugin-test --install` を要することを `code-summary.md` に記録する。

### 是正（未達 2 件と BR 逸脱 6 点を本パスで直す）

検証で見つかった 8 点を **本パスの中で修正する**。対象は 8 本すべてである。
ファイル名・配置・節構成・本文の主張は変えず、規則の書き方・索引・出典を仕様に合わせる。
修正前後の全文は `code-summary.md` に記録する。

#### 要件の未達

- [x] **Step 10: 是正 1 — FR10.2 の `module-visibility`**
      （`ddd/knowledge/aidlc-developer-agent/ddd-rust-domain-conventions.md`）
      同ファイルの Rules 表に `module-visibility` を主題とする規則を **1 件追加**する。
      `Applies to` はモジュール宣言と可視性修飾子を扱う層に限定する。
      **Enforcement は実在する検査だけを指す。** 本 Unit の照合で、センサー (a) は
      ドメイン型の**フィールド**の可視性だけを読み（`tools/ddd/lib/rules/rust/symbols.ts`）、
      モジュールの可視性を読む検査は (a)〜(n) にも `layer.*` にも存在しないことを確認した。
      したがって **`level = guidance-only`** とし、BR4.3 に従って文型を **PREFER** にする
      （ALWAYS / NEVER のまま guidance-only にはできない）。
      出典は `ddd/docs/domain-layer-design.md` §9 の `module-visibility` の項とし、
      「機械強制が無いため PREFER に留める」理由を Rationale に書く。
      **規則 ID は Step 12 の採番に従う**（`K.rust-domain-conventions.12`）。
- [x] **Step 11: 是正 2 — FR10.4 の ADR-010 の矛盾一覧**
      （`ddd/knowledge/aidlc-architect-agent/ddd-always-valid-model.md` の
      `## Conflicts with core knowledge` 節）
      現在の 4 行を、**`decisions.md` ADR-010 の 4 件**に置き換える。
      (1) Repository の動詞（`save` / `findByCustomer` に対し `find_by_id` / `store` /
      `delete_by_id`。適用範囲は IA 層のポート設計）、(2) 集約の導出（「大きめの集約から始める」
      に対し、イベントと不変条件から導出し集約を FSM として扱う）、(3) Entity の可変性と
      setter 禁止、(4) Event Sourcing とコマンドの戻り値（集約ごとの永続化宣言、decide/apply 分離、
      1 コマンド 1 イベント、リプレイ免除）。
      表の列は `functional-spec.md` §3-5 が定める
      `# | コアの記述 | プラグインの規約 | 適用範囲 | 採用理由` に合わせる。
      `コアの記述` は**コアの英語原文の引用**とし、`採用理由` を全 4 行に必ず書く
      （`entities.md` の `ConflictEntry.core_statement` / `rationale`）。
      `core_location` は `ddd-patterns.md` の**節名**まで書く:
      (1) `Repository Pattern`、(2) `Aggregates`、(3) `Entities`、(4) `Domain Events`。
      `precedence = plugin` は維持し、C-4 の scope に「BC 間の連携パターンはコアを引き続き適用する」
      と書く。
      この節は FR10.5 の Meta-discipline 節と同じファイルにあり、**Meta-discipline 節と
      Purpose・Sources は変更しない**（BR3.2 の節順を壊さない）。

#### BR レベルの逸脱

- [x] **Step 12: BR4.1 — 規則 ID の文法と文型の統一、および Principles の `RuleEntry` 化**
      （8 本すべて）
      1. **rule_id**: すべての `RuleEntry` を `K.<topic>.<n>` にする。
         `<topic>` は `entities.md` の `KnowledgeFile.topic`（ファイル名の `ddd-` 以降。
         `ddd-always-valid-model.md` なら `always-valid-model`）。`<n>` は**ファイル内で連番**
         （Principles 節を先、Rules 節を後）。文書間の一意性は topic の一意性で担保する。
      2. **statement**: ALWAYS / NEVER / PREFER のいずれかで始まる 1 文にする。
      3. **BR4.3 の適用**: ALWAYS / NEVER を冠する規則は、センサー・ステージ契約・スキーマの
         いずれかで強制されていなければならない。**実在する強制手段が無い規則は PREFER に
         言い換えて `guidance-only` にする。** この書き換えで従来より主張が弱まる規則が出る。
         弱めた規則は**すべて `code-summary.md` の逸脱欄に列挙する**（弱めた事実を隠さない）。
         現時点で確実に弱まるのは Step 10 の `module-visibility` と Step 13 の `AGG-7` である。
      4. **Principles 節**: `functional-spec.md` §3-2 に従い、箇条書きを `RuleEntry` の表にする。
         列は Rules 節と同じ 6 列（`Rule ID | Statement | Applies to | Enforcement | Rationale |
         Source`）。§3-2 の「level は多くが guidance-only または schema」に従い、
         機械強制がある原則だけ ALWAYS / NEVER、それ以外は PREFER + guidance-only とする。
      5. **例外の記録（BR4.4）**: `functional-spec.md` §3-3 は Rules 節の列を 6 列に固定しており、
         `entities.md` の `exceptions` に対応する列が無い。**例外は Rationale 列に
         「<例外> — <理由>」の形で書く**（この解釈を `code-summary.md` に記録する）。
      6. 採番後の ID は次のとおり（規則の**本数は変えない**。増えるのは Step 10 の 1 件のみ）:

         | ファイル | topic | 現行 | 変更後 |
         |---|---|---|---|
         | `ddd-always-valid-model.md` | `always-valid-model` | AVM-1〜5 + Principles 4 | `K.always-valid-model.1`〜`.9` |
         | `ddd-aggregate-and-invariants.md` | `aggregate-and-invariants` | AGG-1〜8 + Principles 3 | `K.aggregate-and-invariants.1`〜`.11` |
         | `ddd-use-case-conventions.md` | `use-case-conventions` | UC-1〜7 + Principles 3 | `K.use-case-conventions.1`〜`.10` |
         | `ddd-cqrs-and-consistency.md` | `cqrs-and-consistency` | CQ-1〜6 + Principles 3 | `K.cqrs-and-consistency.1`〜`.9` |
         | `ddd-rust-domain-conventions.md` | `rust-domain-conventions` | RDC-1〜8 + Principles 3 + 新規 1 | `K.rust-domain-conventions.1`〜`.12` |
         | `ddd-rust-persistence-conventions.md` | `rust-persistence-conventions` | RPC-1〜7 + Principles 3 | `K.rust-persistence-conventions.1`〜`.10` |
         | `ddd-interface-adapter-conventions.md` | `interface-adapter-conventions` | IAC-1〜8 + Principles 3 | `K.interface-adapter-conventions.1`〜`.11` |
         | `ddd-layer-boundaries.md` | `layer-boundaries` | LB-1〜8 + Principles 3 | `K.layer-boundaries.1`〜`.11` |

      7. 本パス後、規則 ID の旧表記（`AVM-`・`AGG-`・`UC-`・`CQ-`・`RDC-`・`RPC-`・`IAC-`・`LB-`）は
         8 本の中に残さない。**`ddd/` の他の場所（テスト・ツール・contribution・docs・
         CHANGELOG）と `aidlc/` の記録にこれらの ID を参照する箇所が無いことは確認済み**であり、
         改名による参照切れは起きない。

- [x] **Step 13: Enforcement の是正 — `severity` の欠落と実在しない anchor**（BR4.2、entities.md）
      1. `entities.md` は `level = sensor` のとき `severity` を必須とする。次の 3 件に
         **深刻度を補う**。免除の事実は `refs` に括弧書きで残さず、**Rationale に移す**
         （`refs` は規則 ID・anchor・スキーマ属性名の一覧であるため）:
         - `RPC-2`（`sensor:c (replay exempt)`）→ `sensor:c blocking`、Rationale に
           「replay 経路は (c) の対象外 — 復元は生成ではない」
         - `RPC-3`（`sensor:b (exempt)`）→ `sensor:b blocking`、Rationale に
           「replay 名のメソッドは Command ではないため (b) の対象外」
         - `LB-6`（`sensor:k (exempt when from rmu)`）→ `sensor:k blocking`、Rationale に
           「RMU からの依存は (k) の対象外 — RMU は両側を橋渡しする」
         あわせて 8 本の全 `sensor:` 行を走査し、`level = sensor` で深刻度の無いものが
         他に無いことを確認する。
      2. `AGG-7` の `stage-contract:after-step:3` は**実在しない**。本プラグインの contribution が
         宣言する anchor は `after-step:1`（code-generation）、`:2`・`:4`（domain-design、
         functional-design）、`:2`・`:5`（infrastructure-design）だけで、
         `ddd-domain-modeling` は fragment を持たない（`ddd/contributions/**` と
         `ddd/stages/inception/ddd-domain-modeling.md` で確認済み）。
         「イベントから集約を逆算する」は**ワークショップ手順であって機械強制できない**ため、
         **PREFER に言い換えて `guidance-only`** とする。Rationale に
         「導出の**結果**（全 Aggregate が不変条件と遷移を持つこと）は
         `sensor:model-completeness.i` / `.ii` が強制する。導出の**順序**は強制しない」と書く。
      3. `sensor:` の (a)〜(n)、`model-completeness.*`、`mapping-declarations.*`、
         `layer-structure.*`、`design-advisories.*`、`schema:*` の参照は**すべて実在を確認済み**。
         書き換え後にもう一度照合し、結果を `code-summary.md` に記録する。

- [x] **Step 14: example-index の実在化と索引の網羅**（BR6.1、BR6.2、BR4.5）
      1. **ロケータの形式**: BR6.1 は `tests/golden/<suite>/<sensor-id>/clean-*/` という
         **ディレクトリ**を索引する形を定めるが、そのディレクトリは存在しない。実際のゴールデン
         ケースは `ddd/tests/golden/design/cases.ts` と `ddd/tests/golden/rust/cases.ts` の
         **TypeScript の表**にあり、ランナーが `files` を一時ディレクトリに実体化して実行する
         （**U4 の逸脱 1 として既に承認済み**。U8 はこの構造を継承する）。
         したがって `fixture_path` は**実在するリポジトリ相対パスとケース名**で書く:
         `tests/golden/<suite>/cases.ts#<case-name>`。
      2. **索引の網羅**: BR4.5（functional-spec WF3.1）に従い、**`level = sensor` の全規則**に
         索引を 1 件付ける（現行は 8 本で 10 行しかない）。索引先は、
         **その規則を強制するセンサーが実行する clean ケース**とする。実在を確認済みの対応は
         次のとおり:

         | センサー | suite | clean ケース |
         |---|---|---|
         | `ddd-rust-domain` | rust | `clean-domain` |
         | `ddd-rust-interface-adapter` | rust | `clean-repository` |
         | `ddd-model-completeness` | design | `clean-complete` |
         | `ddd-model-presence` | design | `clean-execute`（EXECUTE）/ `clean-skip`（SKIP） |
         | `ddd-reference-ids` | design | `clean-mapping` |
         | `ddd-mapping-declarations` | design | `clean-mapping`（宣言は domain-design / functional-design の 2 節） |
         | `ddd-layer-structure` | design | `clean` |
         | `ddd-design-advisories` | design | `clean` |

         `clean-mapping` と `clean` は suite 内で 2 回使われるケース名であるため、
         **`What it shows` 列に対象センサーを明記**して一意にする。
      3. **違反ケースを指さない**: 現行の `CQ-3` → `violation-k`、`RPC-7` → `violation-n` は
         BR6.1（「違反なし」fixture）に反する。上表の clean ケースに差し替える。
      4. **`projection_note`（BR6.2）**: 各行に
         「投影先のハーネスからは参照できない（`tests/golden/` は `.claude/knowledge/` に投影されない）
         旨」と「プラグインのリポジトリでの参照方法（`ddd/` で該当ファイルを開き、
         ケース名と対象センサーで引く。`bun test` で実行する）」を書く。
      5. **残る限界（正直な申告）**: (k) と (l) を強制するセンサーの clean ケース
         （`clean-repository`）には、コマンド側とクエリ側のクレート対が**含まれていない**ため、
         この 2 規則の索引は「センサーが違反を報告しなかったケース」を指すにとどまり、
         規則を**実演**してはいない。BR6.1 は「U4 または U5 の clean fixture を 1 件選ぶ」と
         定めるため、**U8 がケースを新設することはできない**（`tests/golden/` の所有者は U4・U5）。
         この残差は `code-summary.md` の逸脱欄に記録し、U9 への申し送りに含める。
         同じ理由で `RPC-2` / `RPC-3` の索引は (c) / (b) の clean ケースを指し、
         Event Sourcing 固有の部分は実演しない。

- [x] **Step 15: 出典を U1／U2 の Unit 設計とコアの非矛盾記述に向ける**（BR7.1、BR5.2）
      1. **BR7.1**: スキーマと ID 文法の説明の出典を U1 に、クレート命名・配置規約の説明の出典を
         U2 に向ける。`Sources` 節と各規則の `Source` 列の双方で、
         `SourceRef.kind = unit-design` として
         `construction/u1-sensor-foundation/functional-design/entities.md`（正規モデルのスキーマ）・
         `rules.md`（ID 文法）、
         `construction/u2-rust-analysis-foundation/functional-design/entities.md`・`rules.md`
         （クレート命名・配置・Rust 解析）を指す。
         **設計書（`ddd/docs/*.md §n`）と ADR の出典はそのまま残す**
         （`SourceRef.kind = design-doc` / `adr` として正当）。
         現在 `Source` 列が指している 2 本の**実装ファイル**
         （`ddd/tools/ddd/lib/rules/lists.ts`、`ddd/tools/ddd/lib/workspace/resolver.ts`）は
         U2 の設計に差し替える（BR7.1 は Unit 設計を出典とする）。
      2. **BR5.2**: 「矛盾しないコアの記述」を `core-knowledge` の `SourceRef` として引用する。
         対象はコアの `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` の
         `Aggregates`（集約間参照は ID、トランザクションは集約を跨がない）、
         `Repository Pattern`（集約ルート単位、クエリは別の読み取りモデル）、
         `Value Objects`（VO をプリミティブより優先）の各節。
         引用は `Rationale` 節（および関連する規則の `Source` 列）に置き、
         プラグイン側の根拠として使う。

#### 構成と文書

- [x] **Step 9: 環境・ビルド構成（是正前の基準値）** — `bun run check:biome` と `bun run validate` が
      通り、`bun test tests/u3-plugin-scaffold.test.ts`（ナレッジ面を唯一検査する既存テスト）が
      緑であることを確認する。`bun run check` の `test` 段は既知の 12 件で終了コード 1 になる
      見込みである（U3・U4 と同じ理由）。この実測は**是正の前の基準値**として残す。
- [x] **Step 16: ドキュメントとトレーサビリティ** — 是正後に Step 9 の 4 コマンドを**再実行**し、
      基準値との差を記録する。`code-summary.md` に作成物と判断、**Step 10〜15 で書き換えた
      8 本の修正前後の全文**、Step 12 で PREFER に弱めた規則の一覧、Step 13 の Enforcement 照合結果、
      Step 14 の索引表と残差、Step 15 の出典の対応を記録する。
      `traceability.json` に本 Unit の 7 要件 ID と実装の対応を、
      `source-manifest.json` に本 Unit が所有する 8 パスを列挙する。
      `traceability.json` の FR10.2 と FR10.4 は**是正後に `OK`** とする。

### レビュー所見への対応（R-01・R-02・R-03）

前回レビューで残った Minor 所見 3 件を是正する。
Step 17a〜17c は `traceability.json` と本計画の記録の修正で、ナレッジ文書には触れない。
**Step 17d だけがナレッジ文書 1 本に触れる。**

- [x] **Step 17a: `target` がディレクトリの行を実在ファイルに直す（R-03）** —
      `FR10`（status `OK`）と `FR10.3`（status `Deferred`）の `target` が
      `ddd/knowledge/` というディレクトリで、traceability センサーが
      `invalid_targets`（"target file does not exist"）を報告する。他 Unit の完了条件と同じく
      `OK` 目標は実在するワークスペース相対**ファイル**でなければならない。
      両行の `target` を `ddd/knowledge/aidlc-shared/ddd-layer-boundaries.md` に改める。
      8 本という集合であることは既存の `note` が保持しているため情報は失われない。
      是正後に traceability センサーを実行し、`invalid_targets` が 0 件になることを実測する。

- [x] **Step 17b: 自 Unit の業務規則 26 件を `traceability.json` に載せる（R-02）** —
      現在の `upstream_ids` は FR10 系 7 件のみで、本 Unit 自身の
      `functional-design/rules.md` が定める **BR1.1〜BR8.2 の 26 件が 1 件も現れない**。
      ステージ定義 `code-generation.md` の期待 JSON スキーマ例は `AC` / `NFR` に加えて
      `BR` を coverage 行として示しており、業務規則の対応も含める形が想定されている。
      26 件を `upstream_ids` と `coverage` に追加する。

      **`target` の決め方**: その規則が最も直接に観測できる、**本 Unit 所有の 8 パスのいずれか**を
      指す。他 Unit 所有のファイルは `target` にしない（U3 の同種の所見と同じ規律）。
      8 本は Purpose / Principles / Rules / Rationale / Examples (index) / Retired rules / Sources の
      共通節を持ち、`ddd-always-valid-model.md` だけが追加で
      `Conflicts with core knowledge` と `Meta-discipline` を持つため、
      BR5 系（コアとの矛盾・優先順位）はこのファイルを指す。

      **`Deferred` にする 2 件**: BR8.1（compose 後に各ステージの `inline_context_paths` に
      ナレッジが現れることを検証）と BR8.2（8 本の存在・接頭辞・衝突・Sources・fixture の実在を
      テストで検証）は、いずれも規則本文が**検証を U9 の統合テストに課している**。
      本 Unit に属するテストファイルは存在せず（`ddd/tests/` に u8 のテストは無い）、
      本 Unit では観測できない。既存の FR10.3 と同じ理由で `Deferred` とし、
      `note` にその根拠を書く。残る 24 件は `OK` とする。

      各行の `note` は実測に基づいて書く。**該当ファイルを開いて確認できなかった規則は
      `OK` にせず、確認できた範囲を `note` に正直に書く。**

- [x] **Step 17c: Step 1〜16 のチェックボックスを実施済みに更新する** —
      `code-summary.md` が実施を記録しているにもかかわらず、計画の Step 1〜16 は
      すべて `[ ]` のまま残っている。タスクマーカーは承認フィンガープリントの射影から
      除外される（`aidlc-testing-posture.ts`: 「List task markers are reset … A tick is a
      claim about execution, not a change to the plan.」）ため、更新しても承認は失効しない。
      **`code-summary.md` が実施を記録している範囲に限って** `[x]` に更新し、
      更新後に `aidlc-testing-posture.ts verify --unit u8-knowledge-pack` が
      `ok: true` を返すことを実測で確認する。

- [x] **Step 17d: `ConflictEntry` の `core_location` / `precedence` を独立した列にする（R-01）** —
      `entities.md:72,76` は `ConflictEntry` の必須属性として `core_location` と `precedence` を
      定め、`functional-spec.md:69,71`（WF2-2・WF2-4）も「節名を core_location に書く」
      「precedence は plugin」と、いずれも名前付きの項目として扱っている。
      一方 `functional-spec.md:50`（§3-5）は「ADR-010 の 4 件の表」とだけ書き、
      **列構成を定めていない**。したがって 5 列という現状は仕様の要求ではなく実装側の判断で、
      上流 2 文書と食い違っている。上流への変更依頼は要らず、実装側で直せる。

      `ddd/knowledge/aidlc-architect-agent/ddd-always-valid-model.md` の
      `## Conflicts with core knowledge` の表を 5 列から **7 列**に改める。

      ```
      # | Core statement | Core location | Plugin rule | Scope | Precedence | Rationale
      ```

      - `Core location` 列に `ddd-patterns.md` → `<節名>` を移し、
        `Core statement` セルから同じ接尾を外す。
      - `Precedence` 列に 4 行とも `plugin` を書き、表の直前にあった
        「The precedence is stated here rather than as a column …」の 2 文を削除する
        （列になったので不要になる）。コアのファイルが編集できないためこの一覧が
        唯一の調停である、という記述は残す。
      - **本文の主張・行 ID・節構成・ファイル名・配置は変えない。**
        他の 3 本は `C-1` / `C-4` という行 ID でのみ参照しており列構成に依存しないことを、
        事前に grep で確認する。
      - 是正後に行数（BR3.3 の 250 行以内）、節順（BR3.2）、
        `bun run check:biome` / `bun run validate` / `bun test tests/u3-plugin-scaffold.test.ts`
        を実測する。

      **本ステップだけがナレッジ文書に触れる。** 対象は 8 本のうち 1 本、節は 1 つである。

## 要件 → 実装ステップの対応

| 要件 | 内容 | ステップ | 対象 |
|---|---|---|---|
| FR10 | ナレッジ（8 本の文書集合） | Step 1, 3, 5, 7, 12〜15 | `knowledge/<agent-slug>/ddd-*.md` |
| FR10.1 | 言語横断（基盤）ナレッジを提供する | Step 5 | architect の 4 本と shared の 1 本 |
| FR10.2 | 言語別（Rust）ナレッジを提供する | Step 5, 10, 12 | developer の 2 本 |
| FR10.3 | `knowledge/<agent-slug>/` に置き slug を完全一致させる | Step 1, 7 | 4 ディレクトリ、`plugin.json` |
| FR10.4 | ファイル名はプラグイン固有。コアとの矛盾を明示する | Step 1, 11, 12 | `ddd-` 接頭辞、`ddd-always-valid-model.md` の Conflicts 節 |
| FR10.5 | メタ規律を含める。強制できる範囲だけを主張する | Step 12, 13, 14 | `ddd-always-valid-model.md` の Meta-discipline 節、全 8 本の Enforcement と索引 |
| FR10.6 | 必須条件はナレッジだけに任せない | Step 13, 15 | Enforcement の参照実在、U1／U2 を出典とする |

## テスト方針（Unit 限定）

- **実行コマンド**（`ddd/` を作業ディレクトリとする）:
  - `bun test tests/u3-plugin-scaffold.test.ts` — ナレッジ面（`knowledge/` がディレクトリとして存在し
    1 件以上を含むこと、`ddd-` 接頭辞）を検査する唯一の既存テスト
  - `bun run validate` — プラグイン検証。`knowledge/` 面の宣言を受理すること
  - `bun run check:biome` — U8 は Markdown のみだが、リポジトリ全体の整形規約を壊していないこと
  - `bun run build:claude` / `bun run build:codex` — 8 本の投影
- **使わないコマンド**: `bun test tests/`（プロジェクト全体。Build and Test が Unit ごとに
  実行するため、Unit 限定の指定が要る）
- **戦略**: Standard — コンポーネントあたり 5〜8 件。U8 は kind `spec` で、
  BR8.1／BR8.2 の検証は U9 の統合テストが所有する。**本 Unit でテストを新設しない**
- **スコープ床（plugin-dev）**: 追加の新規テスト床は無し。既存スイートが緑であること
- **品質目標**: 契約の coverage floor を緩和しない。落ちた場合は目標を下げずに乖離を報告する

## 検証

承認後、Step 1・3・5・7 は**既存実装の検証**、Step 2・4・6・8 は**実行と記録**、
Step 9 は**是正前の基準値の測定**、Step 10〜15 は**書き換え**、Step 16 は**再検証と記録**として
実施する。いずれも結果は `code-summary.md` に記録する。

- 8 本の実在、行数（BR3.3 の目安: 1 本 250 行以内、合計 1500 行以内）、H2 節の構成
- FR10.1 の 19 トピックと FR10.2 の 11 トピックの網羅（functional-spec.md §2 の対応表に 1 行ずつ照合）
- **全 83 規則の `rule_id` が `K.<topic>.<n>` の文法に一致し、8 本文書間で一意であること**
- **全 83 規則の `statement` が ALWAYS / NEVER / PREFER で始まる 1 文であること**
- **ALWAYS / NEVER を冠する規則に強制手段が実在すること、PREFER に弱めた規則が
  `code-summary.md` に列挙されていること**（BR4.3）
- **`level = sensor` の全規則に `severity` があり、`stage-contract` の ref が実在する anchor を指すこと**
- **example-index の全行の `fixture_path` が実在し、`pass: true` のケースを指していること**、
  および `level = sensor` の全規則が索引を持つこと（BR4.5）
- ADR-010 の矛盾 4 件と、`ddd-always-valid-model.md` の Conflicts 節 4 行の 1 対 1 対応
- BR7.1 の出典（U1／U2 の Unit 設計）と BR5.2 の `core-knowledge` 引用の存在
- コアの `.claude/knowledge/` とのファイル名衝突の有無
- `bun run validate` / `build:claude` / `build:codex` / `check:biome` の実測（終了コードを含む）
- `bun test tests/u3-plugin-scaffold.test.ts` の実測（pass / fail 件数）
- センサー `required-sections` / `linter` / `type-check` / `traceability` の本 Unit 成果物に対する判定
- `source-manifest.json` の全パスが実在し、未申告の変更が無いこと

### 計画時に判明している乖離（正直な申告）

独自の読み取りで、仕様と実装の間に次の 8 点を見つけている。
**1・2 は要件の未達、3〜7 は BR レベルの逸脱であり、いずれも本パスで修正する**（Step 10〜15）。
8 は設計どおりであり、逸脱ではない。承認時にはこの 8 点を確認されたい。

**1. FR10.2 の `module-visibility` に対応する規則が無い（要件の未達）。**
FR10.2 は Rust のトピックとして `module-visibility` を挙げ、`ddd/docs/domain-layer-design.md` §9 も
取り込み候補として明記している。`ddd-rust-domain-conventions.md` は Purpose の文に
"module visibility" と書くだけで、Rules 表にこれに対応する規則が 1 件も無い。
他の 7 トピック（field-visibility、tell-dont-ask、factory-naming、interior-mutability、
domain-equality、error-handling、first-class-collections）はすべて規則を持つ。
**Step 10 で修正する**（規則を 1 件追加する）。

**2. ADR-010 の矛盾 4 件と、ナレッジの Conflicts 節 4 行が一致しない（要件の未達）。**
story map は「FR10.4 の一覧の内容は `decisions.md` ADR-010 が出典」と定め、functional-spec.md §3 と
WF2 と BR5.1 も ADR-010 の 4 件の転記を求めている。ADR-010 の 4 件は
(1) Repository の動詞、(2) 集約の導出、(3) Entity の可変性と setter 禁止、(4) Event Sourcing と
コマンドの戻り値である。ナレッジの 4 行は (1) Domain Primitive がコアの語彙に無いこと、
(2) コアが集約をデータの塊として扱うこと、(3) コアが getter を許すこと、(4) コアが
コンテキスト間パターンを開いたままにすることであり、**ADR-010 の (1) と (4) が無く、
(2) 以外は別の主張**である。加えて `ConflictEntry` が要求する `core_statement`（コアの記述の
英語引用）と `rationale`（採用理由）の列が無く、`core_location` は節名ではなくファイル名である。
**Step 11 で修正する**（4 行を ADR-010 の 4 件に置き換える）。

**3. 規則 ID の文法と文型が BR4.1 と一致しない。**
BR4.1 と entities.md は `rule_id` を `K.<topic>.<n>`、`statement` を ALWAYS / NEVER / PREFER で
始まる 1 文と定める。実装の 8 本が持つ **57 規則**は `AVM-1`・`AGG-1`・`CQ-1`・`UC-1`・`IAC-1`・
`RDC-1`・`RPC-1`・`LB-1` という短い接頭辞形式で、`statement` は小文字で始まる宣言文である。
`functional-spec.md` §3 が定める Rules 節の**表の列構成**（Rule ID / Statement / Applies to /
Enforcement / Rationale / Source）は一致している。**Step 12 で修正する**（全 83 規則を採番し直し、
文型を揃える）。旧表記は `ddd/` の他の場所から参照されていないことを確認済みである。

**4. Principles 節の項目が `RuleEntry` になっていない。**
`functional-spec.md` §3-2 は Principles を `RuleEntry`（level は多くが guidance-only または schema）
と定め、`entities.md` も `KnowledgeSection.entries` を `list<RuleEntry>`（kind = principles / rules の
とき 1 件以上）とする。実装の Principles は rule_id も Enforcement も Rationale も持たない
箇条書きである（8 本で計 25 項目）。**Step 12 で修正する**（表にする）。

**5. Enforcement 列の一部が深刻度を欠き、1 件が実在しない anchor を指す。**
`entities.md` は `level = sensor` のとき `severity` を必須とする。`RPC-2` の
`sensor:c (replay exempt)`、`RPC-3` の `sensor:b (exempt)`、`LB-6` の
`sensor:k (exempt when from rmu)` は深刻度を書いていない。
また `AGG-7` の `stage-contract:after-step:3` は、本プラグインの contribution が宣言する
anchor（`after-step:1` / `:2` / `:4` / `:5`）に存在しない（BR4.2）。
`sensor:` の (a)〜(n)、`model-completeness.*`、`mapping-declarations.*`、`layer-structure.*`、
`design-advisories.*`、`schema:*` の参照は**すべて実在を確認した**。
**Step 13 で修正する**（深刻度を補い、免除は Rationale に移し、`AGG-7` は PREFER + guidance-only に
言い換える）。

**6. example-index の `fixture_path` が実在パスではなく、`projection_note` が BR6.2 の内容を持たない。**
索引は `tests/golden/design/.../clean-complete` のように `...` を含む**予定パス**で、
リポジトリ相対の実在パスではない。実際のゴールデンケースは
`ddd/tests/golden/design/cases.ts` と `ddd/tests/golden/rust/cases.ts` の TypeScript の表にあり
（**U4 の逸脱 1 と同じ構造で、既に承認済み**）、`tests/golden/<suite>/<sensor-id>/clean-*/` という
ディレクトリは存在しない。索引が指す**ケース名はすべて実在**する（`clean-complete`、
`clean-mapping`、`clean`、`clean-repository`、`clean-domain`）が、`CQ-3` は `violation-k`、
`RPC-7` は `violation-n` と、BR6.1 が求める「違反なし」以外のケースを指している。
`projection_note` は "design fixture" / "rust fixture" の一言で、BR6.2 が求める
「投影先のハーネスからは参照できない旨と、リポジトリでの参照方法」を書いていない。
また索引は 8 本で **10 行**しかなく、`level = sensor` の全規則を覆っていない（BR4.5、WF3.1）。
**Step 14 で修正する**（実在ロケータにし、センサーごとの clean ケースで全 sensor 規則を索引する）。
**BR6.1 の literal な形（ディレクトリ）は実装に存在しないため、ロケータの形式は
`tests/golden/<suite>/cases.ts#<case-name>` とする** — この形式差は U4 の逸脱 1 に由来する残差として
`code-summary.md` に記録する。

**7. BR7.1 の出典が U1／U2 の Unit 設計を指していない。**
BR7.1 は出典を `SourceRef.kind = unit-design` で `construction/u1-*/functional-design/` に
向けることを求める。実装の `Sources` 節は `ddd/docs/*.md` を指し、`AVM-5` の `Source: U1 BR1.1`
だけが例外である。2 本のファイルは設計ではなく実装ファイル
（`ddd/tools/ddd/lib/rules/lists.ts`、`ddd/tools/ddd/lib/workspace/resolver.ts`）を指す。
BR5.2 が求める「矛盾しないコアの記述」（集約間参照は ID、トランザクションは集約を跨がない、
リポジトリは集約ルート単位、クエリは別の読み取りモデル、VO をプリミティブより優先）も
`core-knowledge` の `SourceRef` として引用されていない（BR5.2 の違反列は「なし」であり、
方針の話である）。**Step 15 で修正する**（U1／U2 の設計に向け、コアの非矛盾記述を引用する）。

**8. BR8.1／BR8.2 の検証は U9 が所有する（設計どおり）。**
本 Unit の 8 本を対象にした検証（compose 後の `inline_context_paths` の実在、Sources 節の存在、
example-index の fixture の実在）は、`ddd/tests/` のどこにも実装されていない。
`tests/u3-plugin-scaffold.test.ts` のナレッジ面の検査は面の存在と粒度に限られる。
functional-spec.md §4 WF4・BR8.1・BR8.2・entities.md の `PlacementCheck` はいずれも実行主体を
U9 の統合テスト（`bun run check`）と定めており、**これは設計どおりである**。
本 Unit は U9 への申し送り事項を `code-summary.md` に列挙し、`traceability.json` では
FR10.3 を `Deferred` として記録する。

## 是正の実施計画（未達 2 件と BR 逸脱 6 点）

検証で見つかった 8 点は、**記録に留めず本パスの中で修正する**（Step 10〜15）。
修正の対象・内容・完了条件は上の「実装ステップ」に定めたとおりである。ここでは
**本パスで直すと決めた理由**と、**完了の判定方法**を記す。

### 本パスで直す理由

- U8 の責務は `unit-of-work.md` の U8 の節に
  **「基盤ナレッジ（…）、Rust コード規約、IA 層規約、層境界の原則、メタ規律、
  ADR-010 の矛盾一覧の転記」**と書かれており、FR10.2 のトピック網羅も FR10.4 の
  矛盾一覧の転記も、BR4〜BR7 が定める**規則・索引・出典の書き方**も **U8 自身の責務**である。
  他の Unit に移すと `unit-of-work.md` と矛盾する（U9 の境界は「各コンポーネントの実体は
  U1〜U8」と明記している）。
- 是正の実体は **8 本の記述の書き換え**であり、後続 Unit や新規 Unit に引き継ぐより、
  本パスで閉じた方が確実である。引き継ぎ先が動く保証のないまま `GAP` や逸脱を残すのは、
  要件と規約を満たさないまま完了させることに等しい。
- BR4〜BR7 の逸脱は**欠陥ではなく主張の過剰**である。とくに BR4.3（ALWAYS / NEVER は
  強制されていなければならない）を満たすには、強制手段の無い規則を PREFER に弱める必要がある。
  放置すると「実装済みと主張するのは強制できる範囲だけ」（FR10.5）に反し続ける。

### 完了の判定

- **是正の完了条件**: Step 10〜15 の完了条件（上記）を満たすこと。すなわち
  `ddd-rust-domain-conventions.md` に `module-visibility` を主題とする規則があり、
  `ddd-always-valid-model.md` の Conflicts 節の 4 行が ADR-010 の 4 件と 1 対 1 で対応し、
  全 83 規則の ID が `K.<topic>.<n>` で文型が ALWAYS / NEVER / PREFER で始まり、
  `level = sensor` の全規則に深刻度があり、`stage-contract` の ref が実在 anchor を指し、
  `level = sensor` の全規則が実在する clean ケースを索引し、出典が U1／U2 の設計を指していること。
- **検証**: Step 16 で Step 9 の 4 コマンドを**再実行**し、基準値との差を記録する。
  加えて U9 の統合テスト（BR8.1／BR8.2、`bun run check`）が 8 本の内容を検査する。
- **`traceability.json`**: FR10.2、FR10.4、FR10.5、FR10.6 は**是正後に `OK`** とする。
  目標は是正後のファイル（`ddd/knowledge/...`）とする。
- **`source-manifest.json`**: 8 パスは変わらないが、**8 本すべてが本パスで内容が変わる**
  （ファイル名・配置は不変）。`code-summary.md` に修正前後の全文を記録する。

### `bun run check` の扱いについて（正直な申告）

`bun run check` は `test` 段を含むため、U3・U4 と同じ理由で **終了コード 0 にならない見込み**である
（`tests/codex-dispatch-bridge.test.ts` の 12 件が要求する `aidlc-workflows/dist/codex/aidlc` の
fixture が未生成。`ddd/tests/README.md` が既知の前提条件として記載し、`aidlc-workflows/` は
読み取り専用のサブモジュール）。

本 Unit の FR10 群の**検証欄**はいずれも `bun run check` の緑を挙げていないが、BR8.1／BR8.2 の
`trigger` は `bun run check` である。計画は要件本文に照らして判定し、上記の実測値と生の証拠を
`code-summary.md` に併記する。`check` コマンドそのものの緑は U9 が所有し、
U3 は `FR11.3` として既に GAP を記録している。**目標を下げて通すことはしない。**

## 完了条件

- 本 Unit が所有する 8 パスが `source-manifest.json` に列挙されている
- `traceability.json` のすべての `OK` 目標が実在するワークスペース相対**ファイル**である。
  ディレクトリを指す行は無い（Step 17a）
- `traceability.json` のすべての `target` が本 Unit 所有の 8 パスのいずれかである。
  他 Unit 所有のファイルを `target` に据えていない（Step 17b）
- traceability センサーの `invalid_targets` が **0 件**である（Step 17a、実測）
- `traceability.json` の `upstream_ids` に、自 Unit の `rules.md` が定める
  **BR1.1〜BR8.2 の 26 件**がすべて現れている（Step 17b）
- 計画の Step 1〜16 のチェックボックスが、`code-summary.md` の記録と一致している。
  更新後も `aidlc-testing-posture.ts verify --unit u8-knowledge-pack` が
  `ok: true` を返す（Step 17c、実測）
- Step 17a〜17c はナレッジ文書 8 本を 1 行も変更していない
- Step 17d が変更したのは `ddd/knowledge/aidlc-architect-agent/ddd-always-valid-model.md` の
  `## Conflicts with core knowledge` 節のみで、他の 7 本には触れていない。
  本文の主張・行 ID（C-1〜C-4）・節構成・ファイル名・配置は変わっていない
- Step 17d の後、`ConflictEntry` の `core_location` と `precedence` が
  `entities.md` の属性定義と 1 対 1 に対応する独立した列になっている
- **FR10.2・FR10.4・FR10.5・FR10.6 が是正後に満たされている**
  （`traceability.json` で `OK`。目標は是正後のファイルを指す）
- 8 本すべてについて、修正前後の全文が `code-summary.md` に記録されている。
  **ファイル名・配置・節構成は変更していない**
- **BR4.3 により PREFER に弱めた規則が `code-summary.md` の逸脱欄に列挙されている**
  （弱めた事実を隠さない）
- **Step 14 の索引の残差**（(k)・(l) の clean ケースが規則を実演しないこと、
  BR6.1 のディレクトリ形式が実装に存在しないこと）が `code-summary.md` に記録されている
- 検証で見つかった乖離がすべて `code-summary.md` の逸脱欄に記録されている
- BR8.1／BR8.2 の U9 への申し送り事項が `code-summary.md` に列挙されている
- 是正後に Step 9 の 4 コマンドを再実行し、基準値との差が `code-summary.md` に記録されている

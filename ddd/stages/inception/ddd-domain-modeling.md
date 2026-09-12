---
slug: ddd-domain-modeling
phase: inception
plugin: ddd
execution: CONDITIONAL
condition: Execute when the domain concepts change. Skip when the existing canonical model is still valid.
lead_agent: aidlc-architect-agent
support_agents:
  - aidlc-product-agent
mode: inline
summary_confirmation: required
produces:
  - ddd-domain-model
  - ddd-domain-model-yaml
consumes:
  - artifact: requirements
    required: false
  - artifact: stories
    required: false
  - artifact: architecture
    required: false
    conditional_on: brownfield
  - artifact: component-inventory
    required: false
    conditional_on: brownfield
requires_stage:
  - requirements-analysis
  - user-stories
sensors:
  - ddd-model-completeness
reviewer: aidlc-architecture-reviewer-agent
review_artifact: ddd-domain-model
review_class: advisory
reviewer_max_iterations: 1
scopes:
  - enterprise
  - feature
  - mvp
  - classic
  - workshop
  - refactor
  - plugin-dev
inputs: <record>/inception/requirements-analysis/requirements.md and <record>/inception/user-stories/stories.md (both optional); reverse-engineering architecture.md and component-inventory.md when brownfield; an existing <record>/inception/ddd-domain-modeling/ddd-domain-model-yaml.md on rerun
outputs: ddd-domain-model-yaml.md (the canonical, machine-validated model) and the derived ddd-domain-model.md, plus domain-modeling-questions.md, all under this stage's record dir, engine-resolved
---

# Domain Modeling

Produce the **canonical domain model** — the single source of truth for the
entities, values, aggregates, invariants, commands, events, errors and state
transitions the system must express. Every later stage references this model by
stable element ID instead of redefining it.

This stage owns the model **up to aggregate boundaries**. It does not decide
modules, crates, deployment units, ports, repositories or use-case procedures —
those belong to Domain Design, Functional Design and Infrastructure Design. It
does not write code.

`ddd-domain-model-yaml.md` is canonical. `ddd-domain-model.md` is derived from it and exists
for human review; the gate checks that the two agree.

## Constraints

- Own the aggregate boundary only. No module, deployment unit or use-case step.
- Do not write code or Cargo manifests.
- The yaml is canonical; the md must mention every element ID and repeat every
  invariant statement verbatim.
- Never rename an element ID: `rename` changes `name` only. Split, merge and
  removal are recorded in `lineage:` and the retired ID is removed from the body
  and never reused.

## Steps

### Step 1: Load Prior Context

Read `requirements.md` and `stories.md` when produced, and the reverse-engineering
`architecture.md` / `component-inventory.md` when brownfield. On rerun, read the
existing `ddd-domain-model-yaml.md` and keep its element IDs as the starting candidates.
Read the knowledge `ddd-always-valid-model.md`, `ddd-aggregate-and-invariants.md`
and `ddd-layer-boundaries.md` before writing the model.

### Step 2: Discover Domain Events

For each story, list the domain events in the past tense and record the Command
and actor that produces each. Keep the story → event → command → aggregate trace
in the questions file.

### Step 3: Derive Aggregate Candidates

Group the events that change the same state into aggregate candidates. For each
candidate write the invariant hypothesis and its Bounded Context. A candidate
that cannot own an invariant is merged or demoted. Cross-aggregate flows become
Process Manager candidates in a separate table. When brownfield, compare the
candidates with the existing code and record the differences as open questions.

### Step 4: Questions and Confirmation

下流のパッケージ名の根拠となる業務語彙と、コードで使う名称の対応も確認する。
集約・Entity・VOという型分類をパッケージ名にせず、業務概念でまとめられる語彙を説明へ残す。
物理パッケージやファイル配置はここで決めず、正規YAMLへ追加しない。配置はdomain-designが所有する。

Create `domain-modeling-questions.md`. Cover bounded contexts, aggregate
candidates (merge / demote confirmation), invariants, commands and errors
(effect, state_effect, Domain Error, idempotency), states and transitions, ID
slugs when non-ASCII terms appear, and Process Managers when there are
candidates. Follow the core question flow and take the Consolidated Summary
Confirmation before writing the model.

### Step 5: Write the Canonical Model

正規データは `ddd-domain-model-yaml.md` のラベル付きYAMLコードブロック1つに記載する。
YAMLの外側には説明を置けるが、第2のYAMLブロックを追加しない。U1の形式で
`schema_version: 1`、Bounded Context、集約、要素、不変条件、コマンド、エラー、
イベント、遷移、生成規則、系譜を記載する。
人間向けの `ddd-domain-model.md` はこのデータから作り、Sources、Overview、
Bounded Context、Aggregate、Process Manager、Lineage、Derivation、Self-check、
Open questionsの各節を持たせる。再実行時は分割・統合・削除の系譜を更新する。

### Step 6: Self-check

Fill the completion table and keep it in the md under `## Self-check`:

| Condition | Where it is checked |
|---|---|
| (i) every Aggregate has invariants | yaml `invariants` |
| (ii) every Command declares a state effect or none | yaml `state_effect` / `transitions` |
| (iii) every Command has Domain Errors | yaml `domain_errors` |
| (iv) every referenced ID resolves | yaml reference attributes / `lineage` |
| (v) md and yaml agree | md headings, tables and statements |

### Step 7: Completion

単独実行では、完了報告前に `aidlc engine sensor fire ddd-model-completeness --stage ddd-domain-modeling --output-path <この試行のddd-domain-model-yaml.mdの実パス>` を実行する。
終了コードだけでなく最終JSONの `result: passed` を確認し、それ以外なら修正して再検査する。
標準AI-DLC 2.8.2の単独完了コマンド自体には一般成果物の検査がないため、この手順を省略しない。

Run the core completion flow: the advisory architecture review, the learnings
ritual, then the gate. Before the gate, `ddd-model-completeness` fires. On a
finding, fix the yaml or the md as the Sensors section says, then re-run the
self-check.

## Sensors

`ddd-model-completeness` (blocking) checks the model against the yaml and md:

- `model-completeness.schema` — the loader rejected the yaml; fix the yaml.
- `model-completeness.i` — an Aggregate has no invariant; fix the yaml
  `invariants` (merge or demote the candidate if it cannot own one).
- `model-completeness.ii` — a Command's `state_effect` and `transitions`
  disagree; fix the yaml.
- `model-completeness.iv` — a referenced ID does not resolve; fix the reference
  or the `lineage`.
- `model-completeness.f-missing` / `.f-unknown` / `.f-invariant` — the md
  disagrees with the yaml; fix the md headings, tables and statements.
- `model-completeness.f-absent` — write `ddd-domain-model.md`.

## Learn

Follow the core learnings ritual (§13).

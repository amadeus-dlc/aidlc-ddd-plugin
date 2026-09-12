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

Also establish the correspondence between business terms and code identifiers that will justify downstream package names. Record vocabulary for grouping by business concept, not by Aggregate, Entity, or value-object categories. Do not decide physical package or file placement here or add it to the canonical YAML; domain-design owns placement.

Create `domain-modeling-questions.md`. Cover bounded contexts, aggregate
candidates (merge / demote confirmation), invariants, commands and errors
(effect, state_effect, Domain Error, idempotency), states and transitions, ID
slugs when non-ASCII terms appear, and Process Managers when there are
candidates. Follow the core question flow and take the Consolidated Summary
Confirmation before writing the model.

### Step 5: Write the Canonical Model

Write canonical data in exactly one labelled YAML code block in `ddd-domain-model-yaml.md`. Explanatory text may surround it, but do not add a second YAML block. Use the U1 format with `schema_version: 1`, Bounded Contexts, aggregates, elements, invariants, commands, errors, events, transitions, construction rules, and lineage.
Derive the human-facing `ddd-domain-model.md` from these data, with Sources, Overview, Bounded Context, Aggregate, Process Manager, Lineage, Derivation, Self-check, and Open questions sections. Update split, merge, and deletion lineage on reruns.

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

For standalone execution, before reporting completion, run `aidlc engine sensor fire ddd-model-completeness --stage ddd-domain-modeling --output-path <actual-path-to-this-attempts-ddd-domain-model-yaml.md>`. Require `result: passed` in the final JSON, not merely a successful exit code; otherwise fix and rerun. Do not skip this step: the standard AI-DLC 2.8.2 standalone completion command does not check general artifacts.

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

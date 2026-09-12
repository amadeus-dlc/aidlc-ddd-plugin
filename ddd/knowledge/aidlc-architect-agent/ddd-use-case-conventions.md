# Use-case conventions

## Purpose

The five-point convention set and the orchestrator principle for use cases.
Read during functional-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.use-case-conventions.1 | PREFER letting the use case orchestrate and hand every business judgement to the domain. | use case | guidance-only | The placement of a decision is a design judgement; the code-level half of it is enforced by sensor (d), which is rule `.5` below. | DL §6 |
| K.use-case-conventions.2 | ALWAYS make a use case re-execution-safe by construction: every step declares its idempotency. | use case | sensor:mapping-declarations.j blocking | Retries are the norm, so safety cannot depend on the caller's discipline. | UC §5 |
| K.use-case-conventions.3 | ALWAYS declare the transactional consistency boundary of the use case. | use case | stage-contract:after-step:2 | An implicit boundary is a boundary nobody agreed to. | UC §3 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.use-case-conventions.4 | ALWAYS write the five-point set explicitly: consistency, idempotency, ordering, failure/compensation, observability. | use case | stage-contract:after-step:2 | Completeness of the declaration. | UC §2 |
| K.use-case-conventions.5 | NEVER let the use case make a business judgement; it orchestrates and delegates to the domain. | use case | sensor:d blocking | Tell, Don't Ask. | DL §6 |
| K.use-case-conventions.6 | ALWAYS state the transactional consistency boundary. | use case | stage-contract:after-step:2 | Avoids implicit transactions. | UC §3 |
| K.use-case-conventions.7 | ALWAYS make the flow re-execution-safe and declare each step's idempotency. | use case | sensor:mapping-declarations.j blocking | Retries are the norm. | UC §5 |
| K.use-case-conventions.8 | ALWAYS model a cross-aggregate flow as a Process Manager, especially under actor models. | process manager | sensor:mapping-declarations.process-manager-required blocking | Long-running coordination must not collapse aggregate boundaries. | UC §6 |
| K.use-case-conventions.9 | ALWAYS declare the six mandatory items per use case. | use case | sensor:mapping-declarations.use-case-item blocking | A reviewable contract. | FR4.1 |
| K.use-case-conventions.10 | PREFER applying CQS to state-changing operations only, not to immutable re-derivation. | use case | guidance-only | Query versus command is a judgement at the edge; no sensor reads it. | DL §6 |

## Rationale

A use case is the consistency boundary. Naming the idempotency strategy of each
step makes retries safe; a Process Manager carries multi-aggregate flows without
collapsing aggregate boundaries.

The core agrees on this layer's shape and is cited as support: a repository
exists per aggregate root and query logic belongs in a separate read model
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
Pattern), which is what keeps the use case orchestrating rather than querying.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.use-case-conventions.2 | tests/golden/design/cases.ts#clean-mapping | a use-case declaration whose steps each carry an idempotency strategy | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.use-case-conventions.5 | tests/golden/rust/cases.ts#clean-domain | a domain type whose getters are not called from outside the domain | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.use-case-conventions.7 | tests/golden/design/cases.ts#clean-mapping | a mapping document whose use-case declaration sensor `mapping-declarations.j` accepts | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.use-case-conventions.8 | tests/golden/design/cases.ts#clean-mapping | the same case: no cross-aggregate flow is left without a Process Manager | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.use-case-conventions.9 | tests/golden/design/cases.ts#clean-mapping | the same case: a use-case declaration that carries all six mandatory items | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |

The rows name the clean case of the sensor suite that runs each rule, not a case
built to exercise the rule's subject matter; the limitations are listed in this
unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/use-case-layer-design.md` §2–§8
- `construction/u1-sensor-foundation/functional-design/` — the
  `<kind>.<segments>` ID grammar and the completeness check that the
  declaration sensors build on (`functional-spec.md`, `entities.md`,
  `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
  Pattern (the core statements cited as support)

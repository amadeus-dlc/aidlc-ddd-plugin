# Aggregates, invariants and commands

## Purpose

How to derive aggregates from events and how to specify their invariants,
commands, events, errors and transitions. Read during domain-modeling and
domain-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.aggregate-and-invariants.1 | ALWAYS model an aggregate as a finite state machine whose commands move it between named states and never leave it invalid. | aggregate | sensor:model-completeness.ii blocking | Explicit states are what make the transition table checkable. | DL §9 |
| K.aggregate-and-invariants.2 | ALWAYS give every aggregate at least one invariant; a candidate that cannot own one is not an aggregate. | aggregate | sensor:model-completeness.i blocking | The invariant is what makes the boundary a boundary. | FR1.8 (i) |
| K.aggregate-and-invariants.3 | ALWAYS have every command declare its state effect and its failure conditions. | command | schema:Command.effect | Transitions become typed data rather than prose. | Q3 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.aggregate-and-invariants.4 | ALWAYS give an aggregate named states and named transitions. | aggregate | sensor:model-completeness.ii blocking | State is explicit, not implied by a field. | DL §9 |
| K.aggregate-and-invariants.5 | ALWAYS give every aggregate at least one invariant. | aggregate | sensor:model-completeness.i blocking | The boundary is the invariant. | FR1.8 (i) |
| K.aggregate-and-invariants.6 | ALWAYS declare `effect` and `state_effect` on every command. | command | schema:Command.effect | Transitions are typed. | Q3 |
| K.aggregate-and-invariants.7 | ALWAYS give every command at least one Domain Error. | command | schema:command-no-error | Failures are part of the contract. | FR2.2 |
| K.aggregate-and-invariants.8 | NEVER reference another aggregate by object; reference it by ID only. | aggregate | sensor:b blocking | No cross-aggregate object graph. | DL §3 |
| K.aggregate-and-invariants.9 | PREFER a domain service only when no aggregate owns the behaviour. | domain service | guidance-only | Prefer the model; the placement is a design judgement. | DL §6 |
| K.aggregate-and-invariants.10 | PREFER deriving aggregates bottom-up from past-tense domain events and their invariants. | model | guidance-only | Derivation is a workshop procedure and has no mechanical check. The *result* of the derivation is enforced — sensor `model-completeness.i` requires every aggregate to carry an invariant and `.ii` requires named states — but the *order* in which the candidate is found is not. This is the rule that overrides the core's "start with larger aggregates" heuristic (see C-2 in `ddd-always-valid-model.md`). | DL §2 |
| K.aggregate-and-invariants.11 | ALWAYS record ID lineage for rename, split, merge and removal. | model | schema:lineage | IDs are permanent references across model evolution. | FR2.4 |

## Rationale

The workflow discovers events, groups the events that change the same state into
candidates, and confirms each candidate's invariant and bounded context. The ID
lineage keeps downstream references stable across model evolution.

The core agrees with the invariant-carrying aggregate and with ID-only
references between aggregates, and is cited here as support: "Reference other
aggregates by ID, not by object reference", "Keep aggregates small", and
"Transactions should not span multiple aggregates"
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Aggregates). The one
place where the core disagrees — the "start with larger aggregates" heuristic —
is recorded as C-2 in `ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.aggregate-and-invariants.1 | tests/golden/design/cases.ts#clean-complete | a canonical model whose aggregate declares states and transitions | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.aggregate-and-invariants.2 | tests/golden/design/cases.ts#clean-complete | the same case: sensor `model-completeness.i` reports no aggregate without an invariant | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.aggregate-and-invariants.4 | tests/golden/design/cases.ts#clean-complete | a canonical model whose aggregate carries named states and named transitions | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.aggregate-and-invariants.5 | tests/golden/design/cases.ts#clean-complete | the same case: sensor `model-completeness.i` reports no aggregate without an invariant | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.aggregate-and-invariants.8 | tests/golden/rust/cases.ts#clean-domain | a domain type that holds no aggregate-valued field and no undeclared mutation | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

Sensor `model-completeness.i` reads the canonical model, so the index points at
the design suite; sensor (b) reads Rust source, so the index for
`K.aggregate-and-invariants.8` points at the rust suite. The rows name the clean
case of the suite that runs each sensor, not a case built to exercise the rule's
subject matter; the limitations are listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/domain-layer-design.md` §2–§5
- `construction/u1-sensor-foundation/functional-design/` — the canonical model
  schema and the mechanical completeness conditions (i) and (ii), the ID
  lineage record, and the `<kind>.<segments>` grammar (`functional-spec.md`,
  `entities.md`, `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Aggregates,
  Design Heuristics (the core statements cited as support, and the heuristic
  recorded as conflict C-2 in `ddd-always-valid-model.md`)

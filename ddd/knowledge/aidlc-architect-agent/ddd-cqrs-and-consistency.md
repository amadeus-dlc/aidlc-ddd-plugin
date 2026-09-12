# CQRS and consistency

## Purpose

The CQRS layer structure, the two declaration axes, and why the command side
never reads the read model. Read during domain-design, functional-design and
infrastructure-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.cqrs-and-consistency.1 | NEVER let the command side and the query side depend on each other. | crate graph | sensor:k blocking | A dependency in either direction destroys the independence of the two models. | IA §3 |
| K.cqrs-and-consistency.2 | ALWAYS declare every mapped aggregate on both axes: programming model × persistence method. | aggregate mapping | sensor:mapping-declarations.axes blocking | The two axes are what make the downstream code shape predictable. | FR3.3 |
| K.cqrs-and-consistency.3 | PREFER shaping the query side's model for queries rather than reusing the domain model. | query side | guidance-only | The read-model shape is a design judgement; the mechanical half of the separation is enforced by rule `.7` below. | IA §4 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.cqrs-and-consistency.4 | ALWAYS declare `programming_model` (actor / class) per aggregate. | aggregate mapping | sensor:mapping-declarations.axes blocking | Drives the concurrency model. | FR3.3 |
| K.cqrs-and-consistency.5 | ALWAYS declare `persistence_method` (state-sourcing / event-sourcing) per aggregate. | aggregate mapping | sensor:mapping-declarations.axes blocking | Drives the code shape, including the command return value and the restoration path. | FR3.3 |
| K.cqrs-and-consistency.6 | NEVER let the command side read the read model. | crate graph | sensor:k blocking | Keeps write logic pure. | IA §3 |
| K.cqrs-and-consistency.7 | NEVER let the query side reference a domain type or a repository port. | query crate | sensor:l blocking | Query models are separate. | IA §4 |
| K.cqrs-and-consistency.8 | PREFER an RMU to bridge the command side to the query side. | crate graph | guidance-only | Read-model upkeep is a design choice; an RMU is the shape that keeps both sides independent. | IA §4 |
| K.cqrs-and-consistency.9 | PREFER choosing strong or weak consistency explicitly. | use case | guidance-only | Consistency is a decision, not a default, but no sensor reads the choice. | UC §6 |

## Rationale

CQRS makes the write model and the read model independently shaped. The two axes
capture the two independent choices that change everything downstream: whether
the aggregate is an actor or a class, and whether it is stored as state or as
events.

The core agrees and is cited as support: "Do not put query logic in repositories
— use separate read models for complex queries" and "One repository per
aggregate root (not per entity or table)"
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
Pattern). The one place where the core disagrees — the free choice of a
persistence style and a free command/event correspondence — is recorded as C-4
in `ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.cqrs-and-consistency.1 | tests/golden/design/cases.ts#clean | a declared layer structure with `cqrs: true` and no dependency between the two sides | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.2 | tests/golden/design/cases.ts#clean-mapping | an aggregate mapping that declares both axes for every aggregate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.4 | tests/golden/design/cases.ts#clean-mapping | an aggregate mapping that declares both axes for every aggregate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.5 | tests/golden/design/cases.ts#clean-mapping | the same case: `persistence_method` is declared per aggregate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.6 | tests/golden/design/cases.ts#clean | a declared layer structure with a command-side crate and a query-side crate, and no dependency between them | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.cqrs-and-consistency.7 | tests/golden/design/cases.ts#clean | the same case: the query-side crate's declared dependencies are empty, so no domain-layer crate or repository port appears | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |

Rules `.6` and `.7` are checked twice: sensor (k) and sensor (l) run against the
declared crate graph in `ddd-layer-structure` and against Rust source in
`ddd-rust-interface-adapter`. The rows above index the design suite, whose clean
case does declare a command side and a query side; the rust suite's clean case
contains no such crate pair, and that limitation is listed in this unit's
`code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/interface-adapter-layer-design.md` §2–§4
- `ddd/docs/use-case-layer-design.md` §6
- `ddd/docs/domain-layer-design.md` §7-2
- `construction/u2-rust-analysis-foundation/functional-design/` — layer
  assignment from the crate graph and the allowed-dependency table that sensors
  (k) and (l) consult (`functional-spec.md`, `rules.md`). Record-relative path
  under `aidlc/spaces/default/intents/<intent>/`.
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
  Pattern (the core statements cited as support)

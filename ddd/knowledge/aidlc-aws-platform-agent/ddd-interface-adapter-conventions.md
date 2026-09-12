# Interface-adapter conventions

## Purpose

Port responsibility classification, repository naming and scope, verbs, the
medium-name ban, starting in memory, the query side as DAO + DTO, persistence
backend selection, RMU design, upstream contracts, and the
`ddd-layer-structure` declaration. Read during infrastructure-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.interface-adapter-conventions.1 | NEVER name a port after a technology; a port describes a responsibility. | port | sensor:layer-structure.m-media blocking | A port whose name carries a medium cannot be implemented in memory, and cannot be swapped. | IA §5 |
| K.interface-adapter-conventions.2 | ALWAYS name a repository after its aggregate, never after its storage. | repository | sensor:layer-structure.m-name blocking | The aggregate names the boundary the repository serves. | IA §5 |
| K.interface-adapter-conventions.3 | PREFER starting in memory and adding a backend only when the design needs it. | adapter | guidance-only | Tests run without infrastructure; whether a given port needs a real backend is a design judgement. | IA §5 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.interface-adapter-conventions.4 | ALWAYS classify every port as repository, external-client or es-infrastructure. | port | sensor:layer-structure.item blocking | The responsibility of a port is explicit, not inferred from its name. | FR5.2 |
| K.interface-adapter-conventions.5 | ALWAYS name a repository `<Aggregate>Repository` and keep every storage medium out of the port name. | repository | sensor:layer-structure.m-name / .m-media blocking | Technology-agnostic naming. | IA §5 |
| K.interface-adapter-conventions.6 | PREFER the repository verbs `find_by_id`, `store` and `delete_by_id`, and put conditional search on the query side. | repository | guidance-only | A small stable surface; no sensor reads the verb list. This is the rule that overrides the core's `save` / `findByCustomer` example (see C-1 in `ddd-always-valid-model.md`). | FR5.2 |
| K.interface-adapter-conventions.7 | PREFER starting with an in-memory implementation. | adapter | guidance-only | Tests run without infrastructure. | IA §5 |
| K.interface-adapter-conventions.8 | NEVER let the query side be a domain object; it is a DAO plus a DTO. | query adapter | sensor:l blocking | Separate read model. | IA §4 |
| K.interface-adapter-conventions.9 | NEVER place RPC or database clients in the infrastructure layer; it holds language extensions only. | infrastructure crate | sensor:g blocking | Keeps the dependency direction inward. | IA §3 |
| K.interface-adapter-conventions.10 | PREFER a conformist or an anti-corruption layer for an external system. | adapter | guidance-only | Bounds the foreign model; which of the two fits is a design judgement. | IA §8 |
| K.interface-adapter-conventions.11 | ALWAYS declare the layer structure with the ADR-009 mandatory items. | layer structure | sensor:layer-structure.item blocking | A machine-checkable design. | U4 |

## Rationale

Ports are where the design meets the outside world. Keeping them named by
responsibility — and free of medium words — keeps the design technology-neutral;
the implementation is where `InMemoryInvoiceRepository` and friends appear.

The core agrees with the repository-scope part of this file: "One repository per
aggregate root (not per entity or table)" and "Do not put query logic in
repositories — use separate read models for complex queries"
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
Pattern). The place where the core disagrees — its `save` /
`findByCustomer(customerId)` example — is recorded as C-1 in
`ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.interface-adapter-conventions.1 | tests/golden/design/cases.ts#clean | a declared layer structure whose port names carry no storage medium | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.2 | tests/golden/design/cases.ts#clean | the same case: a repository named `InvoiceRepository` after its aggregate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.4 | tests/golden/design/cases.ts#clean | the same case: every port declares a kind | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.5 | tests/golden/design/cases.ts#clean | the same case: sensors `.m-name` and `.m-media` report no repository name | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.8 | tests/golden/design/cases.ts#clean | the same case: the query-side crate declares no dependency on a domain-layer crate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.interface-adapter-conventions.9 | tests/golden/rust/cases.ts#clean-domain | a domain crate whose only external edge is nowhere, so sensor (g) reports no forbidden direction | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.interface-adapter-conventions.11 | tests/golden/design/cases.ts#clean | the same case: a `ddd-layer-structure` declaration carrying all ADR-009 mandatory items | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |

The design rows all name the single clean case of the `ddd-layer-structure`
suite, because that declaration is the only artifact the `.item` / `.m-name` /
`.m-media` and (l) checks run against. Sensor (g) reads Rust source, so rule `.9`
points at the rust suite instead. The rows name the case the sensor accepted,
not a case built to exercise the rule's subject matter; the limitations are
listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/interface-adapter-layer-design.md` §5–§9
- `construction/u4-design-sensors/functional-design/` — the
  `ddd-layer-structure` declaration schema, its ADR-009 mandatory items, and
  the sensor rule ids `.item` / `.m-name` / `.m-media` / `.n`
  (`functional-spec.md` §WF6, `entities.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `construction/u2-rust-analysis-foundation/functional-design/` — the layer
  assigned from the crate graph and the allowed-dependency table that sensor (g)
  and sensor (l) consult (`functional-spec.md` §WF2, §WF5)
- `inception/domain-design/decisions.md` ADR-009 — the split between the
  declaration-side and code-side checks of (k)(l)(m)(n)
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
  Pattern (the core statements cited as support, and the example recorded as
  conflict C-1 in `ddd-always-valid-model.md`)

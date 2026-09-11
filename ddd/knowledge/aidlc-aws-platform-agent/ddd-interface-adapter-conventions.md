# Interface-adapter conventions

## Purpose

Port responsibility classification, repository naming and scope, verbs, the
medium-name ban, starting in memory, the query side as DAO + DTO, persistence
backend selection, RMU design, upstream contracts, and the
`ddd-layer-structure` declaration. Read during infrastructure-design.

## Principles

- A port describes a responsibility, not a technology.
- Name a repository after its aggregate, never after its storage.
- Start in memory; add a backend only when the design needs it.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| IAC-1 | classify every port as repository / external-client / es-infrastructure | port | sensor:layer-structure.item blocking | explicit responsibility | FR5.2 |
| IAC-2 | name a repository `<Aggregate>Repository`; no storage medium in the port name | repository | sensor:layer-structure.m-name / .m-media blocking | technology-agnostic naming | IA §5 |
| IAC-3 | repository verbs are `find_by_id` / `store` / `delete_by_id` | repository | guidance-only | a small stable surface | FR5.2 |
| IAC-4 | start with an in-memory implementation | adapter | guidance-only | tests run without infrastructure | IA §5 |
| IAC-5 | the query side is a DAO plus a DTO, not a domain object | query adapter | sensor:l blocking | separate read model | IA §4 |
| IAC-6 | the infrastructure layer holds language extensions only | infrastructure crate | sensor:g blocking | no RPC or DB clients there | IA §3 |
| IAC-7 | an external system uses a conformist or an anti-corruption layer | adapter | guidance-only | bound the foreign model | IA §8 |
| IAC-8 | declare the layer structure with the ADR-009 mandatory items | layer structure | sensor:layer-structure.item blocking | machine-checkable design | U4 |

## Rationale

Ports are where the design meets the outside world. Keeping them named by
responsibility — and free of medium words — keeps the design technology-neutral;
the implementation is where `InMemoryInvoiceRepository` and friends appear.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| IAC-2 | tests/golden/rust/.../clean-repository | a `InvoiceRepository` trait and an in-memory implementation | rust fixture |
| IAC-8 | tests/golden/design/.../clean | a complete layer structure | design fixture |

## Retired rules

None.

## Sources

- ddd/docs/interface-adapter-layer-design.md §5–§9

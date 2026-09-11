# Use-case conventions

## Purpose

The five-point convention set and the orchestrator principle for use cases.
Read during functional-design.

## Principles

- The use case orchestrates; it does not do domain work.
- A use case is idempotent and re-execution-safe by construction.
- Declare the transactional consistency boundary explicitly.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| UC-1 | the five-point set is explicit: consistency, idempotency, ordering, failure/compensation, observability | use case | stage-contract:after-step:2 | completeness | UC §2 |
| UC-2 | the use case orchestrates and delegates business judgement to the domain | use case | sensor:d blocking | Tell, Don't Ask | DL §6 |
| UC-3 | state the transactional consistency boundary | use case | stage-contract:after-step:2 | avoid implicit transactions | UC §3 |
| UC-4 | make the flow re-execution-safe and declare each step's idempotency | use case | sensor:mapping-declarations.j blocking | retries are the norm | UC §5 |
| UC-5 | model a cross-aggregate flow as a Process Manager, especially under actor models | process manager | sensor:mapping-declarations.process-manager-required blocking | long-running coordination | UC §6 |
| UC-6 | declare the six mandatory items per use case | use case | sensor:mapping-declarations.use-case-item blocking | reviewable contract | FR4.1 |
| UC-7 | CQS applies to state-changing operations, not to immutable re-derivation | use case | guidance-only | query vs command | DL §6 |

## Rationale

A use case is the consistency boundary. Naming the idempotency strategy of each
step makes retries safe; a Process Manager carries multi-aggregate flows without
collapsing aggregate boundaries.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| UC-6 | tests/golden/design/.../clean-mapping | a complete use-case declaration | design fixture |

## Retired rules

None.

## Sources

- ddd/docs/use-case-layer-design.md §2–§8

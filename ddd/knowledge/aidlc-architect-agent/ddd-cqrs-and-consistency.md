# CQRS and consistency

## Purpose

The CQRS layer structure, the two declaration axes, and why the command side
never reads the read model. Read during domain-design, functional-design and
infrastructure-design.

## Principles

- Separate the command side from the query side; do not let one depend on the
  other.
- Declare every aggregate on two axes: programming model × persistence method.
- The command side writes; the query side reads a model shaped for queries.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| CQ-1 | declare `programming_model` (actor / class) per aggregate | aggregate mapping | sensor:mapping-declarations.axes blocking | drives the concurrency model | FR3.3 |
| CQ-2 | declare `persistence_method` (state-sourcing / event-sourcing) per aggregate | aggregate mapping | sensor:mapping-declarations.axes blocking | drives the code shape | FR3.3 |
| CQ-3 | the command side never reads the read model | crate graph | sensor:k blocking | keeps write logic pure | IA §3 |
| CQ-4 | the query side never references a domain type or repository port | query crate | sensor:l blocking | query models are separate | IA §4 |
| CQ-5 | an RMU bridges the command side to the query side | crate graph | guidance-only | read-model upkeep | IA §4 |
| CQ-6 | choose strong or weak consistency explicitly | use case | guidance-only | consistency is a decision | UC §6 |

## Rationale

CQRS makes the write model and the read model independently shaped. The two axes
capture the two independent choices that change everything downstream: whether
the aggregate is an actor or a class, and whether it is stored as state or as
events.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| CQ-1 | tests/golden/design/.../clean-mapping | both axes declared | design fixture |
| CQ-3 | tests/golden/rust/.../violation-k | a cross-side reference | rust fixture |

## Retired rules

None.

## Sources

- ddd/docs/interface-adapter-layer-design.md §2–§4
- ddd/docs/use-case-layer-design.md §6
- ddd/docs/domain-layer-design.md §7-2

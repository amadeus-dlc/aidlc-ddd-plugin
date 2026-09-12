# Always Valid Domain Model

Updated: 2026-09-13. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.always-valid-model.1 | Satisfy invariants at construction and never expose invalid state. | Review and behavior tests. c/n cover only some construction shapes. |
| K.always-valid-model.2 | Define business operations before choosing representations. | Design convention. |
| K.always-valid-model.3 | Distinguish the roles of Entities, value objects, collections, and events. | Design convention. |
| K.always-valid-model.4 | Use ubiquitous language and explain the meaning of aggregate IDs. | Design convention. The loader checks only ID grammar. |
| K.always-valid-model.5 | Validate invariants in a full constructor. | Review and behavior tests. Complete semantic checking of preconditions is not implemented. |
| K.always-valid-model.6 | Wrap primitives that have business meaning in dedicated types. | Design convention. |
| K.always-valid-model.7 | Reference other aggregates by ID instead of embedding their objects. | Review. |
| K.always-valid-model.8 | Consider a Domain Service when a business operation cannot belong to an aggregate. | Design convention. |
| K.always-valid-model.9 | Use the `<kind>.<segments>` grammar for stable IDs. | Loader ID grammar checks. |

## Rationale

Distinguish invariant declarations, construction-shape checks, and behavioral guarantees. Current sensors do not prove that every invariant is implemented. If model-to-code correspondence is unclear, send it to review rather than marking it checked.

## Examples

The [design cases](../../tests/golden/design/cases.ts) and [Rust cases](../../tests/golden/rust/cases.ts) contain real sensor inputs in the development repository. Find them by case name. These are test inputs, not complete business applications. A passing case without the relevant structure does not prove that structure is valid.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Sources

- [Current design](../../docs/domain-layer-design.md)
- [Measurements and known issues](../../docs/current-state-assessment.md)
- [Remaining work](../../docs/completion-tasks.md)

## Resolving policy conflicts

Do not automatically override explicit project policy with plugin conventions. Record the conflict, its scope, and the reason for the resolution.

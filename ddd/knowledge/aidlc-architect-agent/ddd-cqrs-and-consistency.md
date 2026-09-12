# CQRS and consistency

Updated: 2026-09-13. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.cqrs-and-consistency.1 | Do not allow mutual dependencies between CQRS command and query sides. | Declaration and Rust rule k. Approval integration and coverage have limits. |
| K.cqrs-and-consistency.2 | Declare a programming model and persistence method for every aggregate. | mapping-declarations.axes |
| K.cqrs-and-consistency.3 | Provide read models suited to their queries. | Design convention. |
| K.cqrs-and-consistency.4 | Declare programming_model as actor or class. | mapping-declarations.axes |
| K.cqrs-and-consistency.5 | Declare persistence_method as state-sourcing or event-sourcing. | mapping-declarations.axes. This does not guarantee code shape. |
| K.cqrs-and-consistency.6 | Do not consult query-side read models to make update decisions. | k checks dependencies. Review assesses actual consistency. |
| K.cqrs-and-consistency.7 | Do not reference update-domain types or repositories from the query side. | l checks syntax and declarations. |
| K.cqrs-and-consistency.8 | Make the RMU an independent component connecting the two sides. | Design convention. Edges originating from the RMU are exceptions. |
| K.cqrs-and-consistency.9 | State persistence consistency and read-side propagation delay explicitly. | Review and behavior tests. |

## Rationale

An asynchronous read model may not yet reflect the latest change; it is not necessarily always stale. Persistence and actor adoption are separate axes. State sourcing can also use domain events.

## Examples

The [design cases](../../tests/golden/design/cases.ts) and [Rust cases](../../tests/golden/rust/cases.ts) contain real sensor inputs in the development repository. Find them by case name. These are test inputs, not complete business applications. A passing case without the relevant structure does not prove that structure is valid.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Retired rules

No rule IDs have been retired. Overstated coverage and incorrect technical assumptions were corrected on 2026-09-13. Conventions without automated checks may remain review obligations.

## Sources

- [Current design](../../docs/interface-adapter-layer-design.md)
- [Measurements and known issues](../../docs/current-state-assessment.md)
- [Remaining work](../../docs/completion-tasks.md)

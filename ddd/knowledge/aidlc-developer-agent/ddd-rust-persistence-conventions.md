# Rust persistence conventions

Updated: 2026-09-13. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.rust-persistence-conventions.1 | Prefer static dispatch; choose dynamic dispatch where needed. | Design convention. |
| K.rust-persistence-conventions.2 | Separate business decisions from event application in event sourcing. | Review. |
| K.rust-persistence-conventions.3 | Design repeated store or append operations so the same request is not applied twice. | Review and tests. Storage declaration advisories cover only part of this. |
| K.rust-persistence-conventions.4 | Use port traits and inject concrete implementations through wiring. | Design convention. |
| K.rust-persistence-conventions.5 | Separate decide and apply; make no new business decisions during replay. | Review and behavior tests. c does not verify this separation. |
| K.rust-persistence-conventions.6 | Consider apply, apply_event, replay, and on_event as event-application method names. | Declare method and event ID in replay_methods; check persistence mode and type correspondence. |
| K.rust-persistence-conventions.7 | Place ports according to their inner-layer consumers; Interface Adapter implementation names may identify the medium. | m covers part of naming. Review overall placement. |
| K.rust-persistence-conventions.8 | Safely re-persist state; append to immutable history for event persistence. | Review. Current upsert advisories do not adequately distinguish persistence modes. |
| K.rust-persistence-conventions.9 | Distinguish first success, duplicate success, and rejection. | Design convention. Concrete return types remain T-03 work. |
| K.rust-persistence-conventions.10 | Validate invariants when restoring from DTOs and distinguish restoration from replay. | n checks construction-call shapes. Review and test all invariants. |

## Rationale

State-storage upsert does not mean unconditional overwrite. Never rewrite existing event history. Duplicate success creates no new events; the baseline for an initial state-changing success is one event. If the persistence outcome is unknown, reconcile it using request IDs or equivalent evidence. Do not publish working state as committed before persistence succeeds.

## Examples

The [design cases](../../tests/golden/design/cases.ts) and [Rust cases](../../tests/golden/rust/cases.ts) contain real sensor inputs in the development repository. Find them by case name. These are test inputs, not complete business applications. A passing case without the relevant structure does not prove that structure is valid.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Sources

- [Current design](../../docs/developers/use-case-layer-design.md)
- [Measurements and known issues](../../docs/developers/current-state-assessment.md)
- [Remaining work](../../docs/developers/completion-tasks.md)

## T-02 evaluation contract

Rules b/d/h/i match crates, modules, and explicit type declarations. Do not confuse value objects or ports with aggregates or concrete use cases. Replay is allowed only when the aggregate mapping's replay_methods, event-sourcing mode, owning aggregate, and single event parameter type agree.

Type inference, associated types, and trait implementation selection are outside coverage. Direct sensor JSON includes notes for unexamined code. The standard dispatcher may omit notes on success; record them in code-summary for review. See the [detailed contract](../../docs/users/rust-sensor-contract.md).

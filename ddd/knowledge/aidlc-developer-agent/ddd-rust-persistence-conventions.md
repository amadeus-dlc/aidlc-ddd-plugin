# Rust persistence conventions

Updated: 2026-09-28. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.rust-persistence-conventions.1 | Prefer static dispatch; choose dynamic dispatch where needed. | Design convention. |
| K.rust-persistence-conventions.2 | In event sourcing, a command is one `&mut self` method that makes the business decision, changes the state and returns its one event; do not split it into a `&self` decide method and a separate apply. A replay method, which applies a persisted event to rebuild the aggregate, makes no business decision. | b reports a declared command that does not take `&mut self`; review the rest. |
| K.rust-persistence-conventions.3 | Design repeated store or append operations so the same request is not applied twice. Store the one event of a command with the aggregate, checking the expected version and appending that event. | Review and behavior tests. Storage declaration advisories cover only part of this. |
| K.rust-persistence-conventions.4 | Use port traits and inject concrete implementations through wiring. | Design convention. |
| K.rust-persistence-conventions.5 | A command decides, changes state and returns its event in one `&mut self` method; a replay method only applies a persisted event to the state and makes no business decision. | Review and behavior tests. c does not verify replay bodies. |
| K.rust-persistence-conventions.6 | Consider apply, apply_event, replay, and on_event as event-application method names. | Declare the event ID under `event_ref` and the method under `code.method` in replay_methods; check persistence mode and type correspondence. |
| K.rust-persistence-conventions.7 | Place ports according to their inner-layer consumers; Interface Adapter implementation names may identify the medium. | m covers part of naming. Review overall placement. |
| K.rust-persistence-conventions.8 | Safely re-persist state; append to immutable history for event persistence. A `state-sourcing` aggregate is stored as an `upsert` with its expected version; an `event-sourcing` aggregate as `insert-only`. | design-advisories.store-upsert judges `store_semantics` against the `persistence_method` of the aggregate mapping, and reports that it cannot judge when the mapping does not give it. Review the implementation. |
| K.rust-persistence-conventions.9 | Distinguish first success, duplicate success, and rejection. Under `event-sourcing` a command returns `Result<E, <its error type>>` with its one event after the state changed; a `command-id-memory` command returns `Result<CommandOutcome<E>, <its error type>>`: `CommandOutcome::Applied(event)` with the one declared event after the state changed, or `CommandOutcome::AlreadyApplied` with no event and no change. Under `state-sourcing` a command returns `Result<(), <its error type>>`. A rejection is the command's own error and changes nothing. The use case stores only a change, handing its one event to the repository with the aggregate. | Review and behavior tests. No sensor decides the return shape: the Rust facts resolve no alias and record no returned variant. |
| K.rust-persistence-conventions.10 | Validate invariants when restoring from DTOs and distinguish restoration from replay. | n checks construction-call shapes. Review and test all invariants. |

## Rationale

State-storage upsert does not mean unconditional overwrite. Never rewrite existing event history. Duplicate success creates no new events; an initial state-changing success raises the one event the model declares for the command. If the persistence outcome is unknown, reconcile it using request IDs or equivalent evidence. Do not publish working state as committed before persistence succeeds.

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

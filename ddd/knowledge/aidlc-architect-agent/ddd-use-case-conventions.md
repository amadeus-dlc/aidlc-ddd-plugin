# Use-case conventions

Updated: 2026-09-28. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.use-case-conventions.1 | Delegate business decisions to the domain and coordinate retrieval, persistence, and recovery. | Review. |
| K.use-case-conventions.2 | Explain why each step is safe to re-execute. | Declaration presence is checked; safety requires review and tests. |
| K.use-case-conventions.3 | Distinguish per-aggregate persistence from partial failure of a multi-aggregate flow. | Design convention. |
| K.use-case-conventions.4 | Declare consistency, idempotency, ordering, failure and compensation, and observability. | Design procedure and review. |
| K.use-case-conventions.5 | Do not extract values through getters to make business decisions. Forwarding getter results as repository arguments without business branching or calculation is allowed. | d permits proven unchanged forwarding to repository ports. Review assesses the placement of business decisions. |
| K.use-case-conventions.6 | Do not implicitly promise automatic rollback of an entire flow. | Design convention. |
| K.use-case-conventions.7 | Define retry identification, retention periods, and recovery from unknown persistence outcomes. The resend period is the model's `idempotency.retention` (`last-one`, `multiple` with `retention_count`, or `time-window` with `retention_window`); the use-case declaration adds no item for it and `re_execution_basis` refers to it. For a `strategy: none` command, `re_execution_basis` states whether a repeat is refused with the command's own error or is a no-op of the state transition. | j checks only the strategy of additive commands; the model loader requires the retention of every `command-id-memory` command. Safety requires review. |
| K.use-case-conventions.8 | Represent multi-aggregate recovery with a Process Manager or an explicit re-execution strategy. A use case over any actor-modelled aggregate uses a Process Manager; one over class-modelled aggregates alone may use either. | process-manager-required applies when any target is actor-modelled in the mapping. execution-model-undetermined blocks a multi-aggregate re-execution when the mapping is absent or does not map a target; a single-aggregate use case and a Process Manager are not affected. |
| K.use-case-conventions.9 | Declare the six use-case items, identifier, and name. | mapping-declarations.use-case-item and related checks. Connected to normal approval; standalone completion has limits. |
| K.use-case-conventions.10 | Distinguish CQS from a contract returning update results, new state, or events. A command produces at most one event. Under `event-sourcing` a command that changes state returns its one event; a `command-id-memory` command answers either applied, with that event, or already applied, with no event and no change; a refusal is the command's own error and changes nothing. The new state is held by the aggregate in Rust, whose command changes it through `&mut self`, and is the new instance the command returns in TypeScript, whose domain methods change nothing. The use case stores that state and the one event in one store that checks the expected version, and stores nothing when already applied. | Review and behavior tests. No sensor decides the result shape. |

## Rationale

A single aggregate is the basic strong-consistency boundary. If B fails after A is persisted, A's commit may remain. Compensation is a new operation, not a database rollback. Upsert alone does not guarantee safe re-execution. Retaining only the most recent ID is insufficient if C1 → C2 → retry C1 is allowed. Sagas can also use classes. A flow that mixes actor- and class-modelled aggregates needs a Process Manager, because one actor target is enough to require it.

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

## Getter results as repository arguments

Use-case code may pass a getter result unchanged to a repository port method, directly or through immutable local bindings. Parentheses and shared borrowing are allowed. Every use of a local value must reach a repository argument; comparison, arithmetic, transformation calls, mutable bindings, macros, and other consumers do not qualify. This does not authorize getter calls from the domain layer.

The Rust check resolves the receiving type to an inner-layer trait named `<Aggregate>Repository` and verifies that the called method is declared on that trait. A variable named `repo` or a method named `save` is insufficient. Explicit parameter/field types, `impl`/`dyn` ports, and module-level import/type aliases are supported. Generic-bound resolution, trait implementation selection, associated-function syntax, and type inference remain outside this exception's coverage. Unknown recipients do not gain an exemption; the getter finding remains blocking and unresolved receiver information appears in the sensor note.

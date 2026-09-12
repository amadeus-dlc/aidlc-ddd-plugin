# Use-case conventions

Updated: 2026-09-13. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.use-case-conventions.1 | Delegate business decisions to the domain and coordinate retrieval, persistence, and recovery. | Review. |
| K.use-case-conventions.2 | Explain why each step is safe to re-execute. | Declaration presence is checked; safety requires review and tests. |
| K.use-case-conventions.3 | Distinguish per-aggregate persistence from partial failure of a multi-aggregate flow. | Design convention. |
| K.use-case-conventions.4 | Declare consistency, idempotency, ordering, failure and compensation, and observability. | Design procedure and review. |
| K.use-case-conventions.5 | Do not extract values through getters to make business decisions. | d checks getter calls. Review assesses the placement of business decisions. |
| K.use-case-conventions.6 | Do not implicitly promise automatic rollback of an entire flow. | Design convention. |
| K.use-case-conventions.7 | Define retry identification, retention periods, and recovery from unknown persistence outcomes. | j checks only the strategy of additive commands. Safety requires review. |
| K.use-case-conventions.8 | Represent multi-aggregate recovery with a Process Manager or an explicit re-execution strategy. | process-manager-required applies when every target is actor-based and its mapping is readable. |
| K.use-case-conventions.9 | Declare the six use-case items, identifier, and name. | mapping-declarations.use-case-item and related checks. Connected to normal approval; standalone completion has limits. |
| K.use-case-conventions.10 | Distinguish CQS from a contract returning update results, new state, or events. | Design convention. |

## Rationale

A single aggregate is the basic strong-consistency boundary. If B fails after A is persisted, A's commit may remain. Compensation is a new operation, not a database rollback. Upsert alone does not guarantee safe re-execution. Retaining only the most recent ID is insufficient if C1 → C2 → retry C1 is allowed. Sagas can also use classes; declarations for mixed flows remain T-03 work.

## Examples

The [design cases](../../tests/golden/design/cases.ts) and [Rust cases](../../tests/golden/rust/cases.ts) contain real sensor inputs in the development repository. Find them by case name. These are test inputs, not complete business applications. A passing case without the relevant structure does not prove that structure is valid.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Sources

- [Current design](../../docs/use-case-layer-design.md)
- [Measurements and known issues](../../docs/current-state-assessment.md)
- [Remaining work](../../docs/completion-tasks.md)

## T-02 evaluation contract

Rules b/d/h/i match crates, modules, and explicit type declarations. Do not confuse value objects or ports with aggregates or concrete use cases. Replay is allowed only when the aggregate mapping's replay_methods, event-sourcing mode, owning aggregate, and single event parameter type agree.

Type inference, associated types, and trait implementation selection are outside coverage. Direct sensor JSON includes notes for unexamined code. The standard dispatcher may omit notes on success; record them in code-summary for review. See the [detailed contract](../../docs/rust-sensor-contract.md).

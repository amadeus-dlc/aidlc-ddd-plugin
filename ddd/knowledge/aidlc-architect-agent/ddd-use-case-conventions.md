# Use-case conventions

Updated: 2026-09-30. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

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
| K.use-case-conventions.7 | Define retry identification by command ID, retention periods, and recovery from unknown persistence outcomes. | j checks only the strategy of additive commands; last-one checks that keeping only the last command ID states its rationale. Safety requires review. |
| K.use-case-conventions.8 | Represent multi-aggregate recovery with a Process Manager or an explicit re-execution strategy. | process-manager-required applies when every target is actor-based and its mapping is readable. |
| K.use-case-conventions.9 | Declare the six use-case items, identifier, and name. | mapping-declarations.use-case-item and related checks. Connected to normal approval; standalone completion has limits. |
| K.use-case-conventions.10 | Distinguish CQS from a contract returning update results, new state, or events. | Design convention. |
| K.use-case-conventions.11 | Name a field or parameter that holds a port after the port (`invoice_repository`, `#invoiceRepository` for `InvoiceRepository`), not after a plural of the aggregate such as `invoices`. | Review. |

## Rationale

A single aggregate is the basic strong-consistency boundary. If B fails after A is persisted, A's commit may remain. Compensation is a new operation, not a database rollback. Upsert alone does not guarantee safe re-execution. Keeping only the last command ID (`retention: last-one`) is sufficient only when an older command is never resent after a newer one, and the declaration's rationale states why; when `C1 → C2 → retry C1` can occur, keep several IDs or a time window. Sagas can also use classes; declarations for mixed flows remain T-03 work.

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

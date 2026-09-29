# DDD plugin use-case-layer design

English | [Japanese](use-case-layer-design.ja.md)

Updated: 2026-09-28. Uses the failure and persistence contracts in [domain-layer design §7](domain-layer-design.md). These are design conventions, not claims of complete sensor enforcement.

## 1. Delivery form

Extend functional-design through a contribution with declarations, knowledge, and sensors. Embed declarations in a required section of the registered functional-spec review artifact. See the [artifact contract](../users/artifact-contract.md).

## 2. Responsibilities

A use case coordinates retrieval, business operations, persistence, and recovery. Delegate business decisions to the domain. State consistency, idempotency, ordering, failure and compensation, and observability explicitly.

## 3. Conventions

1. Perform external I/O through ports; wire concrete adapters in the composition root. Dependencies on domain types are allowed.
2. Pass aggregate IDs and value objects to command-side `execute`. Retrieve aggregates through ports.
3. Do not call another use case directly. Put shared business decisions in the domain and coordination in an explicit flow. Calling an external port's `execute` is not prohibited.
4. Do not extract values through getters to make business decisions. Call domain methods that return decisions. Passing a getter result as a repository argument is allowed when the value is not used for business branching or calculation.
5. Do not use database or external-system clients directly.

The query side retrieves DTOs through DAOs; do not impose command-side aggregate retrieval and persistence conventions on it unchanged.

## 4. Consistency and partial failure

Use an aggregate as the basic strong-consistency boundary. Before routinely combining several aggregates in one transaction, reconsider invariants and aggregate boundaries. For operations that cannot be relocated, make intermediate states and recovery flows explicit. See the [design background](https://zenn.dev/j5ik2o/articles/59de072b6728ff).

Persisting one aggregate update in one database transaction is allowed. A code unit called a use case does not by itself promise multi-aggregate atomicity.

If B fails after A is successfully persisted, A's commit remains. Design retries, compensation, or manual recovery. Saga compensation is a new operation and does not have database rollback's atomicity and isolation guarantees. Failed compensation also needs recovery.

Specify which processing, committed, and compensating states read models expose. Actor serialization does not automatically guarantee completion of external I/O or atomicity across aggregates.

## 5. Re-execution and idempotency

Distinguish caller re-execution from retrying a failed step with backoff. Define counts, time windows, and stopping conditions to prevent duplicate effects. Reconcile unknown persistence outcomes.

### 5-1. The store contract

Use `store` as the baseline port write verb and safely handle repeated persistence of the same request. Upsert is the state-sourcing baseline, not permission for unconditional overwrites. Detect conflicts using expected versions, uniqueness constraints, or equivalent mechanisms. A state-sourcing aggregate's `store` is declared as `upsert` with the expected version.

Event sourcing appends new events and never updates past events. Design duplicate handling, append conflicts, and outcome reconciliation together. SQL insert is not itself prohibited. A method named upsert does not establish idempotency for an entire flow. An event-sourcing aggregate's `store` is declared as `insert-only` (append only). One command produces at most one event: `store` checks the expected version and appends that one event, and a store refused for a conflicting version saves nothing.

The advisory `design-advisories.store-upsert` (the rule id is unchanged) judges each repository against the `persistence_method` of its aggregate in the implementation mapping: `state-sourcing` expects the `store` verb with `upsert`, `event-sourcing` expects the `store` verb with `insert-only`. When the mapping is absent, unreadable, or does not map the repository's aggregate, it reports (advisory) that the store semantics cannot be judged; it does not fall back to an upsert-only judgement.

### 5-2. Creation

Define the association between an identifiable creation request, its aggregate ID, and result. If each re-execution creates another ID, explain when unreferenced data remains, how it is reclaimed, and its effects on events or external I/O. Being unreferenced alone does not make data harmless.

### 5-3. State-setting operations

If the same request has already reached the desired state, it may succeed without changes. If another request changes the state before an old request is retried, request IDs, expected versions, or equivalent checks are also needed.

### 5-4. Additive operations

Additions cannot be absorbed by setting the same value again. Associate applied command IDs with their effects and prevent repeated application. Account for failures between duplicate detection and persistence.

Retaining only the most recent ID is valid only when an old retry cannot arrive after another command. `C1 → C2 → retry C1` can occur even with serialization. Choose retention counts and windows from retry conditions and define treatment of requests outside the window.

### 5-5. Current model representation

Commands have `effect: transition | accumulation` and `idempotency`. Current checks reject `strategy: none` for `accumulation` and require `command-id-memory`. They do not prove whole-flow idempotency.

For state-setting operations, `none` means safety is justified by a method other than ID memory, not that no precautions are needed. Record re-execution rationale in the use-case declaration too.

The period in which a resend is recognized is the model's existing `idempotency.retention` (`last-one`, `multiple` with `retention_count`, or `time-window` with `retention_window`); the model loader already requires it for `command-id-memory`. The use-case declaration gets no new item: `re_execution_basis` refers to that retention. For a `strategy: none` command, `re_execution_basis` states whether a repeat is refused with the command's own error or is a no-op of the state transition.

### 5-6. Command results and duplicate success

One command produces one event. In the model a command declares at most one event in its optional `event`. The loader refuses the former `events` list on a command with guidance (`schema.command-events`), refuses an event whose `produced_by` does not match the command that declares it, or a command producing two or more events (`schema.event-producer`), and refuses an event the aggregate does not declare (`schema.event-link`). A command returns its event only when it makes a state transition; a refusal is the method-specific error type and changes nothing.

- Rust: a state-changing method takes `&mut self`. One `&mut self` method makes the business decision, changes the state, and returns the event; there is no `&self` method that only decides, separated from an apply. Under state sourcing it returns `Result<(), XxxError>`; under event sourcing it returns `Result<XxxEvent, XxxError>`. Replay methods (`replay_methods`) only apply persisted events without business decisions and are distinct from commands.
- TypeScript: domain methods are immutable. They never write the instance's state and return a new instance. Under state sourcing a command returns `Result<Invoice, XxxError>`; under event sourcing it returns `Result<{ next: Invoice; event: XxxEvent }, XxxError>`. The use case stores the returned new instance (`next`), not the instance it called the command on.
- Value objects and Domain Primitives are immutable in both languages.

Only an `idempotency.strategy: command-id-memory` command has two kinds of success. "Applied" changes the state and carries its one event; "already applied" changes nothing and carries no event. It is returned for a command ID still remembered under the model's retention; the ID of a refused command is not remembered.

- Rust: `Result<CommandOutcome<XxxEvent>, XxxError>` with `enum CommandOutcome<E> { Applied(E), AlreadyApplied }` in the infrastructure language-extensions crate (`packages/infrastructure/language-extensions`). Under state sourcing a duplicate returns `Ok(())` without change.
- TypeScript: the success side of the infrastructure `Result` is `CommandOutcome<T, E> = { readonly kind: "applied"; readonly next: T; readonly event: E } | { readonly kind: "already-applied" }`, declared beside `Result` in `@acme/language-extensions`. On applied the use case stores `next`; on already applied it stores nothing.

A `none` command handles a repeat as refusal or as a no-op, as written in `re_execution_basis`.

The sensors enforce state changes, not return shapes. TypeScript rule b reports every state write in a domain instance method, regardless of the model, command, and replay declarations and of whether the model is available. Rust rule b additionally reports a declared command implemented with `&self`, `self`, or `mut self`. No sensor judges the return shape: TypeScript domain facts carry no return type, and Rust facts resolve no alias and record no returned variant. The return shape and the one-event append are left to review and behavior tests.

Distinguish cases where a state machine can recognize duplicates from those requiring request-ID memory. Using an FSM does not remove the need for event-store conflict control or duplicate-write protection.

## 6. Two declaration axes and Process Managers

`programming_model: actor | class` and `persistence_method: state-sourcing | event-sourcing` are independent choices. Sagas are not actor-specific and can use ordinary classes. Distinguish platform support from technical possibility. See the [official Temporal Java example](https://github.com/temporalio/samples-java/blob/main/core/src/main/java/io/temporal/samples/hello/HelloSaga.java).

Current multi-aggregate declarations require `process-manager` or `re-execution`. When any target aggregate is `actor` in the aggregate mapping, `multi_aggregate_strategy.kind: process-manager` is required (blocking `mapping-declarations.process-manager-required`); this also covers mixed actor/class flows. When every target is `class`, either `process-manager` or `re-execution` may be chosen. The functional-design contribution follows this design.

When a use case with two or more target aggregates uses `re-execution` and the mapping is absent, unreadable, or has no entry for one of its targets, the blocking `mapping-declarations.execution-model-undetermined` is reported, because whether a Process Manager is required cannot be decided. Single-aggregate use cases and `process-manager` use cases are not affected and pass without the mapping. The former note for an absent mapping is no longer emitted.

The [shared language design](language-independent-design.md) also makes TypeScript source representation an independent project-level choice; the aggregate-level actor/class declaration does not select the source-language class keyword.

## 7. Checks and review

g checks dependencies and external I/O, h aggregate arguments, i use-case chaining, d getters, and j model idempotency declarations. h/i use explicit types to distinguish aggregates from value objects and concrete use cases from ports. Syntax outside the [evaluation contract](../users/rust-sensor-contract.md) is noted.

Review and behavior tests assess recovery from partial failure, retention, aggregate boundaries, and exposure. Declaration presence and behavioral safety are distinct.

## 8. Use-case declarations

Give each definition an identifier and name and declare the following:

| Field | Content |
|---|---|
| `target_aggregates` | Target aggregate reference IDs |
| `commands` | Command reference IDs |
| `re_execution_basis` | Why each step is safe to re-execute |
| `recovery_policy` | `caller-retry` / `step-backoff` / `both` |
| `multi_aggregate_strategy` | Process Manager reference or re-execution strategy for multiple aggregates |
| `read_model_exposure` | Views that expose intermediate states |

Store these in `functional-spec.md` under `## DDD Use-case Declarations`. Existing Japanese section markers remain readable; see the [artifact contract](../users/artifact-contract.md). Do not generate a separate declaration file. Normal approval detects missing documents and sections.

## 9. Knowledge

Cover responsibility separation, aggregate consistency, request-level idempotency, recovery, compensation, and exposure. Prefer port traits and static dispatch in Rust. Do not impose one saga platform or event store on every project.

## 10. Remaining design decisions

The earlier open questions are decided: mixed actor/class flows and missing mappings in §6, the already-applied return value in §5-6, and the resend period in §5-5 (the model's existing `idempotency.retention`; no new use-case item). Adding attributes later still requires coordinated loader, contract, generation, sensor, and test changes.

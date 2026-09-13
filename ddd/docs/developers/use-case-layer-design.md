# DDD plugin use-case-layer design

English | [Japanese](use-case-layer-design.ja.md)

Updated: 2026-09-13. Uses the failure and persistence contracts in [domain-layer design §7](domain-layer-design.md). These are design conventions, not claims of complete sensor enforcement.

## 1. Delivery form

Extend functional-design through a contribution with declarations, knowledge, and sensors. Embed declarations in a required section of the registered functional-spec review artifact. See the [artifact contract](../users/artifact-contract.md).

## 2. Responsibilities

A use case coordinates retrieval, business operations, persistence, and recovery. Delegate business decisions to the domain. State consistency, idempotency, ordering, failure and compensation, and observability explicitly.

## 3. Conventions

1. Perform external I/O through ports; wire concrete adapters in the composition root. Dependencies on domain types are allowed.
2. Pass aggregate IDs and value objects to command-side `execute`. Retrieve aggregates through ports.
3. Do not call another use case directly. Put shared business decisions in the domain and coordination in an explicit flow. Calling an external port's `execute` is not prohibited.
4. Do not extract values through getters to make business decisions. Call domain methods that return decisions.
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

Use `store` as the baseline port write verb and safely handle repeated persistence of the same request. Upsert is the state-sourcing baseline, not permission for unconditional overwrites. Detect conflicts using expected versions, uniqueness constraints, or equivalent mechanisms.

Event sourcing appends new events and never updates past events. Design duplicate handling, append conflicts, and outcome reconciliation together. SQL insert is not itself prohibited. A method named upsert does not establish idempotency for an entire flow.

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

### 5-6. Duplicate success in event sourcing

A command known to be already applied can succeed with zero new events. One event is the baseline for initial state-changing success; rejection is a Domain Error. Concrete return types remain T-03 work.

Distinguish cases where a state machine can recognize duplicates from those requiring request-ID memory. Using an FSM does not remove the need for event-store conflict control or duplicate-write protection.

## 6. Two declaration axes and Process Managers

`programming_model: actor | class` and `persistence_method: state-sourcing | event-sourcing` are independent choices. Sagas are not actor-specific and can use ordinary classes. Distinguish platform support from technical possibility. See the [official Temporal Java example](https://github.com/temporalio/samples-java/blob/main/core/src/main/java/io/temporal/samples/hello/HelloSaga.java).

Current multi-aggregate declarations require `process-manager` or `re-execution`. When mappings are readable and every target aggregate is actor-based, the sensor requires `process-manager`. Classes can also use Process Managers. The existing contribution's instruction limiting classes to re-execution must be aligned with this design.

Requirements for mixed actor/class flows and missing mappings remain T-03 decisions. The current sensor skips the Process Manager requirement when mappings are missing; do not treat that behavior as a safety guarantee.

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

T-03 decides mixed-model recovery declarations, no-op return types, and whether retention periods belong in the model. Adding attributes requires coordinated loader, contract, generation, sensor, and test changes.

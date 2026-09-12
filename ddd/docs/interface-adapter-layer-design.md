# DDD plugin the Interface Adapter layer layer design

English | [Japanese](interface-adapter-layer-design.ja.md)

Updated: 2026-09-13. Conventions for implementing the [domain boundary contract](domain-layer-design.md) and [use-case recovery contract](use-case-layer-design.md) through external I/O.

## 1. Delivery form

Extend infrastructure-design through a contribution with layer declarations, knowledge, and sensors. Embed declarations in a required section of the registered cicd-pipeline review artifact. See the [artifact contract](artifact-contract.md).

## 2. CQRS responsibilities

The CQRS command side contains domain, use-case, and Interface Adapter layers; the query side contains use-case and Interface Adapter layers. Do not create an update-domain layer on the query side. Retrieve DTOs through DAOs.

The command-side Interface Adapter layer contains update controllers, repository implementations, and external clients. The query-side Interface Adapter layer contains retrieval controllers and DAO implementations. Without CQRS, preserve the responsibilities of persistence adapters, external clients, and thin I/O conversion.

State sourcing persists current state; event sourcing reconstructs it from history. Database products and table normalization are separate choices. State sourcing can also use domain events.

The component that updates read models from events is the RMU (Read Model Updater).

## 3. Command/query dependencies

Prohibit mutual dependencies between command and query sides in CQRS. The RMU is an independent bridge that reads events and updates read storage, so it may depend on both sides.

Do not use read models for update decisions: asynchronous propagation may not yet reflect the latest change. They are not necessarily always stale. Protect decisions through aggregate retrieval combined with expected versions or other conflict controls.

## 4. Query-side and RMU boundaries

The query side does not reference update aggregates, domain types, or repository ports. It shapes search and display models without duplicating update invariants. The query-side Interface Adapter layer depends on query use cases.

Keep the RMU independent of the command-side Interface Adapter layer and the query-side Interface Adapter layer. Align exposure of intermediate states with the use-case design.

## 5. Ports and repositories

Classify ports as `repository`, `external-client`, or `es-infrastructure`. Command-side I/O includes external clients as well as repositories, each handled by its port implementation.

Name repository ports `<Aggregate>Repository`, without storage-medium names. Implementation names may include the medium, as in `InMemoryInvoiceRepository`. Place ports according to their inner-layer consumers; concrete implementations belong in the Interface Adapter layer.

Operate on the owned aggregate or a collection of it; do not persist parts of aggregates or unrelated aggregates. Baseline verbs are `find_by_id`, `store`, and `delete_by_id`. Allow additional queries for the owned aggregate, but put screen-oriented searches in DAOs. Follow use-case design §5-1 for repeated stores, conflicts, and appends.

Start with in-memory implementations and test port contracts including conflicts and failures. Restore DTOs through full constructors. Follow domain-layer design §6 for replay; arbitrary restoration bypasses are not allowed.

## 6. Choosing persistence infrastructure

Do not exclude relational databases solely because of event format. PostgreSQL, for example, supports JSON/JSONB, so denormalized data alone does not establish unsuitability. This is an inference from storage capabilities, not a performance guarantee for a particular workload. See the [PostgreSQL specification](https://www.postgresql.org/docs/current/datatype-json.html).

Compare per-aggregate ordering, expected-version appends, duplicate detection, history retention, delivery, and operational cost. CDC is one delivery mechanism; lack of CDC is not a blanket exclusion criterion. Strategy-specific checks belong to later detailed design.

## 7. RMU ordering and idempotency

DynamoDB Streams guarantees order per item. If one aggregate's events are stored as separate items, that does not automatically establish aggregate-wide ordering. Lambda may also process duplicates. See the [DynamoDB Streams documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html) and [Lambda documentation](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html).

Declare and review the following for each RMU:

- Event IDs, aggregate IDs, per-aggregate sequence numbers, and their distinction from transport sequence numbers.
- The ordering scope and treatment of delays, gaps, reordering, and duplicates.
- How updates and processed records commit together, including any conditional-write predicates.
- Rebuilds, retry limits, and isolation of unrecoverable events.

Applying only higher-numbered events has different meanings for full-state replacement and incremental updates. Skipping deltas corrupts results; number comparison alone must not justify ignoring gaps. A view combining several aggregates may not have one sequence number that represents progress through every history.

## 8. Declarations and sensors

Use `## DDD Layer Structure` in `cicd-pipeline.md` to declare model/context references, CQRS, side-specific crate lists, dependencies, ports, repositories, restoration paths, and storage. Existing Japanese section markers remain readable; see the [artifact contract](artifact-contract.md). Explain RMU details outside the schema in prose first.

k checks cross-side references, l query-side domain references, m naming, and n restoration. Design sensors inspect declarations; Rust sensors inspect syntax. Neither proves semantic safety. Review and test aggregate ownership scope and re-execution safety.

Declarations are connected to normal approval. T-01 tracks the framework standalone completion gap, T-02 Rust naming/placement limits, and T-03 strategy-specific detail.

## 9. Knowledge

Cover CQRS separation, port responsibilities, restoration, RMU, and external-model translation. Put DB/RPC clients in the Interface Adapter layer; this plugin's infrastructure layer is only for language extensions. State this meaning of the layer name explicitly.

## 10. Later detailed design

The detailed RMU schema, strategy-specific required fields, and semantic replay verification remain unresolved. Matching declarations to explicit Rust types is implemented in [T-02](rust-sensor-contract.md). Determine needed fields in [T-03](completion-tasks.md); do not present unverified strategies as implemented.

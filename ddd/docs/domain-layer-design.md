# DDD plugin domain-layer design

English | [Japanese](domain-layer-design.ja.md)

Updated: 2026-09-13. Current design conventions consolidated from the discussions of September 8–10. See the [assessment](current-state-assessment.md) for implementation status and [remaining work](completion-tasks.md) for completion criteria. These conventions do not imply complete automated enforcement.

## 1. Purpose and scope

Add procedures, knowledge, and sensors for designing and implementing Domain Primitives and Always Valid Domain Models in AI-DLC. Rust is the initial inspection language; Claude Code and Codex are the completion targets. Kimi and opencode are out of scope.

Layer separation, restrictions on getter use, and physical crate separation are plugin conventions, not universal requirements of DDD.

## 2. The ddd-domain-modeling stage

The official name is `ddd-domain-modeling`. It accepts requirements-analysis and user-stories as optional inputs and creates the canonical model through aggregate boundaries before domain-design. When inputs are absent, elicit vocabulary through dialogue. Standalone application to existing projects is also intended. Normal approval integration is implemented; the framework's standalone completion guard remains incomplete.

Derive the model in this order: stories → past-tense business events → commands → aggregate candidates → invariants. Analysis events are independent of persistence strategy, and not every event discovered during analysis must be persisted.

| Owner | Responsibility |
|---|---|
| ddd-domain-modeling | Vocabulary, aggregate boundaries, invariants, states, commands, events, errors, construction rules |
| domain-design | Mapping to modules, types, ports, repositories, and persistence strategies |
| functional-design | Per-Unit procedures, re-execution, recovery, and exposure |

Completion requires (i) invariants for every aggregate, (ii) a state transition or an explicit no-transition declaration for each command, (iii) Domain Errors for each command, (iv) resolved reference IDs, (v) YAML/Markdown correspondence, and (vi) human semantic review. The loader implements (iii) as `schema.command-no-error`. Normal approval is connected; see the [artifact contract](artifact-contract.md) for standalone completion limits.

## 3. Canonical model

Bounded Contexts contain aggregates. Aggregates contain Entities, value objects, Domain Primitives, invariants, commands, events, errors, state transitions, and FactoryRules. Process Managers can represent coordination across aggregates.

A Domain Primitive is a small immutable type with business meaning and invariants. Always Valid design applies to construction and mutation throughout the model, including aggregates, not only to primitives.

A Domain Error records its owning command and failure condition. It is an input to generation and review; current sensors do not verify every error path or missing handler in generated code.

## 4. Ownership and reference IDs

Only the canonical model owns formal definitions. Downstream stages reference and map them without redefining them. Examples include `bc.billing`, `aggregate.invoice`, `primitive.invoice-number`, and `invariant.invoice.total-positive`.

Requiring IDs needs stage instructions, registered artifacts, and reference sensors together. Adding `adds.sensors` alone cannot establish normal approval checks when the target artifact is unregistered.

## 5. Artifacts and ID lifecycle

Exactly one labelled YAML block in `ddd-domain-model-yaml.md` holds canonical data; `ddd-domain-model.md` is the human-facing explanation. Include every element ID and invariant statement in Markdown. Sensors check their literal presence; review assesses the meaning of the explanation as a whole.

AI-DLC 2.8.2 resolves logical names `ddd-domain-model` and `ddd-domain-model-yaml` to `ddd-domain-model.md` and `ddd-domain-model-yaml.md`. Generation, references, and checks use these names consistently. Follow the [artifact contract](artifact-contract.md) to migrate older artifacts.

`element_id` is immutable; `name` is a display name. Renaming does not change the ID. Record successors, replacements, and retirement in `lineage` for splits, merges, and deletions. Never reuse retired IDs.

A hand-written loader performs runtime validation. JSON Schema documents the contract; it is not the runtime validator.

## 6. Domain code conventions

- Keep fields private, including read-only fields.
- Construct through full constructors that satisfy invariants. Prohibit empty construction followed by incremental initialization and validation bypass during restoration.
- Prohibit plain setters. Limit mutation to declared business commands or explicit event-application paths.
- Keep value objects and Domain Primitives immutable. Rust Entities and aggregates may perform exclusive business operations through `&mut self`.
- Domain Services make domain decisions without owning state or persistence responsibilities.
- Getter definitions are allowed, but calls from domain and use-case layers are restricted. The Interface Adapter layer may use them for I/O conversion. Distinguish decision methods from getters.
- Commands returning business errors preserve their pre-call state and leave no partial mutation.
- Do not hide undeclared business mutations with `RefCell` or similar mechanisms. Review the distinction from caches.

In event sourcing, separate business decisions from event application. The earlier “one command, one event” convention is the baseline for an initial state-changing success. Rejection and safely absorbed duplicates produce zero new events. Concrete Rust return types and operations needing multiple events remain T-03 decisions.

For state sourcing, the baseline update result is `Result<(), E>`. Domain events are optional, not prohibited by the persistence strategy. When using CQS, explicitly define contracts for operations returning update results, new state, or generated events.

Replay of persisted events performs no new business decisions. This does not require accepting corrupt or unknown schemas: abort restoration, report the problem, and isolate it. Names such as `apply` alone are not evidence of a valid restoration path.

## 7. Contracts with outer layers

### 7-1. Getter use

The Interface Adapter layer may use getters for database persistence and DTO conversion. Express business decisions as domain operations.

### 7-2. Persistence strategies

Declare `programming_model: actor | class` and `persistence_method: state-sourcing | event-sourcing` per aggregate in the mapping. Detailed strategy-specific checks remain incomplete; a declaration alone does not guarantee the generated code shape.

### 7-3. Uniqueness

A pre-query finding no existing value does not guarantee persistence will succeed. Arbitrate uniqueness through storage constraints, conditional writes, reservation models, or equivalent mechanisms. When using a separate index, design partial failure, release, and retry together with aggregate persistence. Validate value format when constructing the Domain Primitive.

### 7-4. Errors and publication

Repositories translate database-specific failures into a common contract such as `RepositoryError<Id>`. Use variants for business-relevant conflicts such as uniqueness violations and distinguish them from communication failures.

| Failure scope | Guarantee |
|---|---|
| One domain operation | Preserve pre-operation state on business error. |
| Persistence of one aggregate | Do not expose working state as committed before persistence. Discard and reload after confirmed persistence failure. |
| Communication failure with unknown persistence outcome | Do not assume no write occurred; reconcile request IDs and persisted outcomes. |
| Multi-aggregate flow | Partial commits may remain. Design retry, compensation, and intermediate states without promising automatic rollback of the whole flow. |

Do not publish events externally before persistence succeeds. Declare how failures between persistence and publication are handled. Multi-aggregate recovery is covered by the [use-case design](use-case-layer-design.md).

### 7-5. Physical structure and dependencies

Connect internal domain package names to ubiquitous language. Group by business concept and responsibility instead of technical classifications such as aggregate/, impl/, vo/, and entities/. domain-design declares terms, model references, and placement rationale; code generation checks the actual layout. See the [packaging contract](domain-packaging-design.md).

Separate layers using crates or equivalent boundaries. Allowed dependencies are `interface-adapter → use-case / domain / infrastructure`, `use-case → domain / infrastructure`, and `domain → infrastructure`. Infrastructure is for language extensions: it contains no DB/RPC clients and must not depend on other layers.

The composition root is outside this table because it performs wiring. Determine layers from names and placement. Cargo dependencies and checks maintain the convention, but crate separation alone does not make every prohibited direction a compilation error.

## 8. Sensor guarantees

| Rule | Current check | Limits and remaining work |
|---|---|---|
| a | Public struct fields | Detectable Rust syntax. |
| b | Mutation methods not declared in the model | Matches across files and traits; permits replay only through explicit declaration matching. |
| c / n | Construction sites, Default, incremental initialization, restoration calls | Does not verify the meaning of FactoryRule preconditions. |
| d | Getter calls on explicitly identified receiver types | Notes unexamined receivers requiring inference. |
| e | ID resolution, retirement, replacement | Connected to normal approval; standalone completion has limits. |
| f | IDs and invariant statements in Markdown | Human review assesses semantic correspondence. |

Deterministic syntax inspection and business correctness are distinct. Confirmed syntactic violations are blocking; semantic judgments require review. Test generated behavior against invariants. Universal semantic proof and exhaustive interior-mutability detection are not completion requirements, and knowledge files must state these limits.

## 9. Knowledge

Distribute language-independent design principles and Rust conventions in agent-specific and shared directories. Cover ADTs, ID references between aggregates, Domain Services, business vocabulary, state transitions, and external-model boundaries.

Resolve conflicts with explicit project policy by identifying their scope and rationale. Do not give plugin conventions blanket precedence. Describe actual coverage accurately and link real examples. A passing case without the target structure is not evidence that the structure was validated.

## 10. AI-DLC integration

Compose stages, contributions, sensors, knowledge, and tools. Plugin-owned stages and logical artifacts use the `ddd-` prefix.

Normal approval requires agreement between registered artifacts, actual filenames, `matches`, `fire_on: gate`, and severity. Sensor-only or compose-only success cannot prove approval integration. T-01 integration tests exercise normal approval; the standalone completion gap remains separate.

## 11. Later extensions

A second language, sensor-generation infrastructure, detailed schemas per persistence strategy, and further interior-mutability analysis are later candidates. Use-case and Interface Adapter conventions already have their own design documents; they are not unstarted designs.

## 12. Unresolved implementation contracts

Replay declarations are implemented as [replay_methods](rust-sensor-contract.md). Return types distinguishing success, duplicates, and rejection, and recovery declarations for mixed actor/class flows remain unresolved. Decide and verify them through [T-01–T-03](completion-tasks.md).

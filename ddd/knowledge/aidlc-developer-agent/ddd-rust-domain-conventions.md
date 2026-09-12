# Rust domain conventions

Updated: 2026-09-13. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.rust-domain-conventions.1 | Do not expose domain state through public fields. | a checks struct fields. |
| K.rust-domain-conventions.2 | Construct through full constructors and provide no undeclared setters. | b/c cover some shapes; review and test all preconditions. |
| K.rust-domain-conventions.3 | Limit mutation methods to declared commands or explicitly declared event-application paths. | b matches replay_methods, persistence mode, and types in the aggregate mapping. |
| K.rust-domain-conventions.4 | Keep fields private. | a |
| K.rust-domain-conventions.5 | Do not call getters from domain or use-case layers. | d matches explicitly identified receiver types. It emits notes when inference is needed. |
| K.rust-domain-conventions.6 | Express construction intent through names and centralize invariant-preserving construction. | Naming meaning requires review; c/n cover some construction shapes. |
| K.rust-domain-conventions.7 | Do not hide undeclared business mutations behind interior mutability. | Review, including the distinction from caches. |
| K.rust-domain-conventions.8 | Do not infer valid replay from names such as apply. | b checks replay_methods correspondence. Review the method body. |
| K.rust-domain-conventions.9 | Define value-object equality by value meaning and Entity equality with identity in mind. | Review. |
| K.rust-domain-conventions.10 | Make business errors explicit and leave no partial mutation on error. | Review and behavior tests. Distinguish aborting restoration of corrupt history. |
| K.rust-domain-conventions.11 | Use dedicated collection types when collections have invariants. | Design convention. |
| K.rust-domain-conventions.12 | Expose only needed operations and hide module internals. | Review. a does not check module visibility. |

## Rationale

Value objects and Domain Primitives are immutable. Rust aggregates and Entities may use exclusive &mut self for business mutations. Match declared types with impls across files so file splitting cannot hide mutations. Verify invariant semantics and unchanged state on errors with behavior tests.

## Examples

The [design cases](../../tests/golden/design/cases.ts) and [Rust cases](../../tests/golden/rust/cases.ts) contain real sensor inputs in the development repository. Find them by case name. These are test inputs, not complete business applications. A passing case without the relevant structure does not prove that structure is valid.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Sources

- [Current design](../../docs/domain-layer-design.md)
- [Measurements and known issues](../../docs/current-state-assessment.md)
- [Remaining work](../../docs/completion-tasks.md)

## T-02 evaluation contract

Rules b/d/h/i match crates, modules, and explicit type declarations. Do not confuse value objects or ports with aggregates or concrete use cases. Replay is allowed only when the aggregate mapping's replay_methods, event-sourcing mode, owning aggregate, and single event parameter type agree.

Type inference, associated types, and trait implementation selection are outside coverage. Direct sensor JSON includes notes for unexamined code. The standard dispatcher may omit notes on success; record them in code-summary for review. See the [detailed contract](../../docs/rust-sensor-contract.md).

## Domain packaging

Follow the [shared packaging convention](../aidlc-shared/ddd-domain-packaging.md) and name crates and modules using ubiquitous language. Match domain_packages declarations to the actual layout. Distinguish Rust impl syntax from prohibited technical-classification packages.

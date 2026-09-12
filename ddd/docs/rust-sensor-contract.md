# Rust sensor evaluation contract

English | [Japanese](rust-sensor-contract.ja.md)

Updated: 2026-09-13, T-02. Changes are limited to the analyzer, rules, tests, generation instructions, and documentation in `ddd/`. Third-party framework distributions were not modified.

## Distinguish name equality from type identity

| Rule | Updated evaluation |
|---|---|
| h: Aggregate arguments to execute | Only domain types corresponding to canonical Aggregate.root_element are aggregates. Distinguish value objects, Domain Primitives, and unrelated same-named types. |
| i: Calls to other use cases | Resolve the receiver and detect calls to inherent execute methods on concrete use-case-layer types. Distinguish port traits, other layers, and calls to the same type as the caller. |
| b: Undeclared mutation | Join structs/enums with impls using crate- and module-qualified type identity. Report cross-file and trait-implementation mutations at their actual file and line. |
| d: Getter calls | Inspect getters on the identified domain receiver type. Same-named methods on unrelated types are not violations. Calls on self remain excluded. |

Match aggregate Rust types by the root element's name or PascalCase derived from its stable ID. When several candidates share a name, use crate/module from the aggregate mapping; if still ambiguous, emit `model.unresolved`. Giving a value object a command method named after an aggregate command does not authorize mutation.

## Supported syntax

Handle conventional crate/module layouts, inline modules, module-level use statements and aliases, grouped imports, simple type aliases, and paths using crate/self/super. Inspect aggregate arguments through references and standard wrappers such as Box/Arc/Rc/Option/Vec.

Identify receivers through explicit parameter and let types, self, and fields of explicitly typed variables. Do not infer types from unannotated initializers. Do not reuse outer bindings incorrectly after shadowing or pattern rebinding.

This is not Rust compiler name resolution. Generic aliases, associated types, trait implementation selection, macro expansion, and expressions requiring inference are outside coverage. Suppress type matching in files containing function-local use statements. Cargo dependency aliases and renamed libraries are not fully handled. T-07 follows explicit path attributes in domain crates and uses their logical modules for type matching. cfg_attr path switching and macro-generated modules are unresolved; see the [packaging contract](domain-packaging-design.md). Generated code still needs compilation and tests.

This change does not guarantee exhaustive detection of interior mutability through `&self` or the validity of all ownership-consuming operations.

## Permit replay through explicit declarations

Each aggregate mapping may contain `replay_methods`; omission in an existing row means an empty list. The canonical model schema itself is unchanged.

```yaml
aggregate_ref: aggregate.invoice
programming_model: class
persistence_method: event-sourcing
crate: billing-domain
module: crate
replay_methods:
  - method: apply_event
    event_ref: event.invoice.issued
```

For rule b to permit replay, the aggregate mapping must be unique, its persistence mode must be event-sourcing, and crate/module must match the type's location. The method declaration must also be unique.

Require one domain-event parameter and an event_ref resolving to an event owned by that aggregate. Event code types must be uniquely identifiable by name within the crate. Numeric parameters, unknown events, other crates/modules, and duplicate declarations do not qualify.

Renaming a method to apply or replay is insufficient. A cross-file impl is allowed when all conditions match. Review and behavior tests verify whether the body applies the event correctly.

Design sensors also check replay_methods shape and event_ref resolution. Malformed lists are not silently discarded.

## Record unexamined locations

Direct sensor JSON includes `syntax.unresolved`, `model.unresolved`, and, when applicable, `replay.disabled` notes. If the model is SKIP/absent, it also records that model-dependent rules such as b/h were not run.

The standard AI-DLC 2.8.2 dispatcher does not preserve arbitrary notes from successful sensors. Generation instructions therefore require reading direct results and recording gaps in code-summary. The framework was not patched. `pass: true` means no confirmed violation was found, not that all Rust syntax or invariants were verified.

## Regression tests

[Additional Rust cases](../tests/golden/rust/t2-cases.ts) execute the real sensor scripts against value objects, Domain Primitives, ports, other use cases, cross-file impls, trait mutations, aliases and qualified types, getter-name collisions, shadowing, explicit replay, and invalid exceptions.

[Design cases](../tests/golden/design/cases.ts) include valid replay references, unknown IDs, and malformed declarations. Run the same cases against source tools and both Claude/Codex distributions.

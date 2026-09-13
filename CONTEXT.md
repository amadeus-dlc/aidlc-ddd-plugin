# DDD plugin context

English | [Japanese](CONTEXT.ja.md)

The plugin connects a team's domain model, implementation conventions, and inspection evidence. These terms describe the shared contract across supported languages.

## Language

**Canonical domain model**:
The authoritative definition of business concepts, their stable identities, invariants, operations, and expected failures.
_Avoid_: A language-specific code model presented as the business definition.

**Implementation mapping**:
The correspondence between canonical business definitions and their implementation elements. It references business identities without redefining them.

**Shared inspection contract**:
The conditions and evidence used to distinguish a conforming implementation, a rule violation, and an unresolved inspection across supported languages.

**Unresolved inspection**:
An inspection outcome in which the required evidence cannot be established. It is distinct from a confirmed violation and cannot establish conformance.

**Method-specific Domain Error**:
An expected business failure belonging to one domain operation or generation operation. The operation's error contract contains only its own declared failure cases.

**Generation convention**:
A selected rule for producing domain implementations that satisfy the shared domain and inspection contracts.

**Execution host**:
The application boundary that connects a runtime environment to layered business packages through assembly and delegation. Business decisions remain in their owning packages.

**Aggregate execution model**:
The way an aggregate accepts and executes its operations. It is independent of the source representation and persistence strategy.

**Domain source representation**:
The way domain concepts and operations are expressed in a supported language. Choosing it does not select the aggregate execution model.

**Infrastructure layer**:
The layer providing language-support facilities in this plugin's architecture. Storage and external-service adapters belong to the Interface Adapter layer.

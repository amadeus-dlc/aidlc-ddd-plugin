# Always Valid Domain Model

## Purpose

The foundation of the DDD plugin: an Always Valid Domain Model built from
Domain Primitives and value objects. Read at the start of domain-modeling,
domain-design and functional-design.

## Principles

- A domain object can never exist in an invalid state.
- Operations define meaning; representation does not (the ADT principle).
- Model the four kinds explicitly: entity (global / local), value object,
  first-class collection, domain event.
- Name with the ubiquitous language; an aggregate ID is the aggregate name plus
  `Id`.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| AVM-1 | validate every invariant at construction (full constructor) | domain type | sensor:c blocking | invalid states are unrepresentable | DL §6 |
| AVM-2 | wrap primitives with a meaningful domain primitive | primitives | guidance-only | closes primitive obsession | DL §3 |
| AVM-3 | reference another aggregate by ID only, never embed it | aggregate | sensor:b blocking | keeps aggregate boundaries | DL §3 |
| AVM-4 | a domain service is the last resort, not the default | domain service | guidance-only | behaviour belongs on the model | DL §6 |
| AVM-5 | stable element IDs follow the `<kind>.<segments>` grammar | model element | schema:id-grammar | IDs are permanent references | U1 BR1.1 |

## Rationale

Always Valid is not only about Domain Primitives: value objects, entities,
aggregates, their transitions and their operations all refuse to hold invalid
state. A separate `domain-modeling` stage exists because the standard workflow
would otherwise never produce these.

## Conflicts with core knowledge

| Conflict | Core location | Plugin rule | Scope | Precedence |
|---|---|---|---|---|
| C-1 Domain Primitive is not in the core vocabulary | ddd-patterns.md | AVM-2 | domain modelling | plugin |
| C-2 The core treats an aggregate as a data cluster, not an FSM | ddd-patterns.md | AGG-1 | domain modelling | plugin |
| C-3 The core allows getters for reading model state | ddd-patterns.md | RDC-2 | domain and use-case layers | plugin |
| C-4 The core leaves cross-context patterns open | ddd-patterns.md | AVM-3 | BC-internal references | plugin; core conformance patterns still apply between BCs |

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| AVM-1 | tests/golden/design/.../clean-complete | a complete canonical model | design fixture |

## Retired rules

None.

## Meta-discipline

- Precedence: plugin knowledge overrides core when they conflict; record the
  exception and the reason.
- Exceptions are always recorded with a reason; never silent.
- Index good examples by file, not by snippet.
- Retire rules with a strikethrough and a note; never delete.
- Anchor rules to measured code, not aspiration.
- Claim only as much as can be enforced.

## Sources

- ddd/docs/domain-layer-design.md §3–§6, §9
- aidlc/spaces/default/intents/.../decisions.md ADR-010

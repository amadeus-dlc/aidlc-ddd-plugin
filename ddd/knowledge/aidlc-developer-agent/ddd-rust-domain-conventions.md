# Rust domain conventions

## Purpose

The Rust-specific rules for the domain layer: field visibility,
Tell-Don't-Ask, factory naming, interior mutability, module visibility, domain
equality, error handling, first-class collections, and the `&mut self` business
operation. Read during code-generation and as support during functional-design.

## Principles

- Domain state is private; behaviour is explicit.
- Construct only through a full constructor; never add a setter.
- A `&mut self` method is a business operation and must be a declared Command,
  except for the replay path.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| RDC-1 | no non-private field on a domain type | domain type | sensor:a blocking | state is encapsulated | DL §6 |
| RDC-2 | do not call a getter from the domain or use-case layer | call site | sensor:d blocking | Tell, Don't Ask | DL §7-1 |
| RDC-3 | name factories by intent; build only through a full constructor | domain type | sensor:c / sensor:n blocking | one construction path | DL §6 |
| RDC-4 | no interior mutability to fake a setter | domain type | guidance-only | `&self` must not mutate | DL §6 |
| RDC-5 | a `&mut self` method is a declared Command, else use the replay names | domain type | sensor:b blocking | mutations are commands | FR7.2 |
| RDC-6 | implement equality by meaning, not by identity | domain type | guidance-only | value semantics | DL §9 |
| RDC-7 | model errors explicitly (a hand-written error enum) | domain type | guidance-only | no panics in the domain | DL §6 |
| RDC-8 | use a first-class collection instead of a raw `Vec` | domain type | guidance-only | collection invariants | DL §9 |

## Rationale

The Rust rules come from the domain layer design's code conventions and from the
language-specific handling of `&mut self`. Complete-constructor and
replay-naming are what let the sensors distinguish a real mutation from a replay
or an incomplete initialisation.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| RDC-1 | tests/golden/rust/.../clean-domain | private fields only | rust fixture |
| RDC-5 | tests/golden/rust/.../clean-domain | `issue(&mut self)` declared as a Command | rust fixture |

## Retired rules

None.

## Sources

- ddd/docs/domain-layer-design.md §6, §9
- ddd/tools/ddd/lib/rules/lists.ts

# Layer boundaries and dependency direction

## Purpose

The dependency rules every DDD stage shares: the four layers, the allowed
directions, the composition root, and the command/query ban. Read during
domain-design, functional-design, infrastructure-design and code-generation.

## Principles

- Layers are physically separated by subproject (`packages/<layer>/` or
  `modules/<layer>/`).
- A dependency that the rules forbid is a build error, not a review note.
- The composition root is the only place allowed to depend on everything.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| LB-1 | interface-adapter depends only on use-case, domain and infrastructure | crate graph | sensor:g blocking | I/O adapts inward | IA §3 |
| LB-2 | use-case depends only on domain and infrastructure | crate graph | sensor:g blocking | orchestration without I/O | IA §3 |
| LB-3 | domain depends only on infrastructure | crate graph | sensor:g blocking | domain is pure | IA §3 |
| LB-4 | infrastructure depends on no layer | crate graph | sensor:g blocking | it holds language extensions only | IA §3 |
| LB-5 | command side and query side do not depend on each other | crate graph | sensor:k blocking | CQRS separation | IA §3 |
| LB-6 | an RMU may depend on both sides | crate graph | sensor:k (exempt when from rmu) | read-model updaters bridge | IA §4 |
| LB-7 | the composition root wires all layers | crate graph | guidance-only | DI lives outside the rules | ADR-005 |
| LB-8 | layer is derived from the crate, never from a config file | crate graph | sensor:layer.* blocking | mechanical, not declarative | FR9.4 |

## Rationale

The dependency direction is the same one the domain layer design fixes: the
domain stays pure, use cases orchestrate, adapters perform I/O, and
infrastructure carries only language extensions. CQRS adds the command/query
split, bridged only by RMUs.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| LB-1 | tests/golden/rust/.../clean-domain | domain crate with no outward edge | mirror fixture for the Rust sensor |

## Retired rules

None.

## Sources

- ddd/docs/interface-adapter-layer-design.md §3–§4
- ddd/tools/ddd/lib/workspace/resolver.ts (permission table)

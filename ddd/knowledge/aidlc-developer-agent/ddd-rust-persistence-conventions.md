# Rust persistence conventions

## Purpose

The Rust-specific persistence rules: static binding by default, an
event-store-adapter-style event-sourcing implementation, decide/apply
separation, the replay path, port trait placement and implementation naming,
and `store` as upsert. Read during code-generation.

## Principles

- Prefer static binding; reach for dynamic dispatch only when the design needs a
  seam.
- Separate `decide` (business decision) from `apply` (state change).
- A repository `store` is an upsert.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| RPC-1 | static binding is the default | adapter | guidance-only | performance and clarity | UC §5 |
| RPC-2 | an event-sourced aggregate separates decide from apply | aggregate | sensor:c (replay exempt) | replayable history | DL §6 |
| RPC-3 | the replay path is `apply` / `apply_event` / `replay` / `on_event` | method | sensor:b (exempt) | replay is not a command | Q5 |
| RPC-4 | place a port trait next to its domain and name the implementation by the medium | adapter | sensor:m blocking | the trait names the contract | IA §5 |
| RPC-5 | a repository `store` is an upsert | repository | sensor:design-advisories.store-upsert advisory | idempotent writes | UC §5 |
| RPC-6 | commands return events under event sourcing, `Result<(), E>` otherwise | command | guidance-only | persistence-linked return | DL §6 |
| RPC-7 | restore only through a full constructor | adapter | sensor:n blocking | no bypass of invariants | DL §6 |

## Rationale

The reference implementation is `event-store-adapter-rs`. The rules (g)–(i) and
(k)–(n) map the same ideas onto code the sensors can inspect: forbidden
dependencies, aggregate arguments, cross-side references, repository naming and
restoration bypass.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| RPC-3 | tests/golden/rust/.../clean-domain | a replay method not flagged by (b) | rust fixture |
| RPC-7 | tests/golden/rust/.../violation-n | a struct-literal restoration | rust fixture |

## Retired rules

None.

## Sources

- ddd/docs/domain-layer-design.md §6–§7
- ddd/docs/use-case-layer-design.md §5
- ddd/docs/interface-adapter-layer-design.md §5, §9

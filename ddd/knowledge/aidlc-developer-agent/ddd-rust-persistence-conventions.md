# Rust persistence conventions

## Purpose

The Rust-specific persistence rules: static binding by default, an
event-store-adapter-style event-sourcing implementation, decide/apply
separation, the replay path, port trait placement and implementation naming,
and `store` as upsert. Read during code-generation.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.rust-persistence-conventions.1 | PREFER static binding, and reach for dynamic dispatch only where the design needs a seam. | adapter | guidance-only | Performance and clarity; whether a seam is needed is a design judgement. | UC §5 |
| K.rust-persistence-conventions.2 | ALWAYS separate `decide` (the business decision) from `apply` (the state change) in an event-sourced aggregate. | aggregate | sensor:c blocking | The history is replayable only if the state change has no side conditions. | DL §6 |
| K.rust-persistence-conventions.3 | ALWAYS treat a repository `store` as an upsert. | repository | sensor:design-advisories.store-upsert advisory | Idempotent writes; the check is advisory, so it reports without closing the gate. | UC §5 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.rust-persistence-conventions.4 | PREFER static binding as the default. | adapter | guidance-only | Performance and clarity. | UC §5 |
| K.rust-persistence-conventions.5 | ALWAYS separate `decide` from `apply` in an event-sourced aggregate. | aggregate | sensor:c blocking | Replayable history. The exemption is not a hole in the sensor: sensor (c) ignores the replay path because a method that only applies an already-decided event is not a second construction path. | DL §6 |
| K.rust-persistence-conventions.6 | ALWAYS name the replay path `apply`, `apply_event`, `replay` or `on_event`. | method | sensor:b blocking | Replay is not a command. Sensor (b) treats these four names as replay-exempt and reports no undeclared mutation for them, so the exemption is the reason the name list is fixed rather than free. | Q5 |
| K.rust-persistence-conventions.7 | ALWAYS place a port trait next to its domain and name the implementation by the medium. | adapter | sensor:m blocking | The trait names the contract and the implementation names the technology. | IA §5 |
| K.rust-persistence-conventions.8 | ALWAYS declare a repository `store` as an upsert. | repository | sensor:design-advisories.store-upsert advisory | Idempotent writes. | UC §5 |
| K.rust-persistence-conventions.9 | PREFER commands that return events under event sourcing and `Result<(), E>` otherwise. | command | guidance-only | The return value is bound to the persistence style, which is declared per aggregate; no sensor reads the signature. | DL §6 |
| K.rust-persistence-conventions.10 | ALWAYS restore an aggregate only through its full constructor. | adapter | sensor:n blocking | No bypass of invariants on the way back in. Sensor (n) exempts calls to the replay path (`apply` / `apply_event` / `replay` / `on_event`), because those are not construction. | DL §6 |

## Rationale

The reference implementation is `event-store-adapter-rs`. The rules (g)–(i) and
(k)–(n) map the same ideas onto code the sensors can inspect: forbidden
dependencies, aggregate arguments, cross-side references, repository naming and
restoration bypass.

The core agrees with the port side of this file: "One repository per aggregate
root (not per entity or table)"
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
Pattern). The place where the core disagrees — event sourcing as merely one
option, with a free command/event correspondence — is recorded as C-4 in
`ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.rust-persistence-conventions.2 | tests/golden/rust/cases.ts#clean-domain | a domain type that sensor (c) accepts as a single construction path | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-persistence-conventions.3 | tests/golden/design/cases.ts#clean | a declared layer structure whose repository declares `store_semantics: upsert`, so sensor `design-advisories.store-upsert` reports nothing | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.rust-persistence-conventions.5 | tests/golden/rust/cases.ts#clean-domain | a domain type with no construction path other than its own `impl`, so sensor (c) reports nothing | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-persistence-conventions.6 | tests/golden/rust/cases.ts#clean-domain | the same case: no mutation is reported by sensor (b) | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-persistence-conventions.7 | tests/golden/rust/cases.ts#clean-repository | a `InvoiceRepository` trait beside an `InMemoryInvoiceRepository` implementation | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-persistence-conventions.8 | tests/golden/design/cases.ts#clean | a declared layer structure whose repository declares `store_semantics: upsert` | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.rust-persistence-conventions.10 | tests/golden/rust/cases.ts#clean-repository | the same case: no domain type is built by a struct literal or an update expression in the adapter crate | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

Each row names the clean case of the suite that runs the rule's sensor, not a
case built to exercise the rule's subject matter. Two caveats belong with this
table:

- `clean-domain` declares no event-sourced aggregate, so it contains no
  `decide` / `apply` pair and no replay method. Rules `.5` and `.6` are
  therefore satisfied vacuously there rather than demonstrated.
- `clean-repository` contains no restoration code at all, so rule `.10` is
  likewise satisfied vacuously.

Both caveats are listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/domain-layer-design.md` §6–§7
- `ddd/docs/use-case-layer-design.md` §5
- `ddd/docs/interface-adapter-layer-design.md` §5, §9
- `construction/u2-rust-analysis-foundation/functional-design/` — the layer
  assigned from the crate graph and the placement conventions the port rules
  build on (`functional-spec.md`, `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `construction/u5-rust-code-sensors/functional-design/` — the rule semantics
  for (c), (m) and (n) and the replay-exemption list that rules `.5`, `.6` and
  `.10` describe (`functional-spec.md`, `rules.md`)
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Repository
  Pattern, Domain Events (the core statements cited as support, and the one
  recorded as conflict C-4 in `ddd-always-valid-model.md`)

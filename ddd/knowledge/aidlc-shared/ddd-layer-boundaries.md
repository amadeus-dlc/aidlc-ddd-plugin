# Layer boundaries and dependency direction

## Purpose

The dependency rules every DDD stage shares: the four layers, the allowed
directions, the composition root, and the command/query ban. Read during
domain-design, functional-design, infrastructure-design and code-generation.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.layer-boundaries.1 | ALWAYS take a crate's layer from the crate itself, never from a configuration file. | crate graph | sensor:layer.* blocking | A layer that has to be declared separately can drift from the code it describes. | FR9.4 |
| K.layer-boundaries.2 | NEVER let a forbidden dependency into the build; it is a build error, not a review note. | crate graph | sensor:g blocking | A rule that only a reviewer enforces is a rule that decays. | IA §3 |
| K.layer-boundaries.3 | PREFER confining the everything-depends-on-everything wiring to the composition root. | crate graph | guidance-only | Wiring has to live somewhere; whether a given edge belongs to the composition root is a design judgement. | ADR-005 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.layer-boundaries.4 | ALWAYS keep interface-adapter depending only on use-case, domain and infrastructure. | crate graph | sensor:g blocking | I/O adapts inward. | IA §3 |
| K.layer-boundaries.5 | ALWAYS keep use-case depending only on domain and infrastructure. | crate graph | sensor:g blocking | Orchestration without I/O. | IA §3 |
| K.layer-boundaries.6 | ALWAYS keep domain depending only on infrastructure. | crate graph | sensor:g blocking | The domain is pure. | IA §3 |
| K.layer-boundaries.7 | NEVER let infrastructure depend on a layer. | crate graph | sensor:g blocking | It holds language extensions only. | IA §3 |
| K.layer-boundaries.8 | NEVER let the command side and the query side depend on each other. | crate graph | sensor:k blocking | CQRS separation. | IA §3 |
| K.layer-boundaries.9 | ALWAYS keep the command/query ban, allowing an RMU to depend on both sides. | crate graph | sensor:k blocking | Read-model updaters bridge the two sides by design. Sensor (k) exempts an edge that comes from an RMU crate rather than a command- or query-side crate; that exemption is the reason this rule reads as a permission inside the ban. | IA §4 |
| K.layer-boundaries.10 | PREFER wiring all layers in the composition root. | crate graph | guidance-only | DI lives outside the rules. | ADR-005 |
| K.layer-boundaries.11 | ALWAYS derive a crate's layer from the crate, never from a config file. | crate graph | sensor:layer.* blocking | Mechanical, not declarative. | FR9.4 |

## Rationale

The dependency direction is the same one the domain layer design fixes: the
domain stays pure, use cases orchestrate, adapters perform I/O, and
infrastructure carries only language extensions. CQRS adds the command/query
split, bridged only by RMUs.

The core agrees with the shape of the dependency rules and is cited as support:
transactions do not span aggregates and queries use a separate read model
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Aggregates,
Repository Pattern).

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.layer-boundaries.1 | tests/golden/rust/cases.ts#clean-domain | a workspace whose single crate is assigned a layer from its path, with no layer conflict or unknown | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.2 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (g) reports no forbidden dependency direction | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.4 | tests/golden/rust/cases.ts#clean-domain | the same case: no adapter crate declares an inward-forbidden edge | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.5 | tests/golden/rust/cases.ts#clean-domain | the same case: no use-case crate declares a forbidden edge | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.6 | tests/golden/rust/cases.ts#clean-domain | the same case: the domain crate declares no dependency outside the allowed set | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.7 | tests/golden/rust/cases.ts#clean-domain | the same case: no infrastructure crate declares an outward edge | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.layer-boundaries.8 | tests/golden/design/cases.ts#clean | a declared layer structure with a command-side crate and a query-side crate and no dependency between them | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.layer-boundaries.9 | tests/golden/design/cases.ts#clean | the same case: the declaration lists no RMU crate, so no exempt edge is needed | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/design/cases.ts` and run it with `bun test tests/u4-golden.test.ts`. |
| K.layer-boundaries.11 | tests/golden/rust/cases.ts#clean-domain | the same case: the crate's layer is resolved without a config file | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

Seven of the nine rows point at the one rust clean case because rules `.1`,
`.2` and `.4`–`.7` and `.11` all read the same crate graph. Two caveats belong
with this table:

- `clean-domain` declares a single domain crate, so the adapter, use-case and
  infrastructure rules (`.4`, `.5`, `.7`) are satisfied because no such crate
  exists there, not because a correct edge was checked.
- The `clean` design case declares no RMU crate, so the exemption in rule `.9`
  is not exercised.

Both caveats are listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/interface-adapter-layer-design.md` §3–§4
- `construction/u2-rust-analysis-foundation/functional-design/` — the layer
  assigned from the crate graph and the allowed-dependency table
  (`isAllowed`) that sensors (g), (k) and `layer.*` consult
  (`functional-spec.md` §WF2, §WF5, `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `inception/domain-design/decisions.md` ADR-005 — the composition root
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Aggregates,
  Repository Pattern (the core statements cited as support)

# Always Valid Domain Model

## Purpose

The foundation of the DDD plugin: an Always Valid Domain Model built from
Domain Primitives and value objects. Read at the start of domain-modeling,
domain-design and functional-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.always-valid-model.1 | ALWAYS keep a domain object out of invalid states: every invariant is validated at construction. | domain type | sensor:c blocking | An object that cannot be invalid needs no defensive checks downstream. | DL §6 |
| K.always-valid-model.2 | PREFER modelling operations over representation: a value's meaning is what it can do, not how it is stored (the ADT principle). | domain type | guidance-only | The choice of representation is a design stance; no sensor reads it. | DL §3 |
| K.always-valid-model.3 | PREFER modelling the four kinds explicitly: entity (global / local), value object, first-class collection, domain event. | model element | guidance-only | The canonical model records the kind of every element, but nothing rejects a model that leaves a kind unnamed. | U1 BR1.1 |
| K.always-valid-model.4 | PREFER naming with the ubiquitous language, and deriving an aggregate ID as the aggregate name plus `Id`. | model element | guidance-only | The `<kind>.<segments>` grammar is machine-checked; the words chosen inside a segment are not. | U1 BR1.1 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.always-valid-model.5 | ALWAYS validate every invariant in the full constructor of the domain type. | domain type | sensor:c blocking | Invalid states are unrepresentable. | DL §6 |
| K.always-valid-model.6 | PREFER wrapping a primitive in a domain primitive with a meaningful name. | primitives | guidance-only | Closes primitive obsession; no sensor reads the choice of wrapper type. | DL §3 |
| K.always-valid-model.7 | NEVER embed another aggregate; reference it by ID only. | aggregate | sensor:b blocking | Keeps aggregate boundaries and transaction scopes aligned. | DL §3 |
| K.always-valid-model.8 | PREFER a domain service only as a last resort, when no aggregate owns the behaviour. | domain service | guidance-only | Behaviour belongs on the model; placement is a design judgement. | DL §6 |
| K.always-valid-model.9 | ALWAYS follow the `<kind>.<segments>` grammar for stable element IDs. | model element | schema:id-grammar | IDs are permanent references and must stay resolvable. | U1 BR1.1 |

## Rationale

Always Valid is not only about Domain Primitives: value objects, entities,
aggregates, their transitions and their operations all refuse to hold invalid
state. A separate `domain-modeling` stage exists because the standard workflow
would otherwise never produce these.

The core agrees with the rest of this file and is cited as support, not as a
conflict: aggregates are referenced by ID, transactions do not span aggregates,
a repository exists per aggregate root, queries use a separate read model, and
value objects are preferred over primitives. The four places where the core
disagrees are listed below.

## Conflicts with core knowledge

`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` is read by the same
architect agent in the same stages as this file, so the disagreements are
written out rather than left to whoever reads both. The core file cannot be
edited, so the list below is the only arbitration there is.

| # | Core statement | Core location | Plugin rule | Scope | Precedence | Rationale |
|---|---|---|---|---|---|---|
| C-1 | The Repository Pattern interface shows `save(order: Order): void` and `findByCustomer(customerId: CustomerId): Order[]` | `ddd-patterns.md` → Repository Pattern | K.interface-adapter-conventions.6 | Port design in the interface-adapter layer (FR5.2, sensor (m)); conditional search lives on the query side as a DAO plus a DTO | plugin | Allowing conditional finders on a repository makes the query side depend on domain types, which breaks the mechanical check (l) and the CQRS separation. |
| C-2 | "Start with larger aggregates and split when you encounter contention or performance issues" | `ddd-patterns.md` → Design Heuristics | K.aggregate-and-invariants.10 | The aggregate derivation procedure in domain-modeling (FR1.6, FR2.4) | plugin | Starting from a large aggregate leaves the home of the invariants undecided, which makes the mechanical completeness condition (i) — every aggregate carries an invariant — a formality. The core heuristic stays useful when refactoring an existing model. |
| C-3 | Entity: "Mutable — their state changes over time" | `ddd-patterns.md` → Entities | K.rust-domain-conventions.2, K.rust-domain-conventions.7 | Domain-layer code conventions (FR7.1–FR7.3) | plugin | Making mutability the default removes the grounds for banning setters and forcing a complete constructor, and Always Valid does not hold without them. |
| C-4 | Domain Events: "Build audit trails and event sourcing" | `ddd-patterns.md` → Domain Events | K.cqrs-and-consistency.5, K.rust-persistence-conventions.5 | The command return-value contract and the restoration path (sensors (c) and (n)); the core's integration patterns (notification, state transfer) still apply between Bounded Contexts | plugin | Without a per-aggregate persistence declaration the sensors cannot tell the restoration path from the construction path. |

Source of the plugin-side wording: `inception/domain-design/decisions.md` ADR-010.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.always-valid-model.1 | tests/golden/rust/cases.ts#clean-domain | a domain type whose fields are private and which is never constructed outside its own `impl` | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.always-valid-model.5 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (c) reports no construction outside the full constructor | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.always-valid-model.7 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (b) reports no undeclared mutation, and the type holds no aggregate-valued field | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

The three rows above name the clean case of the sensor suite that runs each
rule, not a case that exercises the rule's subject matter. Where the clean case
does not contain the construct a rule is about, the index records "the sensor
reported nothing", and the gap is listed in this unit's `code-summary.md`.

## Retired rules

None.

## Meta-discipline

- Precedence: plugin knowledge overrides core when they conflict; record the
  exception and the reason.
- Exceptions are always recorded with a reason; never silent. In this file an
  exception is written into the Rationale cell as `<exception> — <reason>`,
  because the Rules and Principles tables fix six columns and carry no separate
  column for exceptions.
- Index good examples by file, not by snippet.
- Retire rules with a strikethrough and a note; never delete.
- Anchor rules to measured code, not aspiration.
- Claim only as much as can be enforced.

## Sources

- `ddd/docs/domain-layer-design.md` §3–§6, §9
- `construction/u1-sensor-foundation/functional-design/` — the `<kind>.<segments>`
  ID grammar, the element kinds and the canonical model schema
  (`functional-spec.md`, `entities.md`, `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `inception/domain-design/decisions.md` ADR-010 — the four conflicts
- Core knowledge cited as non-conflicting: `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md`
  → Aggregates ("Reference other aggregates by ID, not by object reference",
  "Transactions should not span multiple aggregates", "Keep aggregates small"),
  → Repository Pattern ("One repository per aggregate root (not per entity or
  table)", "Do not put query logic in repositories — use separate read models"),
  → Value Objects ("Prefer value objects over primitives")

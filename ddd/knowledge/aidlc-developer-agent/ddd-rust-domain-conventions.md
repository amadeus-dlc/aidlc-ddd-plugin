# Rust domain conventions

## Purpose

The Rust-specific rules for the domain layer: field visibility,
Tell-Don't-Ask, factory naming, interior mutability, module visibility, domain
equality, error handling, first-class collections, and the `&mut self` business
operation. Read during code-generation and as support during functional-design.

## Principles

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.rust-domain-conventions.1 | NEVER expose domain state through a non-private field; behaviour is the only public surface. | domain type | sensor:a blocking | Encapsulation is what makes an invariant enforceable at all. | DL §6 |
| K.rust-domain-conventions.2 | NEVER construct a domain value outside its full constructor, and never add a setter. | domain type | sensor:c blocking | One construction path is what makes "always valid" checkable. | DL §6 |
| K.rust-domain-conventions.3 | ALWAYS make a `&mut self` method a declared Command, or use one of the replay names. | domain type | sensor:b blocking | Every state change is then either a declared operation or a replayed event. | FR7.2 |

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| K.rust-domain-conventions.4 | NEVER put a non-private field on a domain type. | domain type | sensor:a blocking | State is encapsulated. | DL §6 |
| K.rust-domain-conventions.5 | NEVER call a getter from the domain or use-case layer. | call site | sensor:d blocking | Tell, Don't Ask. | DL §7-1 |
| K.rust-domain-conventions.6 | ALWAYS name factories by intent and build only through a full constructor. | domain type | sensor:c / sensor:n blocking | One construction path. | DL §6 |
| K.rust-domain-conventions.7 | PREFER not using interior mutability to fake a setter. | domain type | guidance-only | `&self` must not mutate; the judgement is whether a given cell is a cache or a setter, and no sensor reads that intent, so the rule states a preference rather than an obligation. | DL §6 |
| K.rust-domain-conventions.8 | ALWAYS make a `&mut self` method a declared Command, or use one of the replay names. | domain type | sensor:b blocking | Mutations are commands. | FR7.2 |
| K.rust-domain-conventions.9 | PREFER implementing equality by meaning rather than by identity. | domain type | guidance-only | Value semantics is a modelling decision; the sensor cannot tell the two implementations apart. | DL §9 |
| K.rust-domain-conventions.10 | PREFER modelling errors explicitly, with a hand-written error enum. | domain type | guidance-only | No panics in the domain; the choice of error representation is not read by any sensor. | DL §6 |
| K.rust-domain-conventions.11 | PREFER a first-class collection over a raw `Vec` field. | domain type | guidance-only | Collection invariants need a home; whether a given `Vec` needs one is a judgement. | DL §9 |
| K.rust-domain-conventions.12 | PREFER keeping a module's items internal to that module, exporting only what the layer above must call. | module | guidance-only | Module visibility is part of the design, but sensor (a) reads *field* visibility only (`lib/rules/rust/symbols.ts` compares `field.visibility`), and no check reads a module's own visibility. The rule therefore states a preference rather than an obligation, so that the knowledge claims exactly what can be enforced. | DL §9 |

## Rationale

The Rust rules come from the domain layer design's code conventions and from the
language-specific handling of `&mut self`. Complete-constructor and
replay-naming are what let the sensors distinguish a real mutation from a replay
or an incomplete initialisation: a `&mut self` method is classified
replay-exempt → post-init → unknown → declared-command / undeclared, and only
`undeclared` is a finding.

The core agrees with the immutability-first stance in spirit and is cited as
support: value objects are preferred over primitives
(`.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Value Objects). The
place where the core disagrees — "Mutable — their state changes over time" — is
recorded as C-3 in `ddd-always-valid-model.md`, which owns the conflict list.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| K.rust-domain-conventions.3 | tests/golden/rust/cases.ts#clean-domain | a domain type whose `&mut self` methods are none of the replay-exempt names and produce no finding | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.1 | tests/golden/rust/cases.ts#clean-domain | a domain type whose fields carry no visibility modifier | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.2 | tests/golden/rust/cases.ts#clean-domain | the same case: no struct literal, no `Default`, and no post-init method outside the type's own `impl` | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.4 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (a) reports no non-private field | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.5 | tests/golden/rust/cases.ts#clean-domain | the same case: the type's getter is not called from outside the domain | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.6 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (c) reports no incomplete construction | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |
| K.rust-domain-conventions.8 | tests/golden/rust/cases.ts#clean-domain | the same case: sensor (b) reports no undeclared mutation | `tests/golden/` is not copied into `.claude/knowledge/`, so this path is not reachable from the projected harness; in this repository, find the case by name in `tests/golden/rust/cases.ts` and run it with `bun test tests/u5-golden.test.ts`. |

Each row names the clean case of the suite that runs the rule's first-listed
sensor, not a case built to exercise the rule's subject matter. Two caveats
belong with this table:

- Sensor (n), which rules `.2` and `.6` also list, runs in the
  interface-adapter suite; its clean case is
  `tests/golden/rust/cases.ts#clean-repository`.
- `clean-domain` projects no canonical model, so a `&mut self` method is
  classified `unknown` and sensor (b) stays silent by construction rather than
  by finding a declared Command. No rust clean case exercises a declared
  Command.

Both caveats are listed in this unit's `code-summary.md`.

## Retired rules

None.

## Sources

- `ddd/docs/domain-layer-design.md` §6, §9
- `construction/u2-rust-analysis-foundation/functional-design/` — the crate
  naming and placement conventions, the layer assigned from the crate graph, and
  the symbol queries the rules read (`functional-spec.md`, `entities.md`,
  `rules.md`). Record-relative path under
  `aidlc/spaces/default/intents/<intent>/`.
- `construction/u5-rust-code-sensors/functional-design/` — the rule semantics for
  (a)–(d), the mutator classification order, and the fixed name lists
  (replay-exempt names `apply` / `apply_event` / `replay` / `on_event`,
  post-init names `init` / `setup` / `initialize` / `reset` / `configure`) that
  `ddd-rust-domain` reads (`functional-spec.md`, `rules.md`)
- `.claude/knowledge/aidlc-architect-agent/ddd-patterns.md` → Value Objects,
  Entities (the core statements cited as support, and the one recorded as
  conflict C-3 in `ddd-always-valid-model.md`)

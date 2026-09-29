# Aggregates, invariants, and commands

Updated: 2026-09-30. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.aggregate-and-invariants.1 | Declare aggregate states and the state effects of commands. | ii checks only the correspondence between state_effect and transition references. |
| K.aggregate-and-invariants.2 | Give every aggregate at least one invariant. | model-completeness.i |
| K.aggregate-and-invariants.3 | Declare each command's state effect and failure conditions. | Loader and completeness checks. |
| K.aggregate-and-invariants.4 | Use named states and transitions for transitioning operations; declare none for non-transitioning operations. | Loader and model-completeness.ii |
| K.aggregate-and-invariants.5 | Reconsider an aggregate boundary if it cannot own an invariant. | i checks existence; review assesses the boundary's meaning. |
| K.aggregate-and-invariants.6 | Declare effect and state_effect for each command. | Loader. |
| K.aggregate-and-invariants.7 | Under the current schema, declare at least one Domain Error for each Command and each Factory Rule; each error names the operation it belongs to under `operation`. | schema.command-no-error |
| K.aggregate-and-invariants.8 | Reference other aggregates by ID. | Review. Rule b does not check embedded aggregate objects. |
| K.aggregate-and-invariants.9 | Limit Domain Services to decisions that aggregates cannot own. | Design convention. |
| K.aggregate-and-invariants.10 | Discover business events from stories and derive aggregate candidates and invariants. | Design procedure. Sensors do not enforce the derivation order. |
| K.aggregate-and-invariants.11 | Keep IDs when renaming; record splits, merges, and deletions in lineage. | Loader lineage and reference checks. |
| K.aggregate-and-invariants.12 | For a command with `command-id-memory`, the aggregate remembers the command IDs it applied, as the command's `retention` declares (`last-one`: the last one), and checks a resent command ID before any other decision; a resent command changes nothing and produces no event. | j and last-one check the declaration; review and tests check the aggregate. |

## Rationale

Explicitly declaring no state transition is valid. Completeness checks do not prove that business transitions are correct or that code implements every transition.

The aggregate is the consistency boundary, so remembering an applied command ID together with the state it changed keeps duplicate detection and persistence from failing apart; the use case does not keep a separate record of applied commands.

## Examples

The [design cases](../../tests/golden/design/cases.ts) and [Rust cases](../../tests/golden/rust/cases.ts) contain real sensor inputs in the development repository. Find them by case name. These are test inputs, not complete business applications. A passing case without the relevant structure does not prove that structure is valid.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Sources

- [Current design](../../docs/developers/domain-layer-design.md)
- [Measurements and known issues](../../docs/developers/current-state-assessment.md)
- [Remaining work](../../docs/developers/completion-tasks.md)

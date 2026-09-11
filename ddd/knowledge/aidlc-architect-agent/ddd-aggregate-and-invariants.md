# Aggregates, invariants and commands

## Purpose

How to derive aggregates from events and how to specify their invariants,
commands, events, errors and transitions. Read during domain-modeling and
domain-design.

## Principles

- An aggregate is a finite state machine: its commands move it between named
  states and never leave it invalid.
- An invariant is a promise the aggregate always keeps; a candidate that cannot
  own one is not an aggregate.
- Every command declares its state effect and its failure conditions.

## Rules

| Rule ID | Statement | Applies to | Enforcement | Rationale | Source |
|---|---|---|---|---|---|
| AGG-1 | an aggregate is an FSM with named states and transitions | aggregate | sensor:model-completeness.ii blocking | state is explicit | DL §9 |
| AGG-2 | every aggregate has at least one invariant | aggregate | sensor:model-completeness.i blocking | the boundary is the invariant | FR1.8 (i) |
| AGG-3 | every command declares `effect` and `state_effect` | command | schema:Command.effect | transitions are typed | Q3 |
| AGG-4 | every command has at least one Domain Error | command | schema:command-no-error | failures are part of the contract | FR2.2 |
| AGG-5 | reference other aggregates by ID only | aggregate | sensor:b blocking | no cross-aggregate object graph | DL §3 |
| AGG-6 | a domain service is justified only when no aggregate owns the behaviour | domain service | guidance-only | prefer the model | DL §6 |
| AGG-7 | derive aggregates bottom-up from past-tense events | model | stage-contract:after-step:3 | event storming | DL §2 |
| AGG-8 | record ID lineage for rename / split / merge / removal | model | schema:lineage | IDs are permanent | FR2.4 |

## Rationale

The workflow discovers events, groups the events that change the same state into
candidates, and confirms each candidate's invariant and bounded context. The ID
lineage keeps downstream references stable across model evolution.

## Examples (index)

| Rule ID | Fixture path | What it shows | Projection note |
|---|---|---|---|
| AGG-2 | tests/golden/design/.../clean-complete | an aggregate with an invariant | design fixture |
| AGG-4 | tests/golden/design/.../clean-complete | a command with a Domain Error | design fixture |

## Retired rules

None.

## Sources

- ddd/docs/domain-layer-design.md §2–§5

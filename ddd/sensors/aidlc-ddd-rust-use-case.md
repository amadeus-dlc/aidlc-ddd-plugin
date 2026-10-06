---
id: ddd-rust-use-case
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-rust-use-case.ts
default_severity: blocking
fire_on: gate
description: The code-generation gate for the use-case layer — forbidden dependencies (g), execute arguments (h), use-case chaining (i), getter calls (d), use case type names (use-case-name), repository ports that do not return Result (repository-result) and repository writes that do not take &mut self (repository-mut-self) and an Event Sourcing port whose store does not take the event and the aggregate after it (event-sourcing-store).
category: code-shape
matches: "**/code-summary.md"
timeout_seconds: 10
checks:
  - { rule_id: repository-result-contract, requirement: DEC-2026-10-04, inputs: [traits, declarations, aliases], outcome: finding }
  - { rule_id: g, requirement: FR7.5, inputs: [uses, cargo-dependencies, layer-assignment], outcome: finding }
  - { rule_id: h, requirement: FR7.6, inputs: [impls, fns, domain-symbols], outcome: finding }
  - { rule_id: i, requirement: FR7.7, inputs: [calls], outcome: finding }
  - { rule_id: d, requirement: FR7.4, inputs: [calls, domain-symbols], outcome: finding }
  - { rule_id: use-case-name, requirement: DEC-2026-10-01, inputs: [impls], outcome: finding }
  - { rule_id: repository-result, requirement: DEC-2026-10-03, inputs: [traits], outcome: finding }
  - { rule_id: repository-mut-self, requirement: DEC-2026-10-03, inputs: [traits], outcome: finding }
  - { rule_id: event-sourcing-store, requirement: DEC-2026-10-04, inputs: [traits, ddd-aggregate-mapping], outcome: finding }
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# rust-use-case sensor (ddd)

Blocking gate for `code-generation` on the use-case layer: dependency direction
and external I/O (g), aggregate arguments to `execute` (h), use-case chaining
(i), getter calls (d), a use case type not named `<Verb><Object>UseCase`
(use-case-name), a method of a repository port that does not return `Result`
(repository-result), and a `store…` or `delete…` method of a repository port that does not take
`&mut self` unless the port declares `Sync` (repository-mut-self). Rule d permits unchanged getter-result forwarding to resolved repository port methods, directly or through immutable local bindings used only for repository arguments. Business branching and calculation remain forbidden; naming a variable `repo` is not an exemption.

See the [shared construction and repository contracts](../knowledge/aidlc-shared/ddd-construction-contracts.md). This gate also reports `repository-result-contract`, `event-sourcing-store`.

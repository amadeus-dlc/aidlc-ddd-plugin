---
id: ddd-rust-domain
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-rust-domain.ts
default_severity: blocking
fire_on: gate
description: The code-generation gate for the domain layer — public fields (a), undeclared mutation (b), incomplete construction (c), getter calls (d), the dependency safety net (g) and the layer diagnostics.
category: code-shape
matches: "**/code-summary.md"
timeout_seconds: 10
checks:
  - { rule_id: domain-packaging.declaration, requirement: T-07, inputs: [ddd-aggregate-mapping], outcome: finding }
  - { rule_id: domain-packaging.technical-name, requirement: T-07, inputs: [modules, cargo-targets], outcome: finding }
  - { rule_id: domain-packaging.duplicate, requirement: T-07, inputs: [ddd-aggregate-mapping], outcome: finding }
  - { rule_id: domain-packaging.coverage, requirement: T-07, inputs: [modules, ddd-aggregate-mapping], outcome: finding }
  - { rule_id: domain-packaging.reference, requirement: T-07, inputs: [ddd-domain-model-yaml, ddd-aggregate-mapping], outcome: finding }
  - { rule_id: domain-packaging.unresolved, requirement: T-07, inputs: [modules, cargo-targets], outcome: finding }
  - { rule_id: a, requirement: FR7.1, inputs: [uses, structs], outcome: finding }
  - { rule_id: b, requirement: FR7.2, inputs: [impls, domain-symbols, command-index], outcome: finding }
  - { rule_id: c, requirement: FR7.3, inputs: [impls, constructions, domain-symbols], outcome: finding }
  - { rule_id: d, requirement: FR7.4, inputs: [calls, domain-symbols], outcome: finding }
  - { rule_id: g, requirement: FR9.5, inputs: [uses, cargo-dependencies, layer-assignment], outcome: finding }
  - { rule_id: layer.unknown, requirement: FR9.4, inputs: [layer-assignment], outcome: finding }
  - { rule_id: layer.conflict, requirement: FR9.4, inputs: [layer-assignment], outcome: finding }
  - { rule_id: layer.mixed-targets, requirement: FR9.4, inputs: [layer-assignment], outcome: finding }
  - { rule_id: layer.unowned, requirement: FR9.4, inputs: [layer-assignment], outcome: finding }
  - { rule_id: model.invalid, requirement: FR6.4, inputs: [ddd-domain-model-yaml], outcome: finding }
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# rust-domain sensor (ddd)

Blocking gate for `code-generation` on the domain layer. Uses claimed `.rs` files as entry points and also reads Cargo.toml, the model,
the state file, and reachable modules of affected domain crates. Reports rules (a)–(d),
the dependency safety net (g), and the U2 layer diagnostics (this manifest is
the single reporter for them).

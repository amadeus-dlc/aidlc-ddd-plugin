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
  - { rule_id: a, requirement: FR7.1, inputs: [uses, structs], outcome: finding }
  - { rule_id: b, requirement: FR7.2, inputs: [impls, domain-symbols, command-index], outcome: finding }
  - { rule_id: c, requirement: FR7.3, inputs: [impls, constructions, domain-symbols], outcome: finding }
  - { rule_id: d, requirement: FR7.4, inputs: [calls, domain-symbols], outcome: finding }
  - { rule_id: g, requirement: FR9.5, inputs: [uses, cargo-dependencies, layer-assignment], outcome: finding }
  - { rule_id: "layer.*", requirement: FR9.4, inputs: [layer-assignment], outcome: finding }
  - { rule_id: model.invalid, requirement: FR6.4, inputs: [ddd-domain-model-yaml], outcome: finding }
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# rust-domain sensor (ddd)

Blocking gate for `code-generation` on the domain layer. Reads only the claimed
`.rs` files, Cargo.toml, the model and the state file. Reports rules (a)–(d),
the dependency safety net (g), and the U2 layer diagnostics (this manifest is
the single reporter for them).

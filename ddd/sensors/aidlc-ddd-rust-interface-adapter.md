---
id: ddd-rust-interface-adapter
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-rust-interface-adapter.ts
default_severity: blocking
fire_on: gate
description: The code-generation gate for the interface-adapter / rmu layers and every query-side file — cross-side references (k), query-side domain use (l), repository naming (m), restoration bypass (n), and g.
category: code-shape
matches: "**/code-summary.md"
timeout_seconds: 10
checks:
  - { rule_id: k, requirement: FR7.8, inputs: [uses, cargo-dependencies, layer-assignment], outcome: finding }
  - { rule_id: l, requirement: FR7.9, inputs: [uses, structs, impls, domain-symbols], outcome: finding }
  - { rule_id: m, requirement: FR7.10, inputs: [structs], outcome: finding }
  - { rule_id: n, requirement: FR7.11, inputs: [constructions, impls, domain-symbols], outcome: finding }
  - { rule_id: g, requirement: FR9.5, inputs: [uses, cargo-dependencies, layer-assignment], outcome: finding }
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# rust-interface-adapter sensor (ddd)

Blocking gate for `code-generation` on the interface-adapter and rmu layers,
plus every file whose CQRS side is query (whatever its effective layer):
cross-side references (k), query-side domain / repository references (l),
repository naming (m), restoration bypass (n), and the dependency safety net
(g).

---
id: ddd-rust-use-case
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-rust-use-case.ts
default_severity: blocking
fire_on: gate
description: The code-generation gate for the use-case layer — forbidden dependencies (g), execute arguments (h), use-case chaining (i) and getter calls (d).
category: code-shape
matches: "**/code-summary.md"
timeout_seconds: 10
checks:
  - { rule_id: g, requirement: FR7.5, inputs: [uses, cargo-dependencies, layer-assignment], outcome: finding }
  - { rule_id: h, requirement: FR7.6, inputs: [impls, fns, domain-symbols], outcome: finding }
  - { rule_id: i, requirement: FR7.7, inputs: [calls], outcome: finding }
  - { rule_id: d, requirement: FR7.4, inputs: [calls, domain-symbols], outcome: finding }
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
(i), and getter calls (d).

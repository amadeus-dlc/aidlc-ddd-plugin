---
id: ddd-typescript-domain
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-typescript-domain.ts
default_severity: blocking
fire_on: gate
description: The code-generation gate for the TypeScript domain layer — public state (a), a domain method that writes state (b), incomplete construction (c), getter calls (d), the dependency safety net (g), domain packaging and the layer diagnostics, with the rule ids of ddd-rust-domain.
category: code-shape
matches: "**/code-summary.md"
timeout_seconds: 10
checks:
  - { rule_id: domain-packaging.declaration, requirement: T-07, inputs: [ddd-aggregate-mapping], outcome: finding }
  - { rule_id: domain-packaging.technical-name, requirement: T-07, inputs: [modules, package-json], outcome: finding }
  - { rule_id: domain-packaging.coverage, requirement: T-07, inputs: [modules, ddd-aggregate-mapping], outcome: finding }
  - { rule_id: domain-packaging.reference, requirement: T-07, inputs: [ddd-domain-model-yaml, ddd-aggregate-mapping], outcome: finding }
  - { rule_id: domain-packaging.unresolved, requirement: T-07, inputs: [modules], outcome: finding }
  - { rule_id: a, requirement: FR7.1, inputs: [declarations, members], outcome: finding }
  - { rule_id: b, requirement: FR7.2, inputs: [members, calls, domain-symbols], outcome: finding }
  - { rule_id: c, requirement: FR7.3, inputs: [constructions, domain-symbols], outcome: finding }
  - { rule_id: d, requirement: FR7.4, inputs: [calls, domain-symbols], outcome: finding }
  - { rule_id: g, requirement: FR9.5, inputs: [imports, exports, package-json, tsconfig-paths, layer-assignment], outcome: finding }
  - { rule_id: layer.unknown, requirement: FR9.4, inputs: [layer-assignment], outcome: finding }
  - { rule_id: layer.conflict, requirement: FR9.4, inputs: [layer-assignment], outcome: finding }
  - { rule_id: layer.unowned, requirement: FR9.4, inputs: [layer-assignment], outcome: finding }
  - { rule_id: model.invalid, requirement: FR6.4, inputs: [ddd-domain-model-yaml], outcome: finding }
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# typescript-domain sensor (ddd)

Blocking gate for `code-generation` on the TypeScript domain layer. Uses claimed `.ts` / `.tsx`
files as entry points and also reads each package's `package.json` and `tsconfig.json`, the model,
the state file, the aggregate mapping, and every source below `src/` of each domain package.
Reports rules (a)–(d), the dependency safety net (g), domain packaging and the layer diagnostics
of the packages it is handed, with the rule ids and finding meanings of `ddd-rust-domain`, except
(b): a TypeScript domain method returns a new instance, so any write to the state of a domain
instance is a finding, whatever the model declares and whether or not the model is available.

A construct the facts or the rules cannot decide, and a compiler that cannot be launched, stop the
gate as uninspectable (exit 127) instead of answering, so neither is ever approved.

---
id: ddd-typescript-interface-adapter
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-typescript-interface-adapter.ts
default_severity: blocking
fire_on: gate
description: The code-generation gate for the TypeScript interface-adapter / rmu layers and every query-side source — cross-side references (k), query-side domain use (l), repository naming (m), restoration bypass (n), and g, with the rule ids of ddd-rust-interface-adapter.
category: code-shape
matches: "**/code-summary.md"
timeout_seconds: 10
checks:
  - { rule_id: event-sourcing-storage, requirement: DEC-2026-10-04, inputs: [fields, calls, ddd-layer-structure, ddd-aggregate-mapping], outcome: finding }
  - { rule_id: in-memory-restoration, requirement: DEC-2026-10-04, inputs: [fields, calls, ddd-layer-structure, ddd-aggregate-mapping], outcome: finding }
  - { rule_id: k, requirement: FR7.8, inputs: [imports, exports, package-json, tsconfig-paths, layer-assignment], outcome: finding }
  - { rule_id: l, requirement: FR7.9, inputs: [imports, exports, domain-symbols], outcome: finding }
  - { rule_id: m, requirement: FR7.10, inputs: [declarations], outcome: finding }
  - { rule_id: n, requirement: FR7.11, inputs: [constructions, domain-symbols], outcome: finding }
  - { rule_id: g, requirement: FR9.5, inputs: [imports, exports, package-json, tsconfig-paths, layer-assignment], outcome: finding }
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# typescript-interface-adapter sensor (ddd)

Blocking gate for `code-generation` on the TypeScript interface-adapter and rmu layers, plus every
claimed source of a query-side package whatever its layer. Uses claimed `.ts` / `.tsx` files as
entry points and also reads each package's `package.json` and `tsconfig.json`, the model, the state
file, and every source below `src/` of each domain package. Reports cross-side references (k),
query-side domain type / repository port references (l), repository naming (m), restoration bypass
(n) and the dependency safety net (g), with the rule ids and finding meanings of
`ddd-rust-interface-adapter`.

A construct the facts or the rules cannot decide, and a compiler that cannot be launched, stop the
gate as uninspectable (exit 127) instead of answering, so neither is ever approved.

See the [shared construction and repository contracts](../knowledge/aidlc-shared/ddd-construction-contracts.md). This gate also reports `event-sourcing-storage`, `in-memory-restoration`.

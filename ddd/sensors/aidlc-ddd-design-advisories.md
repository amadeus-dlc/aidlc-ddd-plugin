---
id: ddd-design-advisories
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-design-advisories.ts
default_severity: advisory
fire_on: gate
description: Advisory checks for functional-design / infrastructure-design — multi-aggregate use cases, repository scope, and upsert store semantics. Advisory findings never close the gate.
category: document-traceability
matches: "**/{functional-design/ddd-use-case-declarations.md,infrastructure-design/ddd-layer-structure.md}"
timeout_seconds: 10
checks:
  - rule_id: design-advisories.multi-aggregate
    requirement: FR4.4
    inputs: [ddd-use-case-declarations]
    outcome: finding
  - rule_id: design-advisories.repository-scope
    requirement: FR5.5
    inputs: [ddd-layer-structure]
    outcome: finding
  - rule_id: design-advisories.store-upsert
    requirement: FR5.5
    inputs: [ddd-layer-structure]
    outcome: finding
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# design-advisories sensor (ddd)

Advisory gate for `functional-design` and `infrastructure-design`. Reports
multi-aggregate use cases, partial repository scopes, and repositories not
declared as upsert stores. Findings are reported with `pass:false` but the
manifest severity is advisory, so the gate stays open (BR7.4).

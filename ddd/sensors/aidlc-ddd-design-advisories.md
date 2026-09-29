---
id: ddd-design-advisories
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-design-advisories.ts
default_severity: advisory
fire_on: gate
description: Advisory checks for functional-design / infrastructure-design — multi-aggregate use cases, repository scope, and store semantics that follow the persistence method of the implementation mapping (state-sourcing stored by upsert, event-sourcing by insert-only). Advisory findings never close the gate.
category: document-traceability
matches: "**/{functional-design/*,infrastructure-design/*}"
timeout_seconds: 10
checks:
  - rule_id: design-advisories.document
    requirement: ADR-008
    inputs: [functional-spec, cicd-pipeline]
    outcome: finding
  - rule_id: design-advisories.multi-aggregate
    requirement: FR4.4
    inputs: [functional-spec]
    outcome: finding
  - rule_id: design-advisories.repository-scope
    requirement: FR5.5
    inputs: [cicd-pipeline]
    outcome: finding
  - rule_id: design-advisories.store-upsert
    requirement: FR5.5
    inputs: [cicd-pipeline, ddd-aggregate-mapping]
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
multi-aggregate use cases, partial repository scopes, and repositories whose
store semantics do not follow how the implementation mapping persists their
aggregate: a `state-sourcing` aggregate is stored with `store` and `upsert`
(checked against its expected version), an `event-sourcing` aggregate with
`store` and `insert-only` (append only). When the mapping is absent, unreadable
or does not map the aggregate, the store semantics cannot be judged and the
same rule says so. Findings are reported with `pass:false` but the manifest
severity is advisory, so the gate stays open (BR7.4).

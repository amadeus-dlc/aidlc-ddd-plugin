---
id: ddd-reference-ids
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-reference-ids.ts
default_severity: blocking
fire_on: gate
description: The domain-design / functional-design gate — resolves every stable ID in the declaration documents against the normalised model (rule e).
category: document-traceability
matches: "**/{domain-design/ddd-aggregate-mapping.md,functional-design/ddd-use-case-declarations.md}"
timeout_seconds: 10
checks:
  - rule_id: reference-ids.document
    requirement: ADR-008
    inputs: [ddd-aggregate-mapping, ddd-use-case-declarations]
    outcome: finding
  - rule_id: reference-ids.model
    requirement: FR6.1
    inputs: [ddd-domain-model-yaml, U1 loadDomainModel]
    outcome: finding
  - rule_id: reference-ids.undefined
    requirement: FR6.1
    inputs: [U1 ElementIndex]
    outcome: finding
  - rule_id: reference-ids.deprecated
    requirement: FR2.4
    inputs: [U1 ElementIndex]
    outcome: finding
  - rule_id: reference-ids.kind
    requirement: FR2.3
    inputs: [U1 ElementIndex]
    outcome: finding
  - rule_id: reference-ids.malformed
    requirement: FR2.3
    inputs: [U1 ElementIndex]
    outcome: finding
  - rule_id: reference-ids.cycle
    requirement: FR2.4
    inputs: [U1 lineage.cycle]
    outcome: finding
  - rule_id: reference-ids.missing
    requirement: FR3.2
    inputs: [ddd-aggregate-mapping]
    outcome: finding
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# reference-ids sensor (ddd)

Blocking gate for `domain-design` (on `ddd-aggregate-mapping.md`) and
`functional-design` (on `ddd-use-case-declarations.md`). Resolves
`aggregate_ref` / `reference_ids` / `target_aggregates` / `commands` /
`process_manager_ref` through the U1 element index, reporting undefined,
deprecated, kind-mismatched and malformed references, plus cyclic lineage
transcribed from the model loader.

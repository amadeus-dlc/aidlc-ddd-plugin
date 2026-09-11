---
id: ddd-model-presence
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-model-presence.ts
default_severity: blocking
fire_on: gate
description: The domain-design gate — when domain-modeling ran, requires the normalised model to exist, load and resolve. SKIP / absent passes with a note.
category: document-shape
matches: "**/domain-design/components.md"
timeout_seconds: 10
checks:
  - rule_id: model-presence.missing
    requirement: FR6.4
    inputs: [aidlc-state.md, U1 readStageStatus]
    outcome: finding
  - rule_id: model-presence.invalid
    requirement: FR6.4
    inputs: [ddd-domain-model-yaml, U1 loadDomainModel]
    outcome: finding
  - rule_id: model-presence.unresolved
    requirement: FR3.1
    inputs: [ddd-domain-model-yaml, U1 ElementIndex]
    outcome: finding
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# model-presence sensor (ddd)

Blocking gate for `domain-design`. The trigger file is `components.md`, which
the sensor does not read; it only resolves the record directory. When
`domain-modeling` is EXECUTE, `inception/ddd-domain-modeling/domain-model.yaml`
must exist, load and fully resolve. SKIP or absent passes with a note
(ADR-004).

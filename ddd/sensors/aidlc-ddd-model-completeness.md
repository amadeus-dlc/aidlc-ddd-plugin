---
id: ddd-model-completeness
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-model-completeness.ts
default_severity: blocking
fire_on: gate
description: The domain-modeling gate — validates domain-model.yaml, its completeness conditions (i)-(iv) and its agreement with domain-model.md (rule f).
category: document-shape
matches: "**/domain-modeling/domain-model.yaml"
timeout_seconds: 10
checks:
  - rule_id: model-completeness.schema
    requirement: FR6.5
    inputs: [ddd-domain-model-yaml, U1 loadDomainModel]
    outcome: finding
  - rule_id: model-completeness.i
    requirement: FR1.8 (i)
    inputs: [ddd-domain-model-yaml, U1 checkCompleteness]
    outcome: finding
  - rule_id: model-completeness.ii
    requirement: FR1.8 (ii)
    inputs: [ddd-domain-model-yaml, U1 checkCompleteness]
    outcome: finding
  - rule_id: model-completeness.iv
    requirement: FR1.8 (iv)
    inputs: [ddd-domain-model-yaml, U1 ElementIndex]
    outcome: finding
  - rule_id: model-completeness.f-missing
    requirement: FR6.2
    inputs: [ddd-domain-model-md]
    outcome: finding
  - rule_id: model-completeness.f-unknown
    requirement: FR6.2
    inputs: [ddd-domain-model-md]
    outcome: finding
  - rule_id: model-completeness.f-invariant
    requirement: FR6.2
    inputs: [ddd-domain-model-md]
    outcome: finding
  - rule_id: model-completeness.f-absent
    requirement: FR6.2
    inputs: [ddd-domain-model-md]
    outcome: finding
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# model-completeness sensor (ddd)

Blocking gate for the `domain-modeling` stage. Loads `domain-model.yaml` through
the U1 schema library, transcribes load-time and completeness findings, resolves
every reference, and checks that `domain-model.md` mentions every element ID,
introduces no unknown IDs, and repeats every invariant statement.

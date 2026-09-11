---
id: ddd-mapping-declarations
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-mapping-declarations.ts
default_severity: blocking
fire_on: gate
description: The domain-design / functional-design gate — every aggregate is mapped on both axes, every use case declares its six items, and non-idempotent commands are caught (rule j).
category: document-traceability
matches: "**/{domain-design/ddd-aggregate-mapping.md,functional-design/ddd-use-case-declarations.md}"
timeout_seconds: 10
checks:
  - rule_id: mapping-declarations.aggregate-unmapped
    requirement: FR3.3
    inputs: [ddd-aggregate-mapping, ddd-domain-model-yaml]
    outcome: finding
  - rule_id: mapping-declarations.axes
    requirement: FR3.3
    inputs: [ddd-aggregate-mapping]
    outcome: finding
  - rule_id: mapping-declarations.duplicate
    requirement: FR3.3
    inputs: [ddd-aggregate-mapping]
    outcome: finding
  - rule_id: mapping-declarations.use-case-item
    requirement: FR4.1
    inputs: [ddd-use-case-declarations]
    outcome: finding
  - rule_id: mapping-declarations.multi-aggregate-strategy
    requirement: FR4.1
    inputs: [ddd-use-case-declarations]
    outcome: finding
  - rule_id: mapping-declarations.process-manager-required
    requirement: FR2.6
    inputs: [ddd-use-case-declarations, ddd-aggregate-mapping]
    outcome: finding
  - rule_id: mapping-declarations.j
    requirement: FR6.3
    inputs: [ddd-domain-model-yaml, U1 checkCompleteness]
    outcome: finding
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# mapping-declarations sensor (ddd)

Blocking gate for `domain-design` and `functional-design`. On the aggregate
mapping it requires a mapping for every aggregate with both axes; on the use
case declarations it requires the six mandatory items and a strategy for
multi-aggregate use cases, and requires a Process Manager when every target
aggregate is actor-modelled. It also transcribes rule (j) from the model
completeness check.

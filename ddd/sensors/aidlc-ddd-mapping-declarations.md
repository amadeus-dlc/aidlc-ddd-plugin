---
id: ddd-mapping-declarations
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-mapping-declarations.ts
default_severity: blocking
fire_on: gate
description: The domain-design / functional-design gate — the implementation mapping reads in the language-neutral format, every use case declares its six items, and non-idempotent commands are caught (rule j).
category: document-traceability
matches: "**/{domain-design/*,functional-design/*}"
timeout_seconds: 10
checks:
  - { rule_id: domain-packaging.technical-name, requirement: T-07, inputs: [ddd-aggregate-mapping], outcome: finding }
  - rule_id: mapping-declarations.document
    requirement: ADR-008
    inputs: [ddd-aggregate-mapping, functional-spec]
    outcome: finding
  - rule_id: mapping-declarations.model
    requirement: FR6.1
    inputs: [ddd-domain-model-yaml, U1 loadDomainModel]
    outcome: finding
  - rule_id: mapping-declarations.use-case-item
    requirement: FR4.1
    inputs: [functional-spec]
    outcome: finding
  - rule_id: mapping-declarations.multi-aggregate-strategy
    requirement: FR4.1
    inputs: [functional-spec]
    outcome: finding
  - rule_id: mapping-declarations.process-manager-required
    requirement: FR2.6
    inputs: [functional-spec, ddd-aggregate-mapping]
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
mapping it requires a document the language-neutral reader accepts against the
canonical model it names — every aggregate, operation and business error
mapped — and reports what that reader refuses as `mapping-declarations.document`,
`mapping-declarations.model` or `domain-packaging.technical-name`. On the use
case declarations it requires the six mandatory items and a strategy for
multi-aggregate use cases, and requires a Process Manager when every target
aggregate is actor-modelled; a mapping that is present but unreadable blocks
there too. It also transcribes rule (j) from the model completeness check.

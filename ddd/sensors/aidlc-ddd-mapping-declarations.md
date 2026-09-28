---
id: ddd-mapping-declarations
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-mapping-declarations.ts
default_severity: blocking
fire_on: gate
description: The domain-design / functional-design gate — the implementation mapping reads in the language-neutral format, every use case declares its six items, a use case over any actor-modelled aggregate references a Process Manager, a multi-aggregate re-execution whose execution model the mapping does not give is refused, and non-idempotent commands are caught (rule j).
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
  - rule_id: mapping-declarations.execution-model-undetermined
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
multi-aggregate use cases, and requires a Process Manager when any target
aggregate is actor-modelled; a use case over class-modelled aggregates alone may
choose a Process Manager or re-execution. When the mapping is absent, or does
not give the programming model of a target, a multi-aggregate use case that
chose re-execution is reported as
`mapping-declarations.execution-model-undetermined`, because whether it needs a
Process Manager cannot be decided; a single-aggregate use case and one that
chose a Process Manager are not affected. A mapping that is present but
unreadable blocks there too. It also transcribes rule (j) from the model
completeness check.

---
id: ddd-layer-structure
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-layer-structure.ts
default_severity: blocking
fire_on: gate
description: The infrastructure-design gate — the declared layer structure has the ADR-009 items and no forbidden dependencies (rules k, l) or missing restoration path (n).
category: document-traceability
matches: "**/infrastructure-design/*.{md,json}"
timeout_seconds: 10
checks:
  - rule_id: layer-structure.model
    requirement: FR6.1
    inputs: [ddd-domain-model-yaml, U1 loadDomainModel]
    outcome: finding
  - rule_id: layer-structure.item
    requirement: ADR-009
    inputs: [cicd-pipeline]
    outcome: finding
  - rule_id: layer-structure.cqrs-sides
    requirement: FR5.1
    inputs: [cicd-pipeline]
    outcome: finding
  - rule_id: layer-structure.dependencies-incomplete
    requirement: FR5.1
    inputs: [cicd-pipeline]
    outcome: finding
  - rule_id: layer-structure.k
    requirement: FR5.4 (k)
    inputs: [cicd-pipeline]
    outcome: finding
  - rule_id: layer-structure.l
    requirement: FR5.4 (l)
    inputs: [cicd-pipeline]
    outcome: finding
  - rule_id: layer-structure.n
    requirement: FR5.4 (n)
    inputs: [cicd-pipeline, ddd-domain-model-yaml]
    outcome: finding
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# layer-structure sensor (ddd)

Blocking gate for `infrastructure-design`. Reads only the declaration (never
Rust, Cargo or the implementation mapping): it checks the ADR-009 required
items, the command/query cross-dependency ban (k), query-side domain
dependencies (l), and full-constructor restoration paths (n). Repository naming
is a rule about code, checked by the Rust interface-adapter gate (m); the
declaration names no language, so it is not checked here. A document the
declaration reader refuses is reported as `layer-structure.item`, or as
`layer-structure.model` when the canonical model it names is what did not load.

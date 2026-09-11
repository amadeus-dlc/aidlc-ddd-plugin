---
id: ddd-layer-structure
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-layer-structure.ts
default_severity: blocking
fire_on: gate
description: The infrastructure-design gate — the declared layer structure has the ADR-009 items and no forbidden dependencies (rules k, l), repository naming (m) or restoration path (n).
category: document-traceability
matches: "**/infrastructure-design/ddd-layer-structure.md"
timeout_seconds: 10
checks:
  - rule_id: layer-structure.item
    requirement: ADR-009
    inputs: [ddd-layer-structure]
    outcome: finding
  - rule_id: layer-structure.cqrs-sides
    requirement: FR5.1
    inputs: [ddd-layer-structure]
    outcome: finding
  - rule_id: layer-structure.dependencies-incomplete
    requirement: FR5.1
    inputs: [ddd-layer-structure]
    outcome: finding
  - rule_id: layer-structure.k
    requirement: FR5.4 (k)
    inputs: [ddd-layer-structure]
    outcome: finding
  - rule_id: layer-structure.l
    requirement: FR5.4 (l)
    inputs: [ddd-layer-structure]
    outcome: finding
  - rule_id: layer-structure.m-name
    requirement: FR5.4 (m)
    inputs: [ddd-layer-structure]
    outcome: finding
  - rule_id: layer-structure.m-media
    requirement: FR5.4 (m)
    inputs: [ddd-layer-structure]
    outcome: finding
  - rule_id: layer-structure.n
    requirement: FR5.4 (n)
    inputs: [ddd-layer-structure, ddd-domain-model-yaml]
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
Rust or Cargo): it checks the ADR-009 required items, the command/query
cross-dependency ban (k), query-side domain/repository dependencies (l),
repository naming without a storage medium (m), and full-constructor
restoration paths (n).

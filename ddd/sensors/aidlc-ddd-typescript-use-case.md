---
id: ddd-typescript-use-case
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-typescript-use-case.ts
default_severity: blocking
fire_on: gate
description: The code-generation gate for the TypeScript use-case layer — forbidden dependencies and external I/O (g), execute arguments (h), use-case chaining (i), getter calls (d), use case type names (use-case-name) and repository ports that do not return Result (repository-result), with the rule ids of ddd-rust-use-case.
category: code-shape
matches: "**/code-summary.md"
timeout_seconds: 10
checks:
  - { rule_id: g, requirement: FR7.5, inputs: [imports, exports, package-json, tsconfig-paths, layer-assignment], outcome: finding }
  - { rule_id: h, requirement: FR7.6, inputs: [declarations, members, domain-symbols], outcome: finding }
  - { rule_id: i, requirement: FR7.7, inputs: [calls, declarations], outcome: finding }
  - { rule_id: d, requirement: FR7.4, inputs: [calls, domain-symbols, declarations], outcome: finding }
  - { rule_id: use-case-name, requirement: DEC-2026-10-01, inputs: [declarations, members], outcome: finding }
  - { rule_id: repository-result, requirement: DEC-2026-10-03, inputs: [declarations, members], outcome: finding }
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# typescript-use-case sensor (ddd)

Blocking gate for `code-generation` on the TypeScript use-case layer. Uses claimed `.ts` / `.tsx`
files as entry points and also reads each package's `package.json` and `tsconfig.json`, the model,
the state file, the aggregate mapping, and every source below `src/` of each domain and use-case
package. Reports the dependency direction and external I/O (g), aggregate arguments to `execute`
(h), use-case chaining (i), getter calls (d), a use case type not named `<Verb><Object>UseCase`
(use-case-name) and a method of a repository port that does not return `Result` (repository-result), with the rule ids and finding meanings of
`ddd-rust-use-case`. Rule d permits a getter result handed unchanged to a method of a repository
port, directly or through `const` bindings whose every reference is such a forwarding.

A construct the facts or the rules cannot decide, and a compiler that cannot be launched, stop the
gate as uninspectable (exit 127) instead of answering, so neither is ever approved.

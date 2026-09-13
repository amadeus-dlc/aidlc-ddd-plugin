---
id: ddd-rust-module-layout
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-rust-module-layout.ts
default_severity: blocking
fire_on: gate
description: Enforce the project's selected Rust module file layout across all owned Cargo packages, independent of source claims and domain modeling.
category: code-shape
matches: "**/{code-summary,build-and-test-summary,quality-gates}.md"
timeout_seconds: 10
checks:
  - { rule_id: module-layout.configuration, requirement: T-08, inputs: [ddd-config], outcome: finding }
  - { rule_id: module-layout.violation, requirement: T-08, inputs: [ddd-config, modules, cargo-targets], outcome: finding }
  - { rule_id: module-layout.unresolved, requirement: T-08, inputs: [modules, cargo-targets], outcome: finding }
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# Rust module layout

Read `.ddd.toml` at the project root and enforce one layout across all owned Rust packages and targets, including tests. `file` requires named module files; `mod-rs` requires `mod.rs` for modules with children and named files for leaves. Cargo target roots and inline modules are not external module filenames. Missing or invalid settings, mixed layouts, and unresolved module structure block approval. Never infer a policy from existing files or the Cargo edition.

Run at code-generation, build-and-test, and ci-pipeline admission. Inspect the whole project, without depending on source-manifest claims or the domain-modeling stage. Hidden directories, aidlc records, node_modules, vendor, target, and dist are outside the owned-source scan. A project with no Rust sources, Cargo manifests, or DDD configuration is not applicable. A configured Rust project cannot pass without an inspectable Cargo project.

The same check is available to CI as `bun {{HARNESS_DIR}}/tools/ddd-check-rust-module-layout.ts --project <project-root>`; it exits nonzero on violations, unresolved inspection, or zero inspected packages. Standalone stage completion requires this direct check because standard AI-DLC 2.8.2 does not enforce general gate sensors on that path.

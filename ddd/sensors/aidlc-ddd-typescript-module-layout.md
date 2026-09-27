---
id: ddd-typescript-module-layout
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/ddd-sensor-typescript-module-layout.ts
default_severity: blocking
fire_on: gate
description: Enforce the project's selected TypeScript module file layout across the src source root of every package, independent of source claims and domain modeling.
category: code-shape
matches: "**/{code-summary,build-and-test-summary,quality-gates}.md"
timeout_seconds: 10
checks:
  - { rule_id: module-layout.configuration, requirement: T-11, inputs: [ddd-config], outcome: finding }
  - { rule_id: module-layout.violation, requirement: T-11, inputs: [ddd-config, modules, package-roots], outcome: finding }
  - { rule_id: module-layout.unresolved, requirement: T-11, inputs: [modules, package-roots], outcome: finding }
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  findings_count: integer
---

# TypeScript module layout

Read `.ddd.toml` at the project root and enforce one TypeScript layout across the `src` directory directly under every package root (a directory holding `package.json`). `named-file` places a module with children at `src/<m>.ts`; `index-file` places it at `src/<m>/index.ts`. A leaf is `src/<m>/<leaf>.ts` in both layouts. The package entry `src/index.ts` is not a placed module. Missing or invalid settings, a project holding TypeScript whose settings do not name typescript, and unresolved module structure block approval. Never infer a policy from existing files.

A module placed in both files, a module directory without its module file, a symbolic link, a package inside another package's `src`, a TypeScript source whose name cannot be a module file (such as `*.test.ts`, `*.d.ts`, `.tsx`, `.mts`, `.cts`), and a directory that cannot be listed are reported as unresolved and never pass.

Run at code-generation, build-and-test, and ci-pipeline admission. Inspect the whole project, without depending on source-manifest claims or the domain-modeling stage. Hidden directories, aidlc records, node_modules, vendor, target, and dist are outside the owned-source scan. A project with no TypeScript sources, tsconfig.json, or DDD configuration is not applicable. A configured TypeScript project cannot pass without a package whose root holds `src`.

The same check is available to CI as `bun {{HARNESS_DIR}}/tools/ddd-check-typescript-module-layout.ts --project <project-root>`; it exits nonzero on violations, unresolved inspection, or zero inspected packages. Standalone stage completion requires this direct check because standard AI-DLC 2.8.2 does not enforce general gate sensors on that path.

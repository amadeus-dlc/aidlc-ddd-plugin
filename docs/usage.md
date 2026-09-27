# DDD plugin usage guide

English | [Japanese](usage.ja.md)

Updated: 2026-09-13. The plugin is still being completed. Check [known issues](../ddd/docs/developers/current-state-assessment.md) and use a test project.

## Prerequisites

Use Bun and an AI-DLC-enabled Claude Code or Codex environment. Kimi/opencode are excluded. Sensor analysis needs neither Cargo nor an installed TypeScript: the Rust analysis ships a native extractor and the TypeScript analysis ships the TypeScript Compiler API. Building and testing a generated application needs that language's own toolchain: a Rust toolchain for a Rust application, and Node.js with the project's own TypeScript toolchain (`typescript` for type checking, plus the project's build and test tools) for a TypeScript application.

The installer uses AI-DLC tools in the destination. Preview installation from local source:

```sh
bun ddd/scripts/install.ts --project /path/to/project --from /path/to/aidlc-ddd-plugin --harness codex --dry-run
```

Remove `--dry-run` to install. Fresh installation, updates, and failure protection are [automatically verified](../ddd/docs/developers/installation-verification.md). Actual model-driven stage execution remains T-05 work.

## Select the Rust module layout

Before generating Rust, choose one project-wide layout in `.ddd.toml`:

```toml
schema_version = 2
languages = ["rust"]

[rust]
module_layout = "file"
```

The alternative is `mod-rs`; mixed layouts and missing settings block approval. See the [layout contract](../ddd/docs/users/rust-module-layout.md) for both modes, migration, and the required CI command.

## Select the TypeScript module layout

Before placing TypeScript modules, name `typescript` in `languages` of the same `.ddd.toml` and set `module_layout` in its `[typescript]` table to `named-file` (a parent is `src/invoice.ts`) or `index-file` (a parent is `src/invoice/index.ts`); a leaf is `src/invoice/line.ts` either way. Only `src` directly under each package root is inspected, and missing settings, misplaced modules, and unresolved structure block approval. See the [TypeScript layout contract](../ddd/docs/users/typescript-module-layout.md) for what is inspected and the required CI command.

In the same `[typescript]` table, set `code_representation` to `class` (state in `#` fields) or `companion` (a type with a same-name companion object, state in a closure). Code generation writes every TypeScript domain type in the selected representation and layout, returns method-specific errors through a `Result` type kept in the infrastructure layer, and copies arrays and objects at the domain boundary. The TypeScript domain gate inspects both representations; see the [TypeScript domain sensor contract](../ddd/docs/users/typescript-sensor-contract.md). The TypeScript use-case and interface-adapter gates inspect the code of those layers with the rule ids of the Rust gates.

## Workflow responsibilities

Compose registers the dedicated stage, contributions, sensors, and knowledge. The destination's composed plan and stage conditions determine execution.

The design flow moves from requirements to canonical modeling, aggregate mappings, use-case declarations, layers, and code. Normal approval checks are connected; actual generation through human approval still needs separate host verification. Sensors use `fire_on: gate`; writing a file alone is not evidence it was inspected.

The standalone entry point is `$aidlc --stage ddd-domain-modeling --single`. It is designed to leave the main workflow pointer unchanged. Standard AI-DLC 2.8.2 does not verify general artifacts at standalone completion, so explicitly execute sensors as instructed by the stage. Late adoption, SKIP behavior, and reuse of standalone models still need verification after changes. A model-presence sensor passing on SKIP does not guarantee the whole downstream workflow passes.

## Read the artifacts

See [domain-layer design §5](../ddd/docs/developers/domain-layer-design.md) for model format and migration. Aggregate mappings live in `ddd-aggregate-mapping.md`; use-case and layer declarations occupy required sections in functional-spec and cicd-pipeline. See the [artifact contract](../ddd/docs/users/artifact-contract.md).

Code checks start from Rust files claimed in source-manifest.json. Even with no findings, inspect claims, layer classification, model availability, and notes. No findings is not proof of business correctness.

## Troubleshooting

Compare [compatibility](../ddd/docs/developers/framework-compatibility.md) and [remaining work](../ddd/docs/developers/completion-tasks.md), recording versions and results. Before repeatedly reinstalling, distinguish the framework standalone gap, installation-state problems, and actual model violations.

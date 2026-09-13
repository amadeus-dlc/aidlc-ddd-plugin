# DDD plugin usage guide

English | [Japanese](usage.ja.md)

Updated: 2026-09-13. The plugin is still being completed. Check [known issues](../ddd/docs/current-state-assessment.md) and use a test project.

## Prerequisites

Use Bun and an AI-DLC-enabled Claude Code or Codex environment. Kimi/opencode are excluded. Sensor analysis does not need Cargo, but generated applications need a Rust toolchain for build and tests.

The installer uses AI-DLC tools in the destination. Preview installation from local source:

```sh
bun ddd/scripts/install.ts --project /path/to/project --from /path/to/aidlc-ddd-plugin --harness codex --dry-run
```

Remove `--dry-run` to install. Fresh installation, updates, and failure protection are [automatically verified](../ddd/docs/installation-verification.md). Actual model-driven stage execution remains T-05 work.

## Workflow responsibilities

Compose registers the dedicated stage, contributions, sensors, and knowledge. The destination's composed plan and stage conditions determine execution.

The design flow moves from requirements to canonical modeling, aggregate mappings, use-case declarations, layers, and code. Normal approval checks are connected; actual generation through human approval still needs separate host verification. Sensors use `fire_on: gate`; writing a file alone is not evidence it was inspected.

The standalone entry point is `$aidlc --stage ddd-domain-modeling --single`. It is designed to leave the main workflow pointer unchanged. Standard AI-DLC 2.8.2 does not verify general artifacts at standalone completion, so explicitly execute sensors as instructed by the stage. Late adoption, SKIP behavior, and reuse of standalone models still need verification after changes. A model-presence sensor passing on SKIP does not guarantee the whole downstream workflow passes.

## Read the artifacts

See [domain-layer design §5](../ddd/docs/domain-layer-design.md) for model format and migration. Aggregate mappings live in `ddd-aggregate-mapping.md`; use-case and layer declarations occupy required sections in functional-spec and cicd-pipeline. See the [artifact contract](../ddd/docs/artifact-contract.md).

Code checks start from Rust files claimed in source-manifest.json. Even with no findings, inspect claims, layer classification, model availability, and notes. No findings is not proof of business correctness.

## Troubleshooting

Compare [compatibility](../ddd/docs/framework-compatibility.md) and [remaining work](../ddd/docs/completion-tasks.md), recording versions and results. Before repeatedly reinstalling, distinguish the framework standalone gap, installation-state problems, and actual model violations.

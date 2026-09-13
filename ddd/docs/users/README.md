# DDD plugin user documentation

English | [Japanese](README.ja.md) | [All documentation](../README.md)

For users applying the DDD plugin to an application project. Start with the installation and workflow guide, then consult the contracts when preparing artifacts or reviewing sensor results.

| Task | Document |
|---|---|
| Install the plugin, run stages, and troubleshoot | [Usage guide](../../../docs/usage.md) |
| Prepare canonical models, mappings, and required declarations | [Artifact contract](artifact-contract.md) |
| Name domain packages using ubiquitous language | [Domain packaging contract](domain-packaging-design.md) |
| Understand Rust type matching, replay declarations, and unexamined code | [Rust sensor contract](rust-sensor-contract.md) |

| Enforce one Rust module file layout across the project | [Rust module layout](rust-module-layout.md) |

## Check support and limitations

The plugin is under development. Before adoption, read [compatibility](../developers/framework-compatibility.md) and [remaining work](../developers/completion-tasks.md). [Installation verification](../developers/installation-verification.md) documents tested installation and update behavior. Actual model-driven stage execution remains unverified.

For plugin implementation changes, design rationale, and test evidence, use the [developer documentation](../developers/README.md).

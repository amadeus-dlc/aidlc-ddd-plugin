# DDD plugin architecture

English | [Japanese](architecture.ja.md)

Updated: 2026-09-13. This guide describes responsibilities and data flow. See the [assessment](../ddd/docs/developers/current-state-assessment.md) for implementation evidence.

## Connect the model to implementation

```text
Requirements and stories
  → ddd-domain-modeling: canonical model and human explanation
  → domain-design: mapping aggregates to types, modules, and ports
  → functional-design: use cases and recovery declarations
  → infrastructure-design: layers, persistence, and restoration
  → code-generation: Rust code and source-manifest
```

Only the canonical model owns formal business elements. Downstream stages reference stable IDs. The [developer documentation](../ddd/docs/developers/README.md) holds details.

## Connect checks to approval

Six design sensors read models and declarations. Three Rust sensors use Cargo structure, syntax, and model data. A fourth independently enforces the project-wide Rust module layout from `.ddd.toml`, across all owned Cargo packages and targets. It runs at code-generation, build-and-test, and ci-pipeline admission without depending on model status or source claims. During normal approval, registered artifacts' actual paths must match sensor patterns.

Canonical models use standard filenames; use-case declarations are required sections in functional-spec and layer declarations in cicd-pipeline. Missing, invalid, and valid cases are exercised through approval admission. See the [artifact contract](../ddd/docs/users/artifact-contract.md).

## Separate distribution and destination responsibilities

Build `ddd/` sources into `dist/<harness>/` for Claude/Codex. Compose installs stages, sensors, tools, and knowledge into the destination. Distribution folders and composed destination files are distinct.

Old custom builds and Kimi/opencode support are not maintained. [Compatibility](../ddd/docs/developers/framework-compatibility.md) describes standard AI-DLC integration, installation/update work, and actual rule-delivery verification.

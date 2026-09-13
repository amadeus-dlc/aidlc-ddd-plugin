# DDD plugin

English | [Japanese](README.ja.md)

Adds canonical domain-modeling procedures and design/Rust checks to AI-DLC. Plugin ID: `ddd`; current version: `0.1.0`.

**Under development.** Direct sensor execution and normal approval integration are verified. The framework standalone completion guard remains incomplete, and Rust type inference is outside inspection coverage. See the [assessment](docs/current-state-assessment.md) and [completion tasks](docs/completion-tasks.md).

## Structure

| Kind | Content |
|---|---|
| One stage | ddd-domain-modeling owns the canonical model through aggregate boundaries. |
| Four contributions | Extend domain-design, functional-design, infrastructure-design, and code-generation. |
| Six design sensors | Model loading/completeness/references, mappings, layers, and advisories. |
| Three Rust sensors | Domain, use-case, and Interface Adapter syntax/dependency checks. |
| Nine knowledge files | Language-independent design principles and Rust conventions. |

Sources live in stages/, contributions/, sensors/, knowledge/, and tools/. Implementation is divided into [schema](tools/ddd/lib/schema/), [Rust analysis](tools/ddd/lib/rust/), and [rules](tools/ddd/lib/rules/).

## Inspection coverage

| Sensor | Implemented checks |
|---|---|
| ddd-model-completeness | YAML loading, aggregate invariants, state effects, references, Markdown IDs/invariant statements. The loader enforces required Domain Errors. |
| ddd-model-presence | Existence/loading of a model scheduled to execute. SKIP/absent passes with a note. |
| ddd-reference-ids | Undefined, retired, wrong-kind, malformed IDs, and replacement relationships. |
| ddd-mapping-declarations | Aggregate axes, use-case declarations, multi-aggregate strategy, additive-command idempotency, and vocabulary-based packages. |
| ddd-layer-structure | Required layer fields, dependency direction, naming, and restoration declarations. |
| ddd-design-advisories | Multi-aggregate, repository-scope, and storage-declaration guidance. |
| ddd-rust-domain | a/b/c/d/g, layer diagnostics, and package declaration/layout matching. |
| ddd-rust-use-case | g/h/i/d. |
| ddd-rust-interface-adapter | k/l/m/n/g and query-side checks. |

All manifests except the advisory sensor are blocking. Canonical models use registered names, and added declarations are required sections of existing review artifacts connected to normal approval. See the [artifact contract](docs/artifact-contract.md) for standalone limits.

Rust checks use syntax and names without type inference or execution. T-02 corrected value-object, port, cross-file, and replay evaluation. The [Rust contract](docs/rust-sensor-contract.md) describes explicit-type matching and coverage notes. It does not exhaustively verify invariant semantics, recovery flows, or interior mutability.

Package names must connect to ubiquitous language. Prohibit technical classifications such as aggregate/, impl/, vo/, and entities/. Sensors inspect declarations and actual modules; review assesses term meaning. See the [packaging contract](docs/domain-packaging-design.md).

## Development verification

Requires Bun and AI-DLC development tools under `../.codex/tools/`. Assessment baseline: Bun 1.3.13 and AI-DLC 2.8.2.

```sh
cd ddd
bun install
bun run validate
bun run build:claude
bun run build:codex
bun scripts/verify-dist.ts claude codex
```

Run all tests with `bun run check`. Twenty known old-dependency failures remain. The [contract matrix](docs/sensor-coverage.md) identifies positive, negative, and boundary evidence per rule. build:all, test:sandbox, and default test:dist target only Claude/Codex. `bun run test:sandbox` combines contract coverage, heading compatibility, builds, disposable compose, distribution checks, and normal approval integration.

## Installation and supported environments

Completion targets are Claude Code (`.claude`) and Codex (`.codex`, with skills in `.agents/skills`). Kimi/opencode are excluded. The installer accepts only these two harnesses.

The destination must already have AI-DLC. Preview local-source installation:

```sh
bun ddd/scripts/install.ts --project /path/to/project --from /path/to/aidlc-ddd-plugin --harness claude --dry-run
```

Remove dry-run to install. The script implements source retrieval, build, compose, provenance, and updates, with [automated verification](docs/installation-verification.md) of fresh installs, updates, and failure protection. This document does not assume a latest tag exists or a release has been published.

## Design and remaining work

Start with the [document index](docs/README.md) and distinguish conventions from measurements. [Domain design](docs/domain-layer-design.md) covers layer/CQRS naming; [use-case design](docs/use-case-layer-design.md) covers re-execution and persistence; [Interface Adapter design](docs/interface-adapter-layer-design.md) covers restoration and RMU.

Report defects through [GitHub Issues](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues) with versions and reproduction conditions.

## License

[MIT](../LICENSE). Bundled web-tree-sitter and Rust grammar licenses are in [vendor](tools/ddd/lib/rust/vendor/) and [wasm/LICENSE](tools/ddd/wasm/LICENSE).

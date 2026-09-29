# DDD plugin

English | [Japanese](README.ja.md)

Adds canonical domain-modeling procedures and design/Rust checks to AI-DLC. Plugin ID: `ddd`; current version: `0.1.0`.

**Under development.** Direct sensor execution and normal approval integration are verified. The framework standalone completion guard remains incomplete, and Rust type inference is outside inspection coverage. See the [assessment](docs/developers/current-state-assessment.md) and [completion tasks](docs/developers/completion-tasks.md).

## Structure

| Kind | Content |
|---|---|
| One stage | ddd-domain-modeling owns the canonical model through aggregate boundaries. |
| Six contributions | Extend domain-design, functional-design, infrastructure-design, code-generation, build-and-test, and ci-pipeline. |
| Six design sensors | Model loading/completeness/references, mappings, layers, and advisories. |
| Four Rust sensors | Domain, use-case, and Interface Adapter checks, plus project-wide module layout. |
| One TypeScript sensor | The domain-layer checks of the Rust domain gate, on TypeScript. |
| Twelve knowledge files | Language-independent design principles, Rust conventions, and TypeScript conventions for both code representations and both module layouts. |

Sources live in stages/, contributions/, sensors/, knowledge/, and tools/. Implementation is divided into [schema](tools/ddd/lib/schema/), [Rust analysis](tools/ddd/lib/rust/), and [rules](tools/ddd/lib/rules/).

## Inspection coverage

| Sensor | Implemented checks |
|---|---|
| ddd-model-completeness | YAML loading, aggregate invariants, state effects, references, Markdown IDs/invariant statements. The loader enforces required Domain Errors. |
| ddd-model-presence | Existence/loading of a model scheduled to execute. SKIP/absent passes with a note. |
| ddd-reference-ids | Undefined, retired, wrong-kind, malformed IDs, and replacement relationships. |
| ddd-mapping-declarations | Aggregate axes, use-case declarations, multi-aggregate strategy, additive-command idempotency (a rationale when only the last command ID is kept), and vocabulary-based packages. |
| ddd-layer-structure | Required layer fields, dependency direction, naming, and restoration declarations. |
| ddd-design-advisories | Multi-aggregate, repository-scope, and storage-declaration guidance. |
| ddd-rust-module-layout | Enforce the selected file layout across all owned Cargo packages, including tests. |
| ddd-typescript-module-layout | Enforce the selected TypeScript file layout across the `src` of every package. |
| ddd-rust-domain | a/b/c/d/g, a repository port declared in a domain crate (port-placement), layer diagnostics, and package declaration/layout matching. |
| ddd-rust-use-case | g/h/i/d. |
| ddd-rust-interface-adapter | k/l/m/n/g and query-side checks. |
| ddd-typescript-domain | a/b/c/d/g, a repository port declared in a domain package (port-placement), layer diagnostics, and package declaration/layout matching on TypeScript, for both the class and the companion representation. |
| ddd-typescript-use-case | g/h/i/d on TypeScript, with the rule ids of ddd-rust-use-case. |
| ddd-typescript-interface-adapter | k/l/m/n/g and query-side checks on TypeScript, with the rule ids of ddd-rust-interface-adapter. |

All manifests except the advisory sensor are blocking. Canonical models use registered names, and added declarations are required sections of existing review artifacts connected to normal approval. See the [artifact contract](docs/users/artifact-contract.md) for standalone limits.

Rust checks use syntax and names without type inference or execution. T-02 corrected value-object, port, cross-file, and replay evaluation. The [Rust contract](docs/users/rust-sensor-contract.md) describes explicit-type matching and coverage notes. It does not exhaustively verify invariant semantics, recovery flows, or interior mutability.

The TypeScript domain, use-case and interface-adapter checks decide from the distributed TypeScript facts, likewise without type inference, and stop as uninspectable wherever those facts do not decide. The [TypeScript contract](docs/users/typescript-sensor-contract.md) describes what each rule reads and what stops each gate.

Package names must connect to ubiquitous language. Prohibit technical classifications such as aggregate/, impl/, vo/, and entities/. Sensors inspect declarations and actual modules; review assesses term meaning. See the [packaging contract](docs/users/domain-packaging-design.md).

## Development verification

Requires Bun, `aidlc` on PATH, and AI-DLC development tools under `../.codex/tools/`. Assessment baseline: Bun 1.3.13 and AI-DLC 2.9.0.

```sh
cd ddd
bun install
bun run validate
bun run build:claude
bun run build:codex
bun scripts/verify-dist.ts claude codex
```

Run all tests with `bun run check`, including the [development scope compatibility check](docs/developers/framework-compatibility.md#development-scope-traceability-on-282). The [contract matrix](docs/developers/sensor-coverage.md) identifies positive, negative, and boundary evidence per rule. build:all, test:sandbox, and default test:dist target only Claude/Codex. `bun run test:sandbox` combines contract coverage, heading compatibility, builds, disposable compose, distribution checks, and normal approval integration.

## Installation and supported environments

Completion targets are Claude Code (`.claude`) and Codex (`.codex`, with skills in `.agents/skills`). Kimi/opencode are excluded. The installer accepts only these two harnesses.

The destination must already have AI-DLC. Preview local-source installation:

```sh
bun ddd/scripts/install.ts --project /path/to/project --from /path/to/aidlc-ddd-plugin --harness claude --dry-run
```

Remove dry-run to install. The script implements source retrieval, build, compose, provenance, and updates, with [automated verification](docs/developers/installation-verification.md) of fresh installs, updates, and failure protection. This document does not assume a latest tag exists or a release has been published.

## Design and remaining work

Start with the [document index](docs/README.md) and distinguish conventions from measurements. [Domain design](docs/developers/domain-layer-design.md) covers layer/CQRS naming; [use-case design](docs/developers/use-case-layer-design.md) covers re-execution and persistence; [Interface Adapter design](docs/developers/interface-adapter-layer-design.md) covers restoration and RMU.

Report defects through [GitHub Issues](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues) with versions and reproduction conditions.

## License

[MIT](../LICENSE). The third-party crates the bundled native Rust extractor links, with their licenses, are listed in [tools/ddd/bin/NOTICE.md](tools/ddd/bin/NOTICE.md). The bundled TypeScript Compiler API (`typescript@6.0.3`, Apache-2.0) and its notices are described in [tools/ddd/lib/typescript/vendor/NOTICE.md](tools/ddd/lib/typescript/vendor/NOTICE.md).

For Rust projects, explicitly select `file` or `mod-rs` in the project-root `.ddd.toml` before generation. See the [module layout contract](docs/users/rust-module-layout.md) for configuration, mandatory gate checks, and the CI command.

For TypeScript projects, explicitly select `named-file` or `index-file` in the same document. See the [TypeScript module layout contract](docs/users/typescript-module-layout.md) for the inspected source roots, gate checks, and the CI command.

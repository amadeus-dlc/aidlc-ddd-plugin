# Changelog

All notable changes to the `ddd` plugin are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-09-11

The first implementation of the DDD plugin: a canonical domain-modeling stage,
four core-stage contributions, nine sensors and eight knowledge documents.

### Added

- **domain-modeling stage** (`stages/inception/ddd-domain-modeling.md`): a
  CONDITIONAL inception stage that owns the canonical `domain-model.yaml` (and
  the derived `domain-model.md`), from event discovery through the aggregate
  candidates and the self-check.
- **contributions**: `domain-design` (consumes the canonical model, produces
  the aggregate mapping), `functional-design`, `infrastructure-design` and
  `code-generation`. The design contributions add the declaration instructions
  and bind the design sensors; `code-generation` carries the naming / placement
  / implementation conventions and binds the three Rust sensors.
- **design sensors**: `ddd-model-completeness`, `ddd-model-presence`,
  `ddd-reference-ids`, `ddd-mapping-declarations`, `ddd-layer-structure`
  (blocking) and `ddd-design-advisories` (advisory).
- **Rust code sensors**: `ddd-rust-domain`, `ddd-rust-use-case`,
  `ddd-rust-interface-adapter` (all blocking) implementing rules (a)–(n) and the
  dependency safety net (g).
- **libraries**: `tools/ddd/lib/schema` (the canonical model loader and index),
  `tools/ddd/lib/workspace` (Cargo workspace layer resolution),
  `tools/ddd/lib/rust` (tree-sitter-rust syntax facts),
  `tools/ddd/lib/rules` (the language-neutral rule definitions and the Rust
  evaluators) and `tools/ddd/lib/runtime` (the sensor runtime contract).
- **knowledge**: eight documents under `knowledge/aidlc-{shared,architect-agent,
  developer-agent,aws-platform-agent}/`.
- **vendored assets**: `web-tree-sitter@0.25.10` (MIT) and the
  `tree-sitter-rust` WASM (The Unlicense, ABI 14), with a NOTICE describing
  provenance.

### Notes

- The plugin composes cleanly (`aidlc-plugin-test --install`, claude): 0 drops,
  the stage on the graph, and an idempotent second compose.
- The design contributions deliberately bind sensors and instructions without
  adding a `produces` artifact, because a contributed artifact is applicable to
  every unit kind and would make a core stage with a kind-pruned
  `review_artifact` fail its schema check.

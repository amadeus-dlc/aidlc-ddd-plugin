# Changelog

English | [Japanese](CHANGELOG.ja.md)

All notable changes to the ddd plugin are recorded here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased — Installation and updates

- Use the standard compose hook and include binary payloads and contributions in change detection.
- Compose and verify in a candidate tree, then publish ownership-checked changes.
- Automate fresh-install, update, dry-run, and failure-protection checks.
- Align installer targets with Claude/Codex and use English package descriptions.

## Unreleased — Sensor contract coverage

- Map positive, negative, and boundary evidence per sensor/rule and generate English/Japanese reports.
- Add dependency directions, Cargo-only edges, external I/O, every reserved name, invalid models, and heading compatibility cases.
- Classify malformed reference IDs as malformed.
- Verify sensor audit records, findings, and blocking/advisory behavior through normal admission.
- Include contract coverage and heading tests in test:sandbox.

## Unreleased — Documentation languages (2026-09-13)

- Standardize knowledge, sensors, stages, and contributions on English.
- Provide full English .md and Japanese .ja.md reader documentation. Keep aidlc/ records Japanese.
- Use English declaration section markers while preserving compatibility with existing Japanese markers; reject duplicate sections across languages.

## Unreleased — T-07 packaging (2026-09-13)

- Add ubiquitous-language naming and technical-classification prohibitions to shared knowledge and design/generation instructions.
- Require domain_packages in aggregate mappings and check terms, model references, and placement rationale.
- Follow affected domain crates' modules, including empty/inline modules and path attributes, to match declarations and actual layout.
- Add Claude/Codex normal approval tests. Document migration and limits in the [contract](docs/users/domain-packaging-design.md).

## Unreleased — T-02 Rust evaluation (2026-09-13)

- Distinguish aggregates from value objects and concrete use cases from ports using explicit types; resolve getter-name collisions.
- Collect cross-file and trait impls and report mutation-method locations.
- Add replay_methods contracts for explicit method and event matching.
- Document type-matching limits in notes and the [evaluation contract](docs/users/rust-sensor-contract.md), without modifying framework distributions.

## Unreleased — T-01 normal approval integration (2026-09-13)

- Align canonical models with standard artifact names and read labelled YAML blocks.
- Move added declarations into required sections of existing review artifacts; reject missing declarations at approval admission.
- Add Claude/Codex integration tests; reproduce and document the standalone framework gap separately.

## Unreleased — Documentation cleanup (2026-09-13)

- Separate conventions, measurements, and remaining work; add the [document index](docs/README.md).
- Record the policy excluding Kimi/opencode. Remaining distribution-route cleanup belongs to T-04.
- Correct failure/re-execution/event/RMU explanations and knowledge coverage claims.
- The 0.1.0 section below preserves implementation history. In particular, removing artifact registration did not establish current approval integration; see the [assessment](docs/developers/current-state-assessment.md).

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
- Only the `domain-design` contribution adds a `produces` artifact
  (`ddd-aggregate-mapping`). The `functional-design`, `infrastructure-design` and
  `code-generation` contributions deliberately bind sensors and instructions
  without adding one, because a contributed artifact is applicable to every unit
  kind and would make a core stage with a kind-pruned `review_artifact` fail its
  schema check.

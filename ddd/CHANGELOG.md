# Changelog

English | [Japanese](CHANGELOG.ja.md)

All notable changes to the ddd plugin are recorded here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased — The gates read the language-neutral artifacts

- Read `schema_version: 2` of the canonical model, the implementation mapping and the layer declaration, and `schema_version = 2` of the project settings, on every path a gate takes. **A record still in the format it has to be migrated from is now refused**: the model as `model-completeness.schema`, `model-presence.invalid`, `model.invalid`, `mapping-declarations.model`, `reference-ids.model`, `layer-structure.model` or `domain-packaging.reference`; the mapping as `mapping-declarations.document`, `reference-ids.document` or `domain-packaging.declaration`; the declaration as `layer-structure.item` or `design-advisories.document`; the settings as `module-layout.configuration`. Each refusal names the command that converts it.
- Add `ddd-artifact-set.ts migrate --project <root> --record <record> [--supplement <path>] [--apply]`, which converts a project's settings and one record's model, mapping and layer declarations together, checks the mapping and the declarations against the model it is about to write, writes nothing unless the whole set is ready, and reports what was written, what failed, what is left and how to finish when a write fails partway. See [artifact set migration](docs/users/artifact-migration.md).
- Read the layer declaration a workflow without Units writes straight under the stage, at `<record>/construction/infrastructure-design/cicd-pipeline.md`, as well as the one a Unit writes. A `cicd-pipeline.md` anywhere else is still not a declaration.
- Hand the Rust source sensors the Rust entries of the mapping, projected onto the crate name and module path they compare; an aggregate or package placed in another language does not reach them. The replay, aggregate-binding and package checks keep their existing scope.
- **Report the design gates' findings under fewer rule ids.** What the mapping reader refuses is reported as `mapping-declarations.document` (or `mapping-declarations.model`, or `domain-packaging.technical-name`) with the reader's own rule id at the front of the message, so `mapping-declarations.duplicate`, `mapping-declarations.axes`, `mapping-declarations.aggregate-unmapped`, `reference-ids.missing` and the `domain-packaging.declaration`, `domain-packaging.duplicate` and `domain-packaging.coverage` rules of `ddd-mapping-declarations` no longer exist. `domain-packaging.duplicate` is also removed from `ddd-rust-domain`.
- **Stop checking repository naming on the layer declaration**: `layer-structure.m-name` and `layer-structure.m-media` are removed. A declaration names no language, so a spelling convention of one language is not a rule about it; repository naming in Rust source is still checked by the `m` rule of `ddd-rust-interface-adapter`.
- **Block a functional design beside a mapping that cannot be read.** A mapping that is present but not in the current format is reported as `mapping-declarations.document` against the mapping, instead of leaving the Process Manager requirement unevaluated. An absent mapping still only notes that it is absent.
- **Stop reading the mapping in `ddd-layer-structure`.** Where an aggregate's code lives does not decide whether its context has to rebuild it, so every aggregate of the context needs a restoration path.
- Decide the Rust module layout check from the languages the settings name: a project that names no Rust and holds no Cargo manifest and no `.rs` file has nothing to check, and one that names no Rust but holds either is reported as `module-layout.configuration`.
- Move the generation instructions, the sensor manifests, the knowledge and the fixtures to the same formats, and state that Rust is the only language generated and inspected today. The use-case declarations of `functional-spec.md` stay on version 1: they name nothing a language spells.
- A model whose factory rules still have no business errors reports them as `missing-information` and is not converted; supply them and re-run. Until they are supplied the mapping is checked against the model without them, so a mapping that reported `candidate` in that run can report error cases of its own as `missing-information` in the re-run that follows the model being completed. A migrated record is read by the gates that refused it.

## Unreleased — Language-neutral layer declaration

- Add `schema_version: 2` of the `## DDD Layer Structure` section of `cicd-pipeline.md`: the three crate lists become one `packages` list whose entries carry a `role` of `command`, `query` or `rmu`, `crate_dependencies` becomes `dependencies` over the same package identities, and each package is identified by the language that spells it together with its name. The context reference, the cqrs flag, the ports, the repositories, the restoration paths and the persistence backend are unchanged.
- Add a reader for one declaration document that refuses unknown keys including every crate-fixed one, a package named without its language, a name the language does not accept, broken or foreign model references, duplicate structures, packages, dependency rows, repositories and restoration paths, and a dependency row for a package the context never declares, while a dependency on a package outside the context is kept as written. It reads only a `schema_version: 2` canonical model and never reads a version 1 declaration as the new format.
- Add a structural inspection that can be run on its own against a declaration that loaded: required items, a dependency row per package, a query side for a cqrs context, the command/query boundary with the read-model updater exempt, a query-side dependency on a domain-layer package name in either language's spelling, and a full-constructor restoration path per aggregate.
- Add `ddd-layer-declaration.ts migrate --declaration <path> [--apply]`, which converts the one YAML block below the section marker, keeps every crate name, dependency edge, port, repository, restoration path and persistence backend in the language it is written in, leaves the pipeline prose and the CI configuration fence beside it byte-for-byte alone, and reports the values the crate format supplied on its own — `cqrs`, a port's kind and verbs, a repository's io unit, verbs and store semantics, and a restoration route — as `missing-information` until the document states them.
- Left the production sensors and the generation instructions on version 1 at this step, so a migrated declaration was reported as `layer-structure.item`; they read version 2 as of _The gates read the language-neutral artifacts_ above.
- Leave the use-case declarations of `functional-spec.md` as they are: they carry no name a language spells, so there is no format version to convert them to.
- Document the format, the checks, the inspection, the command and the current scope in [layer declaration](docs/users/layer-declaration.md).

## Unreleased — Reserved package names are compared as whole names

- Compare a crate or package name against the reserved technical classifications as one whole name instead of word by word, the way a module segment is already compared. **A name the gate used to refuse now loads**: a business name that merely ends in a reserved word, such as `invoice-entities` or `invoice_entities`, is accepted by `domain-packaging.technical-name` and by the `schema_version: 2` mapping reader alike.
- `value-objects`, `ValueObjects`, `@acme/value-objects-domain`, `entities-domain` and a package named only `domain` stay refused, because there the name itself is the classification.
- This is the behaviour [domain packaging](docs/users/domain-packaging-design.md) has always documented — substrings and single words inside a name do not trigger a violation — which the crate and package check contradicted.

## Unreleased — Language-neutral implementation mapping

- Add `schema_version: 2` of `ddd-aggregate-mapping.md`: business ids, vocabulary, the execution model and persistence stay at the top of each entry, and the language, package, module path, type, ports and repository move under `code`. Each aggregate also binds its commands and factory rules to a method and error type, and each business error to a case.
- Add a reader for one mapping document that refuses unknown keys, compiler ids and source positions, names a language does not accept, broken or foreign model references, missing and duplicate package, type, operation and error mappings, and technical classifications as business package names in Rust and TypeScript alike. It reads only a `schema_version: 2` canonical model and never reads a version 1 mapping as the new format.
- Add `ddd-aggregate-mapping.ts migrate --mapping <path> [--supplement <path>] [--apply]`, which converts one crate/module mapping, keeps every crate, module spelling, business term, replay method, execution model and persistence method and the language they are written in, and reports the type, operation and error-case names it has no source for as `missing-information` until a supplement file names them.
- Left the production sensors and the generation instructions on version 1 at this step, so a migrated mapping was reported as `mapping-declarations.document`; they read version 2 as of _The gates read the language-neutral artifacts_ above.
- Document the format, the checks, the command and the current scope in [implementation mapping](docs/users/implementation-mapping.md).

## Unreleased — Operation-owned errors in the canonical model

- Add `schema_version: 2` of `ddd-domain-model-yaml.md`: a DomainError names its owner with `operation`, and a FactoryRule declares its own non-empty `domain_errors`.
- Check that a declared owner is the containing operation, for commands and factory rules alike, and register factory errors in the element index so duplicate and broken references are caught there too. **Two of the new ownership checks also apply to `schema_version: 1`**: a legacy model now fails to load where it used to pass when a DomainError's `command` key names an operation other than the command containing it (repair: name the containing command), or when a factory rule's id carries an aggregate name other than that of its containing aggregate (repair: rename the id to `factory.<aggregate>.<operation>`).
- Choose the format at the reading entry point rather than from the document. At this step that kept the production sensors on version 1, refusing a migrated document; the same entry points now name version 2, as of _The gates read the language-neutral artifacts_ above.
- Add `ddd-domain-model.ts migrate --model <path> [--apply]`, which converts one model artifact, keeps every business id, reference, condition text and its language, and reports a factory rule's absent errors as `missing-information` instead of inventing them.
- Document the format, the checks, the command and the current scope in [operation-owned errors](docs/users/domain-model-operation-errors.md).

## Unreleased — Getter exception for repository arguments

- Fix false positives when use cases forward getter results to repository arguments, including through immutable local bindings.
- Resolve port types and declared methods; continue rejecting business decisions, calculations, transformations, and other consumers.
- Align generation knowledge and bilingual design documents with the exception and its coverage, and add regression cases.

## Unreleased — Rust module layout

- Require one project-root `.ddd.toml` policy: `file` or `mod-rs`; reject mixed or missing configuration.
- Add an independent blocking sensor at code-generation, build-and-test, and ci-pipeline, and a CI command that exits nonzero on failure or zero inspected packages.
- Inspect owned Cargo packages and targets without relying on source claims or domain models; unify logical module resolution across inspected layers.
- Document configuration, migration, and limits in the [layout contract](docs/users/rust-module-layout.md).

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

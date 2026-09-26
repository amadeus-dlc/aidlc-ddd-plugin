# Changelog

English | [Japanese](CHANGELOG.ja.md)

All notable changes to the ddd plugin are recorded here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased — The gates read the language-neutral artifacts

- **Record which aggregate execution model and persistence strategy combinations Rust is actually verified on.** Surveyed which `programming_model` × `persistence_method` × module-layout combinations the existing tests, golden cases and verification scenarios decide, and recorded each one with references to the cases and tests that carry it in [the execution model and persistence verification](docs/developers/rust-execution-persistence-verification.md) ([Japanese](docs/developers/rust-execution-persistence-verification.ja.md)) and its [execution evidence](docs/developers/evidence/rust-execution-persistence-verification.json). No golden case definition carries a `.ddd.toml` and an aggregate mapping at once, so coverage of the two module layouts splits across four paths — layout inspection, the Rust source rules, resolution, and the gate integration that supplies a `.ddd.toml` around four packaging cases — and the record keeps those four apart. The three untested combinations — `class` × `event-sourcing` × `mod-rs`, `actor` × either × the Rust source layer, and `actor` × `event-sourcing` — are recorded as unverified with their reasons and are presented as covered nowhere. No rule, judgement or golden expectation changed.
- **Remove the tree-sitter assets, and decide every shipped Rust sensor on the native extractor alone.** `lib/rust/analyzer.ts`, the vendored `web-tree-sitter` build under `lib/rust/vendor/` and the `wasm/tree-sitter-rust.wasm` grammar are deleted, so no shipped sensor, no CI entry and no built distribution carries them; `dist/<harness>/tools/` holds no `*.wasm` at all. The two answers the parser still gave are now answered without it: `InspectionTarget` carries the claimed file's path where it carried a syntax tree, and a claimed file the inspection cannot read stays a file the rules have to decide rather than one dropped from the inspection, so the native extractor is required on exactly the condition it was before. Every catalogued input keeps the `(rule_id, file)` conclusion it had — no expectation under `tests/golden/**` changed, and all 387 distribution cases still pass per harness. The third-party crates the shipped extractor links — its normal dependency graph from the committed `Cargo.lock`, 19 crates, each with the license expression `cargo metadata` reports — are listed in [tools/ddd/bin/NOTICE.md](tools/ddd/bin/NOTICE.md), which replaces the vendored NOTICE the removed assets carried. It also names the two resolved crates that are not linked (the `serde_derive` procedural macro and the `version_check` build-script dependency).
- **The `analyzer.macro-opaque` notes are gone, and nothing replaces them.** No macro shape produces one any more. A macro that can hide a module declaration is still refused as `domain-packaging.unresolved` on that declaration, and an item macro or a `cfg`/`cfg_attr` still carries a `domain-facts.unresolved` note, so the reports that disappear are those for an expression-position macro and for a non-built-in attribute macro — two shapes the native side records nothing for and which a verdict therefore now says nothing about. The built-in attributes (`derive`, `allow`, `cfg`, `cfg_attr`, `test`) never produced an `analyzer.macro-opaque` note, so none of them loses anything here; what `cfg` and `cfg_attr` do produce is the `domain-facts.unresolved` note above, which is unchanged.
- **The last condition that stopped a gate before it read the claims is gone.** The tree-sitter guard fired ahead of context assembly, so an installation whose parser could not initialize exited 127 on every run — including one that claims no Rust source and so has nothing to decide. There is no such runtime to initialize any more. The native extractor is still required exactly where those rules have a file to decide on, so a run that claims no Rust source reports its verdict with the note `no rust sources claimed`, as it did on a working installation.
- Record what removing the assets measured and what it left open. `plugin installation and gate integration` leaves the spike report's `unverified` list, and `full sensor parity` is narrowed to `sensor answers for inputs the golden catalog does not carry`; `Linux/Windows/x86_64`, `WASM distribution` and the four resolution and inference items stay, because nothing measured them. [The evidence](docs/developers/evidence/rust-syn-spike.json) is regenerated without the `tree_sitter_fields` and `getter_comparison` columns the removed extractor filled. Comparing an answer against the tree-sitter grammar is no longer possible from this repository, so [the spike report](docs/developers/rust-syn-spike.md) and [completion tasks](docs/developers/completion-tasks.md) record the questions that leaves open rather than closing them.
- **Verify the operation error-set comparison in both Rust module layouts.** The Rust verification path fixed the module layout at `file` and looked for the mapped module as a leaf file beside the library crate root, so nothing it produced could be read under `mod-rs`. It now places the mapped module where the layout its package is written in puts it — `<module>.rs` under `file`, `<module>/mod.rs` under `mod-rs` — and names that layout in the inspection's project settings. A package the scenario records no layout for is refused with its reason instead of being inspected under a guessed one. The declaration path is still `[...module, type]` in either layout, so what the comparator matches it against does not move. The scenario workspace gained `billing-domain-mod-rs`, written in `mod-rs`, beside the `file` package every existing scenario is still read from; both are judged the same, and [the evidence](docs/developers/evidence/operation-error-set.json) records that under `rust_module_layouts`. The Rust `mod-rs` layout is no longer listed as unverified there; the TypeScript `index-file` layout still is.
- **Decide every rule `ddd-rust-use-case` and `ddd-rust-interface-adapter` report on the native extractor.** The last four enumerations that still walked tree-sitter trees now read the same `domain-facts/1` batch every other Rust rule reads: the execute-argument rule `h` reads the native `impls` and a new `functions`, the query-side reference rule `l` reads the native `uses`, the repository-naming rule `m` reads the native `traits` and `types`, and the restoration-bypass rule `n` reads the native `constructions`. Every shipped Rust source sensor but the module-layout inspection is now on the shared contract. Every catalogued input keeps the `(rule_id, file)` conclusion it had, and each `m` finding keeps the line it carried. For inputs the catalog does not carry, a conclusion moves: nothing written in the default value of a trait associated constant reaches the declaration walk, so a construction there is no longer reported by `n`, and an item a block there declares is no longer reported by `m`, `l` or `h` — an input that reported a finding at that position now passes. What a trait method that writes a body holds, and what an `impl` block's associated constant holds, are each still recorded and still reported, as are the public members rule `a` reads. The trait associated constant is not the only position that walk does not reach; the further ones confirmed so far are recorded as positions it does not reach, without a claim about what the enumerations they replaced reported at them, in [which decisions moved](docs/developers/rust-syn-spike.md) and in [completion tasks](docs/developers/completion-tasks.md) for the parent issue. The protocol is `protocol_version` 6: it gained the functions a file declares outside an impl block — reported at the top level, inside an inline module, inside another function's body, and as a trait method that writes a body, with a body-less trait method and an impl block's own methods left to the declarations that already carry them — and a `line` on every type and trait declaration, each opening at its first keyword rather than at the attributes above it. Neither is read as optional: an answer missing one is refused rather than read as declaring nothing, and an installation still answering protocol 5 is classified `native-extractor:protocol-mismatch` and exits 127 with no verdict.
- **Decide every rule `ddd-rust-domain` reports on the native extractor.** The unreported-mutation rule `b`, the incomplete-construction rule `c`, the dependency-direction rule `g` and the `domain-packaging.*` rules now read the same `domain-facts/1` batch that rules `a` and `d` already read, together with the declaration index, type resolution, dependency edges, call facts and package/module resolution behind them. The `moduleLayout()` module layout and the `value-flow.ts` syntax walk that backed them are removed, so the forwarded-argument repository exception is proven from the extractor's own `forwarded_argument_calls`. Every catalogued input keeps the `(rule_id, file)` conclusion it had; `#[path]` that names exactly one existing `.rs` file is still followed, and `cfg_attr`-conditional, multiple, malformed and out-of-crate forms, and item macros, are still reported as `domain-packaging.unresolved`. **A `mod` declaration whose source file is not named `*.rs` — a `#[path]` naming such a file, or a symbolic link resolving to one — is now reported on that declaration** instead of being opened: the batch is gathered by the `.rs` name of the file the walk reads, so any other name was never asked about. `ddd-rust-domain` reports `domain-packaging.unresolved` where it used to read the file as Rust and give it a module. The protocol is `protocol_version` 5.
- **Widen the files a Rust gate refuses to decide without.** Those rules now resolve types across the whole program, so the files they are decided from are the claimed files plus every source of every *program-layer* crate, not only the domain-layer ones. A run whose use-case or interface-adapter crate holds a source the extractor cannot read now exits 127 with the extractor's reason instead of reporting a verdict built from it, and `ddd-rust-use-case` and `ddd-rust-interface-adapter` stop on the same condition because they share that decision base. No input gains or loses a finding.
- **Read the module walk's declarations from the native extractor too.** `ddd-rust-module-layout` and the `ddd-check-rust-module-layout` CI entry resolve modules from the extractor's per-file declarations, so both now require it. When it cannot be launched, or its answer cannot be read, the gate exits 127 with no verdict and the CI entry exits 1 with `{"pass": false, "reason": …}` and none of the counted results a finished walk reports. With a usable extractor every catalogued input keeps its verdict, and three conclusions move: a `mod` declaration or Cargo target root whose source file is inside a directory the project scan excludes (hidden entries, `aidlc`, `node_modules`, `vendor`, `target`, `dist`) — named there directly, or reached there through a symbolic link — is now reported as `module-layout.unresolved` on the declaration — the declaring file's line, or the crate's `Cargo.toml` — instead of being followed into that excluded tree and judged there, so a project that placed such a file conventionally and passed now fails; the file is never inspected and was never asked about, and judging the placement of a file the same scan excludes was a contradiction; a module file whose declarations could not be read keeps its `module-layout.unresolved` and no longer also gets the `module-layout.violation` a `mod-rs` project reported beside it, because whether it declares a child is exactly what could not be read; and a `mod` declaration naming a file the discovery does not collect — one not named `*.rs` — is reported as `module-layout.unresolved` on the declaration instead of `module-layout.violation` on that file, for the same reason the excluded directories are. On any platform the distribution does not cover, run them elsewhere; see [native extractor distribution](docs/developers/native-extractor-distribution.md).
- **Decide the public-member rule `a` and the getter rule `d` on the native extractor.** The two gates that declare them, `ddd-rust-domain` and `ddd-rust-use-case`, read a new `domain-facts/1` protocol (`--domain-facts-version`, `protocol_version` 5) over one batch covering every source of the inspected program. **A public tuple member is now reported**: `pub struct Invoice(pub u64);` and its `pub(crate)`, `pub(super)` and `pub(in ...)` forms report rule `a` under the member's ordinal, on the line its visibility opens, and a private member beside it is not reported. **A getter whose body is an explicit `return self.amount;` is now a getter for rule `d`**, reported at its call. Raw identifiers keep their `r#` and non-ASCII names keep their spelling, so `r#total` is never absorbed into another type's `total`. Named fields, tail-expression getters, trait implementations and enum variants keep the verdicts they had.
- **Stop a gate that cannot read those facts instead of passing it.** Each gate classifies the extractor's one launch before it evaluates, and every condition that leaves a file without facts — the six launch conditions, a run that did not finish, an answer outside the protocol, a batch over the request limit — exits 127 with no verdict. A file the parser rejected carries no declaration record at all, and on a run whose claimed files give these rules something to decide, a rejected file among the ones they are decided from stops the gate under the same exit with the extractor's own reason, rather than being reported as declaring nothing. A run that claims no such file evaluates none of them and reports its verdict as before.
- Keep on tree-sitter what still comes from it: which claimed files are inspected at all, their macro-opaque regions, and the declaration enumeration of `h`, `l`, `m` and `n`, which only `ddd-rust-use-case` and `ddd-rust-interface-adapter` report and which resolve their candidates through the native program. Of the six rules those two gates own, `i` and `k` moved with the shared base and now decide on the native call and `use` facts; their conclusions are unchanged. Item macros and `cfg`/`cfg_attr` are reported as `domain-packaging.unresolved` findings where they hide a module declaration and as `domain-facts.unresolved` notes otherwise. See [the remaining boundary](docs/developers/rust-syn-spike.md).
- Add `bun run test:domain-facts:native`, which runs the extractor's own unit tests for this protocol inside `bun run check`.
- **Launch the native extractor from one product path, and ship it.** Both language entries now resolve `tools/ddd/bin/<platform-key>/ddd-rust-syn-spike` through one shared module instead of pointing at two directories under `experiments/rust-syn/target/`. The build and `tools/ddd/bin/manifest.json` travel with the rest of the `tools/` payload, so a fresh installation and an `--update` both place an extractor the destination can launch. `bun run prepare:native` replaces `prepare:state-exposure` and `prepare:error-contract`: it builds once, installs at that path, probes every protocol and records the platform. This distribution covers `darwin-arm64`; every other environment is out of scope and is not presented as covered. See [native extractor distribution](docs/developers/native-extractor-distribution.md).
- **Distinguish every way the native extractor can fail to launch, and approve none of them.** An uncovered platform, an absent file, a file without an execute bit, bytes that do not match the recorded digest, a probe that never completed, and an answer for another protocol are classified once in a fixed order and reported under their own subjects — `native-extractor:unsupported-platform`, `:binary-missing`, `:binary-not-executable`, `:checksum-mismatch`, `:probe-failed` and `:protocol-mismatch`. A probe that never completed keeps the reason code the observation reported — `tool-unavailable`, `execution-failed`, `timeout`, `output-limit` or `resource-limit` — rather than being reported as a disagreement about the protocol. Each leaves the execution state short of `completed`, so the inspection is unresolved rather than passing. The digest is checked before the extractor is launched.
- **A gate no longer needs a Rust toolchain to run the extractor.** Resolving, verifying and launching the shipped build uses neither `rustc` nor `cargo`; the target triple the Rust operation-error-set path hands to the Cargo condition now comes from the distribution manifest. `cargo metadata --frozen` remains, because it resolves the build condition of the *inspected* project.
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

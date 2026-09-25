# Remaining DDD plugin work and completion criteria

English | [Japanese](completion-tasks.ja.md)

Updated: 2026-09-13. Track remaining work by T identifier, based on the [implementation assessment](current-state-assessment.md) and supported-environment policy.

Documentation cleanup and T-01 normal approval integration are implemented. T-02 Rust evaluation, T-07 domain packaging, and T-08 Rust module layout enforcement are also implemented. The framework standalone completion gap, T-03, model execution in T-05, and final T-06 reconciliation remain.

The [agreed shared-language design](language-independent-design.md) adds T-09–T-11. These are planned work, not completed features.

## Completion scope

Deliver shared DDD contracts with Rust improvements and artifact migration first, then TypeScript support, on Claude Code and Codex. Kimi and opencode are excluded, and custom builds for them are no longer maintained. The user intends to access desired models through the Ollama Cloud Claude Code bridge; installing that bridge is outside this plugin's scope. Other harnesses are not completion targets.

In addition to static checks and existing tests, completion requires:

- Missing or invalid required artifacts must block normal approval and standalone-stage completion.
- Valid value-object arguments and port calls must pass; undeclared cross-file mutations must be detected.
- Verify builds, compose, distribution checks, fresh installation, and updates for Claude/Codex.
- Align knowledge, design, generation instructions, and measurements about what checks guarantee.

## T-01: Connect artifacts to normal approval and standalone completion

Status: plugin-side normal approval integration is implemented. T-01 remains incomplete because the standard AI-DLC standalone completion guard is insufficient. Priority: highest. Evidence: F-01/F-02.

Canonical model filenames now match standard Markdown artifact names. Use-case and layer declarations are required sections of existing review artifacts and inherit their Unit kinds. See the [artifact contract](../users/artifact-contract.md) for format, migration, and verification scope.

Targets: stages, contributions, sensors, model-path resolution, and integration tests. Prefer mechanisms supported by standard AI-DLC extension contracts; do not assume ad hoc core filename patches.

Completion: composed graph, actual files, and matches agree. Verify missing, invalid, and valid cases through approval processing and apply equivalent checks to standalone execution. Verify Unit-kind exclusions. Direct sensor execution alone is insufficient.

Remaining: the standard `report --single` shared path must verify general artifacts and sensors, then be retested. The plugin alone cannot guarantee checks are never skipped.

Dependency: a standard AI-DLC fix for standalone completion.

## T-02: Correct Rust sensor false positives and misses

Status: implemented. F-03–F-06 and getter/alias/trait regressions are addressed. See the [evaluation contract and limits](../users/rust-sensor-contract.md).

| Fix | Required regression |
|---|---|
| h: Distinguish aggregates and value objects | Value-object arguments pass; aggregate arguments fail. |
| i: Distinguish use cases and ports | Port execute passes; calls to another use case fail. |
| b: Collect types and impls across files | Detect undeclared mutations across files. |
| Limit replay exceptions | Valid replay passes; arbitrary assignment renamed apply fails. |

Investigate getter-name collisions, aliases and qualified types, trait mutations, and value-object mutability; classify each as a check or an explicit limitation. Do not issue blocking findings from guesses.

Completion: reproductions and valid cases pass against source and distributions, and deterministic syntax coverage is documented. Universal semantic proof is not required.

Explicit replay is implemented through aggregate mapping replay_methods. Body semantics, return types, and recovery contracts remain T-03 work.

## T-03: Resolve remaining implementation contracts and align generation

Status: the shared method-error and generation-error policy is agreed; remaining decisions and implementation are pending. Priority: high.

Use the revised [domain](domain-layer-design.md), [use-case](use-case-layer-design.md), and [Interface Adapter](interface-adapter-layer-design.md) conventions as design inputs.

Replay declaration format was decided in T-02. Remaining decisions cover return values for first success, duplicate success, and rejection; multiple events; mixed actor/class recovery declarations; and missing-mapping behavior. Decide whether retry windows and RMU ordering belong in structured data or prose review.

Revisit contribution instructions equating class with re-execution only and all storage with upsert. Coordinate any loader, JSON Schema, generation, and sensor changes. Canonical factory error sets and method-specific return-error checks are now required by the shared design and T-09/T-10. Broader FactoryRule semantic proof and exhaustive interior-mutability detection are separate work; retain review and generated-code behavior tests.

Completion: every unresolved item has a decision and scope, implementation/declaration/instruction differences are resolved, and concrete examples/tests explain failure, retry, and duplicate outcomes.

Dependency: coordinate with T-01 artifact contracts.

## T-04: Supported-harness build and verification paths

Status: complete. Build, installation, and verification use the current Claude/Codex toolchain.

`framework-compatibility.test.ts` verifies compose, graph compilation, and repeat-compose idempotency for both harnesses. The T-04 checkpoint recorded 726 passing tests, three skips, and zero failures. Skips are the optional standalone-guard reproduction and two opt-in network installations.

Actual rule delivery to a model remains T-05 work.

## T-05: Verify installation, updates, and actual usage

Status: mechanical installation/update CLI verification is complete. Actual model-driven stage execution and rule delivery remain unverified. Priority: high.

Automated Claude/Codex checks cover fresh/repeat installs, payload and contribution updates, dry-run, failure protection, ownership, removed payload files, and source selectors. All 45 local tests and two real GitHub main installations passed. The [verification contract](installation-verification.md) records scope and evidence.

Remaining: verify that current AI-DLC delivers DDD rules to the responsible model and that it consumes upstream designs for generation and review. Sensor, compose, and CLI success do not establish model execution.

Completion: record versions, results, and unverified scope for the usage path including actual model execution.

Dependency: T-01–T-04.

## T-06: Reconcile final documentation and knowledge with measurements

Status: old assumptions, misconceptions, and duplication have been addressed; final reconciliation after implementation remains incomplete.

Recheck design versus implementation, coverage, example evidence, and supported environments. A passing case that lacks the target structure does not demonstrate its validity. Align READMEs, knowledge, generation instructions, and plugin descriptions. Runtime instructions are English-only; reader docs have full English .md and Japanese .ja.md editions. aidlc/ records remain Japanese.

Completion: documents agree with the shared decisions and the measurements for tasks included in the release, with valid links and usable procedures. Preserve historical failures; never rewrite them as successes.

Dependency: the tasks included in each release. First-release reconciliation includes T-09/T-10; following-release reconciliation includes T-11.

## T-07: Package the domain by business vocabulary

Status: implemented. The [packaging contract](../users/domain-packaging-design.md) describes declarations, scope, and semantic review.

Avoid technical classifications such as aggregate/, impl/, vo/, and entities/ and connect package names to ubiquitous language. Share principles through knowledge, declare vocabulary/layout in domain-design, and inspect the implementation in code-generation. Keep physical placement outside the canonical model.

Added domain_packages to the registered aggregate mapping with required terms, model references, and rationale. Check reserved names, root/ancestor coverage, undeclared actual modules, and unresolved analysis. Future packages may be declared before implementation. All 55 direct regressions and eight Claude/Codex normal-approval cases passed.

Completion: valid vocabulary-based examples pass; technical classifications, missing declarations, broken references, and layout mismatches are detected. Distinguish inline modules from externally owned references, and leave semantic naming judgments to review. Include normal-approval and distribution tests.

Dependency: reuse T-02's module index; no third-party framework modification is assumed.

## T-08: Enforce one Rust module file layout

Status: implemented. The [module layout contract](../users/rust-module-layout.md) defines the project-root configuration, file/mod-rs policies, inspection scope, and migration steps.

Require one explicit `.ddd.toml` policy across owned Cargo packages and targets. Reject missing configuration, mixed mode, nested overrides, layout violations, and unresolved or unregistered source. Share declaration-based module resolution across inspected layers. Keep Cargo edition separate from the layout policy.

The dedicated sensor is registered at code-generation, build-and-test, and ci-pipeline admission. The CI entry point uses the same checker and exits nonzero on failure or zero inspected packages. Contributions instruct generated pipelines to make it a required check and standalone stages to run it directly. Installing the plugin does not configure an external CI service or fix the standard standalone guard.

Verification covers both policies, source-claim/model independence, tests and other layers, renames/deletion remnants, explicit paths, malformed configuration, Cargo targets, direct sensor and CLI results, both distributions, and actual normal admission on both harnesses. See the [coverage matrix](sensor-coverage.md) and [verification record](evidence/module-layout-verification.json).

## T-09: Define the common contracts and migrate artifacts

Status: agreed specification; implementation pending. Complete before the first release. See the [shared design](language-independent-design.md).

T-09 is tracked by [parent Issue #34](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/34). Do not start the parent as one intent. Run each child as a separate `plugin-dev` intent, with its own bounded outcome, exclusions, tests, and documentation. The parent retains the full contract and prerequisite relationships.

| Child | Independently finishable outcome | Prerequisites |
|---|---|---|
| [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38) | Shared state-exposure check in Rust and TypeScript | None |
| [#39](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/39) | Project configuration and Rust configuration migration | [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38) |
| [#40](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/40) | Bounded Rust return/error reference resolution | [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38), [#39](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/39) |
| [#41](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/41) | TypeScript Compiler API return/error reference resolution | [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38), [#39](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/39) |
| [#42](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/42) | Canonical operation/factory errors and model migration | None |
| [#43](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/43) | Shared aggregate/package/operation mappings and migration | [#38](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/38), [#42](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/42) |
| [#44](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/44) | Layer declaration migration and use-case declaration compatibility | [#43](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/43) |
| [#45](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/45) | Shared closed error-set comparison | [#40](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/40), [#41](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/41), [#42](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/42), [#43](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/43) |
| [#46](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/46) | Artifact activation, coordinated migration, and existing-path verification | [#39](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/39), [#42](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/42), [#43](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/43), [#44](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/44), [#45](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/45) |

Start with #38: one state-exposure rule, both languages, and pass/violation/unresolved outcomes. Keep migration, package-wide resolution, and error-set comparison out of that first intent. #42 is also independent; the table records hard prerequisites rather than requiring every row to finish in order.

Each child targets two or three implementation units, subject to a scope check before starting. New requirements are tracked explicitly in the parent instead of silently extending an active intent. Individual readers/converters remain testable before the final activation; #46 connects completed artifact work without redesigning formats or replacing production source analyzers. T-09 completion does not imply T-10/T-11 or release completion.

Define common package, type, method, error, and inspection contracts, preserving native language details in implementation mappings. Add factory error declarations and explicit error-owner consistency. Specify configuration and artifact versions, then implement an explicit migration command for existing Rust artifacts. Convert deterministic information and report missing business definitions for completion by the model owner.

Define comparison scenarios for Rust and TypeScript up front. A small TypeScript implementation using the TypeScript Compiler API must exercise the common boundary before it is treated as sufficient for the first release. Use the project configuration and AST/type information, keeping compiler-specific objects out of the shared contract. Keep the canonical model, loader/schema, generation instructions, and migrated fixtures aligned.

Implement the [inspection contract design](inspection-contract-design.md) with a limited Rust + syn adapter proof as well. Verify snapshot-bound identities, resolved/absent/unresolved facts, complete/partial sets, per-rule outcomes, and operation/error ownership against equivalent TypeScript cases. The parser experiment alone does not demonstrate the shared resolver/evaluator contract. Identify any intended-use cases requiring a deeper Rust semantic provider before declaring the first-release scope sufficient.

Completion: shared contracts are concrete, migration preserves domain identities and meaning, incomplete inputs are reported, and both languages exercise the proposed contract. This task does not mean full TypeScript sensor support is shipped.

## T-10: Bring Rust into conformance with the shared contracts

Status: agreed work; implementation pending. Depends on T-09 and coordinates with T-01/T-03/T-05/T-06. Required for the first release.

Rust + syn adoption is approved following the [experiment](rust-syn-spike.md). Implement the native Rust backend and resolution boundary described in the [inspection design](inspection-contract-design.md). T-10-01 moved the extractor onto the product path and established its distribution; T-10-02 moved rules `a` and `d` onto its facts, fixed the reproduced public tuple-field and explicit-return getter misses, and made a launch failure stop the two gates that read them; T-10-03 moved the rest of what `ddd-rust-domain` reports — `b`, `c`, `g` and `domain-packaging.*` — onto those facts along with the declaration index, type resolution, dependency edges and package/module resolution behind them, which also put the module walk and its CI entry on the extractor; T-10-04 moved the four enumerations only `ddd-rust-use-case` and `ddd-rust-interface-adapter` report — `h`, `l`, `m`, `n` — onto those facts under `protocol_version` 6, so every rule_id both gates report now decides on them and every shipped Rust source sensor but the module-layout inspection is on the shared contract; T-10-05 held the module-layout inspection and its CI entry to those facts in both project module layouts, added the crate-boundary regressions that keep an unresolvable configuration from passing — a `#[path]` that leaves the crate it is written in, and a Cargo member outside the inspected project — and took the fixed `file` layout out of the [operation error-set verification path](operation-error-set.md), which now places and inspects the mapped module in the layout its package is written in; T-10-06 removed the tree-sitter assets — `lib/rust/analyzer.ts`, the vendored `web-tree-sitter` build and the `tree-sitter-rust` grammar — so the native extractor is the only one any shipped sensor, CI entry or built distribution carries, and recorded what that measured and what it gave up. Whole-sensor parity beyond the golden catalog and supported-platform distribution remain pending; neither the experiment nor T-10-06 completes T-10.

### Carried to T-11 by T-10-06

These are consequences of removing the assets, not work T-10-06 left half-done. Each names what is now open and why it is not closed there.

| Item | What is open | Why T-10-06 does not close it |
|---|---|---|
| The `unverified` entries that stayed | `sensor answers for inputs the golden catalog does not carry`, `Cargo and cross-file resolution`, `type inference and trait solving`, `macro expansion and cfg selection`, `source edition selection`, `Linux/Windows/x86_64`, `minimum OS/Rust versions` and `WASM distribution` are still on the list in [the evidence](evidence/rust-syn-spike.json). [What this report has measured](rust-syn-spike.md#what-this-report-has-measured) records, per entry, the reason no measurement covers it. | Each needs a measurement this repository has no command for, or a platform and packaging choice that is a distribution decision rather than an asset removal. |
| The reports that disappeared with `analyzer.macro-opaque` | A verdict now says nothing about an expression-position macro (`let value = compute_amount!();`) or a non-built-in attribute macro (`#[my_attr]`). Neither can hide a module declaration, so the decision base is complete without them, but nothing records that the inspection did not read through them. Whether either should carry a note, and under which rule, is undecided. | Adding a note is a new rule, which T-10-06 was not asked for, and the shape of one has to agree with how [#80](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/80) settles attribute macros. |
| The positions the declaration walk does not reach | The positions listed under factory-method mapping below — a trait associated constant's default value, an enum variant's discriminant, an expression inside type syntax, a const generic's default value and a const generic argument in an expression path. What the tree-sitter enumerations reported at each is now **permanently unanswerable from this repository**, not pending: the only grammar that could have answered it was the vendored `tree-sitter-rust.wasm`. | Widening the walk moves the conclusions of rules `c` and `d`, which read the same batch, and comparing against the old answer is no longer possible here. Deciding each position on its own merits is the remaining work. |
| The tree-sitter descriptions in the AI-DLC workspace records | `aidlc/spaces/default/codekb/base/` still describes tree-sitter as part of the stack, in `architecture.md`, `component-inventory.md`, `dependencies.md`, `technology-stack.md`, `api-documentation.md` and `code-quality-assessment.md`. | Those are workspace analysis records rather than a shipped sensor, a CI entry, a distribution or a reader document, so they are outside the documents T-10-06 was asked to align, and refreshing all six exceeds its stated size. |
| The license inventory beyond the declared dependencies | [`bin/NOTICE.md`](../../tools/ddd/bin/NOTICE.md) records the six crates `ddd/experiments/rust-syn/Cargo.toml` declares, while `Cargo.lock` resolves 21 third-party crates. The remaining 15 — `block-buffer`, `cfg-if`, `cpufeatures`, `crypto-common`, `digest`, `generic-array`, `itoa`, `libc`, `memchr`, `serde_core`, `serde_derive`, `typenum`, `unicode-ident`, `version_check` and `zmij` — carry no attribution entry. | `Cargo.lock` holds no license field, so the expressions would have to come from another command, and which of those crates are linked into the executable rather than used only while building it is undetermined. Settling both is a license inventory rather than an asset removal, and exceeds T-10-06's stated size. |

Improve host/package separation, visibility and dependency checks, explicit publication, method-specific error-type/set validation, factory bindings, and blocking unresolved inspection. Review coverage of infrastructure, hosts, ownership isolation, and existing mutation/construction checks. Correct Rust gaps rather than treating current behavior as the final specification.

T-10-04 surveyed those five areas for gaps in what is decided today. The gaps below are recorded here rather than closed there: each one either adds or removes a finding, or connects a declaration form, a layer or another protocol that no rule reads yet, so none of them is a substitution of a decision input and none was needed for that intent's outcome.

| Area | Gap | Where | Why it is not closed in T-10-04 |
|---|---|---|---|
| Host/package separation | The placement scan recognizes only `packages` and `modules` as grouping roots, so a host under `apps/` or `workers/` is assigned no layer: one with a lib target and no layer suffix becomes `layer.unknown`. | [`workspace/resolver.ts`](../../tools/ddd/lib/workspace/resolver.ts) | Changes the layer-assignment rule itself, which is a new rule rather than a new decision input. |
| Host/package separation | The layer declaration names no host role — only `command`, `query` and `rmu` — so "a package does not depend back on its host" cannot be checked from the declaration. | [`layer-declaration/contract.ts`](../../tools/ddd/lib/layer-declaration/contract.ts), [`layer-declaration/inspection.ts`](../../tools/ddd/lib/layer-declaration/inspection.ts) | Changes the declaration format, which is a published contract. |
| Host/package separation | Hosts and infrastructure are not part of the inspected program and are not sent to the extractor; a claimed source in one is `skipped`. | [`rules/rust/program.ts`](../../tools/ddd/lib/rules/rust/program.ts), [`rules/context.ts`](../../tools/ddd/lib/rules/context.ts) | Widens what is inspected, which adds new decision subjects. |
| Visibility | The protocol carries `visibility` on named fields only — not on types, traits, methods, `use` paths, aliases or modules. | [`domain-facts/index.ts`](../../tools/ddd/lib/rust/domain-facts/index.ts) | No rule migrated in T-10-04 reads visibility, so it was not needed for any of them. |
| Visibility | `non_private_field_lines`, the only consumer of the visibility that is carried, has no reader. | [`rules/rust/symbols.ts`](../../tools/ddd/lib/rules/rust/symbols.ts), [`rules/types.ts`](../../tools/ddd/lib/rules/types.ts) | Unused before T-10-04 as well, so removing it is not a consequence of that change. |
| Explicit publication | `pub use` and `use` cannot be told apart: the visibility of an import is read only to place its line. | [`domain_facts.rs`](../../experiments/rust-syn/src/domain_facts.rs), [`domain-facts/index.ts`](../../tools/ddd/lib/rust/domain-facts/index.ts) | No rule distinguishes them today; connecting one is a new rule. |
| Explicit publication | Rule `l` matches an import by the literal text after the last `::`, so it sees a domain type only where the path ends in that name alone. A glob re-export (`use a::*`) is dropped without a note; a rename (`use a::Invoice as Bill;`) and a multi-name group (`use a::{Invoice, Ledger};`) each leave a last segment that matches nothing. A query side taking a domain type in through any of the three is not seen. | [`rules/rust/program.ts`](../../tools/ddd/lib/rules/rust/program.ts), [`rules/rust/evaluators.ts`](../../tools/ddd/lib/rules/rust/evaluators.ts) | Produces a finding that was not produced before, which is a changed conclusion rather than a changed input. |
| Method-specific error types/sets | `error-contract/1` (`protocol_version` 3) and the operation error-set comparison are connected to no sensor, and to no rule_id either gate reports. | [`operation-error-set.md`](operation-error-set.md), [`sensors/`](../../sensors) | Connecting them adds a new check. |
| Method-specific error types/sets | The mapping view the Rust rules read drops `operations`, so a declared `code.error_type` and its error set never reach a rule. | [`rules/rust/mapping.ts`](../../tools/ddd/lib/rules/rust/mapping.ts) | Same: delivering them to a rule changes what is decided. |
| Factory-method mapping | A factory's declared `code.method` does not reach rule `n`; its constructors are inferred on the Rust side alone. | [`aggregate-mapping/contract.ts`](../../tools/ddd/lib/aggregate-mapping/contract.ts), [`rules/rust/mapping.ts`](../../tools/ddd/lib/rules/rust/mapping.ts) | Binding from the declaration moves rule `n`'s conclusions. |
| Factory-method mapping | `constructors_by_type` is keyed by type name alone, so same-named types in different crates or modules share one constructor set. | [`rules/rust/symbols.ts`](../../tools/ddd/lib/rules/rust/symbols.ts) | Changes conclusions; T-10-04 left the symbol table as it was. |
| Factory-method mapping | Rule `n` drops a path-qualified construction site without a note, where `d`, `h` and `i` leave a `syntax.unresolved` one. | [`rules/rust/evaluators.ts`](../../tools/ddd/lib/rules/rust/evaluators.ts) | Adding the note changes the output; T-10-04 keeps the same construction facts. |
| Factory-method mapping | The declaration's restoration path (`layer-structure.n`) and the source-side rule `n` are not compared against each other. | [`layer-declaration/inspection.ts`](../../tools/ddd/lib/layer-declaration/inspection.ts) | A new comparison is a new rule. |
| Factory-method mapping | The declaration walk does not reach every position an item or a construction can stand in, so all four enumerations T-10-04 moved lose what stands at the ones it misses; the positions below are those confirmed so far, not a complete account. In the default value of a trait associated constant: a construction is invisible to `n`, and an item a block there declares is invisible to `m` (a `struct`), `l` (a `use`) and `h` (a free `fn`) — the tree-sitter enumerations they replaced recorded all of them there. The rest are recorded as positions the walk does not reach, not as conclusions that moved, because what the enumerations they replaced reported at them is not established from this repository: an enum variant's discriminant, where the `Item::Enum` arm passes `syn::Fields::Unit` and never reads `node.variants`; an expression written inside type syntax, such as the length in an array type `[T; expr]`, where a type a declaration carries is recorded as the text of its span; a const generic's default value, where `generics` is read once, to answer whether an alias takes parameters; and a const generic argument written in an expression path — `Wrap::<{ struct FooRepository; 1 }>::new()`, `x.get::<{ ... }>()`, `Wrap::<{ ... }> { v: 0 }` — where `Expr::Path` follows only a bare identifier, `call` reads a segment's arguments only to rule out a plain associated call, `method_call` never reads its turbofish, and `Expr::Struct` records its path as text. What a trait method that writes a body holds, and what an `impl` block's associated constant holds, are both still recorded; so are the public members rule `a` reads, which come from a separate pass. | [`domain_facts.rs`](../../experiments/rust-syn/src/domain_facts.rs) | Rules `c` and `d` read the same batch — `constructions`, `impls` and `calls` — so widening the walk moves their conclusions too, and neither is one of the four enumerations T-10-04 inherited. |

Completion: updated Rust declarations, migration, knowledge, stages, sensors, existing regression tests, and application behavior scenarios agree. Cover both module layouts and record the aggregate execution/persistence combinations actually tested. Existing standalone and model-execution gaps retain their own acceptance obligations.

## T-11: Add TypeScript against the same contracts

Status: agreed work for the following release; full implementation pending. Depends on T-09/T-10.

Use the TypeScript Compiler API for syntax, symbols, and type resolution; record the supported API version and project compatibility range. Implement package/exports and type-only dependency inspection, both domain source representations, closure/brand and # field privacy, method-specific Result errors, ownership checks, and both file layouts. Use infrastructure for Result support; library-specific neverthrow/Effect/fp-ts integration is outside scope. Verify ESM Next.js integration on server-side Node.js.

Completion: source, distribution, gate, CI, and common behavior tests cover both layouts and both representations. Each new shared requirement is also implemented and verified in Rust. Keep aggregate execution, persistence, and source expression independent; do not advertise unverified host runtimes or combinations.

## Further extensions

Plan sensor-generation templates, advanced language analysis, storage-specific sensors, and other harnesses separately. T-07 is complete. Treat T-01's remaining issue as an upstream reproduction, not a direct edit to third-party code; remaining T-03 design decisions can also proceed independently.

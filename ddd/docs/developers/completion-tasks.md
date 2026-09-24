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

Rust + syn adoption is approved following the [experiment](rust-syn-spike.md). Implement the native Rust backend and resolution boundary described in the [inspection design](inspection-contract-design.md). T-10-01 moved the extractor onto the product path and established its distribution; T-10-02 moved rules `a` and `d` onto its facts, fixed the reproduced public tuple-field and explicit-return getter misses, and made a launch failure stop the two gates that read them; T-10-03 moved the rest of what `ddd-rust-domain` reports — `b`, `c`, `g` and `domain-packaging.*` — onto those facts along with the declaration index, type resolution, dependency edges and package/module resolution behind them, which also put the module walk and its CI entry on the extractor. The use-case and interface-adapter rules (T-10-04), the module-layout inspection itself (T-10-05), the removal of the tree-sitter assets (T-10-06), whole-sensor parity, and supported-platform distribution remain pending; neither the experiment nor T-10-03 completes T-10.

Improve host/package separation, visibility and dependency checks, explicit publication, method-specific error-type/set validation, factory bindings, and blocking unresolved inspection. Review coverage of infrastructure, hosts, ownership isolation, and existing mutation/construction checks. Correct Rust gaps rather than treating current behavior as the final specification.

Completion: updated Rust declarations, migration, knowledge, stages, sensors, existing regression tests, and application behavior scenarios agree. Cover both module layouts and record the aggregate execution/persistence combinations actually tested. Existing standalone and model-execution gaps retain their own acceptance obligations.

## T-11: Add TypeScript against the same contracts

Status: agreed work for the following release; full implementation pending. Depends on T-09/T-10.

Use the TypeScript Compiler API for syntax, symbols, and type resolution; record the supported API version and project compatibility range. Implement package/exports and type-only dependency inspection, both domain source representations, closure/brand and # field privacy, method-specific Result errors, ownership checks, and both file layouts. Use infrastructure for Result support; library-specific neverthrow/Effect/fp-ts integration is outside scope. Verify ESM Next.js integration on server-side Node.js.

Completion: source, distribution, gate, CI, and common behavior tests cover both layouts and both representations. Each new shared requirement is also implemented and verified in Rust. Keep aggregate execution, persistence, and source expression independent; do not advertise unverified host runtimes or combinations.

## Further extensions

Plan sensor-generation templates, advanced language analysis, storage-specific sensors, and other harnesses separately. T-07 is complete. Treat T-01's remaining issue as an upstream reproduction, not a direct edit to third-party code; remaining T-03 design decisions can also proceed independently.

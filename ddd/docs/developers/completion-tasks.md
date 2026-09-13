# Remaining DDD plugin work and completion criteria

English | [Japanese](completion-tasks.ja.md)

Updated: 2026-09-13. Track remaining work by T identifier, based on the [implementation assessment](current-state-assessment.md) and supported-environment policy.

Documentation cleanup and T-01 normal approval integration are implemented. T-02 Rust evaluation and T-07 packaging are also implemented. The framework standalone completion gap, T-03, model execution in T-05, and final T-06 reconciliation remain.

## Completion scope

Connect Rust-oriented DDD workflow outputs and checks on Claude Code and Codex. Kimi and opencode are excluded, and custom builds for them are no longer maintained. The user intends to access desired models through the Ollama Cloud Claude Code bridge; installing that bridge is outside this plugin's scope. Other harnesses are not completion targets.

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

Status: not started. Priority: high.

Use the revised [domain](domain-layer-design.md), [use-case](use-case-layer-design.md), and [Interface Adapter](interface-adapter-layer-design.md) conventions as design inputs.

Replay declaration format was decided in T-02. Remaining decisions cover return values for first success, duplicate success, and rejection; multiple events; mixed actor/class recovery declarations; and missing-mapping behavior. Decide whether retry windows and RMU ordering belong in structured data or prose review.

Revisit contribution instructions equating class with re-execution only and all storage with upsert. Coordinate any loader, JSON Schema, generation, and sensor changes. FactoryRule semantics and exhaustive interior-mutability detection are later candidates; use review and generated-code behavior tests for the first edition.

Completion: every unresolved item has a decision and scope, implementation/declaration/instruction differences are resolved, and concrete examples/tests explain failure, retry, and duplicate outcomes.

Dependency: coordinate with T-01 artifact contracts.

## T-04: Supported-harness build and verification paths

Status: complete. Build, installation, and verification use the current Claude/Codex toolchain.

`framework-compatibility.test.ts` verifies compose, graph compilation, and repeat-compose idempotency for both harnesses. The full check passes 726 tests with three skips and zero failures. Skips are the optional standalone-guard reproduction and two opt-in network installations.

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

Completion: documents agree with T-01–T-05 measurements, with valid links and usable procedures. Preserve historical failures; never rewrite them as successes.

Dependency: T-01–T-05.

## T-07: Package the domain by business vocabulary

Status: implemented. The [packaging contract](../users/domain-packaging-design.md) describes declarations, scope, and semantic review.

Avoid technical classifications such as aggregate/, impl/, vo/, and entities/ and connect package names to ubiquitous language. Share principles through knowledge, declare vocabulary/layout in domain-design, and inspect the implementation in code-generation. Keep physical placement outside the canonical model.

Added domain_packages to the registered aggregate mapping with required terms, model references, and rationale. Check reserved names, root/ancestor coverage, undeclared actual modules, and unresolved analysis. Future packages may be declared before implementation. All 55 direct regressions and eight Claude/Codex normal-approval cases passed.

Completion: valid vocabulary-based examples pass; technical classifications, missing declarations, broken references, and layout mismatches are detected. Distinguish inline modules from externally owned references, and leave semantic naming judgments to review. Include normal-approval and distribution tests.

Dependency: reuse T-02's module index; no third-party framework modification is assumed.

## Extensions after completion

Plan a second language, sensor-generation templates, advanced Rust analysis, storage-specific sensors, and other harnesses separately. T-07 is complete. Treat T-01's remaining issue as an upstream reproduction, not a direct edit to third-party code; remaining T-03 design decisions can also proceed independently.

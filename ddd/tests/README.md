# DDD plugin tests

English | [Japanese](README.ja.md)

Updated: 2026-09-24. Run `bun test tests/` from the plugin root. The [contract matrix](../docs/developers/sensor-coverage.md) tracks per-rule coverage. Normal runs skip the optional standalone-guard reproduction and two network installation cases. Each has an explicit opt-in command.

## Test responsibilities

| File | Scope |
|---|---|
| t1-model-artifacts / t1-gate-integration | Direct canonical-artifact checks and Claude/Codex normal approval admission. |
| t7-domain-packaging | Vocabulary-based declaration/layout matching; technical names and unresolved analysis. |
| t10-rust-module-layout | Project-wide configuration, both layout policies, direct sensors, CI exit statuses, shared logical module resolution, and what the gate and the CI entry each do when the extractor cannot be launched. |
| t9-sensor-contract | Sensor/rule coverage, positive/negative/boundary cases, dependency table, all reserved names, and report drift. |
| t8-declaration-language | English markers, legacy Japanese markers, and rejection of cross-language duplicate sections. |
| u1-sensor-foundation | Model loading, IDs/references, completeness, findings, and runtime contracts. |
| domain-model-operations / domain-model-migration | Operation-owned errors in the canonical model, and preview/apply migration of one model artifact. |
| aggregate-mapping-contract / aggregate-mapping-migration | Reading and refusing the language-neutral aggregate mapping for Rust and TypeScript, and preview/apply migration of one crate/module mapping with a supplement, including the production gate refusing the mapping before the migration and accepting it after. |
| layer-declaration-contract / layer-declaration-migration | Reading, refusing and inspecting the language-neutral layer declaration for Rust and TypeScript, at both the Unit and the stage-direct location, and preview/apply migration of the one YAML block below the DDD section marker of `cicd-pipeline.md`, including the surrounding prose and CI fence left byte-for-byte alone, the production gate refusing the declaration before the migration and accepting it after, and the use-case declarations left untouched. |
| artifact-set-migration | Preview, apply, re-run and partway write failure of one project's whole artifact set, and the gates and CI command that refused the record accepting it once migrated. |
| rust-mapping-view | Projecting the language-neutral mapping onto the crate name, module path and replay methods the Rust source sensors compare, leaving other languages out. |
| generation-instructions | Reading every YAML/TOML example of the runtime instruction directories through the same readers the gates use, and keeping those directories in English. |
| u2-rust-analysis-foundation | Cargo workspace scanning, crate layer and CQRS-side assignment, file classification, and the dependency permission table. |
| u3-plugin-scaffold | Plugin structure, prefixes, commands, and extension declarations. |
| u4-design-sensors / u4-golden | Valid/invalid design inputs and comparison of declared rules with outputs. |
| u5-rust-code-sensors / u5-golden | Valid/invalid Rust sensor inputs, and the line each finding of rules (h), (l), (m) and (n) sends a reader to. |
| t10-rust-domain-facts / t10-domain-facts-contract | Rules decided on the native extractor: reported member names, ordinals and declaration lines, the functions a file declares outside an impl block, what each gate does when the extractor cannot be launched, and the answers the adapter refuses rather than reading as an empty fact set. |
| t10-rust-domain-decision-base | Rules (b), (c), (g) and domain-packaging decided on the native extractor: the line each finding carries, the same spelling in a macro body, a literal or a comment declaring nothing, module resolution's resolved and unresolved pairs, and a program source the extractor cannot read stopping the gate instead of being read as empty. |
| install / install-sandbox | Acquisition helpers and real installation/update/dry-run/failure CLI paths. Network acquisition is opt-in. |
| framework-compatibility | Standard-tool compose, graph compilation, and repeat-compose idempotency for Claude/Codex. |
| error-contract-contract | Business-error contract vocabulary, request identity including the Cargo and the TypeScript condition, and response validation. |
| error-contract-cargo | Cargo condition resolution at the boundary and the lockfile left untouched. |
| error-contract-rust | Native resolution of supported reference forms in both module layouts, bounded cases, package identity, and a build condition change. |
| error-contract-project | TypeScript project condition resolution at the boundary, inherited compiler options, and the project left untouched. |
| error-contract-typescript | Compiler API resolution of supported reference forms in both module layouts and code representations, bounded cases, symbol identity, and a project condition change. |
| operation-error-set-contract | Operation error-set comparison from hand-written error-contract answers: request identity, refused input, missing, unexpected and foreign cases, result contract findings, unresolved facts, earlier observations after a change, and no language-specific import in the comparator. |
| operation-error-set-languages | One shared scenario resolved by the Rust, TypeScript class and TypeScript companion paths and judged by the same comparison, and a changed mapping, model or snapshot never judged from an earlier observation. |

## Distribution checks

```sh
bun run build:claude
bun run build:codex
bun scripts/verify-dist.ts claude codex
```

Distribution checks run 387 cases per harness. The runner creates a temporary directory and executes actual sensor scripts as child processes. These direct checks do not execute normal approval or model-driven generation.

`bun run test:sandbox` runs heading compatibility, contract cases/report checks, Claude/Codex builds, disposable compose/graph/idempotency checks, 387 distribution cases per harness, and normal approval integration. It sends 142 selected matrix inputs through admission per harness and checks audit records and finding rule IDs. The existing 40 combined integration cases remain.

## Verified regressions and remaining checks

Missing, invalid, and valid approval inputs are covered by t1-gate-integration. T-02 added value-object, port, cross-file, and replay regressions. T-07 added 55 direct and eight approval cases. A valid case lacking the target structure is not evidence that structure is correctly inspected.

Seven representative package layouts were also compiled with rustc 1.95.0. This is not compilation of every golden input or proof of business behavior. Installation/update CLI behavior is [verified](../docs/developers/installation-verification.md). Actual model execution and rule delivery remain unverified.

See [remaining work](../docs/developers/completion-tasks.md) and [measurements](../docs/developers/current-state-assessment.md). Include versions and scope when updating results.

## Updating the matrix

Define rule/case correspondence in `golden/contract/coverage.ts` and additional inputs under `golden/contract/`. Generate both editions with `bun scripts/report-sensor-coverage.ts --write`; run `bun run test:coverage` to catch missing references and evidence. The report does not measure all implementation branches, all Rust syntax, or business semantics.

`bun run test:install` is included in the regular sandbox. Run real acquisition with `bun run test:install:remote`.

## Shared state exposure verification

Run `bun run prepare:native`, then `bun run test:state-exposure` and `bun run verify:state-exposure`. The ordinary `bun test tests/` suite also includes real language extraction, so it requires the prepared binary at its product path. See [prerequisites, commands and supported shapes](../docs/developers/state-exposure-verification.md).

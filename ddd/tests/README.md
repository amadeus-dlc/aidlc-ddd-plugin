# DDD plugin tests

English | [Japanese](README.ja.md)

Updated: 2026-09-13. Run `bun test tests/` from the plugin root. After language alignment, the full suite had 285 passes, one skip, and 20 failures. The skip is an optional reproduction of the framework standalone completion gap. Do not restore the deleted reference submodule or old bridge merely to satisfy obsolete tests.

## Test responsibilities

| File | Scope |
|---|---|
| t1-model-artifacts / t1-gate-integration | Direct canonical-artifact checks and Claude/Codex normal approval admission. |
| t7-domain-packaging | Vocabulary-based declaration/layout matching; technical names and unresolved analysis. |
| t8-declaration-language | English markers, legacy Japanese markers, and rejection of cross-language duplicate sections. |
| u1-sensor-foundation | Model loading, IDs/references, completeness, findings, and runtime contracts. |
| u2-rust-analysis-foundation | Cargo layer classification and Rust syntax analysis. |
| u3-plugin-scaffold | Plugin structure, prefixes, commands, and extension declarations. |
| u4-design-sensors / u4-golden | Valid/invalid design inputs and comparison of declared rules with outputs. |
| u5-rust-code-sensors / u5-golden | Valid/invalid Rust sensor inputs. |
| install | Installer pure functions and related checks, not complete installation/update proof. |
| framework-compatibility | Current Claude/Codex compose/idempotency tests mixed with failing old integration tests. |
| codex-dispatch-bridge | Depends on old bridge/deleted fixtures; T-04 tracks cleanup. |

## Distribution checks

```sh
bun run build:claude
bun run build:codex
bun scripts/verify-dist.ts claude codex
```

After T-07, each harness passed 154 cases. The runner creates a temporary directory and executes actual sensor scripts as child processes. These direct checks do not execute normal approval or model-driven generation.

`bun run test:sandbox` runs Claude/Codex builds, disposable compose/graph/idempotency checks, 154 distribution cases per harness, and t1-gate-integration. Default test:dist also targets only Claude/Codex. Manifests use `fire_on: gate`; the earlier claim that writes trigger them was corrected.

## Verified regressions and remaining checks

Missing, invalid, and valid approval inputs are covered by t1-gate-integration. T-02 added value-object, port, cross-file, and replay regressions. T-07 added 55 direct and eight approval cases. A valid case lacking the target structure is not evidence that structure is correctly inspected.

Seven representative package layouts were also compiled with rustc 1.95.0. This is not compilation of every golden input or proof of business behavior. Fresh installation, updates, actual model execution, and rule delivery still need verification.

See [remaining work](../docs/completion-tasks.md) and [measurements](../docs/current-state-assessment.md). Include versions and scope when updating results.

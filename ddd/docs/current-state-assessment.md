# DDD plugin implementation assessment

English | [Japanese](current-state-assessment.ja.md)

Assessment date: 2026-09-13. Scope: `ddd/` and AI-DLC 2.8.2 in this working copy. Measured HEAD: `97a6244`; Bun: `1.3.13`.

**At the initial assessment, the core existed but approval integration and Rust evaluation had defects.** This document preserves measurements and evidence. See the [document index](README.md) for current conventions and [remaining work](completion-tasks.md) for progress.

Design, guidance, and knowledge were cleaned up after the assessment. Sensor and generation code had not yet changed at that initial point. Later T-01, T-02, and T-07 results are appended below. Do not confuse baseline measurements with post-fix results.

## 1. The model-to-code inspection structure exists

At the baseline, there were one dedicated stage, four contributions, six design sensors, three Rust sensors, and eight knowledge files. A hand-written model loader, ID/lineage/reference resolution, Cargo layer classification, tree-sitter Rust analysis, and distribution/installation scripts existed.

See the [stage](../stages/inception/ddd-domain-modeling.md), [contributions](../contributions/), [schema](../tools/ddd/lib/schema/), [analyzer](../tools/ddd/lib/rust/analyzer.ts), [rules](../tools/ddd/lib/rules/rust/evaluators.ts), and [installer](../scripts/install.ts).

## 2. Approval integration defects

### F-01: Canonical model logical and physical names disagree

Composed the Codex plugin into a disposable copy and compared the generated graph with [artifactFilename](../../.codex/tools/aidlc-artifact-vocabulary.ts).

| Logical name or caller | Resolved or requested filename |
|---|---|
| `ddd-domain-model` | `ddd-domain-model.md` |
| `ddd-domain-model-yaml` | `ddd-domain-model-yaml.md` |
| Stage instructions and downstream readers | `domain-model.md`, `domain-model.yaml` |
| Model completeness sensor | `**/ddd-domain-modeling/domain-model.yaml` |

Following the prose failed the completion existence check; following resolved names missed the sensor pattern. Generation, references, review, and checks needed a coordinated fix.

### F-02: Use-case and layer declarations are unregistered

Both contributions instructed generation without registering produces. [existingDeclaredArtifactPaths / fireGateSensors](../../.codex/tools/aidlc-state.ts) passes only existing registered artifacts into approval checks. Merely placing unregistered files does not inspect them, and `--artifacts` does not compensate.

| Composed stage | Registered artifacts matching DDD sensors |
|---|---|
| ddd-domain-modeling | None |
| domain-design | components.md, ddd-aggregate-mapping.md |
| functional-design | None |
| infrastructure-design | None |

This compared composed data and approval code, not a complete approval run. T-01 was assigned missing/invalid/valid integration tests.

## 3. Additional Rust inputs reproduced false positives and misses

Duplicated existing [case inputs](../tests/golden/rust/cases.ts) and used the [runner](../tests/golden/runner.ts) to execute real sensor scripts in temporary directories.

| ID | Input | Observation | Cause |
|---|---|---|---|
| F-03 | Value type Amount passed to execute | Blocking h | Domain type names were not distinguished from aggregates. |
| F-04 | PaymentPort port.execute() | Blocking i | The name execute alone was treated as another use case. |
| F-05 | Invoice struct and undeclared set_amount impl in separate claimed files | No finding | Only structs and impls in the same file were joined. |
| F-06 | Arbitrary undeclared assignment named apply | No finding | Replay exemption depended only on the method name. |

F-03/F-04 came from ruleH/ruleI in [evaluators.ts](../tools/ddd/lib/rules/rust/evaluators.ts); F-05/F-06 from collection and classifyMutator in [symbols.ts](../tools/ddd/lib/rules/rust/symbols.ts). T-02 was assigned their regressions.

For F-03, violation-h was changed to `pub struct Amount { value: i64 }` and an Amount argument. F-04 added PaymentPort and execute to violation-i. F-05 added `mod operations;`, a separate assignment method, and its source-manifest claim to clean-domain. F-06 added an apply method with arbitrary assignment to clean-domain.

## 4. Overstated documentation guarantees were corrected

### F-07: Knowledge enforcement claims

Baseline knowledge claimed c verified every invariant, b prohibited embedding other aggregates, and c enforced decide/apply separation. The actual checks did not guarantee those semantics.

Documentation cleanup preserved rule IDs while separating conventions, automated coverage, and review/behavior tests. Correcting knowledge did not itself expand sensor coverage.

The three layer designs also corrected failure scope, upsert/idempotency, last-ID retention, first versus duplicate success, sagas and actors, relational database selection, and Streams ordering. At that point concrete return values and replay declarations remained T-03 work.

## 5. Errors in the old task list were corrected

Fable5.1's old completion-tasks.md had the following issues; the [current list](completion-tasks.md) corrects them.

| Earlier claim or proposal | Finding |
|---|---|
| Domain Error requirement is unimplemented. | [loader.ts](../tools/ddd/lib/schema/loader.ts) rejects an empty list with schema.command-no-error; [dedicated tests](../tests/u1-sensor-foundation.test.ts) pass. |
| Installer lacks copilot/cursor/kiro. | Already implemented. Duplicate tables and obsolete targets are separate problems. |
| Delete the entire compatibility test file. | Its current Claude/Codex compose tests must remain. |
| Ask again whether audit data should be committed. | Current AGENTS.md and .gitignore already require commits. |
| Passing existing tests nearly establishes completion. | F-01–F-06 integration and evaluation problems were missing from the list. |

## 6. Baseline verification and limits

| Check | Baseline result | Scope |
|---|---|---|
| bun run check | Biome passed, validate VALID, 141 passed / 20 failed | Failures depend on old bridge/deleted reference assumptions. |
| validate warning | One absent compose-hook warning | Build injects the standard hook; absence alone is not an error. |
| Claude/Codex compose tests | Both passed | Disposable composition, graph inclusion, repeat-compose idempotency. |
| bun run test:sandbox | Stopped at Kimi build | Claude/Codex built; subsequent aggregate compose/distribution checks were not reached. |
| bun scripts/verify-dist.ts claude codex | 62 cases passed per harness | Direct sensor execution from rebuilt distributions. |
| Additional Rust inputs | Two false positives and two misses | F-03–F-06. |
| Graph after disposable compose | Confirmed F-01/F-02 | Filename resolution and sensor-pattern comparison. |

The assessment did not verify normal lifecycle approval, rule delivery to current Codex models, installer fresh/update/failure recovery, or compilation/execution of Rust inputs as business applications.

Kimi/opencode were excluded by the user's subsequent decision. Remove unnecessary build, verification, and installation paths rather than repairing Kimi. T-01–T-06 capture the completion sequence and criteria.

## 7. Results after T-01

Aligned canonical model filenames with registered names and moved added declarations into required sections of existing review artifacts. F-01/F-02 normal approval integration is fixed; see the [artifact contract](artifact-contract.md).

- Claude/Codex approval admission and Unit applicability: 32 new integration cases passed.
- New model format: six direct checks passed.
- Overall: 179 passed, one skipped, 20 existing old-dependency failures. Biome and plugin validation passed.
- Optional standalone reproduction: failed because standard 2.8.2 returns done without artifacts; normal runs skip this one case.

These measurements establish normal approval integration, not complete model execution and human approval. At this checkpoint standalone T-01 and T-02 onward remained incomplete.

## 8. Results after T-02

Fixed F-03–F-06 and added aliases, qualified types, field receivers, trait impls, getter collisions, shadowing, and invalid replay declarations. See the [Rust contract](rust-sensor-contract.md).

- 37 new regressions passed: 34 Rust and three design-declaration cases.
- Overall: 216 passed, one skipped, 20 existing old-dependency failures. Biome and plugin validation passed.
- Claude/Codex distributions each passed 99 design/Rust cases.
- No changes under `.claude/tools/` or `.codex/tools/`.

Type inference and trait selection remain outside guarantees; direct JSON records coverage notes. T-02's planned fixes are complete. T-01's framework limitation and subsequent tasks remain.

## 9. Results after T-07

Declared package-to-vocabulary correspondence in domain_packages and integrated it with knowledge, stage instructions, and existing sensors. Checks cover reserved technical names, missing/duplicate declarations, broken references, undeclared actual modules, and unresolved analysis. See the [packaging contract](domain-packaging-design.md).

- 55 new direct regressions and eight Claude/Codex approval cases passed.
- `bun run check`: 279 passed, one skipped, 20 known old-bridge/deleted-fixture failures; no new failures. Biome and plugin validation passed.
- Rebuilt Claude/Codex distributions each passed 154 design/Rust cases.
- rustc 1.95.0 compiled seven representative layouts: external mod, mod.rs, path attribute, path inside inline mod, inline directory override, raw-string path, and child mod inside a path-loaded file.
- Knowledge increased to nine files; one dedicated stage, four contributions, and nine sensors remained unchanged in count.
- No third-party changes under `.claude/tools/` or `.codex/tools/`.

rustc verified representative layout syntax/resolution, not every regression input as an executable business application. Framework standalone limitations, actual model execution, and installation/update verification remain. T-07 is complete; T-03–T-06 continue.

## 10. Combined sandbox verification

Limited build:all, test:sandbox, and test:dist to Claude/Codex and appended normal approval integration tests. `cd ddd && bun run test:sandbox` completed with exit code 0. [Evidence](evidence/sandbox-verification.json) is retained.

- Both harness builds passed.
- Both disposable compositions were CLEAN: zero drops, compiled graphs, and idempotent repeat compose.
- Distribution checks passed all 154 cases per harness.
- Normal approval tests: 40 passed, one skipped, zero failed. The skip is the known optional standalone-guard reproduction.
- Biome and plugin validation passed. Third-party framework distributions were unchanged.

This verifies plugin build, composition, sensors, and approval integration in a sandbox. It does not establish actual model execution or installer fresh/update behavior. The 20 old-dependency failures in the full suite were not changed by this verification.

## 11. Results after documentation language alignment

Runtime knowledge, sensors, stages, and contributions are English-only. All 18 reader documents have full English and Japanese editions, with language navigation and links to the matching edition. Japanese records under aidlc/ and third-party framework files are unchanged.

- No Japanese text remains in the four runtime directories; all local document links resolve.
- Knowledge rule IDs and runtime frontmatter are unchanged.
- Six declaration-language tests pass: English and existing Japanese markers are accepted; cross-language duplicates are rejected.
- The full check has 285 passes, one skip, and the same 20 old-dependency failures. Biome and plugin validation pass.
- The sandbox completes with exit code 0: both harnesses build and compose, each distribution passes 154 cases, and approval integration has 40 passes, one skip, and zero failures. The main fixtures now exercise English section markers.

The skipped standalone reproduction and the unverified installation/model-execution scope remain as described above.

## 12. Sensor contract coverage

The [contract matrix](sensor-coverage.md) tracks nine sensors and 70 rule entries. It directly checks findings for 68 entries and earlier loader rejection for two. Each entry has positive, negative, and boundary evidence; another sensor's identical rule ID cannot substitute for it.

- Claude/Codex distributions each pass 277 cases.
- Admission adds 138 inputs per harness. With the existing 40 combined checks: 316 passed, one skipped, zero failed.
- All 135 contract/heading checks pass, including missing evidence and generated-report drift guards.
- Foundation/installer checks pass 45 cases; existing sensor and related regressions pass 88 cases.
- Temporary projects are removed after each test. The complete sandbox script exits 0.

[Execution evidence](evidence/sensor-contract-verification.json) is retained. The investigation also fixed malformed reference IDs being classified as undefined. This does not claim coverage of every implementation branch, all Rust syntax, or business semantics. The optional standalone-guard reproduction and 20 known old-dependency failures remain separate work.

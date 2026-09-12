# DDD plugin decisions

English | [Japanese](decisions.ja.md)

Updated: 2026-09-13. Distinguish current policy from adopted and superseded historical decisions. The [document index](README.md) links designs; [remaining work](completion-tasks.md) tracks unimplemented items.

## Current policy

| Decision | Status and rationale |
|---|---|
| Target Claude Code and Codex for completion verification. | Kimi and opencode were excluded by user decision. Desired models may be used through the Ollama Cloud Claude Code bridge. Do not maintain custom builds for the excluded harnesses. |
| Commit audit shards. | Follow current AGENTS.md and .gitignore; historical machine-local operation is not the current procedure. |
| Validate canonical models with a hand-written loader. | Adopted 2026-09-10. JSON Schema documents the contract; reject unknown keys and broken references. |
| Use ddd-domain-modeling as the dedicated stage. | Adopted 2026-09-11 to satisfy plugin-prefix constraints. |
| Separate syntax checks from semantic review. | Deterministic output does not prove meaning; do not claim all invariants or recovery paths are verified. |
| Use the full layer name Interface Adapter in prose. | Use the Japanese equivalent in Japanese editions. Keep machine identifiers such as interface-adapter unchanged. |
| Use English for runtime instructions and maintain paired reader documentation. | knowledge/sensors/stages/contributions are English-only. Other plugin docs and guides have English .md and Japanese .ja.md bodies. aidlc/ records remain Japanese. |

## Specification cleanup on 2026-09-13

Separated failure guarantees into domain operations, single-aggregate persistence, unknown outcomes, and multi-aggregate partial failures. Withdrew the earlier claim of no whole-use-case changes while allowing partial commits.

Corrected claims that upsert alone guarantees idempotency, serialization makes one retained ID sufficient, or unreferenced creation remnants are always harmless. Distinguished initial state-changing success from duplicate success with no new events. Concrete return types remain T-03 work.

Corrected actor-only saga claims, exclusion of relational databases solely for denormalized events, and extension of DynamoDB Streams ordering to an entire aggregate. The three layer designs provide conditions and sources.

This records document alignment, not completion of every stage, contribution, and sensor change.

## Retained implementation decisions

| Date | Decision | Current meaning |
|---|---|---|
| 2026-09-11 | Cache parsing by content hash and attach a filename to SyntaxTree per request. | Do not confuse separate files with identical content. |
| 2026-09-11 | Apply CQRS cross-side prohibition before same-layer permission. | Detect forbidden command/query edges even within the same layer. |
| 2026-09-11 | Add trait extraction, Cargo external dependencies, and Rust golden cases. | Expand inputs for m and dependency checks without claiming full Rust coverage. |
| 2026-09-11 | Add installation scripts and provenance. | Fresh-install/update code exists; current end-to-end host verification belongs to T-05. |

## Superseded decisions

| Earlier decision | Current treatment |
|---|---|
| Removing produces from functional-design/infrastructure-design is safe because paths still match sensors. | Insufficient: approval enumerates only registered artifacts. Replaced with required sections in registered review artifacts. |
| Restore the 2.8.1 Codex bridge and patches. | Retired as a current 2.8.2 procedure. T-04 tracks remaining code/tests. |
| Distribute to four harnesses including Kimi and opencode. | Do not restore excluded routes or use historical measurements as current support guarantees. |
| Ignoring audit data preserves execution state. | Conflicts with current commit policy; do not generalize that audit data is unnecessary. |
| Maintain the deleted reference submodule read-only. | Removed the procedure and protection evidence because the target no longer exists. |
| Treat old functional-design records as the sole current authority. | Refer to current design documents, implementation, and measurements in this working copy. |
| Consolidate all reader documentation into Japanese and replace translations with redirects. | Superseded by the user's paired English/Japanese documentation policy; each edition has a full body. |

The [historical Codex page](codex-host-verification.md) links old host evidence. Values such as four-harness success on 2026-09-11 describe that time only. Current measurements belong in the [assessment](current-state-assessment.md).

## T-01 artifact integration

Wrap canonical YAML in Markdown using standard artifact names. Embed use-case and layer declarations in required sections of existing review artifacts without broadening their Unit kinds. Normal approval integration is verified; standard standalone completion can still finish without artifacts. See the [artifact contract](artifact-contract.md).

## T-02 Rust evaluation

Associate canonical root_element with explicit Rust types instead of treating every domain type as an aggregate. Resolve callees through modules, use statements, simple aliases, explicit parameters, and fields. Do not perform type inference or trait implementation selection; note ambiguity.

Replace name-only replay exemptions with method/event IDs in aggregate mapping replay_methods. Rule b permits the exception only when persistence mode, placement, owning aggregate, and event parameter type agree. Keep the model schema unchanged; review and test body semantics. See the [evaluation contract](rust-sensor-contract.md).

## 2026-09-13: Packaging by business vocabulary

T-07 implements shared knowledge, existing-stage instructions, and design/Rust checks together. domain-design owns physical placement in domain_packages; it does not enter the canonical model. Automated checks cover reserved technical names and declaration/layout correspondence; review assesses naming and responsibilities. Future packages may be declared early, but actual undeclared modules are rejected. See the [contract and scope](domain-packaging-design.md).

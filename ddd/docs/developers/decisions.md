# DDD plugin decisions

English | [Japanese](decisions.ja.md)

Updated: 2026-09-13. Record current policy and its rationale. The [document index](../README.md) links designs; [remaining work](completion-tasks.md) tracks unimplemented items.

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

## 2026-09-13: Shared language contracts and release sequence

Status: agreed design; implementation pending. The [shared design](language-independent-design.md) is the consolidated specification, with the current Rust implementation compared against the target.

Improve Rust and TypeScript against one domain and inspection contract. Separate execution hosts from layered packages; enforce public boundaries and dependency direction, including type-only references. Keep aggregate execution, persistence, source representation, and module layout independent. Use method-specific closed business-error types, including generation errors, and block unresolved required inspections. Preserve state privacy, immutability, and ownership isolation in both languages.

TypeScript selects class or structure/companion representation per project. The latter uses closure-held state and a private unique-symbol brand; classes use # private fields. Both apply to Domain Primitives and Value Objects too. Result belongs in language-support infrastructure; individual neverthrow, Effect, and fp-ts integrations are outside this scope. ESM with Next.js on the server-side Node.js runtime is the first TypeScript integration target.

Define common comparison scenarios and validate a small TypeScript implementation before finishing the first release. That release includes shared contracts, Rust improvements, and explicit migration of existing Rust artifacts. Complete TypeScript support follows in the next release. Align specifications, knowledge, stages, sensors, and behavior tests for each shared change.

TypeScript analysis uses the TypeScript Compiler API, including Program/TypeChecker-based evidence for type-dependent checks. Keep these dependencies in the language-specific implementation; Rust and TypeScript feed the same shared inspection contract. Adopt this in the T-09 proof and carry it into T-11, with explicit API-version compatibility verification.

## 2026-09-13: Adopt Rust + syn behind the shared inspection contract

Status: adoption approved after the [parser experiment](rust-syn-spike.md); production replacement pending. Use Rust + syn for Rust syntax analysis and the TypeScript Compiler API for TypeScript. Keep language-specific traversal/resolution inside each implementation and DDD decision semantics in shared rules. This reduces Rust-specific parsing logic in TypeScript while preserving one domain policy.

Syn does not provide compiler type inference, trait solving, or macro expansion. The [inspection design](inspection-contract-design.md) combines Cargo context with explicit reference resolution, records completeness, and blocks unresolved required facts. Separate proven absence from missing evidence, and resolved symbol identity from permission to access it. Business IDs remain owned by the canonical model.

Retaining tree-sitter and fixing its current extractor was viable; the measured tuple/getter misses were implementation defects, not parser limitations. The selected direction is native Rust analysis, with all-rule parity and platform distribution still required. Do not select a compiler-internal semantic provider or claim release readiness from the small prototype.

## Consistency and recovery policy

Define failure guarantees separately for domain operations, single-aggregate persistence, unknown outcomes, and multi-aggregate partial failures. Multi-aggregate flows may retain partial commits, so design retries, compensation, and intermediate states.

Idempotency requires request identification and retention suited to retry conditions. Distinguish initial state-changing success from duplicate success with no new events. Concrete return types remain T-03 work.

Choose saga implementation, storage, and delivery-order guarantees from the actual requirements and conditions. The three layer designs describe those conditions and sources.

## Retained implementation decisions

| Date | Decision | Current meaning |
|---|---|---|
| 2026-09-11 | Cache parsing by content hash and attach a filename to SyntaxTree per request. | Do not confuse separate files with identical content. |
| 2026-09-11 | Apply CQRS cross-side prohibition before same-layer permission. | Detect forbidden command/query edges even within the same layer. |
| 2026-09-11 | Add trait extraction, Cargo external dependencies, and Rust golden cases. | Expand inputs for m and dependency checks without claiming full Rust coverage. |
| 2026-09-11 | Add installation scripts and provenance. | Fresh-install/update code exists; current end-to-end host verification belongs to T-05. |

## T-01 artifact integration

Wrap canonical YAML in Markdown using standard artifact names. Embed use-case and layer declarations in required sections of existing review artifacts without broadening their Unit kinds. Normal approval integration is verified; standard standalone completion can still finish without artifacts. See the [artifact contract](../users/artifact-contract.md).

## T-02 Rust evaluation

Associate canonical root_element with explicit Rust types instead of treating every domain type as an aggregate. Resolve callees through modules, use statements, simple aliases, explicit parameters, and fields. Do not perform type inference or trait implementation selection; note ambiguity.

Record method/event IDs in aggregate mapping replay_methods. Rule b permits the exception only when persistence mode, placement, owning aggregate, and event parameter type agree. Keep the model schema unchanged; review and test body semantics. See the [evaluation contract](../users/rust-sensor-contract.md).

## 2026-09-13: Packaging by business vocabulary

T-07 implements shared knowledge, existing-stage instructions, and design/Rust checks together. domain-design owns physical placement in domain_packages; it does not enter the canonical model. Automated checks cover reserved technical names and declaration/layout correspondence; review assesses naming and responsibilities. Future packages may be declared early, but actual undeclared modules are rejected. See the [contract and scope](../users/domain-packaging-design.md).

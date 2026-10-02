# DDD plugin decisions

English | [Japanese](decisions.ja.md)

Updated: 2026-10-03. Record current policy and its rationale. The [document index](../README.md) links designs; [remaining work](completion-tasks.md) tracks unimplemented items.

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

## 2026-09-25: Remove the tree-sitter assets rather than keep them for a second opinion

Status: in force. Every rule every shipped Rust sensor reports decided on the native extractor once T-10-05 landed, leaving tree-sitter with two answers: whether a claimed file could be read, and where its macro-opaque regions were. Keeping a 1 MB parser and grammar for those two was rejected. The first is a plain file read, and the second is dropped rather than reimplemented: the native side already refuses an item macro or `cfg`/`cfg_attr` that can hide a module declaration and already notes them elsewhere, so what is given up is the report for an expression-position macro and for a non-built-in attribute macro. The existing refusals do not cover the latter: an attribute macro can replace the item it annotates, so what it hides stays unresolved. [#80](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/80) has since settled it, as the next decision records. Adding a replacement note would have been a new rule, which this change was not asked for.

The cost is that the tree-sitter answer is no longer available to compare against from this repository. Where an earlier task recorded "what the enumerations this replaced reported here is not established", that question is now permanently open here rather than pending; [completion tasks](completion-tasks.md) records it for the parent issue. The alternative — keeping the grammar as a comparison oracle no shipped code reads — was rejected because an asset the product does not use is not kept current, and a stale oracle answers a different question from the one asked.

## 2026-09-26: Treat an attribute that is not built in as a possible attribute macro, except the allow-listed helpers of a derive on the same item

Status: in force ([#80](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/80)). An attribute macro replaces the item it annotates, so it can add the public member rule `a` reports or the getter rule `d` reports, and rule `a` could pass such an item with no finding. A derive macro cannot change the item it annotates, but syntax alone cannot tell its helper attributes from an attribute macro of the same name. The native extractor therefore records every attribute that is neither built in nor an allow-listed helper of a derive on the same item as `unresolved` with the reason `attribute-macro`, under `protocol_version` 7. `ddd-rust-domain` and `ddd-rust-use-case` stop as inspection-impossible (exit 127, no verdict) when a file rules `a` and `d` decide from carries one, and every other file and gate keeps it as a note. The built-in list, the allow list (`serde` for `Serialize` and `Deserialize`, `default` for `Default`, and `error`, `from`, `source` and `backtrace` for thiserror's `Error`) and the gate behavior are in [how attribute macros are handled](rust-syn-spike.md#how-attribute-macros-are-handled). [#92](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/92) has since narrowed what is recorded, as the next decision records.

Two alternatives were rejected. Keeping the allow list in the rule layer would split the decision of what to record from the extractor that sees the item, and would need another protocol field to say which item a helper stands on. Allowing a listed helper anywhere in a file would pass `#[serde(...)]` on an item with no serde derive, which is exactly where it can be an attribute macro. What `cfg_attr` would apply is not read, because evaluating `cfg` is outside #80, and a path-qualified attribute is always recorded, because telling it from a re-exported built-in needs name resolution.

## 2026-09-27: Do not record an attribute macro under `#[cfg(test)]` or on the attribute macro allow list

Status: in force ([#92](https://github.com/amadeus-dlc/aidlc-ddd-plugin/issues/92)). The #80 stop also fired on two inputs it was not needed for. First, an attribute macro under `#[cfg(test)]` — `#[tokio::test]` in an inline test module is the common case — stopped a gate because the file is the unit rules `a` and `d` decide from, although the normal build never compiles that code and so it cannot change the declarations those rules read. The extractor now leaves it out, reusing the distinction its declaration walk already draws to mark an item or a file auxiliary: an item carrying `#[cfg(test)]`, together with its own attributes and everything inside it, and a file that opens with `#![cfg(test)]`. `#[cfg(test)]` itself is still recorded as `conditional-compilation`, and any other configuration predicate keeps the handling #80 gave it. Second, `#[async_trait]`, common on the asynchronous ports and repositories of the use-case and domain layers, stopped a gate although it only rewrites the signatures of `async fn` and adds no public member rule `a` reads and no getter rule `d` reads. The extractor now keeps an allow list of attribute macros whose expansion is known, `ATTRIBUTE_MACRO_ALLOW_LIST`, beside `DERIVE_HELPER_ALLOW_LIST` and in the same form, matched by the last path segment so `#[async_trait]` and `#[async_trait::async_trait]` are both left out. It holds `async_trait` alone, and every other attribute macro still stops a gate. `protocol_version` stays 7, because the answer's shape is unchanged and an extractor still on the #80 build only records more. The details, including the boundary of the `#[cfg(test)]` distinction, are in [how attribute macros are handled](rust-syn-spike.md#how-attribute-macros-are-handled).

Several alternatives were rejected. Keeping an attribute macro under `#[cfg(test)]` as a note that does not stop a gate, rather than not recording it, would add a new kind of note for code that cannot affect the rules. Extending the `#[cfg(test)]` distinction to a method or associated item of an impl or trait block would draw a configuration distinction the extractor does not draw today, and evaluating `cfg` is outside #92. For `async_trait`, stopping as before was rejected for the practical cost above, and answering with a note for every attribute macro was rejected because it would let one that does add a member or a getter pass. Deciding either exception in the rule layer was rejected for the same reason as in #80: what to record is the extractor's part. Raising `protocol_version` was rejected because no record kind or field changed.

## 2026-10-03: Group domain types into Modules by business concept

Status: in force. A module of the domain layer is a Module in Evans's sense: part of the model that groups cohesive concepts, named in the ubiquitous language, with few dependencies between Modules, and regrouped when the model changes. The packaging conventions forbade technical names, so code never split by kind, but they did not say how to group; generated code then placed the identifier of the aggregate, the command IDs it remembers, a reference ID and the amount side by side at the root of the domain package. A type that belongs to one concept now goes under that concept's module. A shared value (`money`) or an ID that refers to another aggregate (`customer-id`) may sit at the root while the concepts are few and moves into a Module once the root no longer shows which concepts belong together. Kind-based Modules such as `ids` or `value-objects` remain prohibited. Grouping by concept is left to design review: a sensor that required every element under its aggregate's module would contradict shared values placed by responsibility.

## 2026-10-03: Carry amounts as a Domain Primitive in the examples; name shared packages only as dependencies

Status: in force. Generated code imitates the examples, so the examples follow the conventions they sit beside. A primitive with business meaning is wrapped in a dedicated type, yet the TypeScript knowledge, the generation samples and the Rust behavior sample passed line amounts and the invoice total as bare numbers and compared the total with `< 0`; code generated from them was then rejected by a review that applied the convention. The examples now carry amounts and totals as the Domain Primitive `Money`, declared in the canonical model of the samples. `Money` adds two values inside its own type, so neither the line nor the aggregate takes a number out of it, and it answers whether a total is negative. No rule changed: whether a primitive is wrapped stays a design convention that review decides.

A shared package outside a context, such as the TypeScript language-extensions package that declares `Result`, stands on no CQRS side, so it has no `packages` row and appears only in the `depends_on` of the packages that use it; the loader already accepted such an edge. Adding a role for it was rejected: `role` states the side, and the side rules read it.

## 2026-10-01: Name use case types `<Verb><Object>UseCase`

Status: in force. A use case implementation is a type of its own, and its name says so: `IssueInvoiceUseCase`, not `IssueInvoice`. The knowledge, the generation samples and the golden cases used the bare verb-object name, so generated code in both languages followed it. The use-case gates report the type whose method is `execute` when its name does not end with `UseCase` (`use-case-name`, requirement `DEC-2026-10-01`); a use case written as a bare function has no type to name. Verification records of earlier runs keep the names they ran with.

## 2026-09-30: Declare ports in the use-case layer; the aggregate keeps the applied command IDs

Status: in force. A repository interface is a port of the use-case layer: the use case loads through it, calls the domain, and stores through it. The domain layer declares, holds, and calls no port. The knowledge used to allow a repository port in a domain package and to place ports by their inner-layer consumers, and rule `d` accepted forwarding to a repository port of the domain layer, so a domain that declared or called a repository passed every gate. The domain gates now report a repository port declared in a domain package or crate (`port-placement`, requirement `DEC-2026-09-30`), and rule `d` accepts forwarding only to a repository port of the use-case layer. A port is known by its name, as rules `l` and `m` know it; other ports, and a domain type that holds or calls one, are left to review. A field or parameter that holds a port is named after the port (`invoice_repository`, `#invoiceRepository`).

Idempotency is guaranteed by the aggregate. It is the consistency boundary, so remembering the applied command IDs as part of its state keeps duplicate detection and persistence in one write; a record kept apart by the use case could fail apart from the state it guards. The identifier is called a command ID throughout, not a request ID. Keeping only the last command ID (`retention: last-one`) is valid only when an older command is never resent after a newer one ([use-case-layer design §5-4](use-case-layer-design.md)); `mapping-declarations.last-one` reports a `last-one` declaration without a rationale, which is the part a gate can decide.

Two alternatives were rejected. Recording the applied command IDs in the repository or in a dedicated port of the use case would need a transaction across two writes to keep detection and persistence together, and would move a business guarantee out of the aggregate. Rejecting `last-one` outright would forbid the choice the schema offers to a command whose client never resends an older command after a newer one.

## Consistency and recovery policy

Define failure guarantees separately for domain operations, single-aggregate persistence, unknown outcomes, and multi-aggregate partial failures. Multi-aggregate flows may retain partial commits, so design retries, compensation, and intermediate states.

Idempotency requires identifying commands by command ID, with the aggregate remembering the applied IDs, and retention suited to retry conditions. Distinguish initial state-changing success from duplicate success with no new events. Concrete return types remain T-03 work.

Choose saga implementation, storage, and delivery-order guarantees from the actual requirements and conditions. The three layer designs describe those conditions and sources.

## Retained implementation decisions

| Date | Decision | Current meaning |
|---|---|---|
| 2026-09-11 | Cache parsing by content hash and attach a filename to SyntaxTree per request. | No longer in force: T-10-06 removed the analyzer and `SyntaxTree` with it, so there is no parse to share. What replaced the filename it carried is `InspectionTarget.file`, the claimed file's own path. |
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

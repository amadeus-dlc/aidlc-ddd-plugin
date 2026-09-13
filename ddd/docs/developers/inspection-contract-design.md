# Shared inspection and Rust resolution design

English | [Japanese](inspection-contract-design.ja.md) | [Shared language design](language-independent-design.md)

Status: implementation design dated 2026-09-13. Rust + syn adoption and the shared principles are approved. The design below is the input to T-09 implementation and its paired-language proof; production adapters, schemas, and migration remain pending. It does not make the experimental JSON protocol a public contract.

## 1. Keep language semantics inside the language implementation

Use a Rust executable with syn for Rust syntax analysis and a TypeScript implementation with the Compiler API for TypeScript syntax and type analysis. Shared rule definitions own the DDD requirements, applicability, required facts, and decision semantics. Language implementations extract and resolve evidence; the shared evaluator compares that evidence with the canonical model and implementation mappings. Gate/CI adapters render the result through the plugin's execution contracts.

```text
source + project configuration + compiler/build evidence
             |
      language implementation
      Rust: syn + resolution
      TypeScript: Compiler API
             |
     versioned inspection facts
             |
canonical model + implementation mappings + shared rules
             |
    per-rule inspection results
             |
       gate / CI adapters
```

The text diagram is also the processing order. Rust source must not be reparsed in the TypeScript wrapper. Syn nodes, Cargo structs, and Compiler API objects stay inside their language implementation. An adapter may classify a language-specific code shape only within its declared supported scope; it must attach evidence and completeness, rather than decide a different DDD policy. Keep native details for diagnosis without using them as shared-rule inputs.

## 2. Bind every fact to an analysis snapshot

An analysis snapshot identifies the source/configuration/model inputs used for one inspection. Record source hashes, manifest and available lockfile hashes, mapping/model revisions, analyzer and compiler versions, and the selected build configuration. Rust configuration includes Cargo package/target identities, target triple, features, per-package edition, and effective conditional compilation evidence. TypeScript configuration includes tsconfig inheritance/references, compiler options, package identities/exports, and resolution conditions. Do not combine facts produced under different snapshots.

Analyze the scope required by each rule. Source claims identify changed deliverables; they are not the complete dependency or declaration universe. Load referenced packages, imports, types, and method declarations as needed. Project-wide module-layout checks still inspect all owned packages/targets. Missing required dependency sources or configuration is unresolved inspection, not evidence that a declaration does not exist.

Cache keys include the full relevant snapshot and requested fact scope. A content-only syntax cache may still be used inside an adapter, but cannot serve as a semantic cache. Aliases, feature changes, dependency changes, model edits, and compiler upgrades must invalidate affected results.

Keep business IDs from the canonical model distinct from implementation symbol IDs. A symbol ID is opaque, deterministic within the same snapshot, and unique across package, target, namespace, and declaration. It need not survive source moves. Mappings bind business IDs to uniquely resolved implementation symbols and are revalidated after changes. Never migrate business IDs by replacing them with compiler IDs or source offsets.

## 3. Require explicit resolution and completeness

Every requested fact has a subject, fact kind, snapshot, evidence, and one of these states:

| Fact state | Meaning | Consumer obligation |
|---|---|---|
| `resolved` | The requested value and identity are established in the stated scope. | Consume the value and its evidence. |
| `absent` | A complete search of the relevant scope proves the requested declaration/property is absent. | Apply the rule's absence semantics; absence may itself be a violation. |
| `unresolved` | Missing input, ambiguity, unsupported semantics, or incomplete inspection prevents a conclusion. | Block a required check and identify the missing capability/input. |

Collections also carry `complete` or `partial` coverage. An empty partial list is never an empty closed set. Candidates from a partial collection are diagnostic evidence, not a basis for a pass or a negative set-membership conclusion. A separately proven violation may be retained while other requirements remain unresolved.

Record a machine-readable reason and source/configuration locations. Reasons include missing source/configuration, parse failure, ambiguous identity, unsupported type/trait resolution, unexpanded macro, unknown conditional compilation, and resource limit. `unsupported` describes why resolution failed; it does not turn a required check into an optional check.

## 4. Share facts about packages, types, operations, and access

These logical records define the first contract. T-09 will encode them in a versioned serialization schema and validate them on both sides of the process boundary.

| Record | Required content and constraints |
|---|---|
| Package | Opaque package identity, owned source roots, execution-host/layer/command-query classification, dependency edges, and completeness. Preserve distinct package versions/targets; a name alone is not identity. |
| Type | Symbol identity, containing package, domain-element binding when declared, observable state exposure, and construction/mutation evidence with support limits. Preserve nominal identities and structural distinctions needed by the rule. |
| Operation | Symbol identity, owning type/package, canonical command or factory binding, parameter/return identities, and evidence for the relevant code shape or effect. A factory is an operation even if expressed differently by each language. |
| Business-error contract | Owning operation, recognized result contract, success/error type identities, complete closed error-case set, and mappings from code cases to canonical error IDs. |
| Access | Origin and resolved target identities, dependency kind including type-only, actual entry path, re-export chain, and effective accessibility. Keep visibility/access separate from layer permission. |
| Inspection evidence | Source spans, declaration/resolution chain, configuration evidence, producer/version, and snapshot. Paths are project-relative for owned files; external inputs use a dependency identity and relative path. |

Line positions are one-based. Do not compare raw column offsets between Rust spans and TypeScript positions without normalizing their encoding. The initial gate surface can keep file/line locations; any richer serialized span requires one specified encoding and Unicode/CRLF tests.

Publication inventories are derived from source and package metadata. Do not introduce a second user-maintained inventory of every exported symbol. Resolving an alias to a permitted type does not legitimize the path used to access it: an internal path bypass, forbidden layer edge, or prohibited wildcard publication is still checked separately.

## 5. Resolve Rust declarations conservatively

### Prepare the Cargo context

Use `cargo metadata --format-version 1` with the project's selected platform and feature configuration to establish package/target/dependency identities and renamed dependencies. Its `resolve` graph and package declarations serve different purposes; do not treat the unfiltered package list as the active dependency graph. `--no-deps` is insufficient when transitive or renamed dependency resolution is required. Preserve normal, build, dev, and host/target contexts instead of flattening them into one application-layer graph. See [Cargo metadata](https://doc.rust-lang.org/cargo/commands/cargo-metadata.html).

Inspection consumes prepared dependencies and compiler/build evidence without changing lockfiles. A sensor can use frozen metadata; missing prepared inputs produce unresolved inspection. Dependency preparation and `cargo check` belong to the explicit build/verification path, not an implicit compile on every sensor invocation. Record matching compiler diagnostics and effective build configuration; `cargo check` can involve build scripts and procedural macros, so their generated sources/configuration must be accounted for when relevant. A successful check does not supply the resolved symbol graph used by custom rules. See [Cargo check](https://doc.rust-lang.org/cargo/commands/cargo-check.html).

Do not switch to `--all-features` to obtain a convenient answer. Different feature sets or targets produce different snapshots and separate results. Missing compiler acceptance evidence leaves affected edition/type-dependent checks unresolved; local syntactic evidence can still be reported.

### Build a declaration and explicit-reference index

Syn supplies declarations, structured paths/types, spans, attributes, modules, impls, and signatures. Load external modules from actual declarations, honoring verified path/configuration evidence and both project-selected layouts. Resolve `crate`, `self`, `super`, explicit imports, renamed dependencies, re-exports, and type aliases against namespace- and scope-aware symbol tables. Preserve shadowing, raw identifiers, visibility and the traversed access path. Detect cycles and ambiguity; never take the first matching name. Rust distinguishes namespaces and includes a type-dependent resolution stage; a flat name table cannot implement its semantics. See [Rust name resolution](https://doc.rust-lang.org/reference/names/name-resolution.html).

Initially resolve explicit type references and transparent aliases, with structural substitution of supported type/lifetime/const arguments. Reject unsupported substitution as unresolved; never strip generic arguments to force equality. Support concrete `Self` in inherent impls through its owner. Bind explicit parameter/local/field types when scope and identity are known. A known inherent function return type may be followed only when the callee and every required substitution are established; this is bounded resolution, not general expression inference.

Before reporting a symbol resolved, establish that relevant conditional branches, glob imports, or generated declarations cannot add competing bindings. An unresolved macro need not invalidate unrelated complete field facts, but it must invalidate every affected name or set whose completeness it can change. Conservative broader blocking is acceptable until a narrower dependency scope is proven; silently assuming that macros have no effect is not.

### Separate semantic limits from syntax support

General expression inference, trait implementation selection, associated-type projection, custom deref/coercion, and macro expansion are not provided by syn. Required facts needing them remain unresolved unless a separately verified semantic provider supplies them for the same snapshot. Do not add rustc-private/nightly APIs or rust-analyzer internals implicitly as part of syn adoption; choosing such a provider requires a separate compatibility and distribution proof. T-09 must demonstrate that its explicitly supported scenarios work and identify ordinary intended-use cases that would still block. If those cases are necessary for the release, provider work becomes a release dependency rather than an exception to the rule.

Edition and file layout are independent. Syn parsing success is not compiler acceptance for the package's edition. The [experiment](rust-syn-spike.md) demonstrates this distinction and identifies public tuple fields and explicit-return getters that must enter Rust regression coverage.

## 6. Resolve the operation's error contract before comparing sets

For each command/factory mapping:

1. Resolve the operation uniquely and verify its containing domain owner and canonical operation binding.
2. Resolve its return type and the intended result contract. Rust aliases must reach the standard result identity; an application-defined type named `Result` is not that identity. TypeScript must resolve the configured language-support result definition/shape; `any`, `unknown`, assertions, and broad escape types cannot establish the required closed contract. No third-party Result library is selected by this design.
3. Resolve the error type and obtain its complete closed set of cases. Type aliases, generics, conditional variants, and associated types preserve their resolution obligations. Open or partial sets are unresolved, not empty.
4. Bind each code case to a canonical error ID. Verify that both the canonical error's declared owner and its containing operation agree. Each operation uses its own error contract; a broad union containing errors from other operations is a violation.
5. Compare required and observed sets for missing, extra, and wrong-owner cases. A complete mismatch is a violation. Missing type/set evidence is unresolved. The same algorithm applies to creation methods.

Types and case membership do not establish that each failure path preserves state or enforces invariants. Keep generated-application behavior tests and semantic review for those obligations, including mutable-reference isolation in TypeScript and explicit sharing/interior mutability in Rust.

## 7. Keep execution failure distinct from a rule decision

Analyzer execution is `completed`, `unavailable`, or `failed`. A completed run returns one result for every requested rule/subject/configuration. Each result is `pass`, `violation`, `unresolved`, or `not-applicable`, with references to the facts that justify it. `not-applicable` requires proven scope/applicability; missing model data or unsupported analysis cannot select it.

Approval succeeds only when every required result is pass or justified not-applicable, with complete required coverage. Violation and unresolved both block, but the latter reports an inspection problem rather than accusing application code of violating DDD. Retain proven violations even when other checks are unresolved. Missing results, unknown versions, stale snapshots, partial output, crashes, timeouts, and malformed responses block.

Keep the current sensor's single JSON verdict and existing rule identifiers for confirmed violations. The wrapper translates unresolved results into explicit blocking inspection diagnostics and preserves the existing unavailable-tool/timeout behavior; native exit 0 alone is never a gate pass. CI evaluates the same required results and uses nonzero exit for a blocked check. The experimental process protocol is replaced through a versioned adapter, not connected directly to an approval gate. No changes to third-party framework implementation are required.

## 8. Prove the contract with paired scenarios before migration

| Scenario | Rust input | TypeScript input | Required result |
|---|---|---|---|
| Intended private state | Named and tuple structs with private fields | Class `#` fields and companion closures | Resolved supported evidence; no exposure violation |
| Exposed state | Named/tuple `pub` and restricted fields | Public state and leaked mutable references in supported patterns | Violation where evidence proves exposure; unresolved otherwise |
| Aliased error return | Explicit/qualified Result, import rename, re-export, generic alias | Imported/re-exported result/error alias through project configuration | Same operation/error identities and complete case set |
| False result identity | Local type named `Result` | Unrelated structural/lookalike result or escape type | Never pass by spelling alone |
| Error mismatch | Missing/extra/wrong-owner enum variants | Missing/extra/wrong-owner closed union members | Equivalent violation; incomplete sets unresolved |
| Factory error | Validated create method returning its own error | Class factory and companion create | Same ownership and set checks |
| Public-path bypass | Internal Rust path or forbidden layer caller | Relative/internal path or forbidden layer caller | Access and layer checks remain independent |
| Resolution limit | Macro/unknown cfg, ambiguous alias, inferred trait receiver | Unresolved import, invalid project reference, unsupported return contract | Required inspection blocks with a specific reason |
| Configuration change | Feature/target/edition/layout change | tsconfig/exports/layout/representation change | Recompute affected facts; never reuse stale decisions |
| Host/source boundary | Cargo app/worker host and domain packages | Next.js server host and domain packages | Same allowed direction and business placement |

Add cycles, duplicate package versions/names, incomplete inventories, unavailable binaries, malformed output, Unicode positions, and migration reruns to the contract tests. Existing full sensor, distribution, installation, gate, and application behavior tests remain T-10/T-11 acceptance work.

T-09 owns the serialization/version design, validation, common evaluator, limited Rust/TypeScript proof, and explicit artifact migration. T-10 owns the production Rust executable, all-rule conversion, tuple/getter regressions, packaging of supported native targets, and integration. T-11 owns full TypeScript support. Exact schema versions, installation targets, and a deeper Rust semantic provider are implementation/release decisions that require their own evidence; this document does not mark them implemented.

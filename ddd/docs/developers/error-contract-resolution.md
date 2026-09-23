# Business-error contract resolution

[日本語](error-contract-resolution.ja.md) | [Inspection contract design](inspection-contract-design.md)

The `error-contract/1` contract resolves the declared return type and error type of one named operation from a prepared Cargo workspace or a TypeScript project, and reports the operation, the result contract, the error case set, the resolution path, and the completeness of each fact. Its public entry point is [`tools/ddd/lib/error-contract/index.ts`](../../tools/ddd/lib/error-contract/index.ts).

An inspection names its language, and that name decides which analysis condition it carries: a Rust request carries a Cargo condition and a TypeScript request carries a project condition. Neither ever carries the other's.

This contract reports resolution only. It emits no pass or violation verdict: comparing the observed case set with a canonical error set is a later contract. It is not connected to a production sensor or an approval gate.

`prepareErrorContractRequest(input: unknown)` returns `prepared` with an `InspectionRequest`, or `input-rejected` with one issue. `resolveErrorContract(request: unknown, execution: unknown)` returns `evaluated` with a `ContractResult`, or `input-rejected`. [`contract.ts`](../../tools/ddd/lib/error-contract/contract.ts) defines the exact fields and closed tags.

## Commands

```sh
bun run prepare:native                      # build and install the native extractor (protocol version 3)
bun run verify:error-contract               # run the fixed Rust scenario and print its evidence record
bun run verify:error-contract:typescript    # run the fixed TypeScript scenario and print its evidence record
bun run check                               # the whole gate, including all of the above
```

`bun run verify:error-contract --write` refreshes [`evidence/error-contract.json`](evidence/error-contract.json). `cargo` and `rustc` must be available; the fixed scenario in `tests/fixtures/error-contract/workspace` ships its own `Cargo.lock`.

`bun run verify:error-contract:typescript --write` refreshes [`evidence/error-contract-typescript.json`](evidence/error-contract-typescript.json). It needs neither a Rust toolchain nor the native executable: the fixed scenario in `tests/fixtures/error-contract/typescript-workspace` is resolved and type checked with the installed Compiler API alone.

## The Cargo analysis snapshot

An inspection is bound to one build condition. The caller resolves that condition at the Cargo boundary with [`resolveCargoCondition`](../../tools/ddd/lib/rust/error-contract/cargo-condition.ts), which runs `cargo metadata --format-version 1 --frozen` with one `--filter-platform` and one feature selection. `--frozen` forbids writing the lockfile and fetching, so an inspection never prepares dependencies; a workspace without a current lockfile resolves to `unavailable` instead of gaining one.

The recorded condition carries the target triple and, per workspace-owned package, its opaque Cargo package identity, its inspected `lib` target with a project-relative source path, its edition, its selected features, and its renamed dependencies. Only the library target is inspected, because resolution enters a package through its library crate root; a workspace member that has no library target offers no crate root and is left out of the condition rather than recorded as a package no inspection can enter. A package name is not an identity: two packages that share a name stay distinct records, and a reference that reaches such a name is reported as `multiple-package-versions` rather than merged. A renamed dependency is recorded under its extern name rather than its manifest spelling, because Cargo replaces a hyphen with an underscore for a name a Rust path can carry: the alias `billing-alias` is recorded as `billing_alias`, which is what a reference written in source names.

## The TypeScript analysis snapshot

A TypeScript inspection is bound to one project condition. The caller resolves that condition at the project boundary with [`resolveTypeScriptCondition`](../../tools/ddd/lib/typescript/error-contract/project-condition.ts), which reads the project's own `tsconfig.json` and the `package.json` of each package it references. The boundary only reads: it writes no file and creates no directory, so an inspection never prepares the project it inspects.

The recorded condition carries the supported Compiler API version, the module kind, the module resolution, the language target, the resolution conditions, and the requirement that the project type checks strictly. Per workspace-owned package it carries an opaque package identity, the declared name and version, the package root, the build unit that is its `tsconfig.json`, the entry points its `exports` publishes as project-relative targets, the packages its project references carry, and the packages its manifest depends on. A configuration this condition does not model is refused rather than narrowed to a default: an unsupported module kind, module resolution or language target, a project that does not type check strictly, and a dependency or project reference that names no package of this project all resolve to `unavailable`. Every path the condition records is a project-relative path with no empty and no dot segment, which is the same path a request accepts: a referenced package outside the project and an `exports` target that leaves its own package resolve to `unavailable` rather than to a condition the request would then refuse.

A dependency is recorded only when the version it states accepts the package this project carries. The selectors this boundary models are the workspace protocol (`workspace:*`, `workspace:^`, `workspace:~`, or `workspace:` with an exact version) and a bare exact version; either one must name the version the workspace package declares. A range, a comparator set, a tag, a registry alias or a link is refused as `unavailable` rather than read as accepting whatever version this project happens to carry, because which version a range accepts is a question this boundary does not answer. That refusal is a property of the project configuration and is separate from `unsupported-version-resolution`, which a reference reports when the condition already records more than one version of a name.

The condition also carries the declaration this project configures as its language-support result. TypeScript has no standard result of its own, so identity with that declaration, never the spelling of a name, is what decides whether an operation returns the standard result.

A package name is not an identity here either: two packages that share a name stay distinct records. A reference that reaches such a name is reported as `multiple-package-versions` when they share a version and as `unsupported-version-resolution` when they do not, rather than merged into one candidate.

## The request identity

The request identity is `sha256:` over canonical JSON of every known request field except the identity itself, so the analysis condition, the source snapshot, the project settings, and the toolchain all take part.

For Rust, changing the selected feature, the target triple, an edition, a package identity, a Cargo target, or a renamed dependency produces a different identity. For TypeScript, changing the Compiler API version, the resolution conditions, the configured result declaration, or any recorded package field — its name, version, root, build unit, entry points, project references or dependencies — does the same. In both cases a response prepared under the earlier condition is refused as `identity-mismatch` rather than reused, and the result is derived again.

## What Rust resolution supports

Resolution runs inside the native extractor, which parses with `syn` and never compiles or executes source. It walks the module tree from the crate root of the package's library target, accepting either project module layout for a child module but requiring exactly one file to declare it: no file declaring the module is `missing-referent`, and both layout spellings declaring it is `ambiguous-candidate`.

| Written form | Recorded step |
|---|---|
| A name written by its own spelling | `direct` |
| A path with more than one segment, including `crate`, `self` and `super` | `qualified` |
| A private `use` that renames | `use-rename` |
| A `pub use` re-export | `re-export` |
| A transparent type alias, expanded with its arguments | `type-alias` |
| A dependency reached through its renamed alias | `dependency-rename` |
| A concrete `Self` in an impl, reached through its owner | `self-type` |

Generic arguments are substituted structurally. A type alias is expanded only when its argument count matches its parameter count, and the standard result is recognised only with exactly two arguments. Generic arguments are never stripped to force a match: an argument count mismatch, a missing argument, and an argument that is still an open type parameter are all reported as `unsupported-type-argument`.

A type alias chain is followed to the standard result identity. An application-defined type named `Result` is not that identity: the result contract resolves with `standardResult: false` and names the local declaration, and the error case set is blocked with `shadowed-result-identity`.

The error case set is read from the resolved error enum. A `#[non_exhaustive]` enum and a variant behind a condition outside the selected feature set both produce a `partial` set that keeps its known cases and carries its reason. An incomplete list is never reported as an empty closed set.

## What TypeScript resolution supports

Resolution runs in this process on the Compiler API, pinned to the version the condition records. The program is built from the frozen snapshot and the recorded condition and from nothing else: no project discovery, no ambient type packages, and no emit. The only files it reads besides the snapshot are the compiler's own standard library assets. A program belongs to one request and is never held across calls, so a changed condition can never be answered from an earlier one's compiler.

Which file a specifier names is answered from the recorded entry points rather than from a package manifest read again at inspection time. A bare specifier reaches a package by its published subpath; a relative specifier reaches a file of the snapshot. A scoped name is one name across two segments, so `@scope/package/subpath` names the package `@scope/package` and the subpath `./subpath`, and a specifier that is a scope alone names no package. Reaching a package the importer's project references do not carry is refused as `invalid-project-reference` even when the file itself was found, so resolving a reference and being allowed to make it stay separate questions.

The resolution path records how the business error declaration was reached from the operation's declared return type. An operation that returns `void` states no result contract, so its result contract and its case set are both `absent`. A return type that names, directly or through transparent type aliases, a declaration that is not the configured result and does not carry its spelling is recorded as `standardResult: false` with an `absent` case set, and its path records how that declaration was reached.

| Written form | Recorded step |
|---|---|
| A name written as it is declared | `direct` |
| An import that renames | `import-alias` |
| A type-only import, kept as a dependency | `import-type` |
| An `export ... from` re-export | `re-export` |
| A transparent type alias, expanded with its arguments | `type-alias` |
| A package reached through an entry point its `exports` publishes | `package-entry` |
| A package reached through a path into its internals | `internal-path` |
| An operation reached through a structure and its companion | `companion` |

A declared entry point and a path into another package's internals stay apart even when both end at one declaration, and a relative path inside one package is neither of them. Whether a reference is type-only is recorded as its own step, so a type-only dependency stays a dependency and a value import is never reported as one.

Only a type annotation states a contract. The same spelling in a line comment, a block comment, a documentation comment, either string quote form or either template literal form is not in type position and establishes nothing: an operation that states no return type is reported as `expression-inference-required`, or as `unchecked-assertion` when only an assertion in its body states the shape. In type position that spelling is a string literal type, which is a case name rather than a type reference.

The closed error forms are one string literal type and a union whose members are all string literal types. A union that a wide member or a member carrying no case has joined cannot be closed, and is reported as `open-error-type` rather than as a set that happens to be empty.

## What stays unresolved, and why

Each bounded case has its own machine-readable reason, so a later contract can tell them apart.

| Reason | Raised by | Raised when |
|---|---|---|
| `shadowed-result-identity` | Rust, TypeScript | The return type names a declaration that is not the standard result under that spelling |
| `alias-cycle` | Rust, TypeScript | A type alias or name binding chain returns to itself |
| `ambiguous-candidate` | Rust | More than one active declaration, glob import or module file offers the name |
| `missing-referent` | Rust, TypeScript | The referenced declaration, module file, crate or entry point is not in the snapshot |
| `incomplete-case-set` | Rust | The error enum is `#[non_exhaustive]` |
| `unsupported-type-argument` | Rust, TypeScript | An argument cannot be substituted structurally |
| `multiple-package-versions` | Rust, TypeScript | The condition records more than one package with the referenced name |
| `trait-selection-required` | Rust | The error type depends on selecting an implementation for a type parameter |
| `associated-type-required` | Rust | The error type is an associated type projection |
| `expression-inference-required` | Rust, TypeScript | Only the body establishes the return type |
| `unknown-cfg` | Rust | A `cfg` predicate on a declaration or variant is not settled by the selected features |
| `macro-generated` | Rust | An item macro in the enclosing module, or a `derive` on the declaration, could still declare names |
| `escape-type` | TypeScript | The success or error type is `any` or `unknown` |
| `open-error-type` | TypeScript | The error type states no closed set of cases |
| `unchecked-assertion` | TypeScript | Only an assertion in the body states the returned shape |
| `invalid-project-reference` | TypeScript | The importer's project references do not carry the package the reference reached |
| `unsupported-version-resolution` | TypeScript | The condition records more than one version of the referenced package name |
| `unsupported-syntax` | Rust, TypeScript | The written form is not one this contract resolves, including any attribute it does not interpret |

The vocabulary extends the `state-exposure/1` reason codes rather than redefining them, so the process boundary keeps reporting `tool-unavailable`, `execution-failed`, `timeout`, `output-limit` and `resource-limit` with their existing meaning.

## Syntax success is not compiler acceptance

The extractor reports whether `syn` parsed the source. It never reports that the compiler accepted it. `bun run verify:error-contract` measures the two separately: it resolves each case with the extractor and compiles the same source with `rustc --emit metadata`, and records `syntax_parsed` and `compiler_accepted` as independent values together with the verified `rustc`, `cargo`, `bun` and `syn` versions. Five of the recorded cases parse while the compiler rejects them, with the diagnostics `E0107`, `E0391`, `E0432` and `E0659`.

## Resolution is not compiler acceptance

The same separation holds for TypeScript, where the extractor and the type checker are the same Compiler API. `bun run verify:error-contract:typescript` keeps them apart by building two programs. The inspection's program answers a specifier from the recorded entry points; the acceptance program is built from the project's own `tsconfig.json`, with the workspace links a package manager would install supplied from the project's own `package.json` files rather than from the recorded condition. Each case records `compiler_accepted` next to its `resolution_reasons`, and all but two of the refused cases compile: only the module with a self-referencing alias chain and the module whose import names no module of the project are rejected by the compiler.

## Ordinary code that still needs more semantic analysis

These shapes are ordinary intended use, not contrived input. They resolve no further here and are the handover to the production Rust executable work. Each one is present in `tests/fixtures/error-contract/workspace/billing-domain/src/limits.rs`.

Trait implementation selection — the error type is chosen by the implementation bound to a caller-supplied parameter:

```rust
pub fn issue<T: Failing>(&mut self, inner: &mut T) -> core::result::Result<(), T::Error> {
    inner.issue()
}
```

Associated type projection — the operation is declared through a trait and names the error through the implementing type:

```rust
impl Failing for Invoice {
    type Error = crate::errors::IssueInvoiceError;

    fn issue(&mut self) -> core::result::Result<(), Self::Error> {
        Ok(())
    }
}
```

General expression inference — only the body establishes the returned type:

```rust
pub fn issue(&mut self) -> impl core::fmt::Debug {
    0u8
}
```

Resolving any of these needs a semantic provider verified for the same snapshot. Adding one is a separate compatibility and distribution decision, not part of adopting `syn`.

## Out of scope here

Whole-Cargo-configuration and whole-Rust-syntax guarantees, arbitrary type, lifetime and const argument resolution, trait solving, macro expansion, `rustc-private` and rust-analyzer integration, comparing the case set with canonical errors, migrating the production sensors, and shipping the native executable.

On the TypeScript side: whole-TypeScript-rule guarantees, arbitrary monorepo layouts, conditional and pattern entry points, type features beyond transparent aliases and closed literal unions, `neverthrow`, Effect and fp-ts integration, Next.js, Workers and Edge integration, arbitrary reference leak and business invariant proofs, and the full rule set for public boundary violations.

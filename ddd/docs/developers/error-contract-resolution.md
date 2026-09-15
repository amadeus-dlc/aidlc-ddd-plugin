# Business-error contract resolution

[日本語](error-contract-resolution.ja.md) | [Inspection contract design](inspection-contract-design.md)

The `error-contract/1` contract resolves the declared return type and error type of one named operation from a prepared Cargo workspace, and reports the operation, the result contract, the error case set, the resolution path, and the completeness of each fact. Its public entry point is [`tools/ddd/lib/error-contract/index.ts`](../../tools/ddd/lib/error-contract/index.ts).

This contract reports resolution only. It emits no pass or violation verdict: comparing the observed case set with a canonical error set is a later contract. It is not connected to a production sensor or an approval gate.

`prepareErrorContractRequest(input: unknown)` returns `prepared` with an `InspectionRequest`, or `input-rejected` with one issue. `resolveErrorContract(request: unknown, execution: unknown)` returns `evaluated` with a `ContractResult`, or `input-rejected`. [`contract.ts`](../../tools/ddd/lib/error-contract/contract.ts) defines the exact fields and closed tags.

## Commands

```sh
bun run prepare:error-contract   # build and install the native extractor (protocol version 3)
bun run verify:error-contract    # run the fixed scenario and print its evidence record
bun run check                    # the whole gate, including both of the above
```

`bun run verify:error-contract --write` refreshes [`evidence/error-contract.json`](evidence/error-contract.json). `cargo` and `rustc` must be available; the fixed scenario in `tests/fixtures/error-contract/workspace` ships its own `Cargo.lock`.

## The analysis snapshot

An inspection is bound to one build condition. The caller resolves that condition at the Cargo boundary with [`resolveCargoCondition`](../../tools/ddd/lib/rust/error-contract/cargo-condition.ts), which runs `cargo metadata --format-version 1 --frozen` with one `--filter-platform` and one feature selection. `--frozen` forbids writing the lockfile and fetching, so an inspection never prepares dependencies; a workspace without a current lockfile resolves to `unavailable` instead of gaining one.

The recorded condition carries the target triple and, per workspace-owned package, its opaque Cargo package identity, its inspected `lib` target with a project-relative source path, its edition, its selected features, and its renamed dependencies. Only the library target is inspected, because resolution enters a package through its library crate root; a workspace member that has no library target offers no crate root and is left out of the condition rather than recorded as a package no inspection can enter. A package name is not an identity: two packages that share a name stay distinct records, and a reference that reaches such a name is reported as `multiple-package-versions` rather than merged.

The request identity is `sha256:` over canonical JSON of every known request field except the identity itself, so the Cargo condition, the source snapshot, the project settings, and the toolchain all take part. Changing the selected feature, the target triple, an edition, a package identity, a Cargo target, or a renamed dependency produces a different identity, and a response prepared under the earlier condition is refused as `identity-mismatch` rather than reused.

## What resolution supports

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

## What stays unresolved, and why

Each bounded case has its own machine-readable reason, so a later contract can tell them apart.

| Reason | Raised when |
|---|---|
| `shadowed-result-identity` | The return type names an application-defined `Result` |
| `alias-cycle` | A type alias or name binding chain returns to itself |
| `ambiguous-candidate` | More than one active declaration, glob import or module file offers the name |
| `missing-referent` | The referenced declaration, module file or crate is not in the snapshot |
| `incomplete-case-set` | The error enum is `#[non_exhaustive]` |
| `unsupported-type-argument` | An argument cannot be substituted structurally |
| `multiple-package-versions` | The condition records more than one package with the referenced name |
| `trait-selection-required` | The error type depends on selecting an implementation for a type parameter |
| `associated-type-required` | The error type is an associated type projection |
| `expression-inference-required` | Only the body establishes the return type |
| `unknown-cfg` | A `cfg` predicate on a declaration or variant is not settled by the selected features |
| `macro-generated` | An item macro in the enclosing module, or a `derive` on the declaration, could still declare names |
| `unsupported-syntax` | The written form is not one this contract resolves, including any attribute it does not interpret |

The vocabulary extends the `state-exposure/1` reason codes rather than redefining them, so the process boundary keeps reporting `tool-unavailable`, `execution-failed`, `timeout`, `output-limit` and `resource-limit` with their existing meaning.

## Syntax success is not compiler acceptance

The extractor reports whether `syn` parsed the source. It never reports that the compiler accepted it. `bun run verify:error-contract` measures the two separately: it resolves each case with the extractor and compiles the same source with `rustc --emit metadata`, and records `syntax_parsed` and `compiler_accepted` as independent values together with the verified `rustc`, `cargo`, `bun` and `syn` versions. Five of the recorded cases parse while the compiler rejects them, with the diagnostics `E0107`, `E0391`, `E0432` and `E0659`.

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

# Rust + syn parser experiment

English | [Japanese](rust-syn-spike.ja.md) | [Developer documentation](README.md)

Verified on 2026-09-13 against production baseline `83fadbfb8ac1100637dd157bc55621eae441da02`.

Updated on 2026-09-23 for T-10-02: rules `a` and `d` now decide on the native extractor instead of tree-sitter, so the comparison below separates what each extractor reports from what the gate answers.

**Decision: Rust + syn is adopted as the Rust syntax backend for T-09/T-10.** The user approved this direction after the experiment. It extracts useful DDD inspection facts and runs as a relocated native executable, and reproduces two missed public tuple-field cases in the current sensor. Production replacement still needs the [resolution and shared contract design](inspection-contract-design.md) implemented and verified, full rule parity, and supported-platform distribution tests. This experiment does not replace the installed sensors or complete T-09/T-10.

## The comparison is deliberately bounded

The [experiment](../../experiments/rust-syn/) uses syn 3.0.5, pinned in Cargo.toml, with a committed Cargo.lock. The production implementation uses Bun/TypeScript and tree-sitter-rust WASM. Both implementations receive the same source text. The [verifier](../../scripts/verify-rust-syn.ts) checks 31 source cases, runs 5 cases through the real domain sensor, and rejects 6 malformed protocol inputs. Thirty-one successful experiment assertions are not thirty-one valid Rust programs: some inputs intentionally fail compilation or require unresolved inspection.

Implemented in the experiment:

- Rule `a` candidates for non-private named and tuple struct fields, including restricted visibility, raw identifiers, Unicode, and line locations.
- Syntax facts for impl/trait/free-function signatures, receiver forms, textual return types, enum variants, aliases, imports, modules, and method calls.
- A field-return shape recognizer, including explicit `return self.amount;`. It is not a complete implementation of getter-call rule `d` or a proof about effects.
- Explicit unresolved results for tested macros, attributes/derives, conditional compilation, external modules, malformed syntax, unions, and unsupported modifiers.

The actual sensor comparison covers `a` and `d`. Its normal named-field and tail-expression getter cases agree with the earlier behavior. Whole-sensor equivalence, the canonical artifact schema, command/factory error membership, ownership effects, and business invariants are outside this prototype.

## The two extractors and the gate verdict answer different questions

Rules `a` and `d` decide on the native extractor's facts (T-10-02), so the tree-sitter column below is that extractor's own output and no longer the gate's answer. The verdict column is what `ddd-rust-domain` reports for the input today.

| Input | tree-sitter extractor | native extractor | `ddd-rust-domain` verdict |
|---|---|---|---|
| Private named field | No `a` field | No `a` member | No `a` finding |
| `pub amount: u64` | `a` field | `a` member | `a` finding |
| `pub struct Invoice(pub u64);` | No `a` field | `a` member | `a` finding |
| `pub struct Invoice(pub(crate) u64, u64);` | No `a` field | `a` member | `a` finding |
| Getter with tail expression `self.amount` | Getter syntax recognized | Getter syntax recognized | `d` finding at the call |
| Getter with `return self.amount;` | Getter syntax missed | Getter syntax recognized | `d` finding at the call |

The three rows whose verdict moved — the two public tuple members and the explicit-`return` getter — are the cases this migration changed. The verifier runs each of them plus the two unchanged controls through the real sensor and records both counts per case in the [execution evidence](evidence/rust-syn-spike.json) under `actual_sensor_comparisons`. The `treeSitterFields` and `treeSitterGetters` baselines in [cases.json](../../experiments/rust-syn/cases.json) stay empty on purpose: the tree-sitter extractor still misses these forms, and correcting it is outside T-10-02. The experiment makes no comparative speed claim.

## What rules `a` and `d` still read from tree-sitter

The native facts decide *whether* a member is public and *whether* a method body only hands back a member of `self`. Everything that turns those facts into a finding still comes from the tree-sitter extractor, and this is the remaining boundary:

- Which files make up the program. The Cargo workspace scan, the layer assignment, and the `mod` walk in [`rust-modules.ts`](../../tools/ddd/lib/packaging/rust-modules.ts) choose the batch the native extractor is asked about.
- Type resolution. `impl` blocks are bound to declarations, and a call's receiver type is resolved, by [`program.ts`](../../tools/ddd/lib/rules/rust/program.ts). The native answer carries the self type only as the text the join is keyed on.
- Call sites. Rule `d` finds its calls, their receiver text, and the forwarded-argument repository exception through the tree-sitter call facts.
- Macro-opaque regions and parse errors in the claimed files are still reported from the tree-sitter parse.

Two limits of the native answer are recorded rather than acted on. An attribute or derive macro can append items the parser never sees; because it cannot change the members of the declaration it annotates, it is not recorded per occurrence. Item macros and `cfg`/`cfg_attr` are recorded as `domain-facts.unresolved` notes on the verdict. On a run where rules `a` and `d` have a claimed file to decide, a file the parser rejects is a note only while it is not among the ones these rules are decided from (the claimed files the gate inspects, plus every source of a domain-layer crate); when it is among them the gate stops as inspection-impossible and reports the extractor's reason, because "this file declares nothing public" is the one answer an unread file must not give.

## Parsing does not resolve names or types

Syn documents its role as parsing Rust tokens into a syntax tree. `parse_file` accepts source text without an edition argument. Its modifiers and non-exhaustive/Verbatim nodes also require consumers to handle unsupported syntax explicitly. See the [syn API](https://docs.rs/syn/3.0.5/syn/), [parse_file](https://docs.rs/syn/3.0.5/syn/fn.parse_file.html), and [source-span support](https://docs.rs/proc-macro2/latest/proc_macro2/struct.Span.html).

The verifier demonstrates these boundaries with rustc:

- `MissingType` and a string returned from a function declared `-> u64` both parse; rustc rejects them. Parser success cannot satisfy type-dependent DDD rules.
- An aliased `Outcome<T>`, a re-exported error, and `Self::Error` retain useful syntax, but their target types remain unresolved. An application-defined `Result<T, E>` also parses; matching the spelling `Result` cannot establish the standard result/error contract.
- An inferred receiver call parses, but its receiver type remains unsupported.
- Identical `async fn` source parses for both trials; rustc rejects edition 2015 and accepts 2018. The simple struct control compiles in 2015/2018/2021/2024. This is an edition-boundary probe, not edition compatibility certification.
- Macro-generated fields are absent from unexpanded syntax. A field behind false `cfg` is present syntactically. The experiment reports both situations as unresolved, retaining field candidates without treating them as confirmed violations.
- Both `invoice.rs` and `invoice/mod.rs` containing `mod line;` report an external module requiring loading. The experiment does not discover child files or validate the project's module-layout setting.

Cargo workspace/target/feature discovery, imports and aliases across files/crates, generic substitution, trait resolution, macro expansion, and effective `cfg` selection remain separate responsibilities. Running `cargo check` establishes compiler acceptance but does not, by itself, deliver the resolved symbols required by custom DDD checks.

## A native executable is feasible on the tested host

The release binary was copied into a fresh temporary directory and executed with an empty PATH and no inherited environment. It needed neither Cargo/rustc nor Bun/tree-sitter at runtime. On the tested Apple Silicon Mac, the stripped executable was about 1.86 MB and linked only the system `libSystem.B.dylib`. Input hashes, exact versions, binary size/dependencies, timings, and per-case results are in the [execution evidence](evidence/rust-syn-spike.json).

Building this experiment requires the Rust toolchain and initially access to crates.io. The verifier additionally requires Bun and the existing WASM assets. This does not add Rust as a requirement for current plugin users.

Before production distribution, decide supported OS/architecture targets, build/release binaries for each, verify checksums and executable permissions, test installation/update behavior, and define the missing-binary response. Avoid compiling source during sensor execution. A WASM build is another possible packaging choice; it was not attempted here. Linux, Windows, x86_64, minimum OS/Rust versions, and plugin installation/gate integration are unverified.

## Reproduce and inspect the result

From the repository root:

```sh
cd ddd
bun run experiment:rust-syn
# Deliberately refresh the committed execution record:
bun run experiment:rust-syn --write
cargo fmt --manifest-path experiments/rust-syn/Cargo.toml --check
cargo clippy --locked --manifest-path experiments/rust-syn/Cargo.toml --all-targets -- -D warnings
```

The command builds with `--locked`, verifies the fixtures and real-sensor comparisons, runs rustc on compiler-oracle cases, checks relocation and deterministic output, and prints JSON. Any assertion failure exits nonzero. The `treeSitterFields` / `treeSitterGetters` baselines record what the tree-sitter extractor still misses; `SENSOR_EXPECTATIONS` in the verifier records what the gate answers. Update the pair that a production change actually moves, and this report with it.

The experimental executable accepts one JSON request on stdin. Protocol 1 below is the experiment's own; the sensors read the `domain-facts` protocol described in [native extractor distribution](native-extractor-distribution.md), never this one.

```json
{"protocol_version":1,"files":[{"path":"invoice.rs","source":"pub struct Invoice(pub u64);"}]}
```

It emits JSON with `field_inspection.state` (`pass`, `violation`, or `unresolved`), field candidates, syntax facts, and `semantic_analysis: "unsupported"`. `pass` applies only to this limited field inspection. Exit 0 means a report was produced, including unresolved reports; malformed requests exit 2 with stderr and no stdout. This is an experimental protocol, not the existing sensor verdict contract or the future shared schema. Syn nodes never cross the process boundary. There is no project-wide pass verdict.

## Feed the findings into the shared design

Keep the [language-independent contracts](language-independent-design.md) authoritative. T-09 implements the [inspection design](inspection-contract-design.md): required facts, resolution/completeness states, and the boundary between shared evaluation and language-specific analysis. T-10-02 has closed the two tuple-field regressions and the explicit-return getter for rules `a` and `d`, in both module layouts. The remaining Rust rules, the module-layout inspection, and the removal of the tree-sitter assets are still to migrate. Required unresolved facts must block approval. The TypeScript Compiler API implementation exercises the same contract with equivalent business scenarios.

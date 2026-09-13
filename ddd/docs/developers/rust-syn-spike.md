# Rust + syn parser experiment

English | [Japanese](rust-syn-spike.ja.md) | [Developer documentation](README.md)

Verified on 2026-09-13 against production baseline `83fadbfb8ac1100637dd157bc55621eae441da02`.

**Decision: Rust + syn is adopted as the Rust syntax backend for T-09/T-10.** The user approved this direction after the experiment. It extracts useful DDD inspection facts and runs as a relocated native executable, and reproduces two missed public tuple-field cases in the current sensor. Production replacement still needs the [resolution and shared contract design](inspection-contract-design.md) implemented and verified, full rule parity, and supported-platform distribution tests. This experiment does not replace the installed sensors or complete T-09/T-10.

## The comparison is deliberately bounded

The [experiment](../../experiments/rust-syn/) uses syn 3.0.5, pinned in Cargo.toml, with a committed Cargo.lock. The production implementation uses Bun/TypeScript and tree-sitter-rust WASM. Both implementations receive the same source text. The [verifier](../../scripts/verify-rust-syn.ts) checks 31 source cases, runs 4 cases through the real existing domain sensor, and rejects 6 malformed protocol inputs. Thirty-one successful experiment assertions are not thirty-one valid Rust programs: some inputs intentionally fail compilation or require unresolved inspection.

Implemented in the experiment:

- Rule `a` candidates for non-private named and tuple struct fields, including restricted visibility, raw identifiers, Unicode, and line locations.
- Syntax facts for impl/trait/free-function signatures, receiver forms, textual return types, enum variants, aliases, imports, modules, and method calls.
- A field-return shape recognizer, including explicit `return self.amount;`. It is not a complete implementation of getter-call rule `d` or a proof about effects.
- Explicit unresolved results for tested macros, attributes/derives, conditional compilation, external modules, malformed syntax, unions, and unsupported modifiers.

The actual sensor comparison covers `a` only. Its normal named-field positive/negative cases agree. Whole-sensor equivalence, the canonical artifact schema, command/factory error membership, ownership effects, and business invariants are outside this prototype.

## The experiment exposes concrete gaps in the current extractor

| Input | Existing implementation | syn experiment |
|---|---|---|
| Private named field | No `a` finding | No `a` candidate |
| `pub amount: u64` | `a` finding | `a` candidate |
| `pub struct Invoice(pub u64);` | No `a` finding | `a` candidate |
| `pub struct Invoice(pub(crate) u64, u64);` | No `a` finding | `a` candidate |
| Getter with tail expression `self.amount` | Getter syntax recognized | Getter syntax recognized |
| Getter with `return self.amount;` | Getter syntax missed | Getter syntax recognized |

The first four rows were checked through the real existing sensor as well as the prototype. The last two compare extracted method facts. These misses are defects in the current extraction logic, not intrinsic limitations of tree-sitter. Retaining tree-sitter and correcting those paths remains a technically viable alternative. The experiment makes no comparative speed claim.

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

The command builds with `--locked`, verifies the fixtures and real-sensor comparisons, runs rustc on compiler-oracle cases, checks relocation and deterministic output, and prints JSON. Any assertion failure exits nonzero. Baseline expectations intentionally record the existing misses; update them and this report when production fixes land.

The experimental executable accepts one JSON request on stdin:

```json
{"protocol_version":1,"files":[{"path":"invoice.rs","source":"pub struct Invoice(pub u64);"}]}
```

It emits JSON with `field_inspection.state` (`pass`, `violation`, or `unresolved`), field candidates, syntax facts, and `semantic_analysis: "unsupported"`. `pass` applies only to this limited field inspection. Exit 0 means a report was produced, including unresolved reports; malformed requests exit 2 with stderr and no stdout. This is an experimental protocol, not the existing sensor verdict contract or the future shared schema. Syn nodes never cross the process boundary. There is no project-wide pass verdict.

## Feed the findings into the shared design

Keep the [language-independent contracts](language-independent-design.md) authoritative. T-09 implements the [inspection design](inspection-contract-design.md): required facts, resolution/completeness states, and the boundary between shared evaluation and language-specific analysis. T-10 covers the two tuple-field regressions and explicit-return getter, migrates every existing Rust rule, and validates both module layouts and supported distributions. Required unresolved facts must block approval. The TypeScript Compiler API implementation exercises the same contract with equivalent business scenarios.

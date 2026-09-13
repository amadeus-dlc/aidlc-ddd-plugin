# Language extraction and state exposure verification

[日本語](state-exposure-verification.ja.md) | [Shared contract](state-exposure-inspection.md)

`bun run verify:state-exposure` extracts evidence for one explicitly selected type from frozen Rust or TypeScript source and delegates judgment to U1's `state-exposure/1`. Inspected source is never executed. Production sensor entry points and outputs remain unchanged.

## Preparation and commands

Run from `ddd/`. Verified versions: Bun 1.3.13, Cargo/rustc 1.95.0, TypeScript **6.0.3**, `@types/bun` **1.3.13**, syn **3.0.5**, sha2 **0.10.9**, Biome **2.5.12**. TypeScript 6.0.3 is pinned exactly for its `Program` and `TypeChecker` API.

Fetch dependencies explicitly on initial setup:

```sh
bun install --frozen-lockfile
cargo fetch --locked --manifest-path experiments/rust-syn/Cargo.toml
```

Build from the prepared cache, then verify:

```sh
bun run prepare:state-exposure
bun run verify:state-exposure --case all
bun run test:state-exposure
bun run test:state-exposure:native
bun run typecheck:state-exposure
bun run experiment:rust-syn
bun run check
```

Preparation reads the host from `rustc -vV`, builds with explicit `--target`, `--locked --offline --release`, and copies the binary to `experiments/rust-syn/target/state-exposure/ddd-rust-syn-spike`. Build preparation has a 120-second subprocess limit; failed builds are not copied. Identical bytes are not recopied. A version probe at the fixed path verifies readiness with a separate 180-second bound. A cold dependency build or OS executable initialization may exceed that limit. Inspect the diagnostic and rerun preparation explicitly. Reprepare after source or lockfile changes. C2 never fetches, builds, copies, or retries implicitly.

`check` preserves existing formatting, plugin validation and development-scope checks, and runs explicit offline preparation, the ordinary full suite, native tests, the v1 comparison, C2 and scoped strict typechecking as separate steps. U1's own tests need neither parser. The full suite now includes real extraction and requires the prepared binary.

## Supported evidence

| Representation | Supported evidence | Unresolved boundaries |
|---|---|---|
| Rust named/tuple struct | Direct declarations and inline module paths; private, pub and restricted visibility; UTF-8 field locations | Missing/ambiguous type namespace, external modules, unexpanded macros, non-doc attributes, syntax errors |
| TypeScript class | Declared fields with initializers or direct constructor assignments; runtime-private `#` fields; operation methods | Inheritance, decorators, accessors, computed names, declare/abstract members, uncertain construction |
| Type and same-name companion | Shared local type/value symbol, nonexported unique-symbol brand, local const instance, direct returns and local `ok:true/value` wrappers | Exported/aliased or mismatched brands, spread, unsupported computed names, assertions, aliases/reassignment, unknown returns, distinct instance shapes |

TypeScript `private`, `protected` and `readonly` do not establish runtime privacy: ordinary data properties remain exposed. Constructor-local functions containing `this`, including immediately invoked arrows and synchronous callbacks, make enumeration `partial` with an `unsupported-syntax` reason. Their call flow is not inferred. Independently confirmed public-field findings remain present. Returns in ordinary instance operation methods remain separate from construction flow. Confirmed operation methods and brand markers carry `absent` evidence. Brand construction must be a direct standard-library `Symbol()` call or `Symbol("description")` with one string literal, verified through TypeChecker symbol and signature identity. Assertions (including nested as/type assertions/satisfies), Symbol.for, shadowed or aliased Symbol, and indirect variables/factories remain unresolved. The companion supports one factory method whose declared return type identifies the target directly or as a local Result success value. Returns inside instance methods are excluded from factory control flow.

The CompilerHost reads only frozen input and pinned compiler-owned `lib.*.d.ts` assets. It performs no project or ambient `@types` discovery and does not resolve external imports/reexports. The initial effective settings object is empty; unsupported settings become unresolved. All settings and actual extractor/parser versions participate in request identity.

Rust native v2 is separate from preserved v1. It returns request identity, target, original-source SHA-256, certainty, completeness and byte ranges. The adapter validates the native shape, source identity and UTF-8 boundaries before conversion. BOM/shebang removal by syn is corrected. Common line numbering accounts for CRLF, LF, CR, U+2028 and U+2029. Unknown target establishment never produces confirmed findings; uncertainty limited to one field retains independently confirmed exposure elsewhere.

## CLI and execution states

Options: `--case all|caseId` (default all), `--timeout-ms` (default 30000), `--max-output-bytes` (default 1048576). Limits accept positive safe integers; deadlines beyond the 32-bit timer range use a monotonic clock and bounded timer segments. Unknown/duplicate options, unknown IDs, empty collections and malformed expected values are rejected before extraction.

Stdout contains exactly one `state-exposure-verification/1` JSON report and newline. Diagnostics use stderr. The report retains the run ID, command, actually available tool versions, environment, and case-ID-sorted expectations, observations and differences.

| Exit | Status | Meaning |
|---|---|---|
| 0 | passed | Every selected case matched completely and required paths ran |
| 1 | mismatch | Observed result, reason, target or evidence differed |
| 2 | usage-error | Invalid arguments, ID or bundled case definition |
| 3 | execution-error | Missing real tool, actual timeout or unexpected failure prevented verification |

The supervisor waits for process close, including after killing timed-out or oversized executions. Startup failures are `unavailable`; failures after startup are `failed`. Normal empty/whitespace stdout becomes `completed/response:null`. Invalid nonempty or multiple outputs become `completed/response:"invalid-native-response"`. U1 returns `unresolved/invalid-response` without changing observed normal termination to failure. Normal termination alone never means pass.

The [23 bundled cases](../../tests/fixtures/state-exposure-languages/cases.json) contain 14 real source paths covering the four representations, private/public/unresolved states, mixed evidence and target absence. Nine controlled execution scenarios cover empty, whitespace, invalid and multiple output, abnormal exit, timeout, stdout overflow, stderr resource overflow and deliberate startup failure. A scenario-start marker distinguishes the intended branch from broken test-fixture startup. Expectations were independently authored; only request identity is filled from C1 preparation. Actual judgments are never copied into expectations.

## Evidence and limits

The [execution record](evidence/state-exposure-check.json) records the environment, versions, commands and outcomes separately for isolated tests, real extraction, C2 and existing regressions. Successful results retain target, completeness and private/absent evidence. An evidence-only change is tested to produce exit 1.

The v1 comparison uses explicit host and locked/offline builds. Preparation of its relocated binary has a separate 180-second warmup bound; every original v1 test retains its 10-second limit and expectations. Warmup duration is recorded; OS cold startup is not a performance guarantee.

Only macOS arm64 was verified. General type resolution, Cargo semantics, macro expansion, cfg selection, operation effects, mutable-reference leakage, external Result libraries, other operating systems, production sensor migration and distribution are outside this verification.

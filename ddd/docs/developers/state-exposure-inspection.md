# Shared state-exposure inspection

[日本語](state-exposure-inspection.ja.md)

The `state-exposure/1` contract validates a request and extracted evidence, then evaluates whether a specified type directly exposes retained state. Its public entry point is [`tools/ddd/lib/state-exposure/index.ts`](../../tools/ddd/lib/state-exposure/index.ts). It does not read files, run an analyzer, or replace the existing production Rust sensors.

`prepareInspectionRequest(input: unknown)` returns `prepared` with an `InspectionRequest`, or `input-rejected` with one or more issues. `inspectStateExposure(request: unknown, execution: unknown)` returns `evaluated` with an `InspectionResult`, or `input-rejected`. All contract types are named exports from the entry point; [`contract.ts`](../../tools/ddd/lib/state-exposure/contract.ts) defines their exact fields and closed tags.

## Request identity

The caller supplies a language (`rust` or `typescript`), one target, nonempty source and toolchain lists, and resolved settings. Rust accepts `rust-struct`; TypeScript accepts `ts-class` and `ts-companion`. The caller owns source extraction and must use the same source strings, settings, and actual tool versions used to prepare the request.

Sources have unique relative POSIX paths. Empty, absolute, backslash, NUL, and dot-segment paths are rejected. The target file must occur in the sources and its declaration path must contain nonempty names. Tool names are unique and versions are nonempty. No filesystem lookup or case/Unicode normalization occurs.

Each source snapshot records its SHA-256, UTF-8 byte length, and line starts without changing BOMs or line endings. CRLF is one newline; CR, LF, U+2028, and U+2029 each start a new line. A trailing newline retains the final empty line. Empty content has `lineStarts: [0]`.

The request identity is `sha256:` plus 64 lowercase hex characters, over canonical JSON of the request's known fields except the identity itself. Sources and tools sort by path/name. Object keys sort recursively by Unicode scalar values, arrays retain order, safe integers use decimal notation, and negative zero becomes zero. Every settings key participates. Unknown supplementary fields elsewhere are ignored after JSON validation. Inspection revalidates ordering, ranges, references, and the recomputed identity.

JSON boundaries reject undefined, functions, BigInt, nonfinite or unsafe/noninteger numbers, invalid Unicode, instances, sparse/extended arrays, accessors, symbol keys, and cycles. Shared references are copied as values. JSON traversal, copying, and canonical serialization are iterative, including deeply nested settings.

## Evidence and judgment

The execution envelope separates `completed`, `unavailable`, and `failed`. A completed envelope requires its own `response` key. Missing keys or non-JSON values reject the invocation. `response: null` means no response and produces `evaluated / completed / unresolved`, with `invalid-response` and `checkedEvidence: null`. Other malformed JSON responses do the same. Unknown schema versions and foreign request identities produce `unknown-version` and `identity-mismatch`; they never provide findings.

A resolved target requires target evidence and a member enumeration. Each member has a unique ID and one fact:

| Fact | Meaning | Required support |
| --- | --- | --- |
| `resolved / true` | Retained state is directly exposed, including readonly data | Nonempty locations |
| `resolved / false` | Retained state is not directly exposed | Nonempty locations |
| `absent` | The member is confirmed not to be retained state | Nonempty locations |
| `unresolved` | The member's meaning cannot be established | Nonempty reasons |

`complete` enumeration has no enumeration reasons. `partial` requires reasons and may contain no items. Target/member evidence must refer to the target file. Locations use safe integer UTF-8 byte ranges with `0 <= byteStart < byteEnd <= byteLength` and a matching one-based start line. Issue locations may reference any request source, or be null when unknown. U1 cannot reconstruct character boundaries or prove syntax from source hashes; language extraction tests own those checks.

| Evidence | Rule result | Findings |
| --- | --- | --- |
| Complete, resolved facts, no exposed state | `pass` | Empty |
| Complete, resolved facts, exposed state | `violation` | Confirmed exposed members |
| Unresolved target, partial enumeration, or unresolved fact | `unresolved` | Confirmed exposed members are retained |
| Invalid response, unavailable tool, or failed execution | `unresolved` | Empty |

Invalid evidence rejects the entire response; no partly valid findings are salvaged. A valid partial response is different: its confirmed violations and unresolved reasons both survive. The contract has no `not-applicable` result.

Every result includes a detached target. Valid evidence, including pass evidence, is retained as `checkedEvidence`: target locations, completeness, private/absent facts, and supporting locations are preserved. Unknown fields are stripped. Members/findings sort by member ID; locations by file/start/end; reasons by code/subject/location/message, with null locations first. Strings use Unicode scalar order. Sorting does not deduplicate evidence or reasons. Input mutation after return cannot change previous results.

## Example with explicit fixture evidence

Run from `ddd/`. This sample supplies fixture evidence manually; it does not demonstrate Rust extraction.

```typescript
import { inspectStateExposure, prepareInspectionRequest } from "./tools/ddd/lib/state-exposure/index.ts";

const prepared = prepareInspectionRequest({
  language: "rust",
  target: { file: "model.rs", declarationPath: ["Model"], representation: "rust-struct" },
  sources: [{ path: "model.rs", content: "struct Model;\n" }],
  settings: {},
  toolchain: [{ name: "fixture", version: "1" }],
});
if (prepared.kind === "prepared") {
  const outcome = inspectStateExposure(prepared.request, {
    status: "completed",
    response: {
      schemaVersion: "state-exposure/1",
      requestIdentity: prepared.request.requestIdentity,
      evidence: {
        targetStatus: "resolved",
        targetEvidence: [{ file: "model.rs", line: 1, byteStart: 0, byteEnd: 13 }],
        members: { completeness: "complete", items: [], reasons: [] },
      },
    },
  });
  console.log(JSON.stringify(outcome));
}
```

## Standalone verification

Use the existing Bun environment and installed development dependencies. From `ddd/`:

```sh
bun test tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts
./node_modules/.bin/biome check --error-on-warnings tools/ddd/lib/state-exposure tests/state-exposure-contract.test.ts tests/state-exposure-inspection.test.ts
bun build tools/ddd/lib/state-exposure/index.ts --target bun --format esm --outfile /tmp/aidlc-u1-01a09a8b-smoke.mjs
bun test tests/u2-rust-analysis-foundation.test.ts tests/u5-rust-code-sensors.test.ts tests/u5-golden.test.ts
```

Tests return exit code 0 when expectations pass and nonzero on failures. The shared tests do not start Rust or TypeScript analyzers. The last command separately checks existing Rust behavior.

Verified on macOS arm64 with Bun 1.3.13 and Biome 2.5.12: 138 shared tests passed (273 assertions), Biome checked nine files without errors or warnings, Bun bundled seven modules, and 79 existing Rust baseline tests passed (162 assertions) both before and after implementation. Initial fixture byte-count mistakes were corrected; existing tests and acceptance conditions were unchanged.

The Bun build checks syntax and bundling, **not static types**. Static type checking of both units, real Rust/TypeScript extraction, and the development verification command belong to U2 and are not claimed as completed by these tests. No new runtime dependency or production integration is included.

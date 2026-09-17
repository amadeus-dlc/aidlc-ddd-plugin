# Operation error-set comparison

[日本語](operation-error-set.ja.md) | [Business-error contract resolution](error-contract-resolution.md) | [Inspection contract design](inspection-contract-design.md)

`operation-error-set/1` judges, for every command and generation method of one aggregate mapping, whether the set of error cases the code declares is exactly the set of business errors the canonical model gives that operation. The public entry point is [`tools/ddd/lib/operation-error-set/index.ts`](../../tools/ddd/lib/operation-error-set/index.ts).

Resolving the operation, its result contract and its error case set belongs to [`error-contract/1`](error-contract-resolution.md). This contract binds those observations to one aggregate of the canonical model (`schema_version: 2`) and of the implementation mapping (`schema_version: 2`), and returns one judgement per operation. It reads no source, syntax tree or compiler object, and it never takes a symbol id apart. It is not connected to the production sensors or the approval gate; T-10 connects it.

`prepareOperationErrorSetRequest(input: unknown)` returns `prepared` with a request, or `input-rejected` with one reason. The input is an object with three fields.

| Field | Content |
|---|---|
| `model` | The canonical model as the loader normalises it |
| `mapping` | One aggregate entry of the implementation mapping as the loader normalises it |
| `observations` | `{ operationRef, request }` for each mapped operation, where `request` is a prepared `error-contract/1` request |

`inspectOperationErrorSet(request: unknown, executions: unknown)` returns `evaluated` with a result, or `input-rejected`. `executions` holds `{ operationRef, execution }` for each operation, where `execution` is an `error-contract/1` execution. The exact fields and tags are defined in [`contract.ts`](../../tools/ddd/lib/operation-error-set/contract.ts).

## Commands

```sh
bun run prepare:error-contract       # build and install the native extractor (protocol version 3), used by the Rust path
bun run verify:operation-error-set   # verify the shared scenario through the Rust, TypeScript class and TypeScript companion paths, and print the evidence
bun run check                        # the full check, including the above
```

`bun run verify:operation-error-set --write` updates [`evidence/operation-error-set.json`](evidence/operation-error-set.json). It needs `cargo`, `rustc`, the installed native extractor and TypeScript 6.0.3. The Rust workspace of the shared scenario `tests/fixtures/operation-error-set` has no dependencies and ships its own `Cargo.lock`. The command exits with status 1 when any expectation does not match.

## Input refused during preparation

Input matching any row below is refused as `input-rejected` without being compared.

| Refused input | Why |
|---|---|
| The canonical model's `schema_version` is not 2 | Version 1 has no place for the errors of a generation operation |
| The mapping's `aggregate_ref` does not name exactly one aggregate of the model | The expected operations cannot be decided uniquely |
| An error of the aggregate declares an `operation` other than the operation containing it | Which of the two is the owner changes what is foreign to which operation |
| The mapped operations do not cover the aggregate's commands and generation operations exactly once each | An operation would be left unjudged |
| The mapping lists an error under an operation that does not declare it itself | The containing operation and the owner disagree |
| The mapping leaves an error of an operation out, lists one error twice, or maps two errors of one operation to one case | A case would not name one error |
| An observation is not a valid `error-contract/1` request, including an edited identity | The observation cannot be trusted |
| An observation's language, `target.operation`, last `target.declarationPath` entry, or the name of the package `target.packageId` names differs from the mapped language, method, type or package | It observes another target |
| The entries of a Rust observation's `target.declarationPath` before the type differ from the mapped `module`, reading `r#name` and `name` as one segment | It observes a type of the same name in another module |
| Two observations differ in their sources, analysis condition, settings or tool versions | Different analysis snapshots are never mixed |
| An observation is missing, an operation is observed twice, or an observation names an operation the mapping does not name | Operations and observations cannot be paired one to one |

A Rust declaration path is the module path from the crate root followed by the type, whichever file layout the project uses, so the comparator compares its leading entries with the mapped `module`. A TypeScript module is a file, and the mapping fixes no source root to place it under, so the comparator does not compare a TypeScript observation's file with the mapped `module`; the TypeScript verification path decides the placement.

## Request identity

The request identity is `sha256:` over the canonical JSON of every field except the identity itself:

- `schemaVersion`, `ruleId`, `language`, `aggregateRef`
- `model`: its `schemaVersion`, and `digest`, the `sha256:` of the canonical JSON of the whole model
- `operations`: commands, then generation operations, each group in model order. Each operation carries `operationRef`, `kind`, `code` (`package`, `module`, `type`, `method`, `errorType`), `errors` in model order (`errorRef`, `case`), and `observation`

Each observation's identity already covers its analysis snapshot. Changing the mapped method, case, error type, module, type or package, the model's content or version, or the analysis snapshot therefore changes the request identity. Mapping fields the comparison does not use — the execution model, the persistence method, the ports and so on — are not part of it.

An execution that answers an observation made before a change is refused by the `error-contract/1` identity check as `identity-mismatch`, so that operation is `unresolved`; an earlier result never makes it pass. `inspectOperationErrorSet` re-reads the request and recomputes its identity, so a request edited after preparation is refused as well. The comparator caches nothing.

## Judgement

Each operation's own observation and execution are passed to `resolveErrorContract`, and only the facts it established are read, in the order §6 of the [inspection contract design](inspection-contract-design.md) states.

| Fact established by `error-contract/1` | Finding |
|---|---|
| The result contract is `absent` | `result-contract` (`detail: absent`) |
| The result contract is not the standard result | `result-contract` (`detail: non-standard`) |
| The standard result with a `unit` error type | `result-contract` (`detail: unnamed-error-type`) |
| The standard result whose error type names a declaration, with an `absent` case set | `result-contract` (`detail: no-case-set`) |
| The standard result whose error type names a declaration, with a `resolved` case set | The per-case comparison below |
| The operation, the result contract or the case set is `unresolved` | No finding; see the reasons below |

A result contract problem is reported as one finding, rather than as a missing error for every mapped case.

| Observed case | Finding |
|---|---|
| The operation's own mapping names it | None |
| Only other operations' mappings name it | `foreign-error` (`errorRef` and `owner`), one for each such operation |
| No operation's mapping names it | `unexpected-case` (`case` is the observed spelling) |
| The operation's own mapping names it and the observation lacks it | `missing-error`, judged only when the case set is `complete` |

Case names are compared exactly. Letter case, `-` versus `_` and white space are not normalised, because the mapping states the spelling of each language. A spelling both the operation's own mapping and another operation's mapping use belongs to the operation itself. A `partial` set never yields a missing error, but the cases it established outside the mapping are still reported.

`unresolvedReasons` and `executionState` are exactly what `resolveErrorContract` returns; the comparator never adds or reclassifies a reason. `ruleResult` is `unresolved` when there is a reason, otherwise `violation` when there is a finding, otherwise `pass`. An `unresolved` operation keeps its established findings, and an unresolved reason is never reported as a finding. The result is given per operation; the comparison states no verdict for the aggregate as a whole. Findings are ordered by their meaning, never by the order the cases were observed in.

| Finding | Fields |
|---|---|
| `missing-error` | `operationRef`, `errorRef`, the `case` the mapping expected, the location `error-contract/1` returns as the evidence of the case set: the name of the enum declaration in Rust, and in TypeScript the error type argument of the standard result, which is a reference to the error type rather than its declaration |
| `unexpected-case` | `operationRef`, the observed `case`, its location |
| `foreign-error` | `operationRef`, the other operation's `errorRef` and `owner`, the observed `case`, its location |
| `result-contract` | `operationRef`, `detail`, the evidence locations of the result contract or the case set |

## Verification paths in both languages

Each path turns the mapping into `error-contract/1` targets, runs the extractor, and hands the result to the same `prepareOperationErrorSetRequest` and `inspectOperationErrorSet`. No import reachable from the comparator directory names `tools/ddd/lib/rust/`, `tools/ddd/lib/typescript/`, `experiments/` or the `typescript` package; a test checks this boundary.

| Path | Entry point | How the target is decided |
|---|---|---|
| Rust | [`observeRustOperations`](../../tools/ddd/lib/operation-error-set-verification/rust.ts) | Runs `resolveCargoCondition` for the host target triple with no features. Places the mapped module as `<module>.rs` beside the library crate root. The declaration path is `[...module, type]` and the module layout is `file` |
| TypeScript | [`observeTypeScriptOperations`](../../tools/ddd/lib/operation-error-set-verification/typescript.ts) | Runs `resolveTypeScriptCondition` for the project. Places the mapped module as `<packageRoot>/src/<module>.ts`. The declaration path is `[type]`, the module layout is `named-file`, and the code representation is `class` or `companion` |

[`scenario.ts`](../../tools/ddd/lib/operation-error-set-verification/scenario.ts) reads the model and the mappings through the production loaders.

## Shared scenario

The canonical model gives the aggregate `aggregate.invoice` the command `command.invoice.issue` (`already-issued`, `empty-lines`) and the generation operation `factory.invoice.open` (`negative-amount`, `missing-customer`). The Rust mapping and the TypeScript mapping name the same model and share every business id; only the case spellings differ (`AlreadyIssued` versus `already-issued`, and so on). In TypeScript, a class project and a companion project share one mapping; no project mixes the two representations.

Each module of a project is one scenario, reached by pointing the mapping's `module` at it. The expectations are written from the scenario, not copied from a run.

| Module | Content | Rust | TypeScript (both representations) |
|---|---|---|---|
| `invoice` | The mapped closed sets | `pass` for both operations | Same |
| `missing` | Each operation leaves one case out | `violation` with `missing-error` | Same |
| `extra` | One case no mapping names is added | `violation` with `unexpected-case` | Same |
| `foreign` | One case of the other operation is added | `violation` with `foreign-error` | Same |
| `contract` | The command returns nothing and the generation operation returns something other than the standard result | `violation` with `result-contract` (`absent`, `non-standard`) | Same |
| `shadowed` | An application type named `Result` | `unresolved` with `shadowed-result-identity`, keeping the `non-standard` finding | `unresolved` with `shadowed-result-identity` |
| `widened` | Open error sets | `unresolved` with `incomplete-case-set` from `#[non_exhaustive]` | `unresolved` with `open-error-type` from `\| string` |
| `unreferenced` | Error types read from a module the snapshot lacks | `unresolved` with `missing-referent` | Same |
| `inferred` | Only the bodies state the return types | `unresolved` with `expression-inference-required` | Same |
| `undeclared` | The type exists but the mapped operations do not | `unresolved` with `target-missing` | Same |
| `open_extra` | Open enums that also list cases outside their own mapping (Rust only) | `unresolved` with `incomplete-case-set`, keeping `unexpected-case` and `foreign-error` | Not applicable |

The checks across a change run on each of the three paths.

| Change | What is checked |
|---|---|
| The mapped method name | The request identity changes and a fresh observation is `target-missing`; the earlier execution is `identity-mismatch` |
| The canonical model's content | Adding an error changes the request identity and yields `missing-error` from the same observation; a `schema_version: 1` model is refused |
| The analysis snapshot | Removing a case from the source changes the request identity and yields `missing-error`; the earlier executions are `identity-mismatch` for both operations |
| Mixed snapshots | Observations from before and after the change are refused together |
| The observation language | Observations for a mapping in the other language are refused |

## Limits

- The spelling of the mapping's `code.error_type` is not compared with the name of the resolved error type declaration. `error-contract/1` returns the error type only as a `symbolId` whose internal form is not relied on. Comparing them needs `error-contract/1` to publish the declaration name; this is recorded on the parent issue as prerequisite work for T-10/T-11.
- Whether two operations share one error type is not checked. A union that includes another operation's errors is found case by case as `foreign-error`.
- The production sensors and the approval gate are not connected.
- Whether a compiler accepts the scenario modules is not measured. Several modules are written not to compile.
- This scenario uses only the Rust `file` layout and the TypeScript `named-file` layout; the other layouts are covered by the `error-contract/1` verification.
- Matching types and cases does not prove state preservation or invariants on each failure path.
- The verified environment is the one the evidence records: darwin-arm64, rustc 1.95.0, cargo 1.95.0, Bun 1.3.13, TypeScript 6.0.3 and syn 3.0.5.

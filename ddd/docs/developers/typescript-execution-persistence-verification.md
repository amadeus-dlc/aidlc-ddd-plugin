# TypeScript execution and persistence verification

English | [日本語](typescript-execution-persistence-verification.ja.md) | [Developer documents](README.md)

Verified: 2026-09-27. Base commit: `a1c9f8969100ed47bc7a63e603dc3b424395dc0d` (the T-11-06 changes were measured as an uncommitted working tree on top of it). See the [execution evidence](evidence/typescript-execution-persistence-verification.json).

This record runs the four shared behavior scenarios that §11 of the [language-independent design](language-independent-design.md) requires on the TypeScript generation samples, and records the `programming_model` × `persistence_method` of the aggregate each scenario exercises, per code representation and module layout. Its form follows the [Rust record](rust-execution-persistence-verification.md). A combination no test runs is recorded as unverified and presented as covered nowhere.

## What runs

The samples are the TypeScript code the code-generation instructions teach ([`fixtures/typescript-generation/samples.ts`](../../tests/fixtures/typescript-generation/samples.ts); `generation-instructions.test.ts` checks that the runtime instructions' examples are character-for-character copies of them). [`t11-typescript-behavior.test.ts`](../../tests/t11-typescript-behavior.test.ts) writes each sample into a temporary directory (`:37-50`) and links each package under `node_modules/@acme/*` (`:47`). The samples are not changed.

The scenarios run against each sample in a child `bun test` process started in the sample's directory without coverage (`t11-typescript-behavior.test.ts:60-77`). In that child, [`fixtures/typescript-behavior/sample-runner.ts`](../../tests/fixtures/typescript-behavior/sample-runner.ts) loads the packages through the names their consumers import them by (`:21-35`), so the sources run as written, registers each scenario as its own test, and writes what each one reports to a JSON file in registration order (`:37-55`). The samples run in a separate process so that their sources, which every test run executes, do not enter the coverage `bun run test` measures (the rule stated in `bunfig.toml`). The behavior test only judges the child's report: every scenario has to be reported, in order, and the child has to exit 0 (`t11-typescript-behavior.test.ts:103-111`), and each scenario's test passes only when that scenario is reported as passing (`:113-118`). A missing report, a missing scenario, or a failing one fails the test with the child's output.

The scenarios are defined once, as `BEHAVIOR_SCENARIOS` of [`fixtures/typescript-behavior/scenarios.ts`](../../tests/fixtures/typescript-behavior/scenarios.ts) (`:81`), and the same ones run on all four samples (`t11-typescript-behavior.test.ts:91-127`).

| Scenario | What it checks | Definition |
|---|---|---|
| `state-change` (a normal state change) | `addLine` on an opened invoice raises its total and line count. Once `issue` succeeds, `addLine` and `issue` return `already-issued` and the total stays. `IssueInvoice.execute` succeeds | `scenarios.ts:82-98` |
| `business-error-keeps-state` (state kept on a business error) | After an `addLine` refused with `negative-total`, the total and line count are unchanged. `issue` on an invoice with no line returns `empty-lines`, and the invoice stays a draft that accepts a line and is then issued. When `execute` through the repository returns `already-issued` or `empty-lines`, the recorded state is unchanged | `:99-124` |
| `invalid-value-rejected` (an invalid value refused at creation) | `open` returns `missing-customer` and `negative-total`. `restore` throws `corrupt invoice state` for an empty customer, an issued invoice with no line, and a negative total | `:125-135` |
| `restore-after-persistence` (restoration after persistence) | An aggregate restored by `findById` from its record has the recorded state. After `execute` stores it, `findById` returns the stored, issued aggregate rather than the record it was read from. An unknown id returns `invoice-not-found` | `:136-161` |

Addition of 2026-09-28 (T-03-02): three scenarios were added, so the shared scenarios are now seven, and `t11-typescript-behavior.test.ts:129-139` checks that they are these seven. The samples gained the command `recordPayment` (`command-id-memory`, retention `multiple`), a `CommandOutcome` success value (`applied` with events, or `already-applied`), and a repository `store` that checks the expected version once and appends the command's events together. The four-scenario table above and the line numbers in it are the measurement at the base commit and are not rewritten; the new scenarios are at the current lines of [`fixtures/typescript-behavior/scenarios.ts`](../../tests/fixtures/typescript-behavior/scenarios.ts) below, and the same scenarios are written in Rust in [`fixtures/rust-behavior/scenarios.rs`](../../tests/fixtures/rust-behavior/scenarios.rs).

| Scenario | What it checks | Definition |
|---|---|---|
| `duplicate-command-already-applied` (a repeated command is already applied) | A `recordPayment` repeated with the same command id, even with another amount, returns already applied: no event, no change, nothing saved. A new id is applied. An invoice restored with a paid amount and remembered ids, directly through `restore` or from a record through `RecordPayment`, answers a remembered id as already applied with nothing saved and refuses an overpayment against the restored paid amount; a record that does not remember the id has the payment applied | `scenarios.ts:244-287`; Rust `scenarios.rs:219` |
| `rejected-command-keeps-state` (a refused command keeps the state) | A `recordPayment` refused with `not-issued` or `overpayment` changes nothing, saves nothing, and does not remember the id, so the same id is applied once it can be | `:288-315`; Rust `scenarios.rs:261` |
| `multiple-events-one-append` (several events in one append) | A payment that reaches the total returns two events, and `RecordPayment` saves them in one append that advances the version by one. A `store` of an invoice that was saved again after its read returns `version-conflict` even when another read came in between, and leaves the version and the saved events unchanged; a new read lacks the refused change | `:316-360`; Rust `scenarios.rs:290` |

## Where each axis is read

| Axis | Where it is read for a decision | Location |
|---|---|---|
| `programming_model` | The language-neutral declaration gate only: a use case targeting two or more aggregates of which any is `actor` requires a Process Manager (changed on 2026-09-28 from "all `actor`", T-03-01); a use case that re-executes across two or more aggregates the mapping does not all map is refused as `mapping-declarations.execution-model-undetermined` | [`ddd-sensor-mapping-declarations.ts:127`](../../tools/ddd-sensor-mapping-declarations.ts) (Process Manager condition), `:110-118` (undetermined execution model) |
| `persistence_method` | The replay exemption of the TypeScript domain gate, which holds only for `event-sourcing` | [`rules/mutations.ts:81`](../../tools/ddd/lib/rules/mutations.ts), used by the TypeScript evaluators at [`rules/typescript/evaluators.ts:32`](../../tools/ddd/lib/rules/typescript/evaluators.ts) |
| `typescript.code_representation` and `typescript.module_layout` of `.ddd.toml` | Differ per sample. The behavior tests do not read them; they run the sample's sources themselves | The sample's settings are `settings` at `samples.ts:411`; the combinations are `REPRESENTATIONS` and `LAYOUTS` (`:25-26`) |

The behavior tests read neither axis and do not change what they do by it. The recorded values are the ones the sample's aggregate mapping declares: `samples.ts:383-384` declares `programming_model: class` and `persistence_method: state-sourcing`, and `t11-typescript-behavior.test.ts:122-125` checks both values for each of the four samples.

## Verified combinations

| `programming_model` | `persistence_method` | Code representation | Module layout | Scenarios | Evidence |
|---|---|---|---|---|---|
| `class` | `state-sourcing` | `class` | `named-file` | all four | `generation sample behavior: class / named-file` |
| `class` | `state-sourcing` | `class` | `index-file` | all four | `generation sample behavior: class / index-file` |
| `class` | `state-sourcing` | `companion` | `named-file` | all four | `generation sample behavior: companion / named-file` |
| `class` | `state-sourcing` | `companion` | `index-file` | all four | `generation sample behavior: companion / index-file` |

`t11-typescript-behavior.test.ts:138-146` checks that the four combinations are all there, and `:129-136` that the scenarios are the four. Each row's tests are the `describe` named at `t11-typescript-behavior.test.ts:92`.

`programming_model: class` is the aggregate's execution model, an axis separate from the `class` code representation. The `companion` samples also have the `class` execution model: the aggregate is driven by direct method calls.

The same four samples also run on the following paths, apart from the behavior tests, all with the same `class` × `state-sourcing` mapping.

| Path | What it checks | Location |
|---|---|---|
| Gates of the source tree | The four TypeScript gates inspect and pass, and the CI entry exits 0 | [`t11-typescript-generation-samples.test.ts`](../../tests/t11-typescript-generation-samples.test.ts) |
| Distribution | The same gates and CI entry from `dist/<harness>/tools` | [`scripts/verify-dist.ts`](../../scripts/verify-dist.ts) |
| Installed project | The same gates and CI entry from the installed tree | [`install-sandbox.test.ts:232`](../../tests/install-sandbox.test.ts) |
| Approval | The code-generation gate opens under every DDD sensor. The gate keeps no verdict note for a pass, so each installed TypeScript gate is then run again with the output path the audit records for it, over the tree the gate judged, and has to be a pass that inspected the sample (`:645-653`) | [`t1-gate-integration.test.ts:615-618`](../../tests/t1-gate-integration.test.ts) |
| Next.js integration | Built in an ESM Next.js application on the server-side Node.js runtime, with `IssueInvoice` run over HTTP | [Next.js integration verification](nextjs-integration-verification.md) |

## Unverified combinations

The shared behavior scenarios run none of these combinations. Golden cases of the TypeScript gates may use these values to decide individual rules, but that is not a verification of the behavior of a running aggregate.

| `programming_model` | `persistence_method` | Why it is unverified |
|---|---|---|
| `class` | `event-sourcing` | The generation samples declare `state-sourcing` only and have no replay method. No generation sample passes through the replay exemption of the TypeScript domain gate (`rules/mutations.ts:81`) |
| `actor` | `state-sourcing` | No sample declares `actor` for an aggregate together with TypeScript sources |
| `actor` | `event-sourcing` | No sample declares this pair |

Each is a missing test, not a claim that the combination is unsupported or invalid. The Rust run of the same shared behavior scenarios, and the combinations it exercises, are recorded in [Rust execution model and persistence verification](rust-execution-persistence-verification.md).

## Limits

- The repository is `InMemoryInvoiceRepository`, which keeps each invoice as a record (`InvoiceRecord`) of its whole state: `store` writes the record, and every `findById` restores a new aggregate from it through `Invoice.restore`. The persistence round trip is checked on two paths: restoring from a record the repository starts from, and restoring from the record a `store` wrote. Serializing to a database or a file and reading it back is not verified.
- A sample holds one aggregate (`invoice`) and one child module (`invoice/line`). Several aggregates and collaboration between aggregates are not covered.
- The behavior tests run on bun. Running on Node.js is limited to what the [Next.js integration verification](nextjs-integration-verification.md) covers.
- Every measurement was taken on `darwin-arm64`, at the versions in the execution evidence.

## Rerun and check the result

```sh
cd ddd
bun install --frozen-lockfile
bun test tests/t11-typescript-behavior.test.ts
```

`bun run check` is the entry the CI workflow uses and includes this test through `bun test tests/`.

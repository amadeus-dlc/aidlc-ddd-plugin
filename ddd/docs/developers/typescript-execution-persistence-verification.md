# TypeScript execution and persistence verification

English | [日本語](typescript-execution-persistence-verification.ja.md) | [Developer documents](README.md)

Verified: 2026-09-28. Base commit: `7cda3bf634b8a4c58fc55d7a441c768a132af041` (the T-03-03 changes were measured as an uncommitted working tree on top of it). See the [execution evidence](evidence/typescript-execution-persistence-verification.json).

This record runs the seven shared behavior scenarios that §11 of the [language-independent design](language-independent-design.md) requires, and one scenario of TypeScript alone, on the TypeScript generation samples, and records the `programming_model` × `persistence_method` of the aggregate each scenario exercises, per code representation and module layout. Its form follows the [Rust record](rust-execution-persistence-verification.md). A combination no test runs is recorded as unverified and presented as covered nowhere.

## What runs

The samples are the TypeScript code the code-generation instructions teach ([`fixtures/typescript-generation/samples.ts`](../../tests/fixtures/typescript-generation/samples.ts); `generation-instructions.test.ts` checks that the runtime instructions' examples are character-for-character copies of them). [`t11-typescript-behavior.test.ts`](../../tests/t11-typescript-behavior.test.ts) writes each sample into a temporary directory (`:37-50`) and links each package under `node_modules/@acme/*` (`:47`). The samples are not changed.

The scenarios run against each sample in a child `bun test` process started in the sample's directory without coverage (`t11-typescript-behavior.test.ts:60-77`). In that child, [`fixtures/typescript-behavior/sample-runner.ts`](../../tests/fixtures/typescript-behavior/sample-runner.ts) loads the packages through the names their consumers import them by (`:34-49`), so the sources run as written, registers each scenario as its own test, and writes what each one reports to a JSON file in registration order (`:51-69`). The samples run in a separate process so that their sources, which every test run executes, do not enter the coverage `bun run test` measures (the rule stated in `bunfig.toml`). The behavior test only judges the child's report: every scenario has to be reported, in order, and the child has to exit 0 (`t11-typescript-behavior.test.ts:103-111`), and each scenario's test passes only when that scenario is reported as passing (`:113-118`). A missing report, a missing scenario, or a failing one fails the test with the child's output.

The samples map the invoice as `class` × `event-sourcing` with no replay method. Each command produces one event: `addLine` → `line-added`, `issue` → `issued`, and `recordPayment` → `payment-recorded` (`command-id-memory`, retention `multiple` with `retention_count: 16`). There is no `settled` event; `isSettled()` derives it from the state. Domain methods write no state and return a new instance: `addLine` and `issue` return `Result<{ next, event }, …>`, and `recordPayment` returns `Result<CommandOutcome<Invoice, InvoiceEvent>, …>` (`applied` with `next` and its one event, or `already-applied` with neither). The use cases store the returned `next`, and the repository's `store(invoiceId, invoice, expectedVersion, event)` checks the expected version and appends that one event; a store refused for a conflicting version saves nothing.

The scenarios are defined once in [`fixtures/typescript-behavior/scenarios.ts`](../../tests/fixtures/typescript-behavior/scenarios.ts): the shared ones as `BEHAVIOR_SCENARIOS` (`:169`) and the one of TypeScript alone as `TYPESCRIPT_SCENARIOS` (`:377`). `SAMPLE_SCENARIOS` of `sample-runner.ts` (`:23-26`) runs the shared ones and then the TypeScript one, and the same ones run on all four samples (`t11-typescript-behavior.test.ts:91-127`). `t11-typescript-behavior.test.ts:129-139` checks that the shared scenarios are these seven, and `:141-143` that the TypeScript one is this one. The same seven shared scenarios are written in Rust in [`fixtures/rust-behavior/scenarios.rs`](../../tests/fixtures/rust-behavior/scenarios.rs).

| Scenario | What it checks | Definition |
|---|---|---|
| `state-change` (a normal state change) | `addLine` on an opened invoice returns a next instance with a higher total and line count. Once `issue` succeeds, `addLine` and `issue` on the issued instance return `already-issued` and the total stays. `IssueInvoice.execute` succeeds | `scenarios.ts:171-187`; Rust `scenarios.rs:127` |
| `business-error-keeps-state` (state kept on a business error) | After an `addLine` refused with `negative-total`, the total and line count are unchanged. `issue` on an invoice with no line returns `empty-lines`, and the invoice stays a draft that accepts a line and is then issued. When `execute` through the repository returns `already-issued` or `empty-lines`, the recorded state is unchanged | `:188-212`; Rust `scenarios.rs:144` |
| `invalid-value-rejected` (an invalid value refused at creation) | `open` returns `missing-customer` and `negative-total`. `restore` throws `corrupt invoice state` for an empty customer, an issued invoice with no line, a negative total, a paid amount below zero or above the total, a paid amount or a remembered id on a draft, and more remembered ids than the retention keeps | `:213-232`; Rust `scenarios.rs:169` |
| `restore-after-persistence` (restoration after persistence) | An aggregate restored by `findById` from its record has the recorded state. After `execute` stores the instance the command returned, `findById` returns the stored, issued aggregate rather than the draft it was read as. An unknown id returns `invoice-not-found` | `:233-258`; Rust `scenarios.rs:186` |
| `duplicate-command-already-applied` (a repeated command is already applied) | A `recordPayment` repeated with the same command id, even with another amount, returns already applied: no event, no change, nothing saved. A new id is applied. An invoice restored with a paid amount and remembered ids, directly through `restore` or from a record through `RecordPayment`, answers a remembered id as already applied with nothing saved and refuses an overpayment against the restored paid amount; a record that does not remember the id has the payment applied | `:259-301`; Rust `scenarios.rs:211` |
| `rejected-command-keeps-state` (a refused command keeps the state) | A `recordPayment` refused with `not-issued` or `overpayment` changes nothing, saves nothing, and does not remember the id, so the same id is applied once it can be | `:302-327`; Rust `scenarios.rs:253` |
| `one-event-appended-per-command` (one event appended per command) | Every command that changes state returns one event, and each store through `IssueInvoice` and `RecordPayment` advances the version and the number of saved events by one, including the payment that reaches the total and settles the invoice (`isSettled()` reads it from the state). A `store` handed the next instance and event of a stale read returns `version-conflict` even when another read came in between, and leaves the version and the saved events unchanged; a new read lacks the refused change, and the same payment applies there | `:328-374`; Rust `scenarios.rs:282` |

| Scenario of TypeScript alone | What it checks | Definition |
|---|---|---|
| `command-keeps-original-instance` (a command keeps the original instance) | After `addLine`, `issue` and `recordPayment`, the instance each was called on keeps its total, lines (also a lines array it returned earlier), paid amount, `isSettled()` and remembered command ids: the instance `issue` was called on still accepts a line, and the one `recordPayment` was called on applies the same command id again | `scenarios.ts:377-406`. Rust has no such scenario: a Rust command changes its aggregate through `&mut self` |

## Where each axis is read

| Axis | Where it is read for a decision | Location |
|---|---|---|
| `programming_model` | The language-neutral declaration gate only: a use case targeting two or more aggregates of which any is `actor` requires a Process Manager (changed on 2026-09-28 from "all `actor`", T-03-01); a use case that re-executes across two or more aggregates the mapping does not all map is refused as `mapping-declarations.execution-model-undetermined` | [`ddd-sensor-mapping-declarations.ts:127`](../../tools/ddd-sensor-mapping-declarations.ts) (Process Manager condition), `:110-118` (undetermined execution model) |
| `persistence_method` | Not read by the TypeScript domain gate. Neither rule (b) nor rule (c) depends on the model or the mapping: every state write in a domain instance method is a (b) finding, and a post-init method that writes state is a (c) finding, whatever the model, command and replay declarations say and whether or not the model is available | `ruleB` at [`rules/typescript/evaluators.ts:63-77`](../../tools/ddd/lib/rules/typescript/evaluators.ts); the post-init check of `ruleC` at `:109-119` |
| `typescript.code_representation` and `typescript.module_layout` of `.ddd.toml` | Differ per sample. The behavior tests do not read them; they run the sample's sources themselves | The sample's settings are `settings` at `samples.ts:640`; the combinations are `REPRESENTATIONS` and `LAYOUTS` (`:33-34`) |

The behavior tests read neither axis and do not change what they do by it. The samples' command results follow the declared `event-sourcing` by convention (each command returns its one event); no gate checks the return shape. The recorded values are the ones the sample's aggregate mapping declares: `samples.ts:607-608` declares `programming_model: class` and `persistence_method: event-sourcing`, and `t11-typescript-behavior.test.ts:122-125` checks both values for each of the four samples.

## Verified combinations

| `programming_model` | `persistence_method` | Code representation | Module layout | Scenarios | Evidence |
|---|---|---|---|---|---|
| `class` | `event-sourcing` (no replay) | `class` | `named-file` | all seven shared and the TypeScript one | `generation sample behavior: class / named-file` |
| `class` | `event-sourcing` (no replay) | `class` | `index-file` | all seven shared and the TypeScript one | `generation sample behavior: class / index-file` |
| `class` | `event-sourcing` (no replay) | `companion` | `named-file` | all seven shared and the TypeScript one | `generation sample behavior: companion / named-file` |
| `class` | `event-sourcing` (no replay) | `companion` | `index-file` | all seven shared and the TypeScript one | `generation sample behavior: companion / index-file` |

`t11-typescript-behavior.test.ts:145-153` checks that the four combinations are all there, `:129-139` that the shared scenarios are the seven, and `:141-143` that the TypeScript scenario is the one. Each row's tests are the `describe` named at `t11-typescript-behavior.test.ts:92`.

`programming_model: class` is the aggregate's execution model, an axis separate from the `class` code representation. The `companion` samples also have the `class` execution model: the aggregate is driven by direct method calls.

The same four samples also run on the following paths, apart from the behavior tests, all with the same `class` × `event-sourcing` mapping.

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
| `class` | `state-sourcing` | Every generation sample declares `event-sourcing`, so no behavior run exercises a state-sourcing command returning `Result<Invoice, …>`. The behavior tests no longer cover state sourcing |
| `class` | `event-sourcing` with replay | No generation sample declares `replay_methods`; the samples restore an invoice from a record of its whole state, not by replaying events |
| `actor` | `state-sourcing` | No sample declares `actor` for an aggregate together with TypeScript sources |
| `actor` | `event-sourcing` | No sample declares this pair |

Each is a missing test, not a claim that the combination is unsupported or invalid. The Rust run of the same shared behavior scenarios, and the combinations it exercises, are recorded in [Rust execution model and persistence verification](rust-execution-persistence-verification.md).

## Limits

- The repository is `InMemoryInvoiceRepository`, which keeps each invoice as a record (`InvoiceRecord`) of its whole state, together with its version and the events stored with it: `store` checks the expected version, writes the record, advances the version by one and appends the one event, and every `findById` restores a new aggregate from the record through `Invoice.restore`. The persistence round trip is checked on two paths: restoring from a record the repository starts from, and restoring from the record a `store` wrote. Rebuilding an invoice by replaying its stored events, and serializing to a database or a file and reading it back, are not verified.
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

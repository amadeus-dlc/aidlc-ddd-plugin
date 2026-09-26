# Rust execution model and persistence verification

English | [Japanese](rust-execution-persistence-verification.ja.md) | [Developer documentation](README.md)

Verified on 2026-09-25 against base commit `1621a6d657bccb2b9c0e1809f32c434c43f25bdd`. The confirming re-run finished at 2026-09-26T00:06:29Z; the [evidence](evidence/rust-execution-persistence-verification.json) records each run window.

This records which `programming_model` × `persistence_method` combinations the existing tests, golden cases and verification scenarios actually decide for Rust, and in which module layout. It surveys what is already there; it adds no rule and changes no judgement. A combination no case carries is listed as unverified, never as covered.

## What reads each axis

Which code reads each axis and answers differently because of its value. Three of the four rows name such a place; the second records an axis the Rust view deliberately does not carry. This table is not the criterion for "verified" — that word is defined once, under **Limits** below, and does not depend on which of these places an axis reaches.

| Axis | What reads it for a decision | Where |
|---|---|---|
| `programming_model` | The language-neutral declaration gate, and nothing else. A use case that targets two or more aggregates which are all `actor` must name a Process Manager as its multi-aggregate strategy. | [`ddd-sensor-mapping-declarations.ts:75`](../../tools/ddd-sensor-mapping-declarations.ts) builds the map, `:109-113` holds the condition (`:111` compares `=== "actor"`), `:116` reports `mapping-declarations.process-manager-required` |
| `programming_model`, in the Rust view | Nothing. The Rust view type does not carry the field and the projection does not copy it, so no Rust source rule can read it. | [`rules/rust/mapping.ts:18-25`](../../tools/ddd/lib/rules/rust/mapping.ts) (type), `:56-72` (projection) |
| `persistence_method` | The Rust source layer, as the precondition of the replay exemption. Any value but `event-sourcing` makes the exemption unavailable, and the method is then classified by the remaining branches in order. The exemption feeds two rules, not one: rule `b` reports only on `undeclared` and rule `c` reports `c-post-init` only on `post-init`, and `replay-exempt` is decided ahead of both of those classifications, so an exempted method escapes each. | [`rules/rust/symbols.ts:128`](../../tools/ddd/lib/rules/rust/symbols.ts) (`!== "event-sourcing"` returns false, beside the exemption's other preconditions at `:124-144`). The classification order is `:157` (`unknown` for an ambiguous aggregate binding), `:158` (`replay-exempt`), `:159` (`post-init` for a name in `POST_INIT`, [`rules/lists.ts:7`](../../tools/ddd/lib/rules/lists.ts)), `:160` (`unknown` when the domain model cannot be read) and `:170` (`declared-command` or `undeclared`). The consumers are [`rules/rust/evaluators.ts:68`](../../tools/ddd/lib/rules/rust/evaluators.ts) for rule `b` and `:127-139` for rule `c` |
| `rust.module_layout` of `.ddd.toml` | The module-layout inspection, and nothing else. The Rust source sensors resolve modules from the mapping and the source tree, not from this setting. | [`module-layout/check.ts:151`](../../tools/ddd/lib/module-layout/check.ts) |

The `actor` rows below sit at the declaration gate and at the mapping read and migration boundaries. That is where the cases are: no case declares `actor` on an aggregate and writes Rust sources for it in the same record, so no `actor` case reaches a Rust source rule. Whether such a case would change a Rust source verdict is a separate question with its own answer — it would not, because the Rust view drops the field — and neither fact is recorded here as the other.

## Four separate paths carry "both module layouts"

No golden case *definition* carries a `.ddd.toml` and an aggregate mapping at the same time. The module-layout group is the only one that writes `.ddd.toml` ([`golden/module-layout/cases.ts:22`](../../tests/golden/module-layout/cases.ts)) and it deliberately carries neither a source manifest nor a domain model (`:19`). A test can still supply one around a case that has a mapping, and the gate-integration test does exactly that. Coverage of the two layouts therefore splits across four paths, and a combination verified on one of them is not thereby verified on the others.

| Path | What it holds | What it decides |
|---|---|---|
| (a) Layout inspection | `.ddd.toml` in both declared modes; no mapping | Whether the source tree matches the declared layout |
| (b) Rust source rules | A mapping and real Rust sources; no `.ddd.toml` | Rule verdicts against physical module placement (`src/<name>.rs`, `src/<name>/mod.rs`, `#[path]`) |
| (c) Resolution | A mapping, real sources and a layout setting together | Whether the mapped module is observed where that package's layout places it |
| (d) Gate integration | A mapping, real Rust sources and a `.ddd.toml`, passed through the real gate | Whether the stage's whole applicable sensor set admits or rejects the record |

Path (d) is [`t1-gate-integration.test.ts:288-313`](../../tests/t1-gate-integration.test.ts). It writes `.ddd.toml` with `layoutConfig("file")` at `:300`, the case's mapping at `:306` and the case's Rust sources at `:307`, then opens the real gate. Its fixture keeps every `ddd-*` sensor applicable (`:67-68`), and [`contributions/construction/code-generation.md`](../../contributions/construction/code-generation.md) lists both `ddd-rust-module-layout` and `ddd-rust-domain` for `code-generation`, so the layout inspection and the Rust source rules decide in the same execution there. It covers only the declared `file` layout, and only two packaging cases. The test drives four `PACKAGING_CASES` entries (`:291-294`), but two of them, `clean-packaging-declarations` and `violation-packaging-technical-name`, do not reach this layer: they run at `domain-design`, whose sensor set ([`contributions/inception/domain-design.md`](../../contributions/inception/domain-design.md)) carries no Rust sensor, and they come from `design()` ([`golden/packaging/cases.ts:83-94`](../../tests/golden/packaging/cases.ts)), which clones a `DESIGN_CASES` entry and so has no `workspace` for `:307` to write. Only `clean-packaging-inline` and `violation-packaging-empty-inline` meet the definition of (d), which is exactly the pair the row for it below rests on.

## Verified combinations

Module placement in (b) is the physical placement of the modules the case writes, since that layer reads no layout setting. `violation-i-imported-use-case` places its child file in the use-case crate rather than the domain crate; the others place it in the domain crate. The `programming_model` column of every row at layers (b), (c) and (d) is the value the case's mapping declares, not a value a Rust source rule reads: the Rust view drops the field, as the second row of the table above records.

| `programming_model` | `persistence_method` | Module placement | Layer | Evidence |
|---|---|---|---|---|
| `class` | `state-sourcing` | Crate root, no child module | (b) | The default fixture mapping, [`golden/package-fixture.ts:50-51`](../../tests/golden/package-fixture.ts), injected into every `RUST_CASES` entry without its own mapping at [`golden/rust/cases.ts:372-377`](../../tests/golden/rust/cases.ts) |
| `class` | `state-sourcing` | `file` | (b) | `violation-b-split-impl` ([`golden/rust/t2-cases.ts:26`](../../tests/golden/rust/t2-cases.ts), child path `:27`), `clean-b-split-command` `:39-40`, `violation-b-trait-impl` `:131-132`, `violation-d-split-getter` `:154`, `violation-i-imported-use-case` `:115`; `violation-a-d-module-file` ([`golden/rust/domain-facts-cases.ts:102`](../../tests/golden/rust/domain-facts-cases.ts)); `clean-packaging-external-module` ([`golden/packaging/cases.ts:243-253`](../../tests/golden/packaging/cases.ts)) |
| `class` | `state-sourcing` | `mod-rs` | (b) | `violation-a-d-mod-rs` (`golden/rust/domain-facts-cases.ts:109-112`, `MOD_RS` at `:15`); `clean-packaging-mod-rs` (`golden/packaging/cases.ts:255-258`) |
| `class` | `state-sourcing` | `file` and `mod-rs` claiming one module | (b) | `violation-packaging-ambiguous-source` (`golden/packaging/cases.ts:378-385`) reports `domain-packaging.unresolved` |
| `class` | `state-sourcing` | `#[path]` | (b) | `clean-packaging-path-attribute` (`golden/packaging/cases.ts:267-273`), `clean-packaging-path-child` `:462-472`, `violation-module-cycle` ([`golden/contract/cases.ts:244-252`](../../tests/golden/contract/cases.ts)) |
| `class` | `state-sourcing` | `file` and `mod-rs`, in one run | (c) | [`operation-error-set-languages.test.ts:428-460`](../../tests/operation-error-set-languages.test.ts) covers both packages, `:462-469` and `:484-498` the pass and violation sides of the `mod-rs` package; the package-to-layout table is [`operation-error-set-verification/scenario.ts:44-47`](../../tools/ddd/lib/operation-error-set-verification/scenario.ts); the mapping is [`fixtures/operation-error-set/records/rust/inception/domain-design/ddd-aggregate-mapping.md:10-11`](../../tests/fixtures/operation-error-set/records/rust/inception/domain-design/ddd-aggregate-mapping.md) |
| `class` | `event-sourcing` | Crate root, no child module | (b) | `clean-b-declared-replay` (`golden/rust/t2-cases.ts:48`, its `persistence_method` at `:59`), plus the five derived cases that keep a readable `event-sourcing` mapping: `violation-b-replay-wrong-crate` (`:164`), `-wrong-module` (`:165`), `-unlisted-method` (`:166`), `-duplicate-method` (`:167`) and `violation-b-replay-scalar` (`:189-194`). See the note below for the three derived cases this cell does not rest on |
| `class` | `state-sourcing` | Declared `file` layout with inline modules | (d) | `clean-packaging-inline` (`golden/packaging/cases.ts:176-181`) and `violation-packaging-empty-inline` (`:129-134`), driven through the real gate by `t1-gate-integration.test.ts:288-313`; the `mapping()` helper gives them `class` at `:63` and, with no replay, `state-sourcing` at `:64` |
| `class` | `event-sourcing` | `file` | (b) | `clean-b-split-replay` (`golden/rust/t2-cases.ts:196-201`), whose replay method sits in the child file `src/operations.rs` (`:27`) |
| `class` | `event-sourcing` | `#[path]` | (b) | `clean-packaging-path-replay` (`golden/packaging/cases.ts:438-453`); its `replay` at `:445` is what makes `mapping()` choose `event-sourcing` at `:64` |
| `class` | `event-sourcing` | None; the mapping is read but no source is inspected | Mapping read | [`rust-mapping-view.test.ts:83-93`](../../tests/rust-mapping-view.test.ts), `persistence_method` at `:87` |
| `actor` | `state-sourcing` | None; no Rust source is claimed | Declaration gate | `violation-process-manager-required` ([`golden/design/cases.ts:674-693`](../../tests/golden/design/cases.ts); the mapping is turned `actor` at `:682` and carries `language: rust` at `:131`); `clean-actor-process-manager` (`golden/contract/cases.ts:85-108`) and `clean-multi-aggregate-mapping` `:337-341` |
| `actor` | `state-sourcing` | None | Mapping read and migration | [`fixtures/aggregate-mapping/workspace.ts:404-405`](../../tests/fixtures/aggregate-mapping/workspace.ts) in the canonical mapping and `:219-220` in the legacy YAML; the migrated results are asserted at [`aggregate-mapping-migration.test.ts:121-123`](../../tests/aggregate-mapping-migration.test.ts) and [`artifact-set-migration.test.ts:209-211`](../../tests/artifact-set-migration.test.ts) |

### The three derived cases the `event-sourcing` crate-root cell does not rest on

`clean-b-declared-replay` has eight derived cases at `golden/rust/t2-cases.ts:162-203`. Three of them do not support the cell above, and counting all eight would overstate it.

| Derived case | Why it is not evidence for that cell |
|---|---|
| `violation-b-replay-state-sourcing` (`:163`) | The derivation tuple replaces `persistence_method: event-sourcing` with `state-sourcing`. It is the identification test for the exemption's precondition, so its mapping is `state-sourcing`, not `event-sourcing` |
| `violation-b-replay-unknown-event` (`:177-188`) | It points the replay at an event the model does not define, which makes the whole mapping unreadable; the comment at `:175-176` records that no replay method is exempted as a result, so the `event-sourcing` value never reaches the rule |
| `clean-b-split-replay` (`:196-203`) | It keeps `event-sourcing`, but places the replay method in a child file, so it is the evidence for the `file` row rather than this one |

### Which test runs which group

Each golden group has exactly one test file that runs the whole group. Individual entries are also pulled by name elsewhere: `t1-gate-integration.test.ts` runs four `PACKAGING_CASES` entries at `:290-297` and `DESIGN_CASES` entries at `:120` and `:151`, and [`install-sandbox.test.ts`](../../tests/install-sandbox.test.ts) runs `DESIGN_CASES` entries at `:77` and `:423`. `u4-golden.test.ts` reads `CONTRACT_CASES` and `PACKAGING_CASES` for rule coverage at `:31` but does not run them.

| Group | Executed by |
|---|---|
| `RUST_CASES` | [`u5-golden.test.ts:13-18`](../../tests/u5-golden.test.ts) |
| `DESIGN_CASES` | [`u4-golden.test.ts:18-23`](../../tests/u4-golden.test.ts) |
| `PACKAGING_CASES` | [`t7-domain-packaging.test.ts:7-11`](../../tests/t7-domain-packaging.test.ts) |
| `CONTRACT_CASES` | [`t9-sensor-contract.test.ts:9-13`](../../tests/t9-sensor-contract.test.ts) |
| `MODULE_LAYOUT_CASES` | [`t10-rust-module-layout.test.ts:35-58`](../../tests/t10-rust-module-layout.test.ts) |

### Both layouts without a mapping

These carry a module-layout setting but declare no aggregate mapping, so they carry no combination and have no row above. How much of that setting each one actually reaches differs per row rather than holding for the group, and the `Layouts` column carries it: the first two reach both declared layouts, the third reaches `file` only.

| Test | Layouts | Mapping |
|---|---|---|
| `t10-rust-module-layout.test.ts:35-58` over `golden/module-layout/cases.ts` | Both declared modes of `.ddd.toml` | None (`cases.ts:19`) |
| [`error-contract-rust.test.ts:123-158`](../../tests/error-contract-rust.test.ts), run at `:165-194` | `billing-domain` is `file`, `billing-use-case` is `mod-rs`, per [`error-contract-verification/scenario.ts:16-19`](../../tools/ddd/lib/error-contract-verification/scenario.ts) | None |
| [`scripts/verify-error-contract.ts`](../../scripts/verify-error-contract.ts) | Carries the same layout table at `:128`, but both `inspect` calls (`:165-172`, `:186-193`) name `billing-domain`, so the `mod-rs` branch is never reached | None |

## Unverified combinations

No case carries these. They are recorded as unverified; none of them is presented anywhere as covered.

| `programming_model` | `persistence_method` | Module placement | Why it is unverified |
|---|---|---|---|
| `class` | `event-sourcing` | `mod-rs` | No case combines the two, on either of the two scans this rests on, which look for different things. First, the mappings that declare `event-sourcing` under `tests/`. Two of them come with a Rust source tree: `golden/rust/t2-cases.ts:59`, whose module is the crate root (`:66`) except in the derived `clean-b-split-replay`, which uses the `file` child at `:27`; and `golden/packaging/cases.ts:64`, whose one case with a `replay` is `clean-packaging-path-replay` (`:438-453`, its `replay` at `:445`), placed behind `#[path]`. The other five declare the value in a mapping document that writes no Rust source at all, so none of them claims a physical placement: `rust-mapping-view.test.ts:87` (its `viewOf` at `:58-67` writes the record files only), `fixtures/aggregate-mapping/workspace.ts:210` and `:368`, `aggregate-mapping-migration.test.ts:109`, `artifact-set-migration.test.ts:197`. The remaining occurrence, `golden/rust/t2-cases.ts:163`, is the derivation tuple that removes the value rather than a mapping that declares it. Second, the modules that a case carrying an aggregate mapping writes into a `mod.rs` under `tests/`, module placement meaning here what it means above — the physical placement of the modules the case writes. A case that writes a `mod.rs` without any aggregate mapping declares no `persistence_method`, so it cannot combine with `event-sourcing` and is outside this scan: the module-layout specimens in `golden/module-layout/cases.ts` (`:19` records that they carry no domain model), `t10-rust-module-layout.test.ts` and `error-contract-rust.test.ts`. There are four: `golden/rust/domain-facts-cases.ts:109-112` (`MOD_RS` at `:15`), `golden/packaging/cases.ts:255-258`, `golden/packaging/cases.ts:378-380` (the conflict case, which keeps `invoice.rs` beside the `mod.rs`) and `operation-error-set-languages.test.ts:419`. All four are `state-sourcing`, so the two sets do not meet. In three of the four the aggregate the mapping declares still sits at the crate root — `golden/package-fixture.ts:53` and `ROOT_PACKAGE` at `golden/packaging/cases.ts:22-27`, consumed at `:68`, both `module: []` — and what the `mod.rs` holds is a claimed source file or a mapped domain package. Only `operation-error-set-languages.test.ts:419` puts the mapped aggregate's own module in a `mod.rs`, and that mapping is `state-sourcing` as well (`fixtures/operation-error-set/records/rust/inception/domain-design/ddd-aggregate-mapping.md:10-11`), so the gap holds on the narrower reading too. |
| `actor` | `state-sourcing` | `file` or `mod-rs` | No case declares `actor` on an aggregate and writes Rust sources for it in the same record. Every `actor` declaration under `tests/` is the list in the row below, and none of those records carries a `.rs` file at all, so each one reaches the declaration gate or the mapping read and migration boundaries and stops there. A separate fact, with a separate reason: such a case would not make any Rust source rule answer differently from the `class` rows above, because the Rust view drops `programming_model` (`rules/rust/mapping.ts:18-25`, `:56-72`). Exercising the combination is a test; making the axis change a Rust source verdict would be a change of judgement. |
| `actor` | `event-sourcing` | Any, in any layer | No case declares this pair at all. Every `actor` declaration in `tests/` is `state-sourcing`: `golden/design/cases.ts:682` (derived from the `state-sourcing` base at `:128`), `fixtures/aggregate-mapping/workspace.ts:219-220` and `:404-405`, `aggregate-mapping-migration.test.ts:121-123`, `artifact-set-migration.test.ts:209-211`. The one other occurrence, `aggregate-mapping-migration.test.ts:395`, is a supplement row that sets `programming_model` and is refused with `aggregate-mapping.unknown-key`; it produces no accepted mapping. |

## Limits

- This is a survey of the existing tests at one commit, not a coverage guarantee. It is not regenerated by any script and no check compares it against the cases; a later case will not update it.
- "Verified" here means a case exercises the combination, not that the combination is fully specified. Detailed strategy-specific checks remain incomplete, as [the domain-layer design](domain-layer-design.md) states: a declaration alone does not guarantee the generated code shape.
- `programming_model` and `persistence_method` are independent choices ([use-case-layer design](use-case-layer-design.md)). The gaps above are gaps in the tests, not statements that a combination is unsupported or invalid.
- No golden case *definition* puts a declared layout and a mapped aggregate together; only paths (c) and (d) hold a mapping, real sources and a layout setting at once, and both carry only `class` × `state-sourcing`. Path (c) does carry a declared `mod-rs` layout beside a mapping, as the row for it above records, but it uses that setting only to resolve where the mapped module should be; it never runs the layout inspection. `checkModuleLayout` ([`module-layout/check.ts:85-88`](../../tools/ddd/lib/module-layout/check.ts)) takes an extractor, a project root and a budget callback, and no mapping at all; its shipped callers are [`ddd-check-rust-module-layout.ts:11`](../../tools/ddd-check-rust-module-layout.ts) and [`ddd-sensor-rust-module-layout.ts:15`](../../tools/ddd-sensor-rust-module-layout.ts), the only other callers are the direct ones in `t10-rust-module-layout.test.ts` (`:68`, `:75`, `:80`, `:87`, `:226`, `:266`, `:414`), which are path (a) and carry no mapping, and `operation-error-set-verification` is not among them. Path (d) is the only one that runs the layout inspection and the Rust source rules against a mapping in one execution, and it covers just the declared `file` layout over the two packaging cases named above. So no path runs the layout inspection together with a mapping under a declared `mod-rs` layout.
- The `mod-rs` branch of `scripts/verify-error-contract.ts` is unreached, as recorded above. Closing it belongs to the business-error contract path, not to this record.
- Every measurement was taken on `darwin-arm64` with the versions the evidence records.

## Re-running the checks

Run from the repository root.

```sh
cd ddd
bun install --frozen-lockfile
bun run check
```

`bun run check` is the entry the CI workflow uses. To re-run only the tests that decide the combinations above:

```sh
cd ddd
bun run prepare:native
bun test tests/u5-golden.test.ts
bun test tests/t7-domain-packaging.test.ts
bun test tests/u4-golden.test.ts
bun test tests/t9-sensor-contract.test.ts
bun test tests/t10-rust-module-layout.test.ts
bun test tests/operation-error-set-languages.test.ts tests/error-contract-rust.test.ts
bun test tests/rust-mapping-view.test.ts
bun test tests/aggregate-mapping-contract.test.ts tests/aggregate-mapping-migration.test.ts tests/artifact-set-migration.test.ts
bun test tests/t1-gate-integration.test.ts
bun run verify:operation-error-set
```

`tests/t1-gate-integration.test.ts` is path (d) and is the slowest of these; `bun run check` already includes it, since `bun test tests/` covers all 47 test files.

See the [execution evidence](evidence/rust-execution-persistence-verification.json) and the [remaining work](completion-tasks.md).

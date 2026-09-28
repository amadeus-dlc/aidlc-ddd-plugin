# DDD artifact and approval-check contract

English | [Japanese](artifact-contract.ja.md)

Updated: 2026-09-28. T-01 uses standard AI-DLC 2.8.2 artifact naming and existing Unit kinds. No framework patch was added.

## Align canonical data and explanations with registered files

| Stage | Logical artifact | File and content |
|---|---|---|
| ddd-domain-modeling | ddd-domain-model-yaml | One labelled YAML block in `ddd-domain-model-yaml.md` holds canonical data. |
| ddd-domain-modeling | ddd-domain-model | `ddd-domain-model.md` is the human-facing explanation. |
| domain-design | ddd-aggregate-mapping | One YAML block in `ddd-aggregate-mapping.md` holds aggregate mappings. |
| functional-design | functional-spec (existing) | One YAML block under `## DDD Use-case Declarations` in `functional-spec.md`. |
| infrastructure-design | cicd-pipeline (existing) | One YAML block under `## DDD Layer Structure` in `cicd-pipeline.md`. |

Use the record-relative `model_ref` value `inception/ddd-domain-modeling/ddd-domain-model-yaml.md`. Markdown is the envelope of the YAML data. Generation and every approval gate read YAML data schema version 2 of three artifacts:

| Artifact | Version 2 | Reference |
|---|---|---|
| `ddd-domain-model-yaml.md` | Each operation owns its own business errors | [operation-owned errors](domain-model-operation-errors.md) |
| `ddd-aggregate-mapping.md` | The language-neutral implementation mapping | [implementation mapping](implementation-mapping.md) |
| `## DDD Layer Structure` of `cicd-pipeline.md` | The dependency regime over language-neutral package identities | [layer declaration](layer-declaration.md) |

The `## DDD Use-case Declarations` section of `functional-spec.md` stays on version 1: it names no package, type or method, so there was nothing for a language-neutral format to change. A record still holding version 1 of any of the three above is refused by the gates that read it, and is converted with [`ddd-artifact-set migrate`](artifact-migration.md). IDs and invariant statements are still checked against the explanation.

The old `domain-model.yaml` and `domain-model.md` are not searched automatically. To migrate, wrap YAML in the new data file's code block, rename the explanation, update all model_ref values, and revalidate. The lower-level loader also accepts raw YAML, but that does not make the old name a valid generation target.

## Embed declarations in required sections of existing artifacts

Standard contributions cannot compose `produces_kinds`. Adding new artifacts to all Units therefore conflicts with the applicability of existing review outputs. Declarations are embedded in registered review artifacts instead of separate files.

| Required section owner | Applicable Unit kinds | Excluded |
|---|---|---|
| functional-spec | service / spec / ui / library | packaging |
| cicd-pipeline | service / ui / packaging / library | spec |

Layer structure belongs in cicd-pipeline so review includes the boundaries of components verified and distributed by the pipeline, including libraries. The existing infrastructure-specification still owns the overall infrastructure configuration.

If an applicable Unit has no use cases or layer structure, explicitly declare an empty list and explain why. Do not interpret a missing key or non-array value as an empty list. Reject missing or duplicate required sections and missing, unclosed, or multiple YAML blocks. Do not mistake examples in other sections for canonical declarations.

English section markers are used in the English generation instructions. For compatibility, the parser also accepts the existing Japanese markers for use-case declarations and layer structure. Exactly one matching section is required across both languages; English and Japanese copies in one artifact are duplicates. Artifact prose follows project policy, and existing Japanese records under `aidlc/` do not need rewriting.

## Include package declarations in aggregate mappings

T-07 makes `domain_packages` required in the YAML of `ddd-aggregate-mapping.md`. Record term, model_refs and rationale for each package, and record where it lives under `code`: the language that spells it, the package name, and the module path below that package root. Declare the roots, the ancestors and every aggregate placement. Update existing artifacts and revalidate them. Skipping domain modeling alone does not exempt code from package declarations. See the [packaging contract](domain-packaging-design.md) and the [implementation mapping](implementation-mapping.md).

## Detect missing artifacts at normal approval admission

Model completeness fires for both explanation and data files. If either survives, it detects the other's absence; if both are missing, the framework artifact-existence guard rejects admission.

Mapping, use-case, and layer sensors fire from registered artifacts of their stage, resolve the declaration-owning file, and inspect it. For example, a surviving traceability file still exposes a missing functional-spec declaration. The `matches` patterns avoid multiple nested brace expansions because of standard dispatcher limitations.

The entry points are registered artifacts enumerated by the standard process. An arbitrary file does not trigger these checks merely by existing.

## Standalone completion still has a framework gap

AI-DLC 2.9.0 `report --single --result completed` does not verify registered artifacts or run gate sensors; it checks only summary confirmation, CodeKB artifacts, and pipeline and ensemble evidence. It returns `kind: done` even when every registered artifact of the stage is missing, and no DDD sensor runs, because every DDD sensor fires at the gate.

Before standalone completion, run the "Standalone completion check" in the instructions of the stage. The seven DDD instruction files carry the same check: one `aidlc engine sensor fire <sensor> --stage <slug> --output-path <path>` command per sensor, with each sensor marked blocking or advisory. The path is the artifact of this attempt. The rule is the same for every stage:

- A blocking sensor passes only when the command exits 0 and its final JSON line is `result: passed` with no `note`.
- A non-zero exit (a missing artifact exits non-zero), `result: failed`, or a `note` is a failure. Fix the artifact and rerun the check.
- The advisory `ddd-design-advisories` never blocks.

The DDD plugin alone cannot claim to reject a `report --single` that skips this check. The automated guarantee remains a framework issue, so T-01 as a whole is incomplete. The [upstream issue draft](../developers/upstream-standalone-completion-report.md) describes it; it is not posted yet.

[install-sandbox.test.ts](../../tests/install-sandbox.test.ts) reproduces the gap on every run, for Claude and Codex. It installs the plugin into a fresh AI-DLC 2.9.0 project, completes `ddd-domain-modeling` with `report --single` while its model artifact is missing, and expects `kind: done`. It also shows that the manual check does not pass the missing artifact. Run it with `bun run test:sandbox`, or with `bun test tests/install-sandbox.test.ts` from `ddd/`. Once the framework refuses such a completion, this assertion fails; then assert the refusal and retire the manual check.

## Verification scope

[t1-gate-integration.test.ts](../../tests/t1-gate-integration.test.ts) composes into disposable Claude/Codex projects and invokes the real `orchestrate report --result awaiting-approval` path. It checks valid, invalid, missing-file, missing-section, missing-list, and Unit-kind cases.

These tests exclude unrelated core document sensors and disable Q&A/reviewer evidence through test settings. DDD sensors and artifact guards remain active. This does not replace end-to-end host verification of model generation, review, and human approval.

[t1-model-artifacts.test.ts](../../tests/t1-model-artifacts.test.ts) and golden cases execute sensors directly with the same file format. Verify distributions with `bun scripts/verify-dist.ts claude codex`.

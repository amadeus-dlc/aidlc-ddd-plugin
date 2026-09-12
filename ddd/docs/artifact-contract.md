# DDD artifact and approval-check contract

English | [Japanese](artifact-contract.ja.md)

Updated: 2026-09-13. T-01 uses standard AI-DLC 2.8.2 artifact naming and existing Unit kinds. No framework patch was added.

## Align canonical data and explanations with registered files

| Stage | Logical artifact | File and content |
|---|---|---|
| ddd-domain-modeling | ddd-domain-model-yaml | One labelled YAML block in `ddd-domain-model-yaml.md` holds canonical data. |
| ddd-domain-modeling | ddd-domain-model | `ddd-domain-model.md` is the human-facing explanation. |
| domain-design | ddd-aggregate-mapping | One YAML block in `ddd-aggregate-mapping.md` holds aggregate mappings. |
| functional-design | functional-spec (existing) | One YAML block under `## DDD Use-case Declarations` in `functional-spec.md`. |
| infrastructure-design | cicd-pipeline (existing) | One YAML block under `## DDD Layer Structure` in `cicd-pipeline.md`. |

Use the record-relative `model_ref` value `inception/ddd-domain-modeling/ddd-domain-model-yaml.md`. The YAML data schema remains version 1; Markdown is its envelope. IDs and invariant statements are still checked against the explanation.

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

T-07 makes `domain_packages` required in the YAML of `ddd-aggregate-mapping.md`. Record crate, module, term, model_refs, and rationale for each package, including roots, ancestors, and aggregate placements. Update existing artifacts and revalidate them. Skipping domain modeling alone does not exempt code from package declarations. See the [packaging contract](domain-packaging-design.md).

## Detect missing artifacts at normal approval admission

Model completeness fires for both explanation and data files. If either survives, it detects the other's absence; if both are missing, the framework artifact-existence guard rejects admission.

Mapping, use-case, and layer sensors fire from registered artifacts of their stage, resolve the declaration-owning file, and inspect it. For example, a surviving traceability file still exposes a missing functional-spec declaration. The `matches` patterns avoid multiple nested brace expansions because of standard dispatcher limitations.

The entry points are registered artifacts enumerated by the standard process. An arbitrary file does not trigger these checks merely by existing.

## Standalone completion still has a framework gap

AI-DLC 2.8.2 `report --single --result completed` does not check general artifacts or gate sensors other than CodeKB. A disposable-project regression confirmed that it returns `kind: done` with no DDD artifacts.

Standalone runs must explicitly execute the pre-completion sensor checks in stage instructions. The DDD plugin alone cannot claim to reject a `report --single` that skips them. This automated guarantee remains a separate framework issue, so T-01 as a whole is incomplete.

Reproduce it with the following command (expected to fail on current 2.8.2):

```sh
DDD_VERIFY_FRAMEWORK_SINGLE=1 bun test ddd/tests/t1-gate-integration.test.ts -t 'standard isolated completion'
```

Normal test runs skip this one upstream reproduction, separating it from plugin regressions. Once the framework is fixed, verify the same command passes and make it required.

## Verification scope

[t1-gate-integration.test.ts](../tests/t1-gate-integration.test.ts) composes into disposable Claude/Codex projects and invokes the real `orchestrate report --result awaiting-approval` path. It checks valid, invalid, missing-file, missing-section, missing-list, and Unit-kind cases.

These tests exclude unrelated core document sensors and disable Q&A/reviewer evidence through test settings. DDD sensors and artifact guards remain active. This does not replace end-to-end host verification of model generation, review, and human approval.

[t1-model-artifacts.test.ts](../tests/t1-model-artifacts.test.ts) and golden cases execute sensors directly with the same file format. Verify distributions with `bun scripts/verify-dist.ts claude codex`.

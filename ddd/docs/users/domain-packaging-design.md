# Domain packaging contract

English | [Japanese](domain-packaging-design.ja.md)

Updated: 2026-09-13. Implemented as T-07. The requirement to connect package names to ubiquitous language and avoid technical classifications such as aggregate/, impl/, vo/, and entities/ is reflected in knowledge, stage instructions, and design/Rust sensors.

## Group by business concept

Aggregate, Entity, and value object are modeling roles, not sufficient reasons to split packages. If invoice, invoice number, and invoice line are confirmed business terms, one possible layout is:

```text
billing-domain/src/
  lib.rs
  invoice.rs
  invoice/
    number.rs
    line.rs
  money.rs
```

Each code name needs a term and placement rationale. One package per aggregate is not required. For shared values, start with responsibilities such as money before inventing common/vo containers. Review must catch renamed packages that still mix unrelated responsibilities.

## domain-design declares placement

The registered `ddd-aggregate-mapping.md` artifact now requires domain_packages in its canonical YAML. Physical placement is not part of the canonical domain model schema.

```yaml
domain_packages:
  - crate: billing-domain
    module: crate
    term: Billing
    model_refs: [bc.billing]
    rationale: Owns the billing domain
  - crate: billing-domain
    module: invoice
    term: Invoice
    model_refs: [aggregate.invoice]
    rationale: Groups invoice state, operations, and components
  - crate: billing-domain
    module: invoice::number
    term: Invoice number
    model_refs: [primitive.invoice-number]
    rationale: Owns invoice number representation and validation
```

Define the example IDs in the destination model. Every row requires crate, module, term, model_refs, and rationale; model_refs contains at least one ID. Use `module: crate` for the root and crate-relative `::` paths internally. Reject duplicate crate/module pairs, missing roots or parents, and aggregate_mappings.module values without declarations.

Natural-language terms and code identifiers need not match literally. Reference related model IDs and explain grouping terms and placement. Do not invent aggregates or Entities solely to justify packages.

Future packages may be declared before implementation. Code checks ask whether actual modules are declared; they do not require the current Unit to implement every future package. Existing artifacts must gain declarations; the old format is not automatically exempt.

## Automated technical-name checks

Reject these reserved names:

```text
aggregate aggregates impl impls implementation implementations
vo vos entity entities value_object value_objects valueobject valueobjects
```

Normalize case and Rust's `r#` prefix and compare complete components. Substrings do not trigger violations, so identity and invoice_entities are not automatically rejected. Review the suitability of common/shared/utils and similar terms.

| Name or construct | Treatment |
|---|---|
| billing in billing-domain | Require correspondence to a business term; check technical names. |
| -domain, packages/domain | Retain existing layer markers. |
| Internal invoice/vo and empty/private/inline mod | Detect technical classification. |
| src, lib.rs, main.rs, mod.rs | Treat as layout markers. |
| impl Invoice syntax and model IDs such as aggregate.invoice | Not package names. |
| External use references and unaffected crates | Not inspected as owned domain packages. |

## Rust coverage

Start from lib/bin roots of affected domain crates and follow mod declarations. Inspect all reachable modules in those crates, not only claimed files. Existing violations in affected crates are included; checks do not expand without limit to other crates.

Support conventional file splits, mod.rs, inline modules, and explicit path attributes. Check both logical names and physical placement: naming a module with a business term does not hide a vo.rs path. Type/replay matching uses the same logical module graph. Resolution follows the [Rust Reference path attribute rules](https://doc.rust-lang.org/reference/items/modules.html#the-path-attribute); representative layouts were also compiled with rustc.

Exclude `#[cfg(test)]` modules and contents under tests/benches/examples/vendor/target as auxiliary code. Application-authored wrapper mod declarations remain inspected.

Missing or ambiguous sources, paths escaping the crate, cycles, cfg_attr path switching, and module-generating item macros stop with domain-packaging.unresolved. The analyzer does not evaluate cfg generally, expand macros, or provide compiler-equivalent semantics. Claimed Rust files that cannot be reached are not treated as inspected.

## Responsibilities and checks

The normative rules live in [shared knowledge](../../knowledge/aidlc-shared/ddd-domain-packaging.md).

| Stage | Responsibility |
|---|---|
| ddd-domain-modeling | Establish business vocabulary and code-name correspondence. |
| domain-design | Declare domain_packages and aggregate mappings; review names, hierarchy, and responsibilities. |
| functional-design | Inherit upstream placement. |
| code-generation | Generate according to declarations and inspect actual-module correspondence. |

| Sensor | Coverage |
|---|---|
| ddd-mapping-declarations | Required fields, reserved names, duplicates, and missing root/parent/aggregate placement declarations. |
| ddd-reference-ids | Resolve model IDs referenced by packages. |
| ddd-rust-domain | Affected-crate declarations/references, actual layout, reserved names, missing declarations, and unresolved analysis. |

These checks are blocking and connected to normal approval admission. Term meaning and responsibility suitability require review; sensor success alone does not guarantee them. Standalone completion has the same framework limitation described in the [artifact contract](artifact-contract.md).

## Verification and implementation

[Direct regressions](../../tests/t7-domain-packaging.test.ts) and [inputs](../../tests/golden/packaging/cases.ts) cover valid layouts, prohibited names, invalid declarations, actual placement, auxiliary code, unresolved analysis, and replay through path attributes. [Approval tests](../../tests/t1-gate-integration.test.ts) exercise valid/invalid domain-design and code-generation for both Claude and Codex. Distributions run the same inputs.

Implementation: [declaration checks](../../tools/ddd/lib/packaging/declarations.ts), [Rust module collection](../../tools/ddd/lib/packaging/rust-modules.ts), and [layout evaluation](../../tools/ddd/lib/packaging/evaluate.ts). Third-party framework distributions were not modified. Counts and measurements are in the [assessment](../developers/current-state-assessment.md).

Module filenames follow the project-wide [Rust module layout policy](rust-module-layout.md). This vocabulary check accepts both Rust naming forms; the separate layout sensor enforces the selected form in every owned package.

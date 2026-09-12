# Domain packaging

## Purpose

Name domain crates and internal packages in ubiquitous language and group them by business concept. Designers and implementers use the same convention.

## Rules

| Rule ID | Convention | Verification |
|---|---|---|
| K.domain-packaging.1 | Connect package names to business terms and declare the term, model references, and placement rationale. | Declaration presence and ID resolution are automated; semantic fitness requires review. |
| K.domain-packaging.2 | Do not partition by technical classifications such as aggregate/, impl/, vo/, or entities/. | domain-packaging.technical-name |
| K.domain-packaging.3 | Record each crate root and every level of its package hierarchy in domain_packages. | domain-packaging.coverage |
| K.domain-packaging.4 | Do not separate aggregates, Entities, and value objects of the same business concept solely by type category. | Design review. |
| K.domain-packaging.5 | Place shared values by responsibilities such as money or address before inventing containers such as common/vo. | Design review. |
| K.domain-packaging.6 | Match declarations to real modules, including empty, private, and inline modules. | domain-packaging.coverage / unresolved |
| K.domain-packaging.7 | Do not confuse model-kind IDs, Rust impl syntax, or external use references with owned package declarations. | Distinguish them through the AST and owning crate. |
| K.domain-packaging.8 | domain-design owns physical placement; downstream stages must not reclassify it independently. | Stage instructions and review. |

Reserved names are `aggregate`, `aggregates`, `impl`, `impls`, `implementation`, `implementations`, `vo`, `vos`, `entity`, `entities`, `value_object`, `value_objects`, `valueobject`, and `valueobjects`. Normalize case and Rust raw identifiers and compare complete name components, not substrings. Review the suitability of names such as common, shared, and utils.

Keep the existing layer markers `-domain` in `billing-domain` and `packages/domain`. Internal `invoice/vo` is a technical classification, not a layer marker, and is prohibited. Distinguish layout markers such as `src`, `lib.rs`, and `mod.rs` from business package names.

## Examples

If invoice, invoice number, and invoice line are established business terms, group their responsibilities under `invoice/`. Avoid splitting them into `aggregates/invoice`, `vo/invoice_number`, and `entities/invoice_line`.

This does not require one package per aggregate. Explain the term and placement rationale when grouping several model elements. Code identifiers need not match natural-language terms literally. Passing sensors does not prove semantic correctness.

## Declaration

Add domain_packages to the canonical YAML in `ddd-aggregate-mapping.md`. Use `module: crate` for the root and crate-relative Rust paths for internal modules. term, model_refs, and rationale are required. Renaming a reserved word alone does not resolve mixed responsibilities.

Packages may be declared before implementation. Code checks require actual modules in affected domain crates to have declarations; they do not require a current Unit to implement every package planned for a future Unit.

## Scope

Follow mod declarations from domain crate lib/bin roots. Do not indiscriminately inspect `#[cfg(test)]` modules, contents under tests/benches/examples/vendor/target, or external dependency namespaces as business code. Application-owned wrapper mod declarations remain subject to checks. Item macros, ambiguous path attributes, and unresolved targets stop with unresolved rather than being marked checked.

## Sources

- [Implementation contract](../../docs/domain-packaging-design.md)
- [Regression cases](../../tests/golden/packaging/cases.ts)

Links target the development repository. All conventions needed by installed agents remain in this file.

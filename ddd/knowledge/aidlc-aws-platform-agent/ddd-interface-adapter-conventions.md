# Interface Adapter conventions

Updated: 2026-09-13. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.interface-adapter-conventions.1 | Name ports by responsibility rather than technology. | General naming requires review; repository naming uses m checks. |
| K.interface-adapter-conventions.2 | Name repository ports after their aggregates. | Declaration check m-name. |
| K.interface-adapter-conventions.3 | Start with an in-memory implementation. | Design convention. |
| K.interface-adapter-conventions.4 | Classify ports as repository, external-client, or es-infrastructure. | layer-structure.item |
| K.interface-adapter-conventions.5 | Use `<Aggregate>Repository` for repository ports, without storage-medium names. | m checks. Medium prefixes on implementation structs are allowed. |
| K.interface-adapter-conventions.6 | Use find_by_id, store, and delete_by_id as the baseline; allow additional queries for the owned aggregate. | Verb checks cover part of the declaration. Review separation from screen-oriented queries. |
| K.interface-adapter-conventions.7 | Test port contracts for conflicts and failures even with in-memory implementations. | Tests. |
| K.interface-adapter-conventions.8 | Use DAOs and DTOs on the query side; do not reuse update-domain types. | l checks some reference shapes. |
| K.interface-adapter-conventions.9 | Put DB/RPC clients in the Interface Adapter layer, not in infrastructure intended for language extensions. | Design convention. g alone does not guarantee placement of every client. |
| K.interface-adapter-conventions.10 | State whether an external model is adopted directly or translated at the boundary. | Review. |
| K.interface-adapter-conventions.11 | Declare context, CQRS, crates, dependencies, ports, restoration, and storage in the layer declaration. | layer-structure.item and related checks. Normal approval is connected; standalone completion has limits. |

## Rationale

Command-side I/O includes external clients as well as repositories. Design store as safe state re-persistence or safe event append. Do not exclude relational databases solely because of event format. For the RMU, distinguish per-aggregate order, delivery order, gaps, duplicates, and atomic commitment of updates and processed records. Do not extend DynamoDB Streams ordering guarantees across different items.

## Examples

The [design cases](../../tests/golden/design/cases.ts) and [Rust cases](../../tests/golden/rust/cases.ts) contain real sensor inputs in the development repository. Find them by case name. These are test inputs, not complete business applications. A passing case without the relevant structure does not prove that structure is valid.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Retired rules

No rule IDs have been retired. Overstated coverage and incorrect technical assumptions were corrected on 2026-09-13. Conventions without automated checks may remain review obligations.

## Sources

- [Current design](../../docs/interface-adapter-layer-design.md)
- [Measurements and known issues](../../docs/current-state-assessment.md)
- [Remaining work](../../docs/completion-tasks.md)

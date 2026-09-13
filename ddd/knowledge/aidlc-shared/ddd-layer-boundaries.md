# Layer boundaries and dependencies

Updated: 2026-09-13. Design conventions and automated coverage are documented separately. Existing rule IDs remain stable.

## Purpose

Conventions for DDD design and code generation. A check name does not imply that the entire convention is enforced automatically. DDD checks are connected to normal approval admission; the framework still has a gap in standalone completion guards.

## Rules

| Rule ID | Convention | Current coverage |
|---|---|---|
| K.layer-boundaries.1 | Determine layers from crate names and placement. | Layer diagnostics. |
| K.layer-boundaries.2 | Do not introduce dependencies in prohibited directions. | g. Physical separation alone does not make every prohibited direction a compiler error. |
| K.layer-boundaries.3 | Centralize wiring in the composition root. | Design convention. |
| K.layer-boundaries.4 | Allow the Interface Adapter layer to depend on use-case, domain, and infrastructure. | g dependency checks. |
| K.layer-boundaries.5 | Allow use-case to depend on domain and infrastructure. | g dependency checks. |
| K.layer-boundaries.6 | Allow domain to depend on infrastructure. | g dependency checks. |
| K.layer-boundaries.7 | Do not let infrastructure for language extensions depend on other layers. | Design convention. Current Rust sensors do not target the infrastructure layer. |
| K.layer-boundaries.8 | Prohibit mutual dependencies between CQRS command and query sides. | k. Coverage depends on source claims and sensor targets. |
| K.layer-boundaries.9 | Allow the RMU to depend on both sides. | Edges originating from the RMU are exceptions to k. |
| K.layer-boundaries.10 | Wire implementations and ports for both sides in the composition root. | Design convention. |
| K.layer-boundaries.11 | When names or placement are ambiguous, explain their correspondence to conventions rather than adding a custom layer override. | Layer diagnostics and review. |

## Rationale

This infrastructure layer is for language extensions; DB/RPC clients belong in the Interface Adapter layer. Layer names and responsibilities are this plugin's conventions. Rust sensors use declared source claims as their entry point instead of unconditionally inspecting the entire workspace.

## Examples

The [design cases](../../tests/golden/design/cases.ts) and [Rust cases](../../tests/golden/rust/cases.ts) contain real sensor inputs in the development repository. Find them by case name. These are test inputs, not complete business applications. A passing case without the relevant structure does not prove that structure is valid.

The distribution does not include tests or docs, so these links are for the development repository. All conventions needed at the destination are retained in this file.

## Sources

- [Current design](../../docs/developers/domain-layer-design.md)
- [Measurements and known issues](../../docs/developers/current-state-assessment.md)
- [Remaining work](../../docs/developers/completion-tasks.md)

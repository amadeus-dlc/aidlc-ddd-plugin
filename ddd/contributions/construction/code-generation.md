---
target: code-generation
plugin: ddd
adds:
  consumes:
    - artifact: ddd-aggregate-mapping
      required: false
  sensors:
    - ddd-rust-module-layout
    - ddd-rust-domain
    - ddd-rust-use-case
    - ddd-rust-interface-adapter
fragments:
  - anchor: after-step:1
    order: 100
  - anchor: in:Sensors
    order: 100
---

## fragment: after-step:1

### Step 1x (ddd): Read the DDD conventions

Before planning, read the naming and placement conventions and carry them into
the plan:

- **Rust module layout.** Read `ddd-rust-module-layout.md` shared knowledge and the project-root `.ddd.toml`. Establish one explicit layout before generating Rust. Follow it across all packages; do not infer it from edition or introduce `mod.rs` when `file` is selected.
- **Domain package names.** Read the shared `ddd-domain-packaging.md` knowledge and domain_packages in the aggregate mapping. Match actual modules in affected domain crates to those declarations; do not introduce technical classifications such as aggregate/, impl/, vo/, or entities/. Resolve missing declarations upstream rather than inventing terms during code generation. Empty, private, inline modules and path-attribute layouts are included.
- **Naming and placement.** Crate suffixes (`-domain`, `-use-case`,
  `-interface-adapter`, `-infrastructure`), the `packages/<layer>/` or
  `modules/<layer>/` placement, the command / query / rmu segments, and the
  composition-root markers. Derive layers from the crate, not from a config file.
- **Domain layer.** No public fields; no mutating method that is not a declared
  Command; construct aggregates only through a full constructor.
  Match Rust replay to `replay_methods` in the aggregate mapping: event-sourcing mode, aggregate crate and module, target event ID, and a single event parameter type must agree. Names such as `apply` alone do not exempt mutation methods.
- **Use-case layer.** `execute` takes IDs and value objects, never an aggregate;
  a use case never calls another use case.
- **Interface Adapter layer.** The command side and query side do not depend on
  each other; the query side never references a domain type or repository port;
  repositories are named `<Aggregate>Repository`; adapters restore aggregates
  through the full constructor.

Report only source files in `source-manifest.json`; these claims identify the
affected files and crates. Domain packaging also inspects the reachable module
layout of each affected domain crate.

Rust checks match type declarations, explicit parameter/variable/field types, and module-level use statements and aliases. Do not report ambiguous bindings or expressions requiring type inference as confirmed violations. Inspect the `note` in each directly executed Rust sensor JSON result and record `syntax.unresolved` / `model.unresolved` coverage gaps in code-summary for review. The standard dispatcher may omit notes on success, so passing a gate does not prove that every location was checked.

## fragment: in:Sensors

The three layer-specific Rust sensors fire on `code-summary.md`: `ddd-rust-domain`
(rules a, b, c, d, g plus the layer diagnostics), `ddd-rust-use-case`
(rules g, h, i, d) and `ddd-rust-interface-adapter` (rules k, l, m, n, g, and
every query-side file). Fix the code as the finding names the rule; a repeated
failure means the plan did not carry the conventions above.

The domain sensor inspects the module structure of affected domain crates, in addition to changed files. Resolve technical-classification names, undeclared modules, broken references, and unresolved analysis. Review the correspondence between vocabulary and responsibilities in code review as well.

The independent `ddd-rust-module-layout` sensor also fires on code-summary and checks every owned Cargo package, even with no source claims or a skipped domain model. For standalone completion, run `bun <project-root>/<harness-dir>/tools/ddd-check-rust-module-layout.ts --project <project-root>` and require exit status 0 before reporting completion.

In these commands, `<harness-dir>` is `.claude` for Claude Code or `.codex` for Codex; replace both path placeholders with the installed project paths.

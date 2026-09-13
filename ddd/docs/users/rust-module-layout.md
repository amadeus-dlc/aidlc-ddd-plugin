# Rust module layout contract

English | [Japanese](rust-module-layout.ja.md) | [User documentation](README.md)

Select one layout in `.ddd.toml` at the application project root, alongside the `aidlc/` directory. The setting applies to every owned Cargo package, including nested projects, all layers, and test code. Missing configuration blocks Rust approval; the checker never infers the team's choice from existing files.

```toml
schema_version = 1
[rust]
module_layout = "file"
```

Use `file` or `mod-rs`. Unknown keys, nested configuration files, per-crate overrides, and `mixed` are rejected. Recommend `file` for a new project; changing the setting requires bringing the whole inspected project into compliance.

| Mode | Parent module | Leaf module |
|---|---|---|
| `file` | `src/invoice.rs` | `src/invoice/line.rs` |
| `mod-rs` | `src/invoice/mod.rs` | `src/invoice/line.rs` |

A parent is an external module containing module declarations, including inline or test-only children. With `mod-rs`, a leaf must use its module name as its filename; placing every leaf in mod.rs is not this convention. Cargo target roots, such as lib.rs/main.rs or an explicit target path, retain their target names. Inline modules do not need separate files. `#[path]` can relocate a module, but its actual filename must still follow the selected convention and module name.

The modes are file-placement policies, not Rust editions. Cargo.toml remains the source for language edition. The checker tests both layouts without switching behavior by edition and does not establish complete edition-aware name resolution. Rust itself accepts both source naming forms; this plugin enforces the team's narrower convention for review consistency. See the [Rust Reference](https://doc.rust-lang.org/reference/items/modules.html#module-source-filenames).

## What is inspected

The checker discovers Cargo manifests and Rust files beneath the project root and follows module declarations from Cargo targets. It includes lib, bin, test, example, benchmark, and build-script targets, regardless of layer, domain-modeling status, or source-manifest claims. Unregistered Rust files are reported so a rename or deletion cannot leave an old module unnoticed.

Hidden entries and the directories aidlc, node_modules, vendor, target, and dist are excluded from discovery. Keep third-party and generated files there; do not put application-owned source outside the inspected scope. References from inspected modules still undergo module resolution and layout checks. Symbolic links, crate-escaping paths, ambiguous or missing files, cfg_attr path switching, parse errors, and module-generating item macros do not pass as inspected. Conditional compilation is not evaluated; inspection covers the declared source structure, including test-only modules. Resolve unsupported arrangements before adopting this check.

## Approval and CI

The blocking `ddd-rust-module-layout` sensor runs at these normal approval gates:

| Stage | Trigger artifact |
|---|---|
| code-generation | code-summary.md |
| build-and-test | build-and-test-summary.md |
| ci-pipeline | quality-gates.md |

For CI, run the installed command from any working directory, pointing it at the application project root:

```sh
bun /path/to/project/.codex/tools/ddd-check-rust-module-layout.ts --project /path/to/project
```

For Claude Code, use `.claude/tools/`. Provision Bun and the installed DDD tools in CI. The command prints JSON and returns 0 only when at least one Cargo package was inspected and there are no findings. Invalid arguments, unavailable analysis, zero packages, or violations return nonzero. The sensor entry point uses the framework's JSON verdict protocol and is not a substitute for this CI command.

Run the command on every change, including Cargo.toml/configuration-only changes, renames, and deletions; do not filter it by claimed or changed Rust files. Keep cargo check and application tests. The CI stage contribution instructs pipeline generation to install this required check; installing the plugin alone does not configure an external CI service.

For standalone stage execution, require the same direct command to succeed before reporting completion. Standard AI-DLC 2.8.2 does not enforce general gate sensors on standalone completion. Normal gate registration does not remove that framework limitation.

## Findings and migration

| Rule | Action |
|---|---|
| module-layout.configuration | Set one valid project-root configuration and remove conflicting configuration. |
| module-layout.violation | Move the module to the path named by the finding, then update declarations and preserve child resolution. |
| module-layout.unresolved | Resolve missing/ambiguous modules, unsupported structure, unregistered sources, or Cargo discovery problems. |

To switch a parent from `invoice/mod.rs` to `invoice.rs`, keep its children under `invoice/`. Review explicit path attributes because their relative base can change. Remove the old file; both files cannot coexist for the same ordinary mod declaration. Run the layout command, compilation, and tests after the move. Do not automatically move user code or rewrite the selected policy merely to make a check pass.

See the [coverage matrix](../developers/sensor-coverage.md) for executable normal, violation, and boundary cases.

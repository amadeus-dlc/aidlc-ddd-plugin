# Rust module layout

Choose one reviewable layout per project in the project-root `.ddd.toml` before Rust code generation. The same setting drives generation, gate sensors, and CI. Do not infer it from existing files, select per-crate overrides, or use mixed mode.

```toml
schema_version = 1
[rust]
module_layout = "file"
```

- `file`: every external module uses its module name as the filename, such as `invoice.rs`; children go under `invoice/`. Do not generate `mod.rs`.
- `mod-rs`: an external module with child modules uses `invoice/mod.rs`; a leaf uses `line.rs`. Inline child declarations also make their containing external module a parent. Target roots such as lib.rs/main.rs and explicitly configured Cargo roots retain their target names.

Recommend `file` for new projects. Once the team selects a mode, enforce it across all owned packages, all layers, and test/example/benchmark/build-script targets. Keep inline modules inline if appropriate. A path attribute does not exempt a module's filename from the selected convention. When moving files, preserve child resolution and update explicit paths. Unreachable Rust files must be registered or removed; do not leave an old mod.rs behind.

Rust edition remains a Cargo.toml language setting. File layout is a separate project convention. Neither mode establishes complete edition-aware name resolution or compilation correctness.

`ddd-rust-module-layout` blocks code-generation, build-and-test, and ci-pipeline admission for missing/invalid configuration, wrong layout, or unresolved structure. It scans owned project sources rather than source-manifest claims, and does not depend on domain modeling. Hidden directories, aidlc, node_modules, vendor, target, and dist are excluded from discovery. Symbolic links and unresolved module-generating macros are not silently accepted.

Use `bun <project-root>/<harness-dir>/tools/ddd-check-rust-module-layout.ts --project <project-root>` for CI and standalone completion, requiring exit status 0. Run it every time, with cargo check and tests. General gate sensors are not enforced by standard AI-DLC 2.8.2 standalone completion. The CI pipeline stage must install an actual required check; prose in a report is not CI enforcement.

In this repository, see the [user contract](../../docs/users/rust-module-layout.md). Repository docs are not distributed as runtime knowledge.

In these commands, `<harness-dir>` is `.claude` for Claude Code or `.codex` for Codex; replace both path placeholders with the installed project paths.

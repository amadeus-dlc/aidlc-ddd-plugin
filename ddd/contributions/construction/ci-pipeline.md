---
target: ci-pipeline
plugin: ddd
adds:
  sensors:
    - ddd-rust-module-layout
fragments:
  - anchor: after-step:1
    order: 100
---

## fragment: after-step:1

### Keep Rust module layout uniform in CI

Read shared `ddd-rust-module-layout.md` knowledge and the project's `.ddd.toml`. For Rust projects, add `bun <project-root>/<harness-dir>/tools/ddd-check-rust-module-layout.ts --project <project-root>` as a required CI check. Provision Bun and the installed DDD tools in CI. Require exit status 0; do not use the sensor entry point's process status as a CI verdict. Run for every change, including file deletion, rename, Cargo.toml, and .ddd.toml changes, without source-manifest or changed-file filters. Keep cargo check and application tests alongside it.

Record this required check in quality-gates and ci-config. Do not report CI integration complete until the actual CI configuration invokes the command and a violating fixture makes the check fail. `ddd-rust-module-layout` checks source layout at this stage's quality-gates admission; it does not prove an external CI service is configured. Execute the direct command before standalone completion.

In these commands, `<harness-dir>` is `.claude` for Claude Code or `.codex` for Codex; replace both path placeholders with the installed project paths.

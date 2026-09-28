---
target: ci-pipeline
plugin: ddd
adds:
  sensors:
    - ddd-rust-module-layout
    - ddd-typescript-module-layout
fragments:
  - anchor: after-step:1
    order: 100
---

## fragment: after-step:1

### Keep Rust module layout uniform in CI

Read shared `ddd-rust-module-layout.md` knowledge and the project's `.ddd.toml`. For Rust projects, add `bun <project-root>/<harness-dir>/tools/ddd-check-rust-module-layout.ts --project <project-root>` as a required CI check. Provision Bun and the installed DDD tools in CI. Require exit status 0; do not use the sensor entry point's process status as a CI verdict. Run for every change, including file deletion, rename, Cargo.toml, and .ddd.toml changes, without source-manifest or changed-file filters. Keep cargo check and application tests alongside it.

Record this required check in quality-gates and ci-config. Do not report CI integration complete until the actual CI configuration invokes the command and a violating fixture makes the check fail. `ddd-rust-module-layout` checks source layout at this stage's quality-gates admission; it does not prove an external CI service is configured.

### Keep TypeScript module layout uniform in CI

Read shared `ddd-typescript-module-layout.md` knowledge and the project's `.ddd.toml`. For TypeScript projects, add `bun <project-root>/<harness-dir>/tools/ddd-check-typescript-module-layout.ts --project <project-root>` as a required CI check. Require exit status 0; do not use the sensor entry point's process status as a CI verdict. Run for every change, including file deletion, rename, package.json, and .ddd.toml changes, without source-manifest or changed-file filters. Keep type checking and application tests alongside it.

Record this required check in quality-gates and ci-config. Do not report CI integration complete until the actual CI configuration invokes the command and a violating fixture makes the check fail. `ddd-typescript-module-layout` checks source layout at this stage's quality-gates admission; it does not prove an external CI service is configured.

In these commands, `<harness-dir>` is `.claude` for Claude Code or `.codex` for Codex; replace both path placeholders with the installed project paths.

**Standalone completion check.** Before reporting a standalone completion of `ci-pipeline`, run each command below against this attempt's artifact, replacing the path placeholder with the actual path:

- `aidlc engine sensor fire ddd-rust-module-layout --stage ci-pipeline --output-path <path-to-this-attempt's-quality-gates.md>` (blocking)
- `aidlc engine sensor fire ddd-typescript-module-layout --stage ci-pipeline --output-path <path-to-this-attempt's-quality-gates.md>` (blocking)

A blocking sensor passes only when the command exits 0 and its final JSON line is `result: passed` with no `note`; a non-zero exit (a missing artifact exits non-zero), `result: failed`, or a `note` is a failure: fix the artifact and rerun. AI-DLC 2.9.0 `report --single` does not check this stage's artifacts or run its gate sensors, so do not skip this check.

The `ddd-check-*-module-layout.ts` commands above remain the required check of every build/test cycle and CI run; the sensor commands do not replace them.

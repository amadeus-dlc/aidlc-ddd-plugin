---
target: build-and-test
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

### Verify the selected Rust module layout

Read shared `ddd-rust-module-layout.md` knowledge. For a Rust project, run `bun <project-root>/<harness-dir>/tools/ddd-check-rust-module-layout.ts --project <project-root>` and require exit status 0. Record the selected mode, inspected crate/file counts, and result in build-and-test-summary. This check covers all owned packages and targets, independent of source claims and domain-modeling status. Run it on every build/test cycle, including deletion-only and configuration-only changes. It does not replace cargo check or tests.

The blocking `ddd-rust-module-layout` sensor repeats the check at admission on build-and-test-summary.

### Verify the selected TypeScript module layout

Read shared `ddd-typescript-module-layout.md` knowledge. For a TypeScript project, run `bun <project-root>/<harness-dir>/tools/ddd-check-typescript-module-layout.ts --project <project-root>` and require exit status 0. Record the selected mode, inspected package/file counts, and result in build-and-test-summary. This check covers the `src` source root of every package, independent of source claims and domain-modeling status. Run it on every build/test cycle, including deletion-only and configuration-only changes. It does not replace type checking or tests.

The blocking `ddd-typescript-module-layout` sensor repeats the check at admission on build-and-test-summary.

In these commands, `<harness-dir>` is `.claude` for Claude Code or `.codex` for Codex; replace both path placeholders with the installed project paths.

**Standalone completion check.** Before reporting a standalone completion of `build-and-test`, run each command below against this attempt's artifact, replacing the path placeholder with the actual path:

- `aidlc engine sensor fire ddd-rust-module-layout --stage build-and-test --output-path <path-to-this-attempt's-build-and-test-summary.md>` (blocking)
- `aidlc engine sensor fire ddd-typescript-module-layout --stage build-and-test --output-path <path-to-this-attempt's-build-and-test-summary.md>` (blocking)

A blocking sensor passes only when the command exits 0 and its final JSON line is `result: passed` with no `note`; a non-zero exit (a missing artifact exits non-zero), `result: failed`, or a `note` is a failure: fix the artifact and rerun. AI-DLC 2.9.0 `report --single` does not check this stage's artifacts or run its gate sensors, so do not skip this check.

The `ddd-check-*-module-layout.ts` commands above remain the required check of every build/test cycle and CI run; the sensor commands do not replace them.

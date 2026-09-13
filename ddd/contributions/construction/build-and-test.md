---
target: build-and-test
plugin: ddd
adds:
  sensors:
    - ddd-rust-module-layout
fragments:
  - anchor: after-step:1
    order: 100
---

## fragment: after-step:1

### Verify the selected Rust module layout

Read shared `ddd-rust-module-layout.md` knowledge. For a Rust project, run `bun <project-root>/<harness-dir>/tools/ddd-check-rust-module-layout.ts --project <project-root>` and require exit status 0. Record the selected mode, inspected crate/file counts, and result in build-and-test-summary. This check covers all owned packages and targets, independent of source claims and domain-modeling status. Run it on every build/test cycle, including deletion-only and configuration-only changes. It does not replace cargo check or tests.

The blocking `ddd-rust-module-layout` sensor repeats the check at admission on build-and-test-summary. For standalone completion, run the direct command before reporting completion; the standard framework does not perform general sensor checks on that path.

In these commands, `<harness-dir>` is `.claude` for Claude Code or `.codex` for Codex; replace both path placeholders with the installed project paths.

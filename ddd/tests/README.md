# ddd tests

English | [日本語](README.ja.md)

Run with `bun install && bun test` from the plugin root (`ddd/`). The unit and golden suites pass without the framework submodule; the two pre-existing harness-adapter suites need the `aidlc-workflows` dist fixture.

## Suites

- `u1-sensor-foundation.test.ts` — the schema library and the sensor runtime: element-ID grammar and arity, `loadDomainModel` (unknown keys, duplicates, required references, fail-closed), `checkCompleteness`, verdict assembly (`(file, line, rule_id)` ordering and `finding_id` numbering), and `runSensor` (one JSON line, fail-closed, exit 127 for a missing asset).
- `u2-rust-analysis-foundation.test.ts` — the Cargo workspace layer resolver (members, targets, dependencies, the layer decision table, permissions) and the Rust analyzer (structs / impls / fns / uses / calls / constructions, parse errors, the content-hash cache).
- `u4-design-sensors.test.ts` — the six design sensors driven as child processes through `--stage` / `--output-path`, one clean and one violation case per sensor.
- `u4-golden.test.ts` — the golden runner over `tests/golden/design/cases.ts`, the coverage assertion (every declared rule has a violation case) and determinism (three runs byte-identical).
- `u5-rust-code-sensors.test.ts` — the three Rust sensors driven as child processes against a temp Cargo workspace: clean domain, a/b/d/g, the SKIP note, h, i, m and n.
- `u5-golden.test.ts` — the rust golden suite (`tests/golden/rust/cases.ts`, a `workspace` plus record per case), coverage and determinism.
- `install.test.ts` — the installer's pure helpers: stable-semver selection, source selector, canonical payload digest, tarball extraction (with an unsafe-path check), local acquisition and manifest validation.
- `framework-compatibility.test.ts` / `codex-dispatch-bridge.test.ts` — the pre-existing harness-adapter suites (Codex dispatch bridge, installed-harness patches). They copy a fixture from `aidlc-workflows/dist/codex/aidlc` and therefore skip-fail when that dist is not built; they exercise the codex adapter restored in `.codex/hooks/`.

## Fixtures

- `tests/fixtures/u1/` — valid and invalid canonical models for the U1 loader.
- `tests/golden/runner.ts` — the shared golden runner. It materializes a case into a temp record directory (and, for rust, a workspace), runs the real sensor script as a child process and compares the verdict's `pass` and the full `(rule_id, file)` finding set.
- `tests/golden/design/cases.ts` / `tests/golden/rust/cases.ts` — the case tables. The design cases cover all declared design rules and the rust cases cover rules a–n.

## Beyond `bun test`

- `bun run test:dist` (`scripts/verify-dist.ts`) — runs every design and rust golden case through the **built** `dist/<harness>/tools` (the projected artifacts, not the source tools). Pass `harness ...` to restrict it.
- `bun run test:sandbox` — builds all four harnesses, composes each with `aidlc-plugin-test --install` (0 drops, the stage on the graph, an idempotent second compose), then runs the dist verification.
- `bun run validate` — `aidlc-plugin-validate.ts` over the plugin source.

Note: because the code sensors fire on writes, a test that imported a sensor script directly would call `process.exit`; the suites spawn the scripts instead, which is also the real dispatcher contract.

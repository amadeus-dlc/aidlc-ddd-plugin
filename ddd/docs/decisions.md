# ddd — design decision record

English | [日本語](decisions.ja.md)

The record of implementation-time decisions and deviations from the intent's functional design (intent `260910-ddd-plugin`, `construction/*/functional-design/`). The functional-design documents remain the "source of truth"; this file records what changed while building, and why.

## 2026-09-10 — The canonical model loader is hand-written

The U1 functional design left the schema validator open (Q4): JSON Schema at runtime (ajv) vs a hand-written validator. Decision: hand-write the structural validator in `tools/ddd/lib/schema/loader.ts` and ship `domain-model.schema.json` as a contract document only. Rationale: the plugin runs from bun with no runtime dependencies (NFR2); a vendored validator would be a second mouth for the same contract. `Bun.YAML` provides the parser, so no YAML dependency is needed either.

Consequence: the loader fails closed (no partial index) and rejects unknown keys outright, so the normalised model cannot grow module/crate/deployment concepts by accident.

## 2026-09-11 — A SyntaxTree is labeled per file while the parse is shared by content hash

The U2 analyzer cached by content hash, which returned the first parse's `file` label for any later file with identical bytes. When the domain-layer symbol table parsed a crate file by absolute path and the inspection target parsed the same file by workspace-relative path, the two labels disagreed and rule (b) silently matched nothing. Decision: cache the parse tree by content hash, but build (and label) a fresh `SyntaxTree` for the requested file. Consequence: identical bytes still parse once per run, and file identity is correct at both call sites.

## 2026-09-11 — The cross-side CQRS ban is checked before the same-layer allowance

`isAllowed` originally returned `ok` for any same-layer pair before considering CQRS sides, so a command-side crate and a query-side crate in the same layer avoided rule (k). Decision: evaluate the command/query opposition first; only an RMU may cross. Consequence: rule (k) fires on the wire exercise (`test:sandbox` compose and the Rust golden suite), matching the interface-adapter design §3.

## 2026-09-11 — U5 gaps closed: traits, Cargo external edges, the Rust golden suite

The first U5 increment shipped rules (a)–(n) but left three gaps. Decision: (1) extract `trait_item` in the analyzer so rule (m) can check repository ports (and allow a medium prefix on implementations, where the trait owns the naming contract); (2) build external dependency edges from every `Cargo.toml` dependency name, so domain/use-case → I/O crate is reported even without a `use` path; (3) add `tests/golden/rust/` and extend the shared runner with a `workspace` map that aligns `workspace_root` with the record tree. Consequence: the rust suite covers a/b/c/d/g/h/i/k/l/m/n.

## 2026-09-11 — A plugin-owned stage slug must carry the `ddd-` prefix

The intent's design used `slug: domain-modeling`, but `aidlc-plugin-test` refused to compose it: "plugin-owned stage slugs must carry the plugin prefix". Decision: rename the stage file and slug to `ddd-domain-modeling` (and every stage-status / model-path reference with it), and add `plugin-dev` to the stage's scopes so this repository's own scope can run it. Consequence: the stage composes on all harnesses; the canonical model lives at `inception/ddd-domain-modeling/`.

## 2026-09-11 — Design contributions bind sensors and instructions, not `produces`

The U7 design had the functional-design and infrastructure-design contributions declare `produces` (the use-case and layer-structure artifacts). Composing failed: a contributed artifact is applicable to every unit kind, so a core stage with a kind-pruned `review_artifact` (functional-spec excludes packaging; cicd-pipeline excludes spec) failed its schema check. Decision: drop `produces` from those two contributions; the fragments still instruct the declarations and the sensors still fire on the artifact paths (they match files, not `produces`). `domain-design` keeps its `produces` row because its review artifact is not kind-pruned. Consequence: `aidlc-plugin-test --install` is CLEAN (0 drops, stage on the graph, idempotent).

## 2026-09-11 — Harness support: codex needs the `.agents/skills` surface

Codex discovers skills at `<project>/.agents/skills/` (the kernel sets `skipRunnerGen` and emits there), but the compose hook looked for `<harness>/skills` and recorded an advisory "runner regeneration skipped" drop, which `aidlc-plugin-test` treats as an error. Decision: point `SKILLS_DIR` at `.agents/skills` when the codex harness has no `.codex/skills` tree, and report the relative surface in the advisory. The same fix was already recorded in `ddd/patches/installed-harnesses.patch`; the patch baseline was stale after the 2.8.1 re-projection, so it is applied directly. Consequence: claude, codex, kimi and opencode all compose CLEAN.

## 2026-09-11 — Restore the codex dispatch bridge onto the 2.8.1 baseline

The 2.8.1 re-projection rewrote the `.claude`/`.codex` shells from the vendored engine and dropped the installed-harness adaptations, so `prepare:harnesses` failed both `git apply` directions. Decision: re-apply the adaptations (the `.codex/hooks/aidlc-codex-dispatch.ts` bridge, the `start-stage-rules` / `finish-stage-rules` targets, the `permissionDecision: allow` on rewritten input, the `SubagentStart` / `PostToolUse` hooks, the `isAidlcAgent` exports) and regenerate `installed-harnesses.patch` from the new baseline. Consequence: `prepare:harnesses` reports "already applied"; the codex host-verification path is available again.

## 2026-09-11 — The audit shards are machine-local here (deviation)

The engine's default commits the per-clone audit shards. In this repository they append on every session turn, so committing them dirties the tree continuously (four audit-only PRs). Decision: ignore `aidlc/spaces/*/intents/*/audit/` and untrack the existing shard, documenting the deviation in `.gitignore`. Rationale: the workflow never reads the audit to proceed, so keeping it machine-local loses no run state. Consequence: the working tree stays clean between work.

## 2026-09-11 — A one-command installer for user projects

The plugin needs a user-facing install path. Decision: `ddd/scripts/install.ts`, mirroring the sibling deep-spec-analysis plugin — build the harness projection, compose via `aidlc plugin sync` (or the projection's `hooks/compose.ts`), verify a sentinel sensor, and record provenance at `<harness>/tools/data/ddd-install.json`. It resolves sources from `--from` / `--ref` / `--tag` / the latest stable tag (fetched as a hardened GitHub tarball), refreshes its own previously composed payloads before an upgrade compose, and supports `--dry-run`. Consequence: `bun ddd/scripts/install.ts --project <path> --from <repo>` installs in one command.

## Verification matrix (measured, 2026-09-11)

| Check | Result |
|---|---|
| `bun run validate` | VALID (0 errors) |
| `bun run check:biome` | clean |
| Unit + golden suites (U1/U2/U4/U5) | 123 pass / 0 fail |
| `bun run test:sandbox` (compose) | claude / codex / kimi / opencode all CLEAN (0 drops, stage on graph, idempotent) |
| `bun run test:dist` (projected tools) | 55 design+rust golden cases × 4 harnesses, 0 failed |
| `bun run prepare:harnesses` | already applied |

The pre-existing `framework-compatibility.test.ts` and `codex-dispatch-bridge.test.ts` require the `aidlc-workflows/dist` fixture, which is not generated in this environment (the submodule is read-only); they exercise the restored codex adapter and pass where the fixture is built.

## Deviations from the functional design (summary)

1. **Stage slug** `domain-modeling` → `ddd-domain-modeling` (compose prefix rule).
2. **Contributions** drop `produces` for functional-design / infrastructure-design (kind-pruned review artifacts).
3. **Audit shards** are ignored here, not committed (continuous churn).
4. **(c-model)** and interior-mutability checks are not implemented, per the functional design's own deferral.
5. **U3 / U9** had no functional-design artifacts; they are realized as the existing scaffold plus the README/CHANGELOG/installer and the golden/install tests.

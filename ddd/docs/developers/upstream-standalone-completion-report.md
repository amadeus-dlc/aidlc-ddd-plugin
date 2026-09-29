# Upstream issue draft: standalone completion skips artifact and gate sensor checks

English | [Japanese](upstream-standalone-completion-report.ja.md)

Updated: 2026-09-28. Status: draft, not posted. The issue is posted to [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) only after the user reviews this draft.

This is the T-01 remaining item in [remaining work](completion-tasks.md). The plugin works around the gap with a manual check described in the [artifact contract](../users/artifact-contract.md#standalone-completion-still-has-a-framework-gap). This repository reproduces the gap on every sandbox run in [install-sandbox.test.ts](../../tests/install-sandbox.test.ts) (`bun run test:sandbox`, or `bun test tests/install-sandbox.test.ts` from `ddd/`), for Claude and Codex. Upstream does not need to run that test; the steps below reproduce the gap with the framework alone.

The line numbers below were checked against the AI-DLC 2.9.0 files bundled in this repository (`.claude/tools/`).

## Issue body

**Title:** `report --single --result completed` records completion without verifying registered artifacts or running gate sensors

**Affected version:** AI-DLC 2.9.0. The background of our task reports that v2.10.0 and `main` have the same gap and that no upstream issue exists yet; we have not verified this locally.

### Summary

A stage run in isolation (`aidlc-orchestrate.ts next --stage <slug> --single`, then `report --stage <slug> --single --result completed`) is recorded as completed even when every artifact the stage registers is missing. The single-stage report path does not run the artifact verification or the blocking gate sensors that the approval path runs. A plugin whose checks are all gate sensors (`fire_on: gate`) therefore has no check at all on standalone completion.

### Steps to reproduce

1. Create a fresh project from AI-DLC 2.9.0.
2. Pick a stage that registers produced artifacts (for example a plugin stage whose artifacts are checked by gate sensors).
3. Run `bun .claude/tools/aidlc-orchestrate.ts next --stage <slug> --single`. It returns a `run-stage` directive.
4. Do not write any of the stage's artifacts.
5. Run `bun .claude/tools/aidlc-orchestrate.ts report --stage <slug> --single --result completed`.

### Expected behavior

`report --single` refuses a stage whose registered artifacts are missing, and records no completion. It also runs the stage's blocking gate sensors and refuses when one of them does not pass, as the approval path does.

### Actual behavior

The command returns `"kind":"done"` and records `STAGE_COMPLETED` for the synthetic single-stage workflow. No gate sensor runs.

### Code involved

- `handleSingleReport` in `.claude/tools/aidlc-orchestrate.ts` (lines 8145-8254) checks only summary confirmation evidence, CodeKB artifacts (`checkSingleCodekbArtifacts`), pipeline link evidence and ensemble evidence before it appends `STAGE_COMPLETED` and emits `kind: "done"`.
- It calls none of the functions the approval path uses in `.claude/tools/aidlc-state.ts`: `verifyStageArtifacts` (line 3461), `fireGateSensors` (line 2973) and `enforceBlockingGateSensors` (line 3233).

### Related detail: a sensor result with a note

`aidlc engine sensor fire` (`handleFire`, `.claude/tools/aidlc-sensor.ts` line 385) exits 1 when the output path does not exist (lines 433-435). When the sensor script itself fails (spawn failure, signal, and similar cases, lines 682-781), it reports `result: passed` with a `note` such as `script-error: ...`. The approval gate treats only `passed` without a `note` as a pass (`.claude/tools/aidlc-state.ts` line 3131). So a caller that checks only `result: passed` from `sensor fire` can accept a sensor that did not run. Any fix that reuses the sensor results on the single-stage path should keep the gate's rule.

### Suggested fix

On the single-stage report path, run the same artifact verification and the same blocking gate sensors as on approval (`verifyStageArtifacts`, `fireGateSensors`, `enforceBlockingGateSensors`), and refuse to record `STAGE_COMPLETED` when they fail.

### Workaround

Our plugin tells the model, in each stage's instructions, to run `aidlc engine sensor fire <sensor> --stage <slug> --output-path <artifact>` for every sensor of the stage before a standalone completion. A blocking sensor counts as passed only when the command exits 0 and its final JSON line is `result: passed` with no `note`. This depends on the model following the instructions and is not enforced by the framework.

# 上流イシューの下書き: 単独完了が成果物とゲートセンサーの検査を省く

[English](upstream-standalone-completion-report.md) | 日本語

更新: 2026-09-28。状態: 下書き、未投稿。ユーザーがこの下書きを確認してから、[awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) へ投稿する。

これは[残作業](completion-tasks.ja.md)のT-01の残件である。プラグインは、[成果物契約](../users/artifact-contract.ja.md#単独完了には標準側の不足が残る)に書いた手動の確認でこの不足を補っている。このリポジトリは、[install-sandbox.test.ts](../../tests/install-sandbox.test.ts)で、この不足をClaude・Codexの両方で、サンドボックスの実行ごとに再現する（`bun run test:sandbox`、または `ddd/` で `bun test tests/install-sandbox.test.ts`）。上流にこのテストの実行は求めない。下の手順はフレームワークだけで不足を再現する。

下の行番号は、このリポジトリに同梱したAI-DLC 2.9.0のファイル（`.claude/tools/`）で確認した。

以下のイシュー本文は、投稿先に合わせて英語で書く。

## イシュー本文

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

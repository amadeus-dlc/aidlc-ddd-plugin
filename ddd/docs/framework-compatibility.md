# AI-DLC compatibility

English | [Japanese](framework-compatibility.ja.md)

Updated: 2026-09-13. Verification baseline: AI-DLC 2.8.2 and Bun 1.3.13. Completion targets are Claude Code and Codex; Kimi and opencode are out of scope.

## Use standard installed tools

`.claude/tools/` and `.codex/tools/` are third-party framework distributions, not implementation targets for this plugin. Record framework gaps as reproductions and upstream proposals. Make plugin implementation changes under `ddd/`.

This working copy has AI-DLC installed in `.claude/` and `.codex/`. DDD development validate/build/test commands use `.codex/tools/`. The installer uses the tools already installed for the selected destination harness.

T-04 tracks remaining helper-code cleanup.

## Separate verified and unverified behavior

The assessment verified Claude/Codex builds, compose, and existing golden cases. T-01 connected artifacts to normal approval checks. Standard standalone completion still skips general artifacts and sensors and can finish without artifacts. See the [artifact contract](artifact-contract.md) for reproduction and limits.

Codex rule delivery depends on integration between standard AI-DLC and the execution host. T-05 verifies the current route from the DDD side. Old bridge success records are not a substitute.

## Compatibility work order

1. Normal approval is connected under T-01. The remaining standalone completion guarantee needs a standard AI-DLC fix.
2. T-04 aligns build/verification paths and removes old dependencies for the two supported harnesses.
3. T-05 verifies fresh installation, updates, and actual stage execution.

See [remaining work](completion-tasks.md) and [measurements](current-state-assessment.md). Keep old-version details in the [historical Codex record](codex-host-verification.md).

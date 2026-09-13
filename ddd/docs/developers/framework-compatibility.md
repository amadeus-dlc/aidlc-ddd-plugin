# AI-DLC compatibility

English | [Japanese](framework-compatibility.ja.md)

Updated: 2026-09-13. Verification baseline: AI-DLC 2.8.2 and Bun 1.3.13. Completion targets are Claude Code and Codex; Kimi and opencode are out of scope.

## Use standard installed tools

The framework implementations under `.claude/tools/` and `.codex/tools/` are third-party distributions. Make plugin implementation changes under `ddd/`. The repository-owned development scope manifests and their named scope-grid entries are configuration extensions that this project maintains.

The plugin and its development scopes must supply inputs, artifacts, and explicit checks that work with the supported AI-DLC version. When an integration fails, first correct our configuration and generation flow using the available interfaces. Keep investigations local; external reports require an explicit user instruction.

This working copy has AI-DLC installed in `.claude/` and `.codex/`. DDD development validate/build/test commands use `.codex/tools/`. The installer uses the tools already installed for the selected destination harness.

Development checks use the current standard toolchain.

## Development scope traceability on 2.8.2

`plugin-dev` includes `user-stories` before `domain-design` and `units-generation`. Derive actual stories with actors, goals, and acceptance criteria from the approved requirements, then verify requirements → stories → Units. Keep the requirement IDs and define distinct story IDs; renaming requirement IDs does not create stories.

This is the verified path through the standard 2.8.2 traceability sensor. The supported development scope does not rely on direct requirement-to-Unit mapping. `plugin-bugfix` and `plugin-refactor` do not generate Units, so this condition does not add a stories stage to those scopes.

Run `bun run test:development-scopes` from `ddd/`; `bun run check` includes it. It checks installed repository-owned scope configurations and invokes the real `aidlc` command in a disposable workspace to verify both traceability links and rejection of a mismatched Unit. It requires Bun and the supported `aidlc` binary on PATH.

For an existing intent that has reached Units Generation without stories, use the standard workflow routing to add and execute User Stories, then refresh the affected mappings. Editing the reusable scope alone does not repair an in-progress intent's artifacts.

## Separate verified and unverified behavior

The assessment verified Claude/Codex builds, compose, and existing golden cases. T-01 connected artifacts to normal approval checks. Standard standalone completion still skips general artifacts and sensors and can finish without artifacts. See the [artifact contract](../users/artifact-contract.md) for reproduction and limits.

Codex rule delivery depends on integration between standard AI-DLC and the execution host. T-05 verifies the current route from the DDD side. Old bridge success records are not a substitute.

## Compatibility work order

1. Maintain T-01 normal approval checks and the explicit direct checks before standalone completion. Do not infer verification success from completion or exit status alone.
2. T-04 build/verification paths target the current Claude/Codex toolchain.
3. T-05 installation/update CLI checks are complete; actual model-driven stage execution remains.

See [remaining work](completion-tasks.md) and [measurements](current-state-assessment.md). Keep old-version details in the [historical Codex record](codex-host-verification.md).

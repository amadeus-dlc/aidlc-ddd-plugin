# Installation and update verification

English | [Japanese](installation-verification.ja.md)

The supported destinations are Claude Code and Codex with standard AI-DLC tools installed. The verified baseline is AI-DLC 2.8.2 and Bun 1.3.13.

## Automated commands

```sh
cd ddd
bun run test:install
bun run test:install:remote
```

The first command runs deterministic helper tests and the installer CLI against disposable projects. The second enables two network tests that fetch the real GitHub main archive. The regular sandbox includes test:install; network tests are opt-in.

| Verification | Result |
|---|---|
| Helpers and local CLI scenarios | 45 passed; two network tests skipped |
| Real GitHub main acquisition and installation | Both harnesses passed |
| Plugin validation and formatting | Passed |

The CLI cases cover fresh install, repeat install, payload updates, contribution-only updates, fresh/update dry-runs, compose failures, invalid contributions, ownership conflicts, removed payload files, legacy receipts, fixed-tag integrity, unsupported harnesses, conflicting selectors, prebuilt projections, and linked destination directories. A freshly installed sensor is executed, and the registered stage graph is inspected.

Tag/latest acquisition uses archive fixtures at the HTTP boundary, including version mismatch and HTTP failure. No public release tag was created or installed during this verification. Actual model-driven stage execution and rule delivery to a model are separate from installation verification.

## Publishing an installation

The installer builds a projection and prepares a candidate copy of the managed harness, shared skills, and AI-DLC records. It composes through the projection's standard hook, checks plugin drops, compiles the graph, and compares installed payload bytes with the selected projection before publishing changes. Dry-run stops before publication.

Only changed files are published. The installer checks destination contents against the candidate's starting state, refuses writes through symbolic links, and keeps rollback copies for the publication step. Compose and validation failures leave the destination unchanged. The tests do not inject process termination or storage failure during publication; this is not a claim of whole-filesystem atomicity.

An installation lock prevents overlapping installer publications. A caught publication failure attempts to restore prior file contents; if restoration itself fails, the error names the retained recovery directory.

## Ownership and update receipts

The receipt is `<harness>/tools/data/ddd-install.json`. It records version, source selector, timestamp, payload digest, projection digest, and per-file ownership hashes. The projection digest includes contributions; binary payloads are hashed as bytes.

Updates refresh only recorded, unmodified plugin files and remove recorded files no longer shipped. Unowned collisions and local modifications are reported rather than overwritten. A legacy receipt can gain ownership metadata when its previous payload digest is verifiable. Otherwise, use the recorded source version to establish ownership before updating.

`--update` reuses the recorded source. A fixed-tag update checks its recorded files and reports no change when intact. `--skip-build` consumes the existing projection. Use exactly one of --from, --ref, and --tag for an explicit source.

See [execution evidence](evidence/installation-verification.json) and the [remaining work](completion-tasks.md).

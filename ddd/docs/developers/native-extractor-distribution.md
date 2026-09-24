# Native extractor distribution

[日本語](native-extractor-distribution.ja.md) | [Inspection contract design](inspection-contract-design.md)

The Rust + syn native extractor is the one executable that answers the `error-contract/1`, `state-exposure/1` and `domain-facts/1` extraction protocols. This document records where it is installed, which platforms this distribution covers, how it reaches an installed project, what is reported when it cannot be launched, and whether a gate needs a Rust toolchain.

## The installed path

One build is installed at one path, and every entry launches it:

```
tools/ddd/bin/manifest.json                        # the platforms this distribution covers
tools/ddd/bin/<platform-key>/ddd-rust-syn-spike    # the build for one platform
```

`<platform-key>` is `${process.platform}-${process.arch}`, for example `darwin-arm64`. [`manifest.ts`](../../tools/ddd/lib/rust/native/manifest.ts) resolves that path relative to itself, so the same relative location holds in the source tree, in `dist/<harness>/` and in an installed project.

[`rust/error-contract/index.ts`](../../tools/ddd/lib/rust/error-contract/index.ts), [`rust/state-evidence/index.ts`](../../tools/ddd/lib/rust/state-evidence/index.ts) and [`rust/domain-facts/index.ts`](../../tools/ddd/lib/rust/domain-facts/index.ts) all resolve their default launch path through that module, so none carries an installation path of its own. Each entry keeps its own protocol version — 3 for the error contract, 2 for state exposure, 4 for domain facts — and the manifest records none of them: the protocol numbers and the extractor and syn versions stay in the code that checks them.

| Protocol | Version flag | `protocol_version` | Read by |
|---|---|---|---|
| `error-contract/1` | `--error-contract-version` | 3 | the operation error-set comparison |
| `state-exposure/1` | `--state-exposure-version` | 2 | the state-exposure inspection |
| `domain-facts/1` | `--domain-facts-version` | 4 | rules `a` and `d` of `ddd-rust-domain` and `ddd-rust-use-case` |

A caller may still pass an explicit command to `extractRust`. That names a process to observe for a controlled verification scenario, so it is launched as given and the installed extractor is neither resolved nor verified.

## Covered platforms

| Platform key | Rust target triple | Status |
|---|---|---|
| `darwin-arm64` | `aarch64-apple-darwin` | Built and shipped |

A build can only be produced on the platform it targets, so the manifest records the platform this distribution was prepared on. Every other environment — Linux, Windows, and x86_64 in general — is **out of scope** and is not presented as covered: a platform with no manifest row resolves to `unsupported-platform` rather than to a path that was never installed. Adding a platform means running the build below on that platform and committing the resulting binary and manifest row.

`ddd-rust-domain` and `ddd-rust-use-case` decide rules `a` and `d` on this extractor, so on an uncovered environment a run those rules have a claimed file to decide stops as inspection-impossible rather than passing; a run that claims no file they evaluate reports its verdict as usual. `ddd-rust-interface-adapter` declares neither rule and never launches it.

## Building and recording a platform

Run from `ddd/`:

```sh
bun run prepare:native
```

[`prepare-native-extractor.ts`](../../scripts/prepare-native-extractor.ts) reads the host triple from `rustc -vV`, builds with `cargo build --locked --offline --release` and an explicit `--target`, installs the result at the product path, grants it the execute bit, probes **all three** protocols, and records `{ target, sha256 }` for the host platform key in the manifest. Identical bytes are not recopied. Build preparation has a 120-second subprocess limit and the version probes a 180-second bound; a failed build is not installed. Existing rows for other platforms are preserved.

## Reaching an installed project

`tools/` is already a distributed payload, and `tools/ddd/**` is already owned by the installation, so the extractor and the manifest travel with every other plugin file: the plugin build projects them into `dist/claude/` and `dist/codex/`, composition writes them into the project, and [`install.ts`](../../scripts/install.ts) records them in `owned_files`. Both a fresh installation and an `--update` place them.

Projection and composition write payload bytes without a mode, so the extractor arrives without its execute bit. The installer grants it inside the candidate tree after composition and before the candidate is read, so the destination is still guarded by the collision check and the commit is still atomic. A user-owned file already sitting at the extractor path is refused as a payload collision and the destination is left untouched.

## When the extractor cannot be launched

[`launch.ts`](../../tools/ddd/lib/rust/native/launch.ts) classifies one launch once, and the entries project that one outcome into one reported issue. The conditions are tested in a fixed order because each presupposes the previous — an absent file cannot be hashed, a file without an execute bit cannot be probed, and only a probe that completed can disagree about the protocol:

| Order | Condition | Reported subject | Reason code |
|---|---|---|---|
| 1 | The manifest records no row for this platform | `native-extractor:unsupported-platform` | `tool-unavailable` |
| 2 | No file at the installed path | `native-extractor:binary-missing` | `tool-unavailable` |
| 3 | The file carries no execute permission | `native-extractor:binary-not-executable` | `tool-unavailable` |
| 4 | The bytes do not hash to the recorded digest | `native-extractor:checksum-mismatch` | `tool-unavailable` |
| 5 | The probe does not complete, so there is no answer | `native-extractor:probe-failed` | the code the observation reported: `tool-unavailable`, `execution-failed`, `timeout`, `output-limit` or `resource-limit` |
| 6 | The probe completed but does not answer the expected protocol | `native-extractor:protocol-mismatch` | `unknown-version` |

Each condition carries its own subject, so a report never merges two of them. When more than one holds, the first in the order is the one reported. The digest is checked before the extractor is launched, so altered bytes are never executed. A probe that never completed keeps the reason code the observation gave it — a failed launch, a timeout or an output past the limit stays itself and is not restated as a disagreement about the protocol.

None of these pass. For the two inspection contracts, extraction returns an execution whose status is not `completed` and whose reasons carry the issue, so the shared inspection rules report `executionState` as `unavailable`, `ruleResult` as `unresolved`, and the issue among the unresolved reasons. For the two gates that read `domain-facts/1`, the same issue becomes the sensor runtime's tool-unavailable terminal on every run where rules `a` and `d` have a claimed file to decide: the gate exits 127 and writes no verdict. A run that claims no such file evaluates neither rule, so the classification decides nothing there and the gate reports its verdict. An inspection that cannot run does not approve.

## Rust toolchain at gate time

**A gate does not require a Rust toolchain for the extractor.** Because the build is shipped, resolving, verifying and launching it needs neither `rustc` nor `cargo`: the platform key comes from the running process, the target triple and the digest come from the manifest, and the executable is launched by path. [`operation-error-set-verification/rust.ts`](../../tools/ddd/lib/operation-error-set-verification/rust.ts) reads the triple it hands to the Cargo condition from the manifest for this reason.

`resolveCargoCondition` still runs `cargo metadata --format-version 1 --frozen`. That is a requirement of the **inspected project**, not of this plugin: it resolves the build condition of the workspace under inspection, and `--frozen` forbids fetching and writing a lockfile, so an unprepared workspace is reported as unavailable rather than prepared implicitly.

The development commands are a separate matter. `bun run prepare:native`, `bun run verify:error-contract`, `bun run verify:operation-error-set` and `bun run experiment:rust-syn` build or measure Rust source and need `cargo` and `rustc` as they always have.

## Out of scope

Migrating the remaining Rust rules to this extractor, distributing the TypeScript extractor, and moving the Rust crate out of `experiments/rust-syn/` are not part of this change. Rules `a` and `d` were connected in T-10-02; every other rule still decides on tree-sitter.

# DDD plugin documentation

English | [Japanese](README.ja.md)

Updated: 2026-09-13. Design conventions, implementation measurements, and remaining work are maintained separately.

| Topic | Document |
|---|---|
| What the plugin provides and how to verify it | [Plugin README](../README.md) |
| Domain packaging by business vocabulary | [Packaging contract](domain-packaging-design.md) |
| Rust type matching, replay, and coverage gaps | [Rust sensor contract](rust-sensor-contract.md) |
| Artifact names, declaration format, standalone limits | [Artifact contract](artifact-contract.md) |
| Work remaining before completion | [Tasks and criteria](completion-tasks.md) |
| What has been verified | [2026-09-13 assessment](current-state-assessment.md) |
| Domain conventions and boundaries | [Domain design](domain-layer-design.md) |
| Re-execution, consistency, and recovery | [Use-case design](use-case-layer-design.md) |
| CQRS, persistence, and RMU | [Interface Adapter design](interface-adapter-layer-design.md) |
| Policy and historical decisions | [Decisions](decisions.md) |
| AI-DLC compatibility and unverified scope | [Compatibility](framework-compatibility.md) |
| Provenance of earlier Codex host evidence | [Historical verification](codex-host-verification.md) |

## How to read these documents

The three layer designs define conventions for generated applications and the plugin. Implementation and measurements establish compliance; a written convention is not evidence of a completed check.

The assessment retains evidence from each checkpoint rather than rewriting failures as later successes. The task list tracks current progress. Record new measurements with dates and scope.

Knowledge, sensors, stages, and contributions are English-only. Other plugin docs and guides have full English `.md` and Japanese `.ja.md` editions with matching content; records under `aidlc/` remain Japanese. Procedures for the removed reference submodule are retired, and old Codex evidence is historical only.

# DDD plugin developer documentation

English | [Japanese](README.ja.md) | [All documentation](../README.md)

For developers maintaining this plugin. Start with the assessment and remaining work, consult the relevant design, and verify changes through the test guide.

## Design and implementation

| Topic | Document |
|---|---|
| Plugin responsibilities and data flow | [Architecture overview](../../../docs/architecture.md) |
| Current policy and rationale | [Decisions](decisions.md) |
| Domain conventions and boundaries | [Domain-layer design](domain-layer-design.md) |
| Re-execution, consistency, and recovery | [Use-case-layer design](use-case-layer-design.md) |
| CQRS, persistence, and RMU | [Interface Adapter-layer design](interface-adapter-layer-design.md) |
| Framework integration and constraints | [AI-DLC compatibility](framework-compatibility.md) |

The layer designs define conventions for generated applications and the plugin. Consult the [user contracts](../users/README.md) when changing artifact formats or sensor behavior. Written conventions alone do not establish automated enforcement.

## Verification and remaining work

| Topic | Document |
|---|---|
| Current progress and completion criteria | [Remaining work](completion-tasks.md) |
| Measurements from each checkpoint | [Current-state assessment](current-state-assessment.md) |
| Test commands and fixture organization | [Test guide](../../tests/README.md) |
| Positive, negative, and boundary evidence per sensor | [Sensor coverage matrix](sensor-coverage.md) |
| Fresh installation, updates, and failure behavior | [Installation verification](installation-verification.md) |
| Provenance of earlier Codex host results | [Historical host verification](codex-host-verification.md) |
| Machine-readable execution records | [Evidence](evidence/) |

Keep measurements dated and scoped. The assessment preserves each checkpoint; the task list tracks current progress. Earlier host results do not establish current rule delivery.

Run `bun scripts/report-sensor-coverage.ts --write` from `ddd/` to regenerate both coverage documents in this directory. Run `bun run test:coverage` to check the report against the fixtures. Update source documents and generators together when changing the documentation structure.

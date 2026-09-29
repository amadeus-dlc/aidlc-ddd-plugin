---
target: functional-design
plugin: ddd
adds:
  consumes:
    - artifact: ddd-aggregate-mapping
      required: false
  sensors:
    - ddd-reference-ids
    - ddd-mapping-declarations
    - ddd-design-advisories
fragments:
  - anchor: after-step:2
    order: 100
  - anchor: after-step:4
    order: 100
---

## fragment: after-step:2

### Step 2x (ddd): Ask the use-case items and conventions

Add these question topics, and follow the conventions while designing:

- **Inherited placement.** Use domain_packages from domain-design; do not invent Unit-local classifications such as aggregate/ or vo/. If placement must change, update the upstream term, model references, and rationale before using it.
- **Six mandatory items per use case.** `use_case_id` (`uc.<slug>`), `name`,
  `target_aggregates` (one or more `aggregate.*`), `commands` (one or more
  `command.*`), `re_execution_basis` (how each step's idempotency strategy makes
  a retry safe), `recovery_policy` (`caller-retry`, `step-backoff` or `both`),
  and `read_model_exposure` (which view exposes intermediate state).
- **Multi-aggregate strategy.** When a use case targets two or more aggregates,
  require a `multi_aggregate_strategy`. When any target aggregate is
  actor-modelled in `ddd-aggregate-mapping`, it must be a `process-manager`
  referencing a `pm.*`. When every target is class-modelled, choose either a
  `process-manager` or a `re-execution` with its rationale. A multi-aggregate
  `re-execution` needs the mapping to give the programming model of every
  target; without the mapping, or with a target it does not map, the gate
  cannot decide whether a Process Manager is required and refuses the use case.
  A single-aggregate use case and a `process-manager` do not depend on the
  mapping.
- **Idempotency and resend period.** `re_execution_basis` states how the
  idempotency strategy of each command makes a retry safe. For a command with
  `idempotency.strategy: command-id-memory`, a repeated command id is answered
  as already applied, and how long ids are remembered is the model's
  `idempotency.retention` (with `retention_count` or `retention_window`); do
  not restate or override it in the use case. For a command with
  `strategy: none`, state whether a repeat is refused with the command's own
  error or is a no-op of the state transition.
- **Conventions.** Keep the five-point set (transactional consistency boundary,
  idempotency, ordering, failure and compensation, observability) explicit; keep
  the use case the orchestrator, not the domain; state the consistency boundary;
  and make the flow re-execution-safe.

## fragment: after-step:4

### Step 4x (ddd): Write the use-case declarations

Add exactly one `## DDD Use-case Declarations` section to the existing required review artifact `functional-spec.md`. Put the following declaration in exactly one labelled YAML block in that section. Do not generate a separate declaration file. Inherit the artifact's Unit kinds (service / spec / ui / library); packaging does not require it. YAML examples in other sections are not DDD declarations. Artifact prose follows the project's output-language policy; the section heading is a parser marker.

```yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
use_cases:
  - use_case_id: uc.<slug>
    name: <name>
    target_aggregates: [<aggregate.*>, ...]
    commands: [<command.*>, ...]
    re_execution_basis: <how a retry is safe>
    recovery_policy: <caller-retry | step-backoff | both>
    multi_aggregate_strategy:        # required when two or more targets
      kind: <process-manager | re-execution>
      process_manager_ref: <pm.*>    # when process-manager
      rationale: <text>              # when re-execution
    read_model_exposure: <which view>
```

A unit with no use cases writes `use_cases: []` and a one-line explanation.
Reference the model by ID; never redefine it.

**Standalone completion check.** Before reporting a standalone completion of `functional-design`, run each command below against this attempt's artifact, replacing the path placeholder with the actual path:

- `aidlc engine sensor fire ddd-reference-ids --stage functional-design --output-path <path-to-this-attempt's-functional-spec.md>` (blocking)
- `aidlc engine sensor fire ddd-mapping-declarations --stage functional-design --output-path <path-to-this-attempt's-functional-spec.md>` (blocking)
- `aidlc engine sensor fire ddd-design-advisories --stage functional-design --output-path <path-to-this-attempt's-functional-spec.md>` (advisory)

A blocking sensor passes only when the command exits 0 and its final JSON line is `result: passed` with no `note`; a non-zero exit (a missing artifact exits non-zero), `result: failed`, or a `note` is a failure: fix the artifact and rerun. The advisory `ddd-design-advisories` never blocks completion: read its findings and address or explain each one. AI-DLC 2.9.0 `report --single` does not check this stage's artifacts or run its gate sensors, so do not skip this check.

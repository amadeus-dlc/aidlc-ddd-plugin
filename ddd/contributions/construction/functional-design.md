---
target: functional-design
plugin: ddd
adds:
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

- **Six mandatory items per use case.** `use_case_id` (`uc.<slug>`), `name`,
  `target_aggregates` (one or more `aggregate.*`), `commands` (one or more
  `command.*`), `re_execution_basis` (how each step's idempotency strategy makes
  a retry safe), `recovery_policy` (`caller-retry`, `step-backoff` or `both`),
  and `read_model_exposure` (which view exposes intermediate state).
- **Multi-aggregate strategy.** When a use case targets two or more aggregates,
  require a `multi_aggregate_strategy`: a `process-manager` referencing a `pm.*`
  when the aggregates are actor-modelled, or a `re-execution` rationale when
  they are class-based.
- **Conventions.** Keep the five-point set (transactional consistency boundary,
  idempotency, ordering, failure and compensation, observability) explicit; keep
  the use case the orchestrator, not the domain; state the consistency boundary;
  and make the flow re-execution-safe.

## fragment: after-step:4

### Step 4x (ddd): Write the use-case declarations

Write `ddd-use-case-declarations` (logical name) to this stage's engine-resolved
per-unit record dir. The first fenced ```yaml block is canonical:

```yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/domain-model.yaml
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

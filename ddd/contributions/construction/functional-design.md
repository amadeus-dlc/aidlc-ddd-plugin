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
  require a `multi_aggregate_strategy`: a `process-manager` referencing a `pm.*`
  when the aggregates are actor-modelled, or a `re-execution` rationale when
  they are class-based.
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

For standalone execution, explicitly run `ddd-reference-ids`, `ddd-mapping-declarations`, and `ddd-design-advisories` with `aidlc engine sensor fire` against this attempt's functional-spec before reporting completion. Both blocking sensors must return `result: passed` in their final JSON. Standard 2.8.2 standalone completion does not perform these checks for you.

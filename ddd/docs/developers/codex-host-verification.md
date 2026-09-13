# Historical Codex host verification

English | [Japanese](codex-host-verification.ja.md)

This page and its JSON evidence record the earlier Codex integration investigated in September 2026. **They do not prove rule delivery works on current AI-DLC 2.8.2.** See [compatibility](framework-compatibility.md) for current policy and [T-05](completion-tasks.md) for re-verification.

The initial investigation could not confirm child rule delivery because host tool names and encrypted input did not match the old delivery code's assumptions. Later, a custom bridge added to the old setup allowed verification of workflow-state and standalone-stage-hint routes.

| Evidence | Scope |
|---|---|
| [Initial investigation](evidence/codex-host-verification.json) | Old input formats, session binding, rule-delivery failures, and related observations. |
| [After the old bridge](evidence/codex-host-bridge-verification.json) | Success with a custom bridge in the old setup. |

Preserve the original environments, dates, and hashes in JSON. Local raw-log paths identify historical locations and may not exist in a new working copy. Do not present reapplying old patches or changing authentication/trust settings as current recommended procedures.

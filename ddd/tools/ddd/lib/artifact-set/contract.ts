/**
 * The DDD artifact set of one project: its settings, and the canonical model, implementation
 * mapping and layer declarations of one intent record.
 *
 * The set has one outcome, chosen from the outcomes of its artifacts by a single rule, and every
 * decision the command reports — the exit status, whether anything is written — is read from that
 * one outcome. An artifact that is not there is not a defect of the set: a record may hold no
 * mapping, and the rest of it is still converted.
 */

import type { FindingInput } from "../shared/findings.ts";

export const ARTIFACT_SET_RULES = { record: "artifact-set.record" } as const;

/** What the set holds, in the order the artifacts are written. */
export const ARTIFACT_KINDS = [
  "canonical-model",
  "implementation-mapping",
  "layer-declaration",
  "project-settings",
] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export type ArtifactOutcome =
  | "absent"
  | "candidate"
  | "already-migrated"
  | "applied"
  | "missing-information"
  | "rejected"
  | "write-failed";

/** One artifact's report: its identity, its outcome, and whatever that outcome carries. */
export interface ArtifactReport {
  readonly artifact: ArtifactKind;
  readonly path: string;
  readonly outcome: ArtifactOutcome;
  readonly [field: string]: unknown;
}

export type SetOutcome =
  | "candidate"
  | "already-migrated"
  | "applied"
  | "missing-information"
  | "rejected"
  | "write-failed"
  | "invalid-arguments";

/**
 * The outcome of the set, from the outcomes of its artifacts. A refusal outranks information still
 * to supply, which outranks having something to convert, which outranks having nothing left to do;
 * an artifact that is not there decides nothing. This order is the whole rule: no artifact is
 * given precedence over another, and no field of the report is chosen from a different artifact
 * than the outcome was.
 */
export function selectSetOutcome(
  artifacts: readonly ArtifactReport[],
): Extract<SetOutcome, "candidate" | "already-migrated" | "missing-information" | "rejected"> {
  const outcomes = new Set(artifacts.map((entry) => entry.outcome));
  if (outcomes.has("rejected")) return "rejected";
  if (outcomes.has("missing-information")) return "missing-information";
  if (outcomes.has("candidate")) return "candidate";
  return "already-migrated";
}

/** Why the request itself names no set to convert, before any artifact of one was read. */
export function refuseRecord(path: string, message: string): readonly FindingInput[] {
  return [{ rule_id: ARTIFACT_SET_RULES.record, file: path, message }];
}

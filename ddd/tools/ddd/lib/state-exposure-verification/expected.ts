import { isDeepStrictEqual } from "node:util";
import { REASON_CODES } from "../state-exposure/index.ts";
import { byteLocation, type FrozenTask } from "./input.ts";

type RecordValue = Record<string, unknown>;
function record(value: unknown, keys: string[]): RecordValue {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !isDeepStrictEqual(Object.keys(value).sort(), keys.sort())
  )
    throw new Error("invalid expected object shape");
  return value as RecordValue;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("invalid expected array");
  return value;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.length) throw new Error("invalid expected string");
  return value;
}
function location(value: unknown, task: FrozenTask): void {
  const raw = record(value, ["file", "line", "byteStart", "byteEnd"]);
  if (
    typeof raw.byteStart !== "number" ||
    typeof raw.byteEnd !== "number" ||
    !isDeepStrictEqual(raw, byteLocation(task.request, raw.byteStart, raw.byteEnd))
  )
    throw new Error("invalid expected location");
}
function locations(value: unknown, task: FrozenTask): void {
  const list = array(value);
  if (!list.length) throw new Error("missing expected evidence");
  for (const item of list) location(item, task);
}
function issues(value: unknown, task: FrozenTask): unknown[] {
  const list = array(value);
  for (const item of list) {
    const raw = record(item, ["code", "subject", "message", "location"]);
    if (!(REASON_CODES as readonly unknown[]).includes(raw.code)) throw new Error("unknown expected reason");
    string(raw.subject);
    string(raw.message);
    if (raw.location !== null) location(raw.location, task);
  }
  return list;
}
function evidence(value: unknown, task: FrozenTask): void {
  if (!value || typeof value !== "object") throw new Error("invalid expected evidence");
  if ("targetStatus" in value && value.targetStatus === "unresolved") {
    const raw = record(value, ["targetStatus", "reasons"]);
    if (!issues(raw.reasons, task).length) throw new Error("missing target reason");
    return;
  }
  const raw = record(value, ["targetStatus", "targetEvidence", "members"]);
  if (raw.targetStatus !== "resolved") throw new Error("invalid expected target state");
  locations(raw.targetEvidence, task);
  const members = record(raw.members, ["completeness", "items", "reasons"]);
  if (!["complete", "partial"].includes(String(members.completeness))) throw new Error("invalid expected completeness");
  const reasons = issues(members.reasons, task);
  if ((members.completeness === "complete") !== !reasons.length)
    throw new Error("invalid expected enumeration reasons");
  const seen = new Set<string>();
  for (const item of array(members.items)) {
    const member = record(item, ["memberId", "stateExposure"]);
    const id = string(member.memberId);
    if (seen.has(id)) throw new Error("duplicate expected member");
    seen.add(id);
    const value = member.stateExposure;
    if (!value || typeof value !== "object" || !("status" in value)) throw new Error("invalid expected fact");
    if (value.status === "resolved") {
      const fact = record(value, ["status", "value", "evidence"]);
      if (typeof fact.value !== "boolean") throw new Error("invalid expected exposure");
      locations(fact.evidence, task);
    } else if (value.status === "absent") locations(record(value, ["status", "evidence"]).evidence, task);
    else if (value.status === "unresolved") {
      if (!issues(record(value, ["status", "reasons"]).reasons, task).length)
        throw new Error("missing expected fact reason");
    } else throw new Error("invalid expected fact state");
  }
}
/** Validate authored expectations without running the production judgment to derive them. */
export function validateExpected(value: unknown, task: FrozenTask): void {
  const outcome = record(value, ["kind", "result"]);
  if (outcome.kind !== "evaluated") throw new Error("expected evaluated outcome");
  const result = record(outcome.result, [
    "schemaVersion",
    "requestIdentity",
    "target",
    "executionState",
    "ruleResult",
    "checkedEvidence",
    "findings",
    "unresolvedReasons",
  ]);
  if (
    result.schemaVersion !== "state-exposure/1" ||
    result.requestIdentity !== task.request.requestIdentity ||
    !isDeepStrictEqual(result.target, task.request.target) ||
    !["completed", "failed", "unavailable"].includes(String(result.executionState)) ||
    !["pass", "violation", "unresolved"].includes(String(result.ruleResult))
  )
    throw new Error("invalid expected result identity or status");
  if (result.checkedEvidence !== null) evidence(result.checkedEvidence, task);
  for (const item of array(result.findings)) {
    const finding = record(item, ["code", "memberId", "evidence"]);
    if (finding.code !== "state-exposed") throw new Error("invalid expected finding");
    string(finding.memberId);
    locations(finding.evidence, task);
  }
  const reasons = issues(result.unresolvedReasons, task);
  if (
    (result.ruleResult === "unresolved") !== !!reasons.length ||
    (result.ruleResult === "pass" &&
      (array(result.findings).length || result.checkedEvidence === null || result.executionState !== "completed"))
  )
    throw new Error("invalid expected result invariant");
}

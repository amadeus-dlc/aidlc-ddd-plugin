import type { EvidenceResponse, Issue, MemberEvidence, ReasonCode, StateEvidence } from "../../state-exposure/index.ts";
import { byteLocation, type FrozenTask, verifyTask } from "../../state-exposure-verification/input.ts";
import {
  DEFAULT_LIMITS,
  issue,
  type Limits,
  type Observation,
  observeProcess,
} from "../../state-exposure-verification/process.ts";
// Aliased: this module already names its own conversion of a native reason code `nativeIssue`.
import { classifyNativeExtractor, nativeIssue as launchIssue } from "../native/launch.ts";
import { NATIVE_BIN_DIR, PLATFORM_KEY } from "../native/manifest.ts";

const PROTOCOL = { flag: "--state-exposure-version", version: 2 };
export const RUST_TOOLCHAIN = [
  { name: "ddd-rust-syn-spike", version: "0.0.0" },
  { name: "syn", version: "3.0.5" },
];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected native object");
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("expected native array");
  return value;
}
function reason(value: unknown): ReasonCode {
  if (
    value !== "unsupported-syntax" &&
    value !== "syntax-error" &&
    value !== "target-missing" &&
    value !== "target-ambiguous" &&
    value !== "incomplete-evidence"
  )
    throw new Error("invalid native reason");
  return value;
}
function location(value: unknown, task: FrozenTask) {
  const raw = object(value);
  if (typeof raw.byte_start !== "number" || typeof raw.byte_end !== "number") throw new Error("invalid native range");
  const loc = byteLocation(task.request, raw.byte_start, raw.byte_end);
  const source = task.input.sources.find((s) => s.path === loc.file);
  if (!source) throw new Error("missing source");
  const bytes = Buffer.from(source.content);
  for (const offset of [loc.byteStart, loc.byteEnd])
    if (offset < bytes.length && (bytes[offset] & 0xc0) === 0x80) throw new Error("invalid UTF-8 boundary");
  return loc;
}
function nativeIssue(value: unknown, task: FrozenTask): Issue {
  return issue(reason(value), task.request.target.declarationPath.join("::"));
}
function member(value: unknown, task: FrozenTask): MemberEvidence {
  const raw = object(value);
  if (typeof raw.name !== "string" || !/^(field:.+|tuple:[0-9]+)$/.test(raw.name))
    throw new Error("invalid native member");
  const memberId = `${task.request.target.declarationPath.join("::")}::${raw.name}`;
  const loc = location(raw.location, task);
  if (raw.status === "resolved" && typeof raw.exposed === "boolean" && !("reason" in raw))
    return { memberId, stateExposure: { status: "resolved", value: raw.exposed, evidence: [loc] } };
  if (raw.status === "unresolved" && !("exposed" in raw))
    return {
      memberId,
      stateExposure: {
        status: "unresolved",
        reasons: [{ ...nativeIssue(raw.reason, task), subject: memberId, location: loc }],
      },
    };
  throw new Error("invalid native fact");
}
function evidence(raw: Record<string, unknown>, task: FrozenTask): StateEvidence {
  const reasons = array(raw.reasons).map((r) => nativeIssue(r, task));
  if (
    raw.target_status === "unresolved" &&
    reasons.length &&
    !("members" in raw) &&
    !("target_location" in raw) &&
    !("completeness" in raw)
  )
    return { targetStatus: "unresolved", reasons };
  if (raw.target_status !== "resolved" || !["complete", "partial"].includes(String(raw.completeness)))
    throw new Error("invalid native target");
  if ((raw.completeness === "complete") !== (reasons.length === 0)) throw new Error("invalid completeness");
  const items = array(raw.members).map((m) => member(m, task));
  if (new Set(items.map((m) => m.memberId)).size !== items.length) throw new Error("duplicate native member");
  return {
    targetStatus: "resolved",
    targetEvidence: [location(raw.target_location, task)],
    members: { completeness: raw.completeness as "complete" | "partial", items, reasons },
  };
}
export function convertRustResponse(value: unknown, task: FrozenTask): EvidenceResponse | null | string {
  if (value === null) return null;
  try {
    const raw = object(value);
    const target = object(raw.target);
    const expected = task.request.target;
    const snapshot = task.request.sources.find((s) => s.path === expected.file);
    if (
      raw.protocol_version !== 2 ||
      raw.request_identity !== task.request.requestIdentity ||
      raw.source_digest !== snapshot?.sha256 ||
      target.file !== expected.file ||
      target.representation !== expected.representation ||
      JSON.stringify(target.declarationPath) !== JSON.stringify(expected.declarationPath)
    )
      throw new Error("native identity mismatch");
    return {
      schemaVersion: "state-exposure/1",
      requestIdentity: task.request.requestIdentity,
      evidence: evidence(raw, task),
    };
  } catch {
    return "invalid-native-response";
  }
}
export async function rustVersions(): Promise<typeof RUST_TOOLCHAIN> {
  const outcome = await classifyNativeExtractor(NATIVE_BIN_DIR, PLATFORM_KEY, PROTOCOL);
  if (outcome.kind !== "ready") {
    const reported = launchIssue(outcome);
    throw new Error(`${reported.subject}: ${reported.message}; run prepare:native`);
  }
  if (outcome.version.extractor !== "0.0.0" || outcome.version.syn !== "3.0.5")
    throw new Error("Rust binary version mismatch; run prepare:native");
  return RUST_TOOLCHAIN;
}
export async function extractRust(
  task: FrozenTask,
  limits: Limits = DEFAULT_LIMITS,
  command?: readonly string[],
): Promise<Observation> {
  verifyTask(task);
  if (
    task.request.language !== "rust" ||
    RUST_TOOLCHAIN.some(
      (tool) =>
        !task.request.toolchain.some((claimed) => claimed.name === tool.name && claimed.version === tool.version),
    )
  )
    throw new Error("Rust toolchain identity mismatch");
  // A caller-supplied command names the process to observe for a verification scenario, so it is
  // launched as given; the installed extractor is the one this classification resolves and verifies.
  let launch = command;
  if (!launch) {
    const outcome = await classifyNativeExtractor(NATIVE_BIN_DIR, PLATFORM_KEY, PROTOCOL);
    if (outcome.kind !== "ready")
      return { execution: { status: "unavailable", reasons: [launchIssue(outcome)] }, stdout: "", diagnostic: "" };
    launch = [outcome.binaryPath];
  }
  const observed = await observeProcess(
    launch,
    JSON.stringify({
      protocol_version: 2,
      request_identity: task.request.requestIdentity,
      files: task.input.sources.map((s) => ({ path: s.path, source: s.content })),
      target: task.request.target,
      settings: task.input.settings,
    }),
    limits,
  );
  if (observed.execution.status !== "completed") return observed;
  return {
    ...observed,
    execution: {
      status: "completed",
      response:
        observed.stdout.trim() && observed.execution.response === null
          ? "invalid-native-response"
          : convertRustResponse(observed.execution.response, task),
    },
  };
}

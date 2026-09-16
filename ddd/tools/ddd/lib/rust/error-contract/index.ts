/**
 * Protocol version 3 of the native extractor. This adapter checks the echoed
 * identity and converts native spellings into contract records; the contract
 * module is what validates them.
 */

import { resolve } from "node:path";
import type {
  ContractEvidence,
  ContractResponse,
  ErrorCase,
  ErrorCaseSet,
  Fact,
  Issue,
  Location,
  ReasonCode,
  ResolutionStep,
  ResolutionStepKind,
  ResultContract,
  TypeReference,
} from "../../error-contract/index.ts";
import { PROTOCOL_VERSION, REASON_CODES, RESOLUTION_STEP_KINDS, SCHEMA_VERSION } from "../../error-contract/index.ts";
import { byteLocation, type FrozenTask, verifyTask } from "../../error-contract-verification/input.ts";
import {
  DEFAULT_LIMITS,
  type Limits,
  type Observation,
  observeProcess,
} from "../../state-exposure-verification/process.ts";

export const RUST_BINARY = resolve(
  import.meta.dir,
  "../../../../..",
  "experiments/rust-syn/target/error-contract/ddd-rust-syn-spike",
);
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
function nonempty(value: unknown): string {
  if (typeof value !== "string" || !value.length) throw new Error("expected native text");
  return value;
}

function location(value: unknown, task: FrozenTask): Location {
  const raw = object(value);
  if (typeof raw.byte_start !== "number" || typeof raw.byte_end !== "number") throw new Error("invalid native range");
  const file = nonempty(raw.file);
  const resolved = byteLocation(task.request, file, raw.byte_start, raw.byte_end);
  const source = task.input.sources.find((entry) => entry.path === file);
  if (!source) throw new Error("missing source");
  const bytes = Buffer.from(source.content);
  for (const offset of [resolved.byteStart, resolved.byteEnd])
    if (offset < bytes.length && (bytes[offset] & 0xc0) === 0x80) throw new Error("invalid UTF-8 boundary");
  return resolved;
}

function issue(value: unknown, task: FrozenTask): Issue {
  const raw = object(value);
  const code = nonempty(raw.code);
  if (!REASON_CODES.includes(code as ReasonCode)) throw new Error("invalid native reason");
  return {
    code: code as ReasonCode,
    subject: nonempty(raw.subject),
    message: nonempty(raw.message),
    location: raw.location === null ? null : location(raw.location, task),
  };
}

function typeReference(value: unknown): TypeReference {
  const raw = object(value);
  if (raw.kind === "unit") return { kind: "unit" };
  if (raw.kind === "nominal") return { kind: "nominal", symbolId: nonempty(raw.symbolId) };
  throw new Error("invalid native type reference");
}

function resultContract(value: unknown): ResultContract {
  const raw = object(value);
  if (raw.standardResult === true)
    return {
      standardResult: true,
      successType: typeReference(raw.successType),
      errorType: typeReference(raw.errorType),
    };
  if (raw.standardResult === false) return { standardResult: false, resultType: typeReference(raw.resultType) };
  throw new Error("invalid native result contract");
}

function fact<T>(value: unknown, task: FrozenTask, parse: (value: unknown) => T): Fact<T> {
  const raw = object(value);
  if (raw.status === "unresolved")
    return { status: "unresolved", reasons: array(raw.reasons).map((entry) => issue(entry, task)) };
  const evidence = array(raw.evidence).map((entry) => location(entry, task));
  if (raw.status === "absent") return { status: "absent", evidence };
  if (raw.status === "resolved") return { status: "resolved", value: parse(raw.value), evidence };
  throw new Error("invalid native fact");
}

function completeness(value: unknown): "complete" | "partial" {
  if (value === "complete" || value === "partial") return value;
  throw new Error("invalid native completeness");
}

function errorCaseSet(value: unknown, task: FrozenTask): ErrorCaseSet {
  const raw = object(value);
  return {
    completeness: completeness(raw.completeness),
    items: array(raw.items).map((entry): ErrorCase => {
      const item = object(entry);
      return { name: nonempty(item.name), location: location(item.location, task) };
    }),
    reasons: array(raw.reasons).map((entry) => issue(entry, task)),
  };
}

function resolutionStep(value: unknown, task: FrozenTask): ResolutionStep {
  const raw = object(value);
  const kind = nonempty(raw.kind);
  if (!RESOLUTION_STEP_KINDS.includes(kind as ResolutionStepKind)) throw new Error("invalid native step kind");
  return {
    kind: kind as ResolutionStepKind,
    reference: nonempty(raw.reference),
    resolved: nonempty(raw.resolved),
    location: location(raw.location, task),
  };
}

function evidence(value: unknown, task: FrozenTask): ContractEvidence {
  const raw = object(value);
  if (raw.operation_status === "unresolved")
    return { operationStatus: "unresolved", reasons: array(raw.reasons).map((entry) => issue(entry, task)) };
  if (raw.operation_status !== "resolved") throw new Error("invalid native operation status");
  const operation = object(raw.operation);
  return {
    operationStatus: "resolved",
    operation: {
      symbolId: nonempty(operation.symbolId),
      packageId: nonempty(operation.packageId),
      declarationPath: array(operation.declarationPath).map(nonempty),
      operation: nonempty(operation.operation),
    },
    operationEvidence: array(raw.operation_evidence).map((entry) => location(entry, task)),
    resultContract: fact(raw.result_contract, task, resultContract),
    errorCases: fact(raw.error_cases, task, (cases) => errorCaseSet(cases, task)),
    resolutionPath: array(raw.resolution_path).map((entry) => resolutionStep(entry, task)),
  };
}

export function convertRustResponse(value: unknown, task: FrozenTask): ContractResponse | null | string {
  if (value === null) return null;
  try {
    const raw = object(value);
    const echoed = object(raw.target);
    const expected = task.request.target;
    if (
      raw.protocol_version !== PROTOCOL_VERSION ||
      raw.request_identity !== task.request.requestIdentity ||
      echoed.packageId !== expected.packageId ||
      echoed.targetName !== expected.targetName ||
      echoed.file !== expected.file ||
      echoed.operation !== expected.operation ||
      JSON.stringify(echoed.declarationPath) !== JSON.stringify(expected.declarationPath)
    )
      throw new Error("native identity mismatch");
    return {
      schemaVersion: SCHEMA_VERSION,
      requestIdentity: task.request.requestIdentity,
      evidence: evidence(raw.evidence, task),
    };
  } catch {
    return "invalid-native-response";
  }
}

export async function rustVersions(binary = RUST_BINARY): Promise<typeof RUST_TOOLCHAIN> {
  const observed = await observeProcess([binary, "--error-contract-version"], "", DEFAULT_LIMITS);
  if (observed.execution.status !== "completed") throw new Error("Rust binary unavailable; run prepare:error-contract");
  const raw = object(observed.execution.response);
  if (raw.protocol_version !== PROTOCOL_VERSION || raw.extractor !== "0.0.0" || raw.syn !== "3.0.5")
    throw new Error("Rust binary version mismatch; run prepare:error-contract");
  return RUST_TOOLCHAIN;
}

export async function extractRust(
  task: FrozenTask,
  limits: Limits = DEFAULT_LIMITS,
  command: readonly string[] = [RUST_BINARY],
): Promise<Observation> {
  // The claimed parser is checked before the frozen snapshot: a request that names
  // another extractor is never sent to this binary.
  if (
    task.request.language !== "rust" ||
    RUST_TOOLCHAIN.some(
      (tool) => !task.input.toolchain.some((claimed) => claimed.name === tool.name && claimed.version === tool.version),
    )
  )
    throw new Error("Rust toolchain identity mismatch");
  verifyTask(task);
  const observed = await observeProcess(
    command,
    JSON.stringify({
      protocol_version: PROTOCOL_VERSION,
      request_identity: task.request.requestIdentity,
      files: task.input.sources.map((source) => ({ path: source.path, source: source.content })),
      target: task.request.target,
      cargo_condition: task.request.cargoCondition,
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

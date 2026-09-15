import {
  array,
  ContractError,
  jsonCopy,
  nonempty,
  record,
  requireValue,
  withoutFields,
} from "../state-exposure/canonical.ts";
import type {
  ContractEvidence,
  ErrorCase,
  ErrorCaseSet,
  Fact,
  InspectionRequest,
  Issue,
  OperationIdentity,
  ResolutionStep,
  ResolutionStepKind,
  ResultContract,
  TypeReference,
} from "./contract.ts";
import { RESOLUTION_STEP_KINDS, SCHEMA_VERSION } from "./contract.ts";
import { evidenceLocations, issues, sourceLocation } from "./locations.ts";
import { isDigest } from "./request.ts";

type ValidatedExecution =
  | { readonly status: "completed"; readonly response: unknown }
  | { readonly status: "failed" | "unavailable"; readonly reasons: readonly Issue[] };

export function validateExecution(value: unknown, request: InspectionRequest): ValidatedExecution {
  const item = record(jsonCopy(value, "execution"), "execution");
  if (item.status === "completed") {
    requireValue(Object.hasOwn(item, "response"), "execution.response", "Completed execution requires a response key.");
    withoutFields(item, ["reasons"], "execution");
    return { status: "completed", response: item.response };
  }
  requireValue(
    item.status === "failed" || item.status === "unavailable",
    "execution.status",
    "Unknown execution status.",
  );
  withoutFields(item, ["response"], "execution");
  return { status: item.status, reasons: issues(item.reasons, request, "execution.reasons") };
}

function fact<T>(
  value: unknown,
  request: InspectionRequest,
  subject: string,
  parse: (value: unknown, subject: string) => T,
): Fact<T> {
  const item = record(value, subject);
  if (item.status === "unresolved") {
    withoutFields(item, ["value", "evidence"], subject);
    return { status: "unresolved", reasons: issues(item.reasons, request, `${subject}.reasons`) };
  }
  requireValue(item.status === "resolved" || item.status === "absent", `${subject}.status`, "Unknown fact status.");
  withoutFields(item, item.status === "absent" ? ["value", "reasons"] : ["reasons"], subject);
  const evidence = evidenceLocations(item.evidence, request, `${subject}.evidence`);
  if (item.status === "absent") return { status: "absent", evidence };
  return { status: "resolved", value: parse(item.value, `${subject}.value`), evidence };
}

function typeReference(value: unknown, subject: string): TypeReference {
  const item = record(value, subject);
  if (item.kind === "unit") {
    withoutFields(item, ["symbolId"], subject);
    return { kind: "unit" };
  }
  requireValue(item.kind === "nominal", `${subject}.kind`, "Unknown type reference kind.");
  return { kind: "nominal", symbolId: nonempty(item.symbolId, `${subject}.symbolId`) };
}

function resultContract(value: unknown, subject: string): ResultContract {
  const item = record(value, subject);
  requireValue(typeof item.standardResult === "boolean", `${subject}.standardResult`, "Expected a boolean.");
  if (item.standardResult) {
    withoutFields(item, ["resultType"], subject);
    return {
      standardResult: true,
      successType: typeReference(item.successType, `${subject}.successType`),
      errorType: typeReference(item.errorType, `${subject}.errorType`),
    };
  }
  withoutFields(item, ["successType", "errorType"], subject);
  return { standardResult: false, resultType: typeReference(item.resultType, `${subject}.resultType`) };
}

function errorCaseSet(value: unknown, request: InspectionRequest, subject: string): ErrorCaseSet {
  const item = record(value, subject);
  requireValue(
    item.completeness === "complete" || item.completeness === "partial",
    `${subject}.completeness`,
    "Unknown completeness.",
  );
  const reasons = issues(item.reasons, request, `${subject}.reasons`, item.completeness === "partial" ? 1 : 0);
  requireValue(
    item.completeness !== "complete" || reasons.length === 0,
    `${subject}.reasons`,
    "Complete lists cannot have enumeration issues.",
  );
  const found = new Set<string>();
  const items: ErrorCase[] = array(item.items, `${subject}.items`).map((entry, index) => {
    const field = `${subject}.items.${index}`;
    const record_ = record(entry, field);
    const name = nonempty(record_.name, `${field}.name`);
    requireValue(!found.has(name), `${field}.name`, "Duplicate error case name.");
    found.add(name);
    return { name, location: sourceLocation(record_.location, request, `${field}.location`) };
  });
  return { completeness: item.completeness, items, reasons };
}

function operationIdentity(value: unknown, request: InspectionRequest, subject: string): OperationIdentity {
  const item = record(value, subject);
  const declarationPath = array(item.declarationPath, `${subject}.declarationPath`, 1).map((name, index) =>
    nonempty(name, `${subject}.declarationPath.${index}`),
  );
  requireValue(
    item.packageId === request.target.packageId,
    `${subject}.packageId`,
    "Operation belongs to another package than the request target.",
  );
  requireValue(
    item.operation === request.target.operation,
    `${subject}.operation`,
    "Operation is not the requested operation.",
  );
  requireValue(
    declarationPath.length === request.target.declarationPath.length &&
      declarationPath.every((name, index) => name === request.target.declarationPath[index]),
    `${subject}.declarationPath`,
    "Operation owner is not the requested declaration.",
  );
  return {
    symbolId: nonempty(item.symbolId, `${subject}.symbolId`),
    packageId: request.target.packageId,
    declarationPath,
    operation: request.target.operation,
  };
}

function resolutionPath(
  value: unknown,
  request: InspectionRequest,
  subject: string,
  minimum: number,
): ResolutionStep[] {
  return array(value, subject, minimum).map((entry, index) => {
    const field = `${subject}.${index}`;
    const item = record(entry, field);
    requireValue(
      RESOLUTION_STEP_KINDS.includes(item.kind as ResolutionStepKind),
      `${field}.kind`,
      "Unknown resolution step kind.",
    );
    return {
      kind: item.kind as ResolutionStepKind,
      reference: nonempty(item.reference, `${field}.reference`),
      resolved: nonempty(item.resolved, `${field}.resolved`),
      location: sourceLocation(item.location, request, `${field}.location`),
    };
  });
}

function contractEvidence(value: unknown, request: InspectionRequest): ContractEvidence {
  const item = record(value, "response.evidence");
  if (item.operationStatus === "unresolved") {
    withoutFields(
      item,
      ["operation", "operationEvidence", "resultContract", "errorCases", "resolutionPath"],
      "response.evidence",
    );
    return { operationStatus: "unresolved", reasons: issues(item.reasons, request, "response.evidence.reasons") };
  }
  requireValue(item.operationStatus === "resolved", "response.evidence.operationStatus", "Unknown operation status.");
  withoutFields(item, ["reasons"], "response.evidence");
  const contract = fact(item.resultContract, request, "response.evidence.resultContract", resultContract);
  return {
    operationStatus: "resolved",
    operation: operationIdentity(item.operation, request, "response.evidence.operation"),
    operationEvidence: evidenceLocations(item.operationEvidence, request, "response.evidence.operationEvidence"),
    resultContract: contract,
    errorCases: fact(item.errorCases, request, "response.evidence.errorCases", (cases, subject) =>
      errorCaseSet(cases, request, subject),
    ),
    // A resolved result contract states how the reference was reached, so its path is never empty.
    resolutionPath: resolutionPath(
      item.resolutionPath,
      request,
      "response.evidence.resolutionPath",
      contract.status === "resolved" ? 1 : 0,
    ),
  };
}

export type ResponseValidation =
  | { readonly valid: true; readonly evidence: ContractEvidence }
  | { readonly valid: false; readonly issue: Issue };

/** Called only after the execution boundary has copied and validated JSON. */
export function validateResponse(value: unknown, request: InspectionRequest): ResponseValidation {
  try {
    const item = record(value, "response");
    const version = nonempty(item.schemaVersion, "response.schemaVersion");
    requireValue(isDigest(item.requestIdentity), "response.requestIdentity", "Invalid response identity.");
    requireValue(Object.hasOwn(item, "evidence"), "response.evidence", "Response requires evidence.");
    if (version !== SCHEMA_VERSION)
      return {
        valid: false,
        issue: {
          code: "unknown-version",
          subject: "response.schemaVersion",
          message: "Unsupported response schema version.",
          location: null,
        },
      };
    if (item.requestIdentity !== request.requestIdentity)
      return {
        valid: false,
        issue: {
          code: "identity-mismatch",
          subject: "response.requestIdentity",
          message: "Response identity does not match the request.",
          location: null,
        },
      };
    return { valid: true, evidence: contractEvidence(item.evidence, request) };
  } catch (error) {
    if (error instanceof ContractError)
      return {
        valid: false,
        issue: {
          code: "invalid-response",
          subject: "response",
          message: `${error.issue.subject}: ${error.issue.message}`,
          location: null,
        },
      };
    throw error;
  }
}

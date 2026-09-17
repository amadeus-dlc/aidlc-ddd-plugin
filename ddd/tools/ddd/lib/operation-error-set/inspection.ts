/**
 * Judges each operation of a prepared comparison from the error-contract answer to its own
 * observation. The error contract validates every answer and is the only source of unresolved
 * reasons; this module only reads the facts it established, in the order the inspection contract
 * design states: the result contract, then the error type, then the closed case set.
 */

import type {
  ContractEvidence,
  ContractResult,
  ErrorCase,
  ErrorCaseSet,
  Location,
} from "../error-contract/contract.ts";
import { resolveErrorContract } from "../error-contract/inspection.ts";
import {
  array,
  ContractError,
  jsonCopy,
  nonempty,
  record,
  requireValue,
  scalarCompare,
} from "../state-exposure/canonical.ts";
import type {
  ComparedOperation,
  ComparisonOutcome,
  ComparisonRequest,
  Finding,
  OperationResult,
  ResultContractDetail,
} from "./contract.ts";
import { RULE_ID, SCHEMA_VERSION } from "./contract.ts";
import { validateRequest } from "./request.ts";

type ResolvedEvidence = Extract<ContractEvidence, { readonly operationStatus: "resolved" }>;

function executionsOf(value: unknown, request: ComparisonRequest): Map<string, unknown> {
  const entries = array(jsonCopy(value, "executions"), "executions").map((entry, index) => {
    const item = record(entry, `executions.${index}`);
    return { operationRef: nonempty(item.operationRef, `executions.${index}.operationRef`), execution: item.execution };
  });
  const answered = entries.map((entry) => entry.operationRef);
  requireValue(new Set(answered).size === answered.length, "executions", "An operation is answered more than once.");
  for (const [index, operationRef] of answered.entries())
    requireValue(
      request.operations.some((operation) => operation.operationRef === operationRef),
      `executions.${index}.operationRef`,
      "The request names no such operation.",
    );
  for (const operation of request.operations)
    requireValue(answered.includes(operation.operationRef), "executions", `${operation.operationRef} is not answered.`);
  return new Map(entries.map((entry) => [entry.operationRef, entry.execution]));
}

function resultContract(
  operation: ComparedOperation,
  detail: ResultContractDetail,
  evidence: readonly Location[],
): Finding {
  return { code: "result-contract", operationRef: operation.operationRef, detail, evidence };
}

/**
 * A case the operation maps is its own even when another operation spells a case alike. A case only
 * other operations map is foreign to each of them, and a case no operation maps is unexpected. No
 * spelling is normalised: the mapping states the exact spelling of each language.
 */
function caseFindings(
  operation: ComparedOperation,
  operations: readonly ComparedOperation[],
  item: ErrorCase,
): Finding[] {
  if (operation.errors.some((error) => error.case === item.name)) return [];
  const foreign: Finding[] = operations
    .filter((other) => other.operationRef !== operation.operationRef)
    .flatMap((other) =>
      other.errors
        .filter((error) => error.case === item.name)
        .map((error) => ({
          code: "foreign-error" as const,
          operationRef: operation.operationRef,
          errorRef: error.errorRef,
          owner: other.operationRef,
          case: item.name,
          evidence: [item.location],
        })),
    );
  if (foreign.length) return foreign;
  return [
    { code: "unexpected-case", operationRef: operation.operationRef, case: item.name, evidence: [item.location] },
  ];
}

/** Only a complete list can show that a case is missing; a partial one keeps what it did establish. */
function setFindings(
  operation: ComparedOperation,
  operations: readonly ComparedOperation[],
  cases: ErrorCaseSet,
  evidence: readonly Location[],
): Finding[] {
  const observed = cases.items.flatMap((item) => caseFindings(operation, operations, item));
  if (cases.completeness !== "complete") return observed;
  const missing: Finding[] = operation.errors
    .filter((error) => !cases.items.some((item) => item.name === error.case))
    .map((error) => ({
      code: "missing-error",
      operationRef: operation.operationRef,
      errorRef: error.errorRef,
      case: error.case,
      evidence,
    }));
  return [...observed, ...missing];
}

/**
 * A fact the error contract left unresolved yields no finding: its reason already surfaces. A result
 * contract that is not the standard result with a named error type has no case set to compare, so it
 * is reported once rather than as a missing error per mapped case.
 */
function findingsOf(
  operation: ComparedOperation,
  operations: readonly ComparedOperation[],
  evidence: ResolvedEvidence,
): Finding[] {
  const contract = evidence.resultContract;
  if (contract.status === "absent") return [resultContract(operation, "absent", contract.evidence)];
  if (contract.status === "unresolved") return [];
  if (!contract.value.standardResult) return [resultContract(operation, "non-standard", contract.evidence)];
  if (contract.value.errorType.kind === "unit")
    return [resultContract(operation, "unnamed-error-type", contract.evidence)];
  const cases = evidence.errorCases;
  if (cases.status === "absent") return [resultContract(operation, "no-case-set", cases.evidence)];
  if (cases.status === "unresolved") return [];
  return setFindings(operation, operations, cases.value, cases.evidence);
}

function sortKey(finding: Finding): readonly string[] {
  switch (finding.code) {
    case "missing-error":
      return [finding.code, finding.case, finding.errorRef];
    case "unexpected-case":
      return [finding.code, finding.case];
    case "foreign-error":
      return [finding.code, finding.case, finding.errorRef, finding.owner];
    case "result-contract":
      return [finding.code, finding.detail];
  }
}

/** Findings follow their meaning, never the order the extractor listed the cases in. */
function compareFindings(a: Finding, b: Finding): number {
  const [left, right] = [sortKey(a), sortKey(b)];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const order = scalarCompare(left[i], right[i]);
    if (order) return order;
  }
  return left.length - right.length;
}

function judge(
  operation: ComparedOperation,
  operations: readonly ComparedOperation[],
  contract: ContractResult,
): OperationResult {
  const findings =
    contract.evidence?.operationStatus === "resolved" ? findingsOf(operation, operations, contract.evidence) : [];
  const reasons = contract.unresolvedReasons;
  return {
    operationRef: operation.operationRef,
    kind: operation.kind,
    observationIdentity: contract.requestIdentity,
    executionState: contract.executionState,
    // An established finding is kept when another fact of the same operation is unresolved.
    ruleResult: reasons.length ? "unresolved" : findings.length ? "violation" : "pass",
    checkedEvidence: contract.evidence,
    findings: findings.sort(compareFindings),
    unresolvedReasons: reasons,
  };
}

export function inspectOperationErrorSet(request: unknown, executions: unknown): ComparisonOutcome {
  try {
    const validated = validateRequest(request);
    const answers = executionsOf(executions, validated);
    const results: OperationResult[] = [];
    for (const operation of validated.operations) {
      const outcome = resolveErrorContract(operation.observation, answers.get(operation.operationRef));
      if (outcome.kind !== "evaluated")
        return {
          kind: "input-rejected",
          issues: outcome.issues.map((issue) => ({
            ...issue,
            subject: `executions[${operation.operationRef}].${issue.subject}`,
          })),
        };
      results.push(judge(operation, validated.operations, outcome.result));
    }
    return {
      kind: "evaluated",
      result: {
        schemaVersion: SCHEMA_VERSION,
        ruleId: RULE_ID,
        requestIdentity: validated.requestIdentity,
        language: validated.language,
        aggregateRef: validated.aggregateRef,
        operations: results,
      },
    };
  } catch (error) {
    if (error instanceof ContractError) return { kind: "input-rejected", issues: [error.issue] };
    throw error;
  }
}

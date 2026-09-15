import { ContractError } from "../state-exposure/canonical.ts";
import type { ContractEvidence, ContractOutcome, ContractResult, InspectionRequest, Issue } from "./contract.ts";
import { SCHEMA_VERSION } from "./contract.ts";
import { validateExecution, validateResponse } from "./evidence.ts";
import { compareIssues } from "./locations.ts";
import { validateRequest } from "./request.ts";

function result(
  request: InspectionRequest,
  executionState: ContractResult["executionState"],
  evidence: ContractEvidence | null,
  reasons: readonly Issue[],
): ContractOutcome {
  return {
    kind: "evaluated",
    result: {
      schemaVersion: SCHEMA_VERSION,
      requestIdentity: request.requestIdentity,
      target: request.target,
      executionState,
      evidence,
      unresolvedReasons: [...reasons].sort(compareIssues),
    },
  };
}

/** Every fact that could not be established surfaces its own machine-readable reason. */
function blocking(evidence: ContractEvidence): Issue[] {
  if (evidence.operationStatus === "unresolved") return [...evidence.reasons];
  const reasons: Issue[] = [];
  if (evidence.resultContract.status === "unresolved") reasons.push(...evidence.resultContract.reasons);
  if (evidence.errorCases.status === "unresolved") reasons.push(...evidence.errorCases.reasons);
  else if (evidence.errorCases.status === "resolved") reasons.push(...evidence.errorCases.value.reasons);
  return reasons;
}

export function resolveErrorContract(request: unknown, execution: unknown): ContractOutcome {
  try {
    const validatedRequest = validateRequest(request);
    const validatedExecution = validateExecution(execution, validatedRequest);
    if (validatedExecution.status !== "completed")
      return result(validatedRequest, validatedExecution.status, null, validatedExecution.reasons);
    const response = validateResponse(validatedExecution.response, validatedRequest);
    if (!response.valid) return result(validatedRequest, "completed", null, [response.issue]);
    return result(validatedRequest, "completed", response.evidence, blocking(response.evidence));
  } catch (error) {
    if (error instanceof ContractError) return { kind: "input-rejected", issues: [error.issue] };
    throw error;
  }
}

export type {
  ComparedOperation,
  ComparisonOutcome,
  ComparisonRequest,
  ComparisonResult,
  Finding,
  MappedError,
  OperationCode,
  OperationExecution,
  OperationKind,
  OperationObservation,
  OperationResult,
  RequestPreparation,
  ResultContractDetail,
  SchemaVersion,
} from "./contract.ts";
export { RULE_ID, SCHEMA_VERSION } from "./contract.ts";
export { inspectOperationErrorSet } from "./inspection.ts";
export { prepareOperationErrorSetRequest } from "./request.ts";

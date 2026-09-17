/**
 * The operation error-set comparison (`operation-error-set/1`): for every command and generation
 * method of one mapped aggregate, whether the case set its code declares is exactly the set of
 * business errors the canonical model gives that operation.
 *
 * Resolution stays with `error-contract/1`. This contract binds its observations to the model and
 * the mapping, and turns each observation into one judgement. Nothing here reads a source, a syntax
 * tree or a compiler object, and a symbol id is never taken apart.
 */

import type {
  ContractEvidence,
  Digest,
  InspectionRequest,
  Issue,
  Language,
  Location,
  RequestIdentity,
} from "../error-contract/contract.ts";
import type { SchemaVersion as ModelSchemaVersion } from "../schema/loader.ts";

export type SchemaVersion = "operation-error-set/1";
export type OperationKind = "command" | "factory";

/** Where the mapping places an operation, in the spelling of its language. */
export interface OperationCode {
  readonly package: string;
  /** The module path below the package root, one segment per entry. */
  readonly module: readonly string[];
  readonly type: string;
  readonly method: string;
  readonly errorType: string;
}

/** A business error the operation declares, and the case the mapping spells it as. */
export interface MappedError {
  readonly errorRef: string;
  readonly case: string;
}

export interface ComparedOperation {
  readonly operationRef: string;
  readonly kind: OperationKind;
  readonly code: OperationCode;
  /** Every error the model gives this operation, in model order. */
  readonly errors: readonly MappedError[];
  /** The error-contract request whose answer this operation is judged from. */
  readonly observation: InspectionRequest;
}

export interface ComparisonRequest {
  readonly schemaVersion: SchemaVersion;
  readonly ruleId: typeof RULE_ID;
  readonly requestIdentity: RequestIdentity;
  readonly language: Language;
  readonly aggregateRef: string;
  /** The canonical model the expected sets come from: its format and a digest of its whole content. */
  readonly model: { readonly schemaVersion: ModelSchemaVersion; readonly digest: Digest };
  /** Commands before generation methods, each group in model order. */
  readonly operations: readonly ComparedOperation[];
}

/** What a verification path observed for one mapped operation. */
export interface OperationObservation {
  readonly operationRef: string;
  readonly request: InspectionRequest;
}

/** What the extractor answered to the observation of one operation. */
export interface OperationExecution {
  readonly operationRef: string;
  readonly execution: unknown;
}

/**
 * Why a resolved result contract offers no closed case set to compare: the operation declares no
 * result, returns something other than the standard result, names no declaration as its error type,
 * or names one the extractor established to state no case set.
 */
export type ResultContractDetail = "absent" | "non-standard" | "unnamed-error-type" | "no-case-set";

/** Every finding is established; a fact that could not be established is an unresolved reason instead. */
export type Finding =
  | {
      readonly code: "missing-error";
      readonly operationRef: string;
      readonly errorRef: string;
      /** The case the mapping expected and the closed set lacks. */
      readonly case: string;
      readonly evidence: readonly Location[];
    }
  | {
      readonly code: "unexpected-case";
      readonly operationRef: string;
      /** The case as the code spells it; no operation of the mapping spells a case this way. */
      readonly case: string;
      readonly evidence: readonly Location[];
    }
  | {
      readonly code: "foreign-error";
      readonly operationRef: string;
      /** The business error another operation of the mapping spells this case as. */
      readonly errorRef: string;
      readonly owner: string;
      readonly case: string;
      readonly evidence: readonly Location[];
    }
  | {
      readonly code: "result-contract";
      readonly operationRef: string;
      readonly detail: ResultContractDetail;
      readonly evidence: readonly Location[];
    };

export interface OperationResult {
  readonly operationRef: string;
  readonly kind: OperationKind;
  readonly observationIdentity: RequestIdentity;
  readonly executionState: "completed" | "unavailable" | "failed";
  readonly ruleResult: "pass" | "violation" | "unresolved";
  readonly checkedEvidence: ContractEvidence | null;
  readonly findings: readonly Finding[];
  /** Exactly the reasons `error-contract/1` reports for this operation's observation. */
  readonly unresolvedReasons: readonly Issue[];
}

export interface ComparisonResult {
  readonly schemaVersion: SchemaVersion;
  readonly ruleId: typeof RULE_ID;
  readonly requestIdentity: RequestIdentity;
  readonly language: Language;
  readonly aggregateRef: string;
  /** One result per operation; the comparison states no verdict for the aggregate as a whole. */
  readonly operations: readonly OperationResult[];
}

export type RequestPreparation =
  | { readonly kind: "prepared"; readonly request: ComparisonRequest }
  | { readonly kind: "input-rejected"; readonly issues: readonly Issue[] };
export type ComparisonOutcome =
  | { readonly kind: "evaluated"; readonly result: ComparisonResult }
  | { readonly kind: "input-rejected"; readonly issues: readonly Issue[] };

export const SCHEMA_VERSION: SchemaVersion = "operation-error-set/1";
export const RULE_ID = "operation-error-set" as const;

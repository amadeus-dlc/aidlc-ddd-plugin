/**
 * The shared business-error contract: the vocabulary, the request that binds a
 * resolution to one analysis snapshot, and the records a language extractor
 * returns. This contract reports resolution and completeness only; comparing the
 * observed case set with a canonical error set belongs to a later contract.
 */

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type SchemaVersion = "error-contract/1";
export type Language = "rust";
export type Digest = string;
export type RequestIdentity = string;

export interface ToolVersion {
  readonly name: string;
  readonly version: string;
}
export interface SourceInput {
  readonly path: string;
  readonly content: string;
}
export interface SourceSnapshot {
  readonly path: string;
  readonly sha256: Digest;
  readonly byteLength: number;
  readonly lineStarts: readonly number[];
}

export interface CargoTarget {
  readonly kind: string;
  readonly name: string;
  readonly srcPath: string;
}
export interface DependencyRename {
  readonly alias: string;
  readonly packageId: string;
}
/** A package name is not an identity: two records may share a name and stay distinct. */
export interface CargoPackage {
  readonly packageId: string;
  readonly name: string;
  readonly edition: string;
  readonly targets: readonly CargoTarget[];
  readonly features: readonly string[];
  readonly dependencyRenames: readonly DependencyRename[];
}
export interface CargoCondition {
  readonly targetTriple: string;
  readonly packages: readonly CargoPackage[];
}

export interface OperationTarget {
  readonly packageId: string;
  readonly targetName: string;
  readonly file: string;
  readonly declarationPath: readonly string[];
  readonly operation: string;
}

export interface InspectionInput {
  readonly language: Language;
  readonly cargoCondition: CargoCondition;
  readonly target: OperationTarget;
  readonly sources: readonly SourceInput[];
  readonly settings: { readonly [key: string]: JsonValue };
  readonly toolchain: readonly ToolVersion[];
}
export interface InspectionRequest {
  readonly schemaVersion: SchemaVersion;
  readonly requestIdentity: RequestIdentity;
  readonly language: Language;
  readonly cargoCondition: CargoCondition;
  readonly target: OperationTarget;
  readonly sources: readonly SourceSnapshot[];
  readonly settings: { readonly [key: string]: JsonValue };
  readonly toolchain: readonly ToolVersion[];
}

export interface Location {
  readonly file: string;
  readonly line: number;
  readonly byteStart: number;
  readonly byteEnd: number;
}
export type ReasonCode =
  | "invalid-request"
  | "unknown-version"
  | "invalid-response"
  | "identity-mismatch"
  | "target-missing"
  | "target-ambiguous"
  | "syntax-error"
  | "unsupported-syntax"
  | "incomplete-evidence"
  | "tool-unavailable"
  | "execution-failed"
  | "timeout"
  | "output-limit"
  | "resource-limit"
  | "shadowed-result-identity"
  | "alias-cycle"
  | "ambiguous-candidate"
  | "missing-referent"
  | "incomplete-case-set"
  | "unsupported-type-argument"
  | "multiple-package-versions"
  | "trait-selection-required"
  | "associated-type-required"
  | "expression-inference-required"
  | "unknown-cfg"
  | "macro-generated";
export interface Issue {
  readonly code: ReasonCode;
  readonly message: string;
  readonly subject: string;
  readonly location: Location | null;
}
export type Fact<T> =
  | { readonly status: "resolved"; readonly value: T; readonly evidence: readonly Location[] }
  | { readonly status: "absent"; readonly evidence: readonly Location[] }
  | { readonly status: "unresolved"; readonly reasons: readonly Issue[] };

export type ResolutionStepKind =
  | "direct"
  | "qualified"
  | "use-rename"
  | "re-export"
  | "type-alias"
  | "dependency-rename"
  | "self-type";
export interface ResolutionStep {
  readonly kind: ResolutionStepKind;
  readonly reference: string;
  readonly resolved: string;
  readonly location: Location;
}

export type TypeReference = { readonly kind: "unit" } | { readonly kind: "nominal"; readonly symbolId: string };
/** `standardResult` discriminates: only the standard result carries a success and an error type. */
export type ResultContract =
  | { readonly standardResult: true; readonly successType: TypeReference; readonly errorType: TypeReference }
  | { readonly standardResult: false; readonly resultType: TypeReference };

export interface ErrorCase {
  readonly name: string;
  readonly location: Location;
}
/** A `partial` list is never an empty closed set, so it always carries its reasons. */
export interface ErrorCaseSet {
  readonly completeness: "complete" | "partial";
  readonly items: readonly ErrorCase[];
  readonly reasons: readonly Issue[];
}

export interface OperationIdentity {
  readonly symbolId: string;
  readonly packageId: string;
  readonly declarationPath: readonly string[];
  readonly operation: string;
}
export type ContractEvidence =
  | {
      readonly operationStatus: "resolved";
      readonly operation: OperationIdentity;
      readonly operationEvidence: readonly Location[];
      readonly resultContract: Fact<ResultContract>;
      readonly errorCases: Fact<ErrorCaseSet>;
      readonly resolutionPath: readonly ResolutionStep[];
    }
  | { readonly operationStatus: "unresolved"; readonly reasons: readonly Issue[] };
export interface ContractResponse {
  readonly schemaVersion: SchemaVersion;
  readonly requestIdentity: RequestIdentity;
  readonly evidence: ContractEvidence;
}

export interface ContractResult {
  readonly schemaVersion: SchemaVersion;
  readonly requestIdentity: RequestIdentity;
  readonly target: OperationTarget;
  readonly executionState: "completed" | "unavailable" | "failed";
  readonly evidence: ContractEvidence | null;
  readonly unresolvedReasons: readonly Issue[];
}
export type RequestPreparation =
  | { readonly kind: "prepared"; readonly request: InspectionRequest }
  | { readonly kind: "input-rejected"; readonly issues: readonly Issue[] };
export type ContractOutcome =
  | { readonly kind: "evaluated"; readonly result: ContractResult }
  | { readonly kind: "input-rejected"; readonly issues: readonly Issue[] };

export const SCHEMA_VERSION: SchemaVersion = "error-contract/1";
export const PROTOCOL_VERSION = 3 as const;
export const REASON_CODES: readonly ReasonCode[] = Object.freeze([
  "invalid-request",
  "unknown-version",
  "invalid-response",
  "identity-mismatch",
  "target-missing",
  "target-ambiguous",
  "syntax-error",
  "unsupported-syntax",
  "incomplete-evidence",
  "tool-unavailable",
  "execution-failed",
  "timeout",
  "output-limit",
  "resource-limit",
  "shadowed-result-identity",
  "alias-cycle",
  "ambiguous-candidate",
  "missing-referent",
  "incomplete-case-set",
  "unsupported-type-argument",
  "multiple-package-versions",
  "trait-selection-required",
  "associated-type-required",
  "expression-inference-required",
  "unknown-cfg",
  "macro-generated",
]);
export const RESOLUTION_STEP_KINDS: readonly ResolutionStepKind[] = Object.freeze([
  "direct",
  "qualified",
  "use-rename",
  "re-export",
  "type-alias",
  "dependency-rename",
  "self-type",
]);

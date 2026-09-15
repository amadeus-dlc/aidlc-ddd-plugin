/**
 * Schema-level fixture values for the shared business-error contract.
 *
 * The source below is a self-contained snapshot used to exercise request
 * preparation and response validation. It carries every spelling the schema
 * tests need a location for; it is not itself a resolution scenario. Resolution
 * across modules, packages and build conditions is exercised against the Cargo
 * workspace in `workspace/`.
 *
 * Response-side builders return plain records because the validators accept
 * `unknown`: a fixture that could only express well-typed values could not
 * express the malformed responses these tests require.
 */

import type {
  CargoCondition,
  CargoPackage,
  ErrorCase,
  InspectionInput,
  InspectionRequest,
  Issue,
  Location,
  OperationIdentity,
  ResolutionStep,
  ResolutionStepKind,
} from "../../../tools/ddd/lib/error-contract/contract.ts";
import { prepareErrorContractRequest } from "../../../tools/ddd/lib/error-contract/request.ts";
import { projectSettingsPayload } from "../../../tools/ddd/lib/project-settings/payload.ts";

export const DOMAIN_ID = "path+file:///fixture/billing-domain#0.1.0";
export const USE_CASE_ID = "path+file:///fixture/billing-use-case#0.1.0";
const ERROR_SYMBOL = "billing-domain::IssueInvoiceError";
const OPERATION_SYMBOL = "billing-domain::Invoice::issue";
export const SOURCE_PATH = "billing-domain/src/lib.rs";
export const SOURCE = [
  "pub enum IssueInvoiceError { AlreadyIssued, Empty, Rejected }",
  "pub struct Invoice;",
  "impl Invoice { pub fn issue(&mut self) -> Result<(), IssueInvoiceError> { Ok(()) } }",
  "",
].join("\n");
const RETURN_TYPE = SOURCE.indexOf("impl Invoice");

/** The fixture source is ASCII, so a character index is also its byte offset. */
function location(needle: string, from = 0): Location {
  const byteStart = SOURCE.indexOf(needle, from);
  if (byteStart < 0) throw new Error(`Fixture source does not contain ${needle}.`);
  return {
    file: SOURCE_PATH,
    line: SOURCE.slice(0, byteStart).split("\n").length,
    byteStart,
    byteEnd: byteStart + needle.length,
  };
}
/** The declaration carries the first spelling of the error name; the return type carries the second. */
export function errorTypeLocation(): Location {
  return location("IssueInvoiceError", RETURN_TYPE);
}
export function operationLocation(): Location {
  return location("issue", RETURN_TYPE);
}
export function lineStarts(): number[] {
  const starts = [0];
  for (let index = 0; index < SOURCE.length; index++) if (SOURCE[index] === "\n") starts.push(index + 1);
  return starts;
}

export function cargoPackage(overrides: Partial<CargoPackage> = {}): CargoPackage {
  return {
    packageId: DOMAIN_ID,
    name: "billing-domain",
    edition: "2021",
    targets: [{ kind: "lib", name: "billing_domain", srcPath: SOURCE_PATH }],
    features: [],
    dependencyRenames: [],
    ...overrides,
  };
}
export function condition(overrides: Partial<CargoCondition> = {}): CargoCondition {
  return { targetTriple: "aarch64-apple-darwin", packages: [cargoPackage()], ...overrides };
}
export function settings() {
  return projectSettingsPayload({ languages: ["rust"], rust: { moduleLayout: "file" }, typescript: null });
}
export function input(overrides: Partial<InspectionInput> = {}): InspectionInput {
  return {
    language: "rust",
    cargoCondition: condition(),
    target: {
      packageId: DOMAIN_ID,
      targetName: "billing_domain",
      file: SOURCE_PATH,
      declarationPath: ["Invoice"],
      operation: "issue",
    },
    sources: [{ path: SOURCE_PATH, content: SOURCE }],
    settings: settings(),
    toolchain: [{ name: "fixture", version: "1" }],
    ...overrides,
  };
}
export function request(overrides: Partial<InspectionInput> = {}): InspectionRequest {
  const prepared = prepareErrorContractRequest(input(overrides));
  if (prepared.kind !== "prepared") throw new Error(`Fixture preparation failed: ${JSON.stringify(prepared)}`);
  return prepared.request;
}

export function reason(code: Issue["code"] = "unsupported-syntax", subject = "Invoice::issue"): Issue {
  return { code, subject, message: "Cannot establish this fact.", location: null };
}
export function operation(): OperationIdentity {
  return { symbolId: OPERATION_SYMBOL, packageId: DOMAIN_ID, declarationPath: ["Invoice"], operation: "issue" };
}
export function resultContract(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "resolved",
    value: {
      standardResult: true,
      successType: { kind: "unit" },
      errorType: { kind: "nominal", symbolId: ERROR_SYMBOL },
    },
    evidence: [location("Result")],
    ...overrides,
  };
}
export function errorCase(name = "AlreadyIssued"): ErrorCase {
  return { name, location: location(name) };
}
export function step(kind: ResolutionStepKind = "direct"): ResolutionStep {
  return { kind, reference: "IssueInvoiceError", resolved: ERROR_SYMBOL, location: errorTypeLocation() };
}
/** The closed case set of the fixture's error enum under the condition that selects no feature. */
export function errorCases(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "resolved",
    value: { completeness: "complete", items: [errorCase("AlreadyIssued"), errorCase("Empty")], reasons: [] },
    evidence: [location("IssueInvoiceError")],
    ...overrides,
  };
}
export function caseSet(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    completeness: "complete",
    items: [errorCase("AlreadyIssued"), errorCase("Empty")],
    reasons: [],
    ...overrides,
  };
}
export function evidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    operationStatus: "resolved",
    operation: operation(),
    operationEvidence: [operationLocation()],
    resultContract: resultContract(),
    errorCases: errorCases(),
    resolutionPath: [step("direct")],
    ...overrides,
  };
}
export function response(evidenceValue: unknown = evidence(), identity?: string): Record<string, unknown> {
  return {
    schemaVersion: "error-contract/1",
    requestIdentity: identity ?? request().requestIdentity,
    evidence: evidenceValue,
  };
}

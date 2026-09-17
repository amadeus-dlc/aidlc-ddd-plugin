/**
 * The comparison request: the expected sets of one mapped aggregate, each bound to the one
 * error-contract observation it is judged from, under one identity.
 *
 * The identity covers the model digest, the mapping and every observation, and every observation's
 * own identity already covers its analysis snapshot. A changed mapping, model or snapshot therefore
 * yields a new request, and an execution answering an earlier observation is refused by the
 * error-contract identity check rather than judged again.
 */

import type { InspectionRequest, JsonValue, Language } from "../error-contract/contract.ts";
import { isDigest, validateRequest as validateObservation } from "../error-contract/request.ts";
import { OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import {
  array,
  ContractError,
  canonicalJson,
  digest,
  jsonCopy,
  nonempty,
  record,
  requireValue,
} from "../state-exposure/canonical.ts";
import type { ComparedOperation, ComparisonRequest, MappedError, RequestPreparation } from "./contract.ts";
import { RULE_ID, SCHEMA_VERSION } from "./contract.ts";
import { type Expectation, expectedOperations } from "./expected.ts";

function distinct(values: readonly string[], subject: string, message: string): void {
  requireValue(new Set(values).size === values.length, subject, message);
}

/** An observation is validated as its own contract, and a refusal names where it sits in this request. */
function observationAt(value: unknown, subject: string): InspectionRequest {
  try {
    return validateObservation(value);
  } catch (error) {
    if (error instanceof ContractError)
      throw new ContractError(`${subject}.${error.issue.subject}`, error.issue.message);
    throw error;
  }
}

function packageName(request: InspectionRequest): string | undefined {
  const packages = request.language === "rust" ? request.cargoCondition.packages : request.typeScriptCondition.packages;
  return packages.find((entry) => entry.packageId === request.target.packageId)?.name;
}

/** Everything an observation was analysed under apart from its target: one comparison reads one snapshot. */
function snapshotOf(request: InspectionRequest): string {
  const snapshot = {
    sources: request.sources,
    condition: request.language === "rust" ? request.cargoCondition : request.typeScriptCondition,
    settings: request.settings,
    toolchain: request.toolchain,
  };
  return canonicalJson(snapshot as unknown as JsonValue);
}

/**
 * The invariants a request holds however it was produced. An observation is compared with the
 * mapping only through what every language states alike — the language, the method, the last
 * declaration of its path and the name of its package — so module placement stays with each path.
 */
function checkOperations(language: Language, operations: readonly ComparedOperation[], subject: string): void {
  requireValue(operations.length > 0, subject, "The aggregate has no operation to compare.");
  distinct(
    operations.map((operation) => operation.operationRef),
    subject,
    "An operation is compared more than once.",
  );
  for (const [index, operation] of operations.entries()) {
    const field = `${subject}.${index}`;
    distinct(
      operation.errors.map((error) => error.errorRef),
      `${field}.errors`,
      "An error of this operation is mapped more than once.",
    );
    distinct(
      operation.errors.map((error) => error.case),
      `${field}.errors`,
      "Two errors of this operation are mapped to one case.",
    );
    const { observation, code } = operation;
    requireValue(observation.language === language, `${field}.observation.language`, "Observed in another language.");
    requireValue(
      observation.target.operation === code.method,
      `${field}.observation.target.operation`,
      "Observes another method than the mapped one.",
    );
    requireValue(
      observation.target.declarationPath.at(-1) === code.type,
      `${field}.observation.target.declarationPath`,
      "Observes another declaration than the mapped type.",
    );
    requireValue(
      packageName(observation) === code.package,
      `${field}.observation.target.packageId`,
      "Observes a package with another name than the mapped one.",
    );
  }
  requireValue(
    new Set(operations.map((operation) => snapshotOf(operation.observation))).size <= 1,
    subject,
    "The observations belong to more than one analysis snapshot.",
  );
}

type RequestFields = Omit<ComparisonRequest, "requestIdentity">;

/**
 * The one place a request states its fields, so the identity a preparation issues and the identity
 * a validation recomputes can never be taken over different sets.
 */
function requestFields(
  expectation: Omit<Expectation, "operations">,
  operations: readonly ComparedOperation[],
): RequestFields {
  return {
    schemaVersion: SCHEMA_VERSION,
    ruleId: RULE_ID,
    language: expectation.language,
    aggregateRef: expectation.aggregateRef,
    model: expectation.model,
    operations,
  };
}

function identify(fields: RequestFields): ComparisonRequest {
  return { ...fields, requestIdentity: digest(canonicalJson(fields as unknown as JsonValue)) };
}

function observationsOf(value: unknown, expected: Expectation): Map<string, InspectionRequest> {
  const entries = array(value, "input.observations").map((entry, index) => {
    const field = `input.observations.${index}`;
    const item = record(entry, field);
    return {
      operationRef: nonempty(item.operationRef, `${field}.operationRef`),
      request: observationAt(item.request, `${field}.request`),
    };
  });
  distinct(
    entries.map((entry) => entry.operationRef),
    "input.observations",
    "An operation is observed more than once.",
  );
  for (const [index, entry] of entries.entries())
    requireValue(
      expected.operations.some((operation) => operation.operationRef === entry.operationRef),
      `input.observations.${index}.operationRef`,
      "The mapping names no such operation.",
    );
  return new Map(entries.map((entry) => [entry.operationRef, entry.request]));
}

export function prepareOperationErrorSetRequest(input: unknown): RequestPreparation {
  try {
    const item = record(jsonCopy(input, "input"), "input");
    const expected = expectedOperations(item.model, item.mapping);
    const observed = observationsOf(item.observations, expected);
    const operations = expected.operations.map((operation) => {
      const observation = observed.get(operation.operationRef);
      requireValue(observation, "input.observations", `${operation.operationRef} is not observed.`);
      return { ...operation, observation };
    });
    checkOperations(expected.language, operations, "input.operations");
    return { kind: "prepared", request: identify(requestFields(expected, operations)) };
  } catch (error) {
    if (error instanceof ContractError) return { kind: "input-rejected", issues: [error.issue] };
    throw error;
  }
}

function mappedErrors(value: unknown, subject: string): MappedError[] {
  return array(value, subject).map((entry, index) => {
    const item = record(entry, `${subject}.${index}`);
    return {
      errorRef: nonempty(item.errorRef, `${subject}.${index}.errorRef`),
      case: nonempty(item.case, `${subject}.${index}.case`),
    };
  });
}

function comparedOperation(value: unknown, subject: string): ComparedOperation {
  const item = record(value, subject);
  requireValue(item.kind === "command" || item.kind === "factory", `${subject}.kind`, "Unknown operation kind.");
  const code = record(item.code, `${subject}.code`);
  return {
    operationRef: nonempty(item.operationRef, `${subject}.operationRef`),
    kind: item.kind,
    code: {
      package: nonempty(code.package, `${subject}.code.package`),
      module: array(code.module, `${subject}.code.module`).map((segment, index) =>
        nonempty(segment, `${subject}.code.module.${index}`),
      ),
      type: nonempty(code.type, `${subject}.code.type`),
      method: nonempty(code.method, `${subject}.code.method`),
      errorType: nonempty(code.errorType, `${subject}.code.errorType`),
    },
    errors: mappedErrors(item.errors, `${subject}.errors`),
    observation: observationAt(item.observation, `${subject}.observation`),
  };
}

/** Re-reads a prepared request and recomputes its identity, so a request edited after preparation is refused. */
export function validateRequest(value: unknown): ComparisonRequest {
  const item = record(jsonCopy(value, "request"), "request");
  requireValue(item.schemaVersion === SCHEMA_VERSION, "request.schemaVersion", "Unknown request version.");
  requireValue(item.ruleId === RULE_ID, "request.ruleId", "Unknown rule.");
  requireValue(isDigest(item.requestIdentity), "request.requestIdentity", "Invalid request identity.");
  requireValue(item.language === "rust" || item.language === "typescript", "request.language", "Unknown language.");
  const model = record(item.model, "request.model");
  requireValue(
    model.schemaVersion === OPERATION_OWNED_SCHEMA_VERSION,
    "request.model.schemaVersion",
    "Unknown canonical model version.",
  );
  requireValue(isDigest(model.digest), "request.model.digest", "Invalid model digest.");
  const operations = array(item.operations, "request.operations").map((entry, index) =>
    comparedOperation(entry, `request.operations.${index}`),
  );
  checkOperations(item.language, operations, "request.operations");
  const expected = identify(
    requestFields(
      {
        language: item.language,
        aggregateRef: nonempty(item.aggregateRef, "request.aggregateRef"),
        model: { schemaVersion: OPERATION_OWNED_SCHEMA_VERSION, digest: model.digest },
      },
      operations,
    ),
  );
  requireValue(
    expected.requestIdentity === item.requestIdentity,
    "request.requestIdentity",
    "Request identity does not match its contents.",
  );
  return expected;
}

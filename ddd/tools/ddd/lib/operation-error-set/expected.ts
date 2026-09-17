/**
 * What the canonical model and one aggregate mapping require of each operation: its kind, where the
 * mapping places it, and every business error it declares with the case the mapping spells it as.
 *
 * Both inputs arrive already copied at the JSON boundary, and only the parts the comparison uses are
 * read. Input that does not state the requirement unambiguously is refused here, before any
 * observation is looked at.
 */

import type { JsonValue, Language } from "../error-contract/contract.ts";
import { OPERATION_OWNED_SCHEMA_VERSION } from "../schema/loader.ts";
import { array, canonicalJson, digest, nonempty, record, requireValue } from "../state-exposure/canonical.ts";
import type { ComparedOperation, ComparisonRequest, OperationKind } from "./contract.ts";

export interface Expectation {
  readonly language: Language;
  readonly aggregateRef: string;
  readonly model: ComparisonRequest["model"];
  readonly operations: readonly Omit<ComparedOperation, "observation">[];
}

interface DeclaredOperation {
  readonly operationRef: string;
  readonly kind: OperationKind;
  readonly errors: readonly string[];
}

function declaredIn(value: unknown, subject: string, kind: OperationKind): DeclaredOperation[] {
  return array(value, subject).map((entry, index) => {
    const field = `${subject}.${index}`;
    const operation = record(entry, field);
    const operationRef = nonempty(operation.element_id, `${field}.element_id`);
    const errors = array(operation.domain_errors, `${field}.domain_errors`).map((error, position) => {
      const errorField = `${field}.domain_errors.${position}`;
      const declared = record(error, errorField);
      // The containing operation is the owner. A declared owner naming another operation is refused
      // rather than believed, because either reading would change which operation the error is foreign to.
      requireValue(
        declared.operation === operationRef,
        `${errorField}.operation`,
        "The error names another operation than the one containing it.",
      );
      return nonempty(declared.element_id, `${errorField}.element_id`);
    });
    return { operationRef, kind, errors };
  });
}

/** The operations of the one aggregate `aggregateRef` names: its commands, then its factory rules. */
function declaredOperations(model: Record<string, unknown>, aggregateRef: string): DeclaredOperation[] {
  requireValue(
    model.schema_version === OPERATION_OWNED_SCHEMA_VERSION,
    "input.model.schema_version",
    `Expected a schema_version ${OPERATION_OWNED_SCHEMA_VERSION} canonical model, where every operation owns its errors.`,
  );
  const found = array(model.bounded_contexts, "input.model.bounded_contexts").flatMap((entry, index) => {
    const aggregates = `input.model.bounded_contexts.${index}.aggregates`;
    return array(record(entry, `input.model.bounded_contexts.${index}`).aggregates, aggregates)
      .map((aggregate, position) => {
        const subject = `${aggregates}.${position}`;
        return { aggregate: record(aggregate, subject), subject };
      })
      .filter(({ aggregate }) => aggregate.element_id === aggregateRef);
  });
  requireValue(
    found.length === 1,
    "input.mapping.aggregate_ref",
    "The model does not state this aggregate exactly once.",
  );
  const [{ aggregate, subject }] = found;
  const operations = [
    ...declaredIn(aggregate.commands, `${subject}.commands`, "command"),
    ...declaredIn(aggregate.factory_rules, `${subject}.factory_rules`, "factory"),
  ];
  const operationRefs = operations.map((operation) => operation.operationRef);
  requireValue(new Set(operationRefs).size === operationRefs.length, subject, "An operation is stated more than once.");
  const errorRefs = operations.flatMap((operation) => operation.errors);
  requireValue(new Set(errorRefs).size === errorRefs.length, subject, "A business error is stated more than once.");
  return operations;
}

interface MappedEntry {
  readonly subject: string;
  readonly operationRef: string;
  readonly method: string;
  readonly errorType: string;
  readonly errors: readonly { readonly subject: string; readonly errorRef: string; readonly case: string }[];
}

function mappedEntry(value: unknown, subject: string): MappedEntry {
  const entry = record(value, subject);
  const code = record(entry.code, `${subject}.code`);
  return {
    subject,
    operationRef: nonempty(entry.operation_ref, `${subject}.operation_ref`),
    method: nonempty(code.method, `${subject}.code.method`),
    errorType: nonempty(code.error_type, `${subject}.code.error_type`),
    errors: array(entry.errors, `${subject}.errors`).map((error, index) => {
      const field = `${subject}.errors.${index}`;
      const mapped = record(error, field);
      return {
        subject: field,
        errorRef: nonempty(mapped.error_ref, `${field}.error_ref`),
        case: nonempty(record(mapped.code, `${field}.code`).case, `${field}.code.case`),
      };
    }),
  };
}

function language(value: unknown, subject: string): Language {
  requireValue(value === "rust" || value === "typescript", subject, "Unknown language.");
  return value;
}

export function expectedOperations(model: unknown, mapping: unknown): Expectation {
  const modelItem = record(model, "input.model");
  const mappingItem = record(mapping, "input.mapping");
  const aggregateRef = nonempty(mappingItem.aggregate_ref, "input.mapping.aggregate_ref");
  const declared = declaredOperations(modelItem, aggregateRef);
  const code = record(mappingItem.code, "input.mapping.code");
  const location = {
    package: nonempty(code.package, "input.mapping.code.package"),
    module: array(code.module, "input.mapping.code.module").map((segment, index) =>
      nonempty(segment, `input.mapping.code.module.${index}`),
    ),
    type: nonempty(code.type, "input.mapping.code.type"),
  };
  const entries = array(mappingItem.operations, "input.mapping.operations").map((entry, index) =>
    mappedEntry(entry, `input.mapping.operations.${index}`),
  );
  for (const entry of entries)
    requireValue(
      declared.some((operation) => operation.operationRef === entry.operationRef),
      `${entry.subject}.operation_ref`,
      "The mapped aggregate states no such operation.",
    );

  const operations = declared.map((operation) => {
    const matches = entries.filter((entry) => entry.operationRef === operation.operationRef);
    requireValue(
      matches.length === 1,
      "input.mapping.operations",
      `${operation.operationRef} is ${matches.length ? "mapped more than once" : "not mapped"}.`,
    );
    const [entry] = matches;
    for (const error of entry.errors)
      requireValue(
        operation.errors.includes(error.errorRef),
        `${error.subject}.error_ref`,
        `${operation.operationRef} does not declare this error itself.`,
      );
    return {
      operationRef: operation.operationRef,
      kind: operation.kind,
      code: { ...location, method: entry.method, errorType: entry.errorType },
      errors: operation.errors.map((errorRef) => {
        const spelled = entry.errors.filter((error) => error.errorRef === errorRef);
        requireValue(
          spelled.length === 1,
          `${entry.subject}.errors`,
          `${errorRef} is ${spelled.length ? "mapped more than once" : "not mapped"}.`,
        );
        return { errorRef, case: spelled[0].case };
      }),
    };
  });

  return {
    language: language(code.language, "input.mapping.code.language"),
    aggregateRef,
    model: {
      schemaVersion: OPERATION_OWNED_SCHEMA_VERSION,
      digest: digest(canonicalJson(modelItem as { readonly [key: string]: JsonValue })),
    },
    operations,
  };
}

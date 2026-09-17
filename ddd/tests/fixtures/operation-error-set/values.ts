/**
 * Hand-written values for the operation error-set suites.
 *
 * One aggregate with one command and one generation method, each declaring two
 * business errors; a mapping of both operations in either language; and
 * error-contract requests over a self-contained snapshot. The snapshot text is
 * only something locations can point at. It is not a resolution scenario: the
 * Rust and TypeScript projects beside this file are.
 *
 * Every builder returns fresh data, so a test that edits a value never edits
 * what another test reads. Execution builders return plain records because the
 * comparator accepts `unknown`, and several tests need values no well-typed
 * builder could express.
 */

import type { AggregateMapping, OperationMapping } from "../../../tools/ddd/lib/aggregate-mapping/contract.ts";
import type {
  InspectionInput,
  InspectionRequest,
  Issue,
  Location,
  ReasonCode,
} from "../../../tools/ddd/lib/error-contract/contract.ts";
import { prepareErrorContractRequest } from "../../../tools/ddd/lib/error-contract/request.ts";
import { projectSettingsPayload } from "../../../tools/ddd/lib/project-settings/payload.ts";
import type { Command, DomainError, DomainModel, FactoryRule } from "../../../tools/ddd/lib/schema/model.ts";

export const AGGREGATE = "aggregate.invoice";
export const ISSUE = "command.invoice.issue";
export const OPEN = "factory.invoice.open";
export const ALREADY_ISSUED = "error.invoice.issue.already-issued";
export const EMPTY_LINES = "error.invoice.issue.empty-lines";
export const NEGATIVE_AMOUNT = "error.invoice.open.negative-amount";
export const MISSING_CUSTOMER = "error.invoice.open.missing-customer";
/** An error the model gains when a test changes the model; the base model does not state it. */
export const LOCKED = "error.invoice.issue.locked";

type Language = "rust" | "typescript";

/** The case each business error is written as. Only this spelling differs between the languages. */
export type Spelling = Readonly<Record<string, string>>;
export const PASCAL_CASES: Spelling = {
  [ALREADY_ISSUED]: "AlreadyIssued",
  [EMPTY_LINES]: "EmptyLines",
  [NEGATIVE_AMOUNT]: "NegativeAmount",
  [MISSING_CUSTOMER]: "MissingCustomer",
};
export const KEBAB_CASES: Spelling = {
  [ALREADY_ISSUED]: "already-issued",
  [EMPTY_LINES]: "empty-lines",
  [NEGATIVE_AMOUNT]: "negative-amount",
  [MISSING_CUSTOMER]: "missing-customer",
};

/** Replace one exact piece of text, failing loudly when the text no longer contains it. */
export function edit(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`text does not contain ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

// ---------------------------------------------------------------------------
// Canonical model
// ---------------------------------------------------------------------------

function domainError(element_id: string, name: string, operation: string): DomainError {
  return { element_id, name, operation, condition: `${name} に当たる。` };
}

export function model(): DomainModel {
  return {
    schema_version: 2,
    bounded_contexts: [
      {
        element_id: "bc.billing",
        name: "Billing",
        aggregates: [
          {
            element_id: AGGREGATE,
            name: "Invoice",
            bounded_context: "bc.billing",
            root_element: "entity.invoice",
            states: [],
            elements: [
              {
                element_id: "entity.invoice",
                kind: "entity",
                name: "Invoice",
                aggregate: AGGREGATE,
                attributes: [],
                invariants: [],
              },
            ],
            invariants: [],
            commands: [
              {
                element_id: ISSUE,
                name: "Issue",
                aggregate: AGGREGATE,
                effect: "transition",
                state_effect: "none",
                transitions: [],
                domain_errors: [
                  domainError(ALREADY_ISSUED, "AlreadyIssued", ISSUE),
                  domainError(EMPTY_LINES, "EmptyLines", ISSUE),
                ],
                events: [],
                idempotency: { strategy: "none" },
              },
            ],
            events: [],
            transitions: [],
            factory_rules: [
              {
                element_id: OPEN,
                name: "Open",
                target_element: "entity.invoice",
                preconditions: [],
                domain_errors: [
                  domainError(NEGATIVE_AMOUNT, "NegativeAmount", OPEN),
                  domainError(MISSING_CUSTOMER, "MissingCustomer", OPEN),
                ],
              },
            ],
            process_managers: [],
          },
        ],
        process_managers: [],
      },
    ],
    lineage: [],
  };
}

/** Every command and factory rule of a model, wherever it sits. */
function operationsOf(value: DomainModel): (Command | FactoryRule)[] {
  return value.bounded_contexts
    .flatMap((context) => context.aggregates)
    .flatMap((aggregate) => [...aggregate.commands, ...aggregate.factory_rules]);
}

/** A copy of `value` whose operation declares one more error of its own. */
export function withModelError(value: DomainModel, operationRef: string, errorRef: string): DomainModel {
  const copy = structuredClone(value);
  const operation = operationsOf(copy).find((entry) => entry.element_id === operationRef);
  if (!operation) throw new Error(`the model states no operation ${operationRef}`);
  operation.domain_errors.push(domainError(errorRef, "Added", operationRef));
  return copy;
}

/** A copy of `value` in which the declared error `errorRef` is edited in place. */
function withDeclaredError(value: DomainModel, errorRef: string, change: (entry: DomainError) => void): DomainModel {
  const copy = structuredClone(value);
  const entry = operationsOf(copy)
    .flatMap((operation) => operation.domain_errors)
    .find((candidate) => candidate.element_id === errorRef);
  if (!entry) throw new Error(`the model declares no error ${errorRef}`);
  change(entry);
  return copy;
}

/** A copy of `value` in which one declared error names `owner` while staying where it is. */
export function withErrorOwner(value: DomainModel, errorRef: string, owner: string): DomainModel {
  return withDeclaredError(value, errorRef, (entry) => {
    entry.operation = owner;
  });
}

/** A copy of `value` in which one declared error states another condition. */
export function withErrorCondition(value: DomainModel, errorRef: string, condition: string): DomainModel {
  return withDeclaredError(value, errorRef, (entry) => {
    entry.condition = condition;
  });
}

// ---------------------------------------------------------------------------
// Implementation mapping
// ---------------------------------------------------------------------------

function mapping(language: Language, spelling: Spelling): AggregateMapping {
  const errors = (refs: readonly string[]) => refs.map((ref) => ({ error_ref: ref, code: { case: spelling[ref] } }));
  return {
    aggregate_ref: AGGREGATE,
    programming_model: "class",
    persistence_method: "state-sourcing",
    reference_ids: ["entity.invoice"],
    replay_methods: [],
    code: { language, package: "billing-domain", module: ["invoice"], type: "Invoice", ports: [] },
    operations: [
      {
        operation_ref: ISSUE,
        code: { method: "issue", error_type: "IssueInvoiceError" },
        errors: errors([ALREADY_ISSUED, EMPTY_LINES]),
      },
      {
        operation_ref: OPEN,
        code: { method: "open", error_type: "OpenInvoiceError" },
        errors: errors([NEGATIVE_AMOUNT, MISSING_CUSTOMER]),
      },
    ],
  };
}

function withOperation(
  value: AggregateMapping,
  operationRef: string,
  change: (operation: OperationMapping) => OperationMapping,
): AggregateMapping {
  if (!value.operations.some((operation) => operation.operation_ref === operationRef))
    throw new Error(`the mapping names no operation ${operationRef}`);
  return {
    ...value,
    operations: value.operations.map((operation) =>
      operation.operation_ref === operationRef ? change(operation) : operation,
    ),
  };
}

export function withMethod(value: AggregateMapping, operationRef: string, method: string): AggregateMapping {
  return withOperation(value, operationRef, (operation) => ({ ...operation, code: { ...operation.code, method } }));
}

export function withErrorType(value: AggregateMapping, operationRef: string, errorType: string): AggregateMapping {
  return withOperation(value, operationRef, (operation) => ({
    ...operation,
    code: { ...operation.code, error_type: errorType },
  }));
}

export function withMappedErrors(
  value: AggregateMapping,
  operationRef: string,
  errors: readonly (readonly [errorRef: string, spelling: string])[],
): AggregateMapping {
  return withOperation(value, operationRef, (operation) => ({
    ...operation,
    errors: errors.map(([errorRef, spelling]) => ({ error_ref: errorRef, code: { case: spelling } })),
  }));
}

export function withCase(value: AggregateMapping, errorRef: string, spelling: string): AggregateMapping {
  if (!value.operations.some((operation) => operation.errors.some((entry) => entry.error_ref === errorRef)))
    throw new Error(`the mapping maps no error ${errorRef}`);
  return {
    ...value,
    operations: value.operations.map((operation) => ({
      ...operation,
      errors: operation.errors.map((entry) =>
        entry.error_ref === errorRef ? { ...entry, code: { case: spelling } } : entry,
      ),
    })),
  };
}

export function atModule(value: AggregateMapping, module: string): AggregateMapping {
  return { ...value, code: { ...value.code, module: [module] } };
}

// ---------------------------------------------------------------------------
// Observations: error-contract requests over a self-contained snapshot
// ---------------------------------------------------------------------------

/**
 * Every spelling a hand-written response points a location at. The text is ASCII,
 * so a character index is also its byte offset.
 */
const SOURCE = [
  "pub enum IssueInvoiceError { AlreadyIssued, EmptyLines, Locked, Invalid }",
  "pub enum OpenInvoiceError { NegativeAmount, MissingCustomer, Expired }",
  "pub struct Invoice;",
  "impl Invoice {",
  "    pub fn issue(&mut self) -> Result<(), IssueInvoiceError> { Ok(()) }",
  "    pub fn open() -> Result<Self, OpenInvoiceError> { Ok(Invoice) }",
  "}",
  "// negative_amount negativeAmount NEGATIVE_AMOUNT",
  '// "already-issued" "empty-lines" "negative-amount" "missing-customer"',
  '// "Negative-Amount" "negative-amount "',
  "",
].join("\n");

/** The same snapshot with one more line; every location into `SOURCE` stays valid in it. */
export const CHANGED_SOURCE = `${SOURCE}// changed\n`;

const SOURCE_FILES: Readonly<Record<Language, string>> = {
  rust: "billing-domain/src/invoice.rs",
  typescript: "billing-domain/src/invoice.ts",
};
const RUST_PACKAGE_ID = "path+file:///fixture/billing-domain#0.1.0";
const TYPESCRIPT_PACKAGE_ID = "path:billing-domain#billing-domain@0.1.0";

/** What an observation may differ in; every field left out keeps the base value. */
interface ObservationOptions {
  readonly type?: string;
  /** The Rust module path the declaration is observed in; TypeScript names its module by the file. */
  readonly module?: readonly string[];
  readonly packageName?: string;
  readonly content?: string;
  readonly otherCondition?: boolean;
  readonly otherSettings?: boolean;
  readonly toolVersion?: string;
}

function rustInput(method: string, options: ObservationOptions): InspectionInput {
  const file = SOURCE_FILES.rust;
  return {
    language: "rust",
    cargoCondition: {
      targetTriple: options.otherCondition ? "x86_64-unknown-linux-gnu" : "aarch64-apple-darwin",
      packages: [
        {
          packageId: RUST_PACKAGE_ID,
          name: options.packageName ?? "billing-domain",
          edition: "2021",
          targets: [{ kind: "lib", name: "billing_domain", srcPath: "billing-domain/src/lib.rs" }],
          features: [],
          dependencyRenames: [],
        },
      ],
    },
    target: {
      packageId: RUST_PACKAGE_ID,
      targetName: "billing_domain",
      file,
      declarationPath: [...(options.module ?? ["invoice"]), options.type ?? "Invoice"],
      operation: method,
    },
    sources: [{ path: file, content: options.content ?? SOURCE }],
    settings: projectSettingsPayload({
      languages: ["rust"],
      rust: { moduleLayout: options.otherSettings ? "mod-rs" : "file" },
      typescript: null,
    }),
    toolchain: [{ name: "fixture", version: options.toolVersion ?? "1" }],
  };
}

function typeScriptInput(method: string, options: ObservationOptions): InspectionInput {
  const file = SOURCE_FILES.typescript;
  return {
    language: "typescript",
    typeScriptCondition: {
      compilerApiVersion: "6.0.3",
      module: "esnext",
      moduleResolution: "bundler",
      target: "esnext",
      resolutionConditions: options.otherCondition ? ["development"] : [],
      strict: true,
      packages: [
        {
          packageId: TYPESCRIPT_PACKAGE_ID,
          name: options.packageName ?? "billing-domain",
          version: "0.1.0",
          packageRoot: "billing-domain",
          tsconfigPath: "billing-domain/tsconfig.json",
          entryPoints: [],
          projectReferences: [],
          dependencies: [],
        },
      ],
      resultDefinition: { packageId: TYPESCRIPT_PACKAGE_ID, modulePath: file, typeName: "Result" },
    },
    target: {
      packageId: TYPESCRIPT_PACKAGE_ID,
      targetName: "billing-domain/tsconfig.json",
      file,
      declarationPath: [options.type ?? "Invoice"],
      operation: method,
    },
    sources: [{ path: file, content: options.content ?? SOURCE }],
    settings: projectSettingsPayload({
      languages: ["typescript"],
      rust: null,
      typescript: {
        moduleLayout: options.otherSettings ? "index-file" : "named-file",
        codeRepresentation: "class",
      },
    }),
    toolchain: [{ name: "fixture", version: options.toolVersion ?? "1" }],
  };
}

export function observationRequest(
  language: Language,
  method: string,
  options: ObservationOptions = {},
): InspectionRequest {
  const prepared = prepareErrorContractRequest(
    language === "rust" ? rustInput(method, options) : typeScriptInput(method, options),
  );
  if (prepared.kind !== "prepared") throw new Error(`fixture observation rejected: ${JSON.stringify(prepared)}`);
  return prepared.request;
}

interface Observation {
  readonly operationRef: string;
  readonly request: InspectionRequest;
}

/** The input the comparator prepares a request from. */
export interface World {
  readonly model: DomainModel;
  readonly mapping: AggregateMapping;
  readonly observations: readonly Observation[];
}

export function world(language: Language, spelling: Spelling = PASCAL_CASES): World {
  return {
    model: model(),
    mapping: mapping(language, spelling),
    observations: [
      { operationRef: ISSUE, request: observationRequest(language, "issue") },
      { operationRef: OPEN, request: observationRequest(language, "open") },
    ],
  };
}

export function observationOf(value: World, operationRef: string): InspectionRequest {
  const found = value.observations.find((entry) => entry.operationRef === operationRef);
  if (!found) throw new Error(`the world observes no operation ${operationRef}`);
  return found.request;
}

export function withObservation(value: World, operationRef: string, request: InspectionRequest): World {
  observationOf(value, operationRef);
  return {
    ...value,
    observations: value.observations.map((entry) => (entry.operationRef === operationRef ? { ...entry, request } : entry)),
  };
}

// ---------------------------------------------------------------------------
// Executions: what an extractor answered for one observation
// ---------------------------------------------------------------------------

const SYMBOL = "fixture::billing-domain";

function span(request: InspectionRequest, needle: string): Location {
  const byteStart = SOURCE.indexOf(needle);
  if (byteStart < 0) throw new Error(`the fixture source does not contain ${needle}`);
  return {
    file: request.target.file,
    line: SOURCE.slice(0, byteStart).split("\n").length,
    byteStart,
    byteEnd: byteStart + needle.length,
  };
}

function reason(code: ReasonCode): Issue {
  return { code, subject: "Invoice", message: "This fact cannot be established.", location: null };
}

/**
 * Where the source spells the observed operation: its signature, its result type and its error
 * type. The source declares only `issue` and `open`; any other method an observation names stands
 * in for `issue` and is located there.
 */
function spellingOf(request: InspectionRequest) {
  return request.target.operation === "open"
    ? { operation: "pub fn open()", result: "Result<Self, OpenInvoiceError>", errorType: "OpenInvoiceError" }
    : {
        operation: "pub fn issue(&mut self)",
        result: "Result<(), IssueInvoiceError>",
        errorType: "IssueInvoiceError",
      };
}

export function standardResult(request: InspectionRequest, errorType: "nominal" | "unit" = "nominal") {
  return {
    status: "resolved",
    value: {
      standardResult: true,
      successType: { kind: "unit" },
      errorType:
        errorType === "unit"
          ? { kind: "unit" }
          : { kind: "nominal", symbolId: `${SYMBOL}::${request.target.operation}::Error` },
    },
    evidence: [span(request, spellingOf(request).result)],
  };
}

export function nonStandardResult(request: InspectionRequest) {
  return {
    status: "resolved",
    value: { standardResult: false, resultType: { kind: "nominal", symbolId: `${SYMBOL}::Invoice` } },
    evidence: [span(request, "pub struct Invoice;")],
  };
}

/** An operation that declares no result is evidenced by its own signature. */
export function absentFact(request: InspectionRequest) {
  return { status: "absent", evidence: [span(request, spellingOf(request).operation)] };
}

export function unresolvedFact(code: ReasonCode) {
  return { status: "unresolved", reasons: [reason(code)] };
}

function caseSet(request: InspectionRequest, names: readonly string[], reasons: readonly Issue[]) {
  return {
    status: "resolved",
    value: {
      completeness: reasons.length ? "partial" : "complete",
      items: names.map((name) => ({ name, location: span(request, name) })),
      reasons,
    },
    evidence: [span(request, spellingOf(request).errorType)],
  };
}

export function closedCases(request: InspectionRequest, names: readonly string[]) {
  return caseSet(request, names, []);
}

export function partialCases(request: InspectionRequest, names: readonly string[], code: ReasonCode) {
  return caseSet(request, names, [reason(code)]);
}

interface Facts {
  readonly resultContract: unknown;
  readonly errorCases: unknown;
}

export function resolvedOperation(request: InspectionRequest, facts: Facts) {
  const spelled = spellingOf(request);
  return {
    operationStatus: "resolved",
    operation: {
      symbolId: `${SYMBOL}::Invoice::${request.target.operation}`,
      packageId: request.target.packageId,
      declarationPath: [...request.target.declarationPath],
      operation: request.target.operation,
    },
    operationEvidence: [span(request, spelled.operation)],
    resultContract: facts.resultContract,
    errorCases: facts.errorCases,
    resolutionPath: [
      { kind: "direct", reference: "Result", resolved: `${SYMBOL}::Result`, location: span(request, spelled.result) },
    ],
  };
}

export function unresolvedOperation(code: ReasonCode) {
  return { operationStatus: "unresolved", reasons: [reason(code)] };
}

/** A completed execution; `requestIdentity` is the identity the response claims to answer. */
export function completed(request: InspectionRequest, evidence: unknown, requestIdentity = request.requestIdentity) {
  return { status: "completed", response: { schemaVersion: "error-contract/1", requestIdentity, evidence } };
}

export function notCompleted(status: "failed" | "unavailable", code: ReasonCode) {
  return { status, reasons: [reason(code)] };
}

/** A completed execution that resolved the standard result and a closed set of `names`. */
export function closedSet(request: InspectionRequest, names: readonly string[]) {
  return completed(
    request,
    resolvedOperation(request, { resultContract: standardResult(request), errorCases: closedCases(request, names) }),
  );
}

export interface ExecutionEntry {
  readonly operationRef: string;
  readonly execution: unknown;
}

/** One execution per observed operation, each answering with exactly the cases its mapping names. */
export function matchingExecutions(value: World): ExecutionEntry[] {
  return value.mapping.operations.map((operation) => ({
    operationRef: operation.operation_ref,
    execution: closedSet(
      observationOf(value, operation.operation_ref),
      operation.errors.map((entry) => entry.code.case),
    ),
  }));
}

export function withExecution(entries: readonly ExecutionEntry[], operationRef: string, execution: unknown) {
  if (!entries.some((entry) => entry.operationRef === operationRef))
    throw new Error(`no execution answers ${operationRef}`);
  return entries.map((entry) => (entry.operationRef === operationRef ? { ...entry, execution } : entry));
}

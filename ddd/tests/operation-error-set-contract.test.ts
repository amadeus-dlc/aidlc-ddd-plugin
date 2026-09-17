/**
 * The operation error-set comparison (operation-error-set/1), judged from hand-written
 * error-contract evidence: how a request binds the model, the mapping and one
 * observation per operation; which input it refuses; how each operation's observed case
 * set is judged against its own mapped errors; how an earlier observation is kept out of
 * a changed request; and that nothing in the judgement depends on the language.
 *
 * No extractor runs here. The Rust and TypeScript projects are exercised in
 * `operation-error-set-languages.test.ts`.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import type { InspectionRequest, ReasonCode } from "../tools/ddd/lib/error-contract/contract.ts";
import { resolveErrorContract } from "../tools/ddd/lib/error-contract/inspection.ts";
import {
  inspectOperationErrorSet,
  prepareOperationErrorSetRequest,
  RULE_ID,
  SCHEMA_VERSION,
} from "../tools/ddd/lib/operation-error-set/index.ts";
import { canonicalJson, digest, jsonCopy } from "../tools/ddd/lib/state-exposure/canonical.ts";
import {
  AGGREGATE,
  ALREADY_ISSUED,
  absentFact,
  atModule,
  CHANGED_SOURCE,
  closedCases,
  closedSet,
  completed,
  EMPTY_LINES,
  type ExecutionEntry,
  ISSUE,
  KEBAB_CASES,
  LOCKED,
  MISSING_CUSTOMER,
  matchingExecutions,
  model,
  NEGATIVE_AMOUNT,
  nonStandardResult,
  notCompleted,
  OPEN,
  observationOf,
  observationRequest,
  PASCAL_CASES,
  partialCases,
  resolvedOperation,
  type Spelling,
  standardResult,
  unresolvedFact,
  unresolvedOperation,
  type World,
  withCase,
  withErrorCondition,
  withErrorOwner,
  withErrorType,
  withExecution,
  withMappedErrors,
  withMethod,
  withModelError,
  withObservation,
  world,
} from "./fixtures/operation-error-set/values.ts";

type PreparedRequest = Extract<ReturnType<typeof prepareOperationErrorSetRequest>, { kind: "prepared" }>["request"];
type EvaluatedResult = Extract<ReturnType<typeof inspectOperationErrorSet>, { kind: "evaluated" }>["result"];
type OperationResult = EvaluatedResult["operations"][number];

function prepare(input: unknown): PreparedRequest {
  const outcome = prepareOperationErrorSetRequest(input);
  if (outcome.kind !== "prepared") throw new Error(`preparation refused: ${JSON.stringify(outcome)}`);
  return outcome.request;
}

function evaluate(request: unknown, executions: unknown): EvaluatedResult {
  const outcome = inspectOperationErrorSet(request, executions);
  if (outcome.kind !== "evaluated") throw new Error(`inspection refused: ${JSON.stringify(outcome)}`);
  return outcome.result;
}

function operationOf(result: EvaluatedResult, operationRef: string): OperationResult {
  const found = result.operations.filter((entry) => entry.operationRef === operationRef);
  if (found.length !== 1) throw new Error(`expected one result for ${operationRef}, found ${found.length}`);
  return found[0];
}

function fields(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

/** What a finding means independently of the language: its kind, operation, business error, owner and detail. */
const MEANING = ["code", "operationRef", "errorRef", "owner", "detail"];
function meaning(finding: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(finding).filter(([key, value]) => MEANING.includes(key) && value !== undefined && value !== null),
  );
}
function sortedByJson<T>(values: readonly T[]): T[] {
  return [...values].sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
}

interface Judgement {
  readonly ruleResult: string;
  readonly findings: readonly Record<string, unknown>[];
  readonly reasons: readonly string[];
}
function judgement(result: EvaluatedResult, operationRef: string): Judgement {
  const entry = operationOf(result, operationRef);
  return {
    ruleResult: entry.ruleResult,
    findings: sortedByJson(entry.findings.map(meaning)),
    reasons: [...new Set(entry.unresolvedReasons.map((issue) => issue.code))].sort(),
  };
}
function judged(
  ruleResult: "pass" | "violation" | "unresolved",
  findings: readonly Record<string, unknown>[] = [],
  reasons: readonly ReasonCode[] = [],
): Judgement {
  return { ruleResult, findings: sortedByJson(findings), reasons: [...reasons].sort() };
}
const PASS = judged("pass");

const missing = (operationRef: string, errorRef: string) => ({ code: "missing-error", operationRef, errorRef });
const unexpected = (operationRef: string) => ({ code: "unexpected-case", operationRef });
const foreign = (operationRef: string, errorRef: string, owner: string) => ({
  code: "foreign-error",
  operationRef,
  errorRef,
  owner,
});
const contract = (operationRef: string, detail: "absent" | "non-standard" | "unnamed-error-type" | "no-case-set") => ({
  code: "result-contract",
  operationRef,
  detail,
});

function observedCases(result: EvaluatedResult, operationRef: string, code: string): unknown[] {
  return operationOf(result, operationRef)
    .findings.map(fields)
    .filter((finding) => finding.code === code)
    .map((finding) => finding.case);
}

/** Inspect `value` with every operation matching its mapping, except `issue`, which answers with `execution`. */
function inspectIssue(value: World, execution: (request: InspectionRequest) => unknown): EvaluatedResult {
  return evaluate(
    prepare(value),
    withExecution(matchingExecutions(value), ISSUE, execution(observationOf(value, ISSUE))),
  );
}

test("the comparison states its own schema version", () => {
  expect(SCHEMA_VERSION).toBe("operation-error-set/1");
});

// ---------------------------------------------------------------------------
// The prepared request
// ---------------------------------------------------------------------------

describe("the prepared request", () => {
  test("states the language, the aggregate, a digest of the model and each mapped operation with its own observation", () => {
    const value = world("rust");
    const stated = {
      schemaVersion: SCHEMA_VERSION,
      ruleId: RULE_ID,
      language: "rust",
      aggregateRef: AGGREGATE,
      model: { schemaVersion: 2, digest: digest(canonicalJson(jsonCopy(model(), "model"))) },
      operations: [
        {
          operationRef: ISSUE,
          kind: "command",
          code: {
            package: "billing-domain",
            module: ["invoice"],
            type: "Invoice",
            method: "issue",
            errorType: "IssueInvoiceError",
          },
          errors: [
            { errorRef: ALREADY_ISSUED, case: "AlreadyIssued" },
            { errorRef: EMPTY_LINES, case: "EmptyLines" },
          ],
          observation: observationOf(value, ISSUE),
        },
        {
          operationRef: OPEN,
          kind: "factory",
          code: {
            package: "billing-domain",
            module: ["invoice"],
            type: "Invoice",
            method: "open",
            errorType: "OpenInvoiceError",
          },
          errors: [
            { errorRef: NEGATIVE_AMOUNT, case: "NegativeAmount" },
            { errorRef: MISSING_CUSTOMER, case: "MissingCustomer" },
          ],
          observation: observationOf(value, OPEN),
        },
      ],
    };
    const actual: unknown = prepare(value);
    expect(actual).toEqual({
      ...stated,
      requestIdentity: digest(canonicalJson(jsonCopy(stated, "expected"))),
    });
  });

  test("lists commands before generation methods whatever order the mapping and the observations use", () => {
    const value = world("typescript");
    const reordered: World = {
      ...value,
      mapping: { ...value.mapping, operations: [...value.mapping.operations].reverse() },
      observations: [...value.observations].reverse(),
    };
    expect(prepare(reordered).operations.map((operation) => [operation.operationRef, operation.kind])).toEqual([
      [ISSUE, "command"],
      [OPEN, "factory"],
    ]);
  });

  test("gives the same identity to the same input whatever order its object keys are written in", () => {
    const value = world("rust");
    const rewritten = JSON.parse(JSON.stringify(value), (_key, entry) =>
      entry && typeof entry === "object" && !Array.isArray(entry)
        ? Object.fromEntries(Object.entries(entry).reverse())
        : entry,
    );
    expect(Object.keys(rewritten)).toEqual([...Object.keys(value)].reverse());
    expect(prepare(rewritten).requestIdentity).toBe(prepare(value).requestIdentity);
  });

  const CHANGES: [string, (value: World) => World][] = [
    [
      "the mapped method",
      (value) =>
        withObservation(
          { ...value, mapping: withMethod(value.mapping, ISSUE, "issue_invoice") },
          ISSUE,
          observationRequest("rust", "issue_invoice"),
        ),
    ],
    ["the mapped case", (value) => ({ ...value, mapping: withCase(value.mapping, EMPTY_LINES, "NoLines") })],
    [
      "the mapped error type",
      (value) => ({ ...value, mapping: withErrorType(value.mapping, ISSUE, "InvoiceIssueError") }),
    ],
    ["the mapped module", (value) => ({ ...value, mapping: atModule(value.mapping, "billing") })],
    [
      "the mapped type",
      (value) => ({
        model: value.model,
        mapping: { ...value.mapping, code: { ...value.mapping.code, type: "Bill" } },
        observations: [
          { operationRef: ISSUE, request: observationRequest("rust", "issue", { type: "Bill" }) },
          { operationRef: OPEN, request: observationRequest("rust", "open", { type: "Bill" }) },
        ],
      }),
    ],
    [
      "the mapped package",
      (value) => ({
        model: value.model,
        mapping: { ...value.mapping, code: { ...value.mapping.code, package: "billing-core" } },
        observations: [
          { operationRef: ISSUE, request: observationRequest("rust", "issue", { packageName: "billing-core" }) },
          { operationRef: OPEN, request: observationRequest("rust", "open", { packageName: "billing-core" }) },
        ],
      }),
    ],
    [
      "the model content",
      (value) => ({ ...value, model: withErrorCondition(value.model, ALREADY_ISSUED, "請求書は取り消し済みである。") }),
    ],
    [
      "the analysed snapshot",
      (value) => ({
        ...value,
        observations: [
          { operationRef: ISSUE, request: observationRequest("rust", "issue", { content: CHANGED_SOURCE }) },
          { operationRef: OPEN, request: observationRequest("rust", "open", { content: CHANGED_SOURCE }) },
        ],
      }),
    ],
  ];
  test.each(CHANGES)("changes its identity when %s changes", (_label, change) => {
    const base = world("rust");
    expect(prepare(change(base)).requestIdentity).not.toBe(prepare(base).requestIdentity);
  });
});

// ---------------------------------------------------------------------------
// Input the comparison refuses
// ---------------------------------------------------------------------------

describe("preparation refuses input it cannot compare", () => {
  const REFUSED: [string, () => unknown][] = [
    [
      "a model written in schema_version 1",
      () => {
        const value = world("rust");
        return { ...value, model: { ...value.model, schema_version: 1 } };
      },
    ],
    [
      "a mapping of an aggregate the model does not state",
      () => {
        const value = world("rust");
        return { ...value, mapping: { ...value.mapping, aggregate_ref: "aggregate.payment" } };
      },
    ],
    [
      "a model that states the mapped aggregate in two bounded contexts",
      () => {
        const value = world("rust");
        const context = value.model.bounded_contexts[0];
        return {
          ...value,
          model: {
            ...value.model,
            bounded_contexts: [context, { ...context, element_id: "bc.sales", name: "Sales" }],
          },
        };
      },
    ],
    [
      "an aggregate with no operation to compare",
      () => {
        const value = world("rust");
        const context = value.model.bounded_contexts[0];
        const aggregates = context.aggregates.map((aggregate) => ({ ...aggregate, commands: [], factory_rules: [] }));
        return {
          model: { ...value.model, bounded_contexts: [{ ...context, aggregates }] },
          mapping: { ...value.mapping, operations: [] },
          observations: [],
        };
      },
    ],
    [
      "a model error that names another operation than the one containing it",
      () => {
        const value = world("rust");
        return { ...value, model: withErrorOwner(value.model, EMPTY_LINES, OPEN) };
      },
    ],
    [
      "a mapped error that the operation does not declare itself",
      () => {
        const value = world("rust");
        return {
          ...value,
          mapping: withMappedErrors(value.mapping, ISSUE, [
            [ALREADY_ISSUED, "AlreadyIssued"],
            [EMPTY_LINES, "EmptyLines"],
            [NEGATIVE_AMOUNT, "NegativeAmount"],
          ]),
        };
      },
    ],
    [
      "a mapped error the model does not state",
      () => {
        const value = world("rust");
        return {
          ...value,
          mapping: withMappedErrors(value.mapping, ISSUE, [
            [ALREADY_ISSUED, "AlreadyIssued"],
            [EMPTY_LINES, "EmptyLines"],
            [LOCKED, "Locked"],
          ]),
        };
      },
    ],
    [
      "a mapping that leaves an operation out",
      () => {
        const value = world("rust");
        return {
          ...value,
          mapping: {
            ...value.mapping,
            operations: value.mapping.operations.filter((entry) => entry.operation_ref === ISSUE),
          },
          observations: value.observations.filter((entry) => entry.operationRef === ISSUE),
        };
      },
    ],
    [
      "a mapping that maps one operation twice",
      () => {
        const value = world("rust");
        return {
          ...value,
          mapping: { ...value.mapping, operations: [...value.mapping.operations, value.mapping.operations[0]] },
        };
      },
    ],
    [
      "a mapping of an operation the aggregate does not state",
      () => {
        const value = world("rust");
        return {
          ...value,
          mapping: {
            ...value.mapping,
            operations: [
              ...value.mapping.operations,
              { operation_ref: "command.invoice.void", code: { method: "void", error_type: "VoidError" }, errors: [] },
            ],
          },
          observations: [
            ...value.observations,
            { operationRef: "command.invoice.void", request: observationRequest("rust", "void") },
          ],
        };
      },
    ],
    [
      "a mapping that leaves an error of an operation out",
      () => {
        const value = world("rust");
        return { ...value, mapping: withMappedErrors(value.mapping, ISSUE, [[ALREADY_ISSUED, "AlreadyIssued"]]) };
      },
    ],
    [
      "a mapping that writes two errors of one operation as one case",
      () => {
        const value = world("rust");
        return {
          ...value,
          mapping: withMappedErrors(value.mapping, ISSUE, [
            [ALREADY_ISSUED, "AlreadyIssued"],
            [EMPTY_LINES, "AlreadyIssued"],
          ]),
        };
      },
    ],
    [
      "no observation of a mapped operation",
      () => {
        const value = world("rust");
        return { ...value, observations: value.observations.filter((entry) => entry.operationRef === ISSUE) };
      },
    ],
    [
      "two observations of one operation",
      () => {
        const value = world("rust");
        return { ...value, observations: [...value.observations, value.observations[0]] };
      },
    ],
    [
      "an observation of an operation the mapping does not name",
      () => {
        const value = world("rust");
        return {
          ...value,
          observations: [
            ...value.observations,
            { operationRef: "command.invoice.void", request: observationRequest("rust", "void") },
          ],
        };
      },
    ],
    [
      "an observation whose identity does not match its contents",
      () => {
        const value = world("rust");
        return withObservation(value, ISSUE, {
          ...observationOf(value, ISSUE),
          requestIdentity: `sha256:${"0".repeat(64)}`,
        });
      },
    ],
    [
      "observations in another language than the mapping",
      () => ({ ...world("typescript"), mapping: world("rust").mapping }),
    ],
    [
      "an observation of another method than the mapped one",
      () => withObservation(world("rust"), ISSUE, observationRequest("rust", "issue_invoice")),
    ],
    [
      "an observation of another declaration than the mapped type",
      () => withObservation(world("typescript"), ISSUE, observationRequest("typescript", "issue", { type: "Bill" })),
    ],
    [
      "observations in a package with another name than the mapped one",
      () => ({
        ...world("rust"),
        observations: [
          { operationRef: ISSUE, request: observationRequest("rust", "issue", { packageName: "billing-core" }) },
          { operationRef: OPEN, request: observationRequest("rust", "open", { packageName: "billing-core" }) },
        ],
      }),
    ],
    [
      "observations of two snapshots",
      () => withObservation(world("rust"), OPEN, observationRequest("rust", "open", { content: CHANGED_SOURCE })),
    ],
    [
      "observations under two analysis conditions",
      () =>
        withObservation(world("typescript"), OPEN, observationRequest("typescript", "open", { otherCondition: true })),
    ],
    [
      "observations under two project settings",
      () => withObservation(world("rust"), OPEN, observationRequest("rust", "open", { otherSettings: true })),
    ],
    [
      "observations from two toolchains",
      () => withObservation(world("rust"), OPEN, observationRequest("rust", "open", { toolVersion: "2" })),
    ],
  ];
  test.each(REFUSED)("%s", (_label, input) => {
    const outcome = prepareOperationErrorSetRequest(input());
    expect(outcome.kind).toBe("input-rejected");
    if (outcome.kind === "input-rejected") expect(outcome.issues.length).toBeGreaterThan(0);
  });
});

describe("inspection accepts only the request it prepared and one execution per operation", () => {
  function prepared(): { request: PreparedRequest; executions: ExecutionEntry[] } {
    const value = world("rust");
    return { request: prepare(value), executions: matchingExecutions(value) };
  }

  test("the prepared request with one execution per operation is evaluated", () => {
    const { request, executions } = prepared();
    const result = evaluate(request, executions);
    expect(result.requestIdentity).toBe(request.requestIdentity);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.aggregateRef).toBe(AGGREGATE);
  });

  const REFUSED: [string, (request: PreparedRequest, executions: ExecutionEntry[]) => [unknown, unknown]][] = [
    [
      "no execution for an operation",
      (request, executions) => [request, executions.filter((entry) => entry.operationRef === ISSUE)],
    ],
    ["two executions for one operation", (request, executions) => [request, [...executions, executions[0]]]],
    [
      "an execution for an operation the request does not name",
      (request, executions) => [
        request,
        [...executions, { operationRef: "command.invoice.void", execution: executions[0].execution }],
      ],
    ],
    [
      "an execution the error contract cannot read",
      (request, executions) => [request, withExecution(executions, ISSUE, { status: "running" })],
    ],
    [
      "a request that gained a mapped error after preparation and kept its identity",
      (request, executions) => [
        {
          ...request,
          operations: request.operations.map((operation) =>
            operation.operationRef === ISSUE
              ? { ...operation, errors: [...operation.errors, { errorRef: LOCKED, case: "Locked" }] }
              : operation,
          ),
        },
        executions,
      ],
    ],
    [
      "a request whose model version was changed after preparation",
      (request, executions) => [{ ...request, model: { ...request.model, schemaVersion: 1 } }, executions],
    ],
  ];
  test.each(REFUSED)("%s is refused", (_label, change) => {
    const { request, executions } = prepared();
    const [candidate, candidateExecutions] = change(request, executions);
    const outcome = inspectOperationErrorSet(candidate, candidateExecutions);
    expect(outcome.kind).toBe("input-rejected");
    if (outcome.kind === "input-rejected") expect(outcome.issues.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Comparing the observed case set with the mapped errors
// ---------------------------------------------------------------------------

describe("each operation is judged against its own mapped errors", () => {
  test("closed sets that match the mapping pass for the command and the generation method", () => {
    const value = world("rust");
    const request = prepare(value);
    const result = evaluate(request, matchingExecutions(value));
    expect(judgement(result, ISSUE)).toEqual(PASS);
    expect(judgement(result, OPEN)).toEqual(PASS);
    expect(operationOf(result, ISSUE)).toMatchObject({
      kind: "command",
      executionState: "completed",
      observationIdentity: observationOf(value, ISSUE).requestIdentity,
    });
    expect(operationOf(result, OPEN)).toMatchObject({
      kind: "factory",
      executionState: "completed",
      observationIdentity: observationOf(value, OPEN).requestIdentity,
    });
  });

  test("a mapped case the code leaves out is a missing error of that operation", () => {
    const value = world("rust");
    const result = evaluate(
      prepare(value),
      withExecution(
        withExecution(matchingExecutions(value), ISSUE, closedSet(observationOf(value, ISSUE), ["AlreadyIssued"])),
        OPEN,
        closedSet(observationOf(value, OPEN), ["NegativeAmount"]),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("violation", [missing(ISSUE, EMPTY_LINES)]));
    expect(judgement(result, OPEN)).toEqual(judged("violation", [missing(OPEN, MISSING_CUSTOMER)]));
  });

  test("a case no operation maps is an unexpected case of that operation", () => {
    const value = world("rust");
    const result = evaluate(
      prepare(value),
      withExecution(
        withExecution(
          matchingExecutions(value),
          ISSUE,
          closedSet(observationOf(value, ISSUE), ["AlreadyIssued", "EmptyLines", "Locked"]),
        ),
        OPEN,
        closedSet(observationOf(value, OPEN), ["NegativeAmount", "MissingCustomer", "Expired"]),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("violation", [unexpected(ISSUE)]));
    expect(judgement(result, OPEN)).toEqual(judged("violation", [unexpected(OPEN)]));
    expect(observedCases(result, ISSUE, "unexpected-case")).toEqual(["Locked"]);
    expect(observedCases(result, OPEN, "unexpected-case")).toEqual(["Expired"]);
  });

  test("a case the other operation maps is a foreign error naming the business error and its owner", () => {
    const value = world("rust");
    const result = evaluate(
      prepare(value),
      withExecution(
        withExecution(
          matchingExecutions(value),
          ISSUE,
          closedSet(observationOf(value, ISSUE), ["AlreadyIssued", "EmptyLines", "NegativeAmount"]),
        ),
        OPEN,
        closedSet(observationOf(value, OPEN), ["NegativeAmount", "MissingCustomer", "AlreadyIssued"]),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("violation", [foreign(ISSUE, NEGATIVE_AMOUNT, OPEN)]));
    expect(judgement(result, OPEN)).toEqual(judged("violation", [foreign(OPEN, ALREADY_ISSUED, ISSUE)]));
    expect(observedCases(result, ISSUE, "foreign-error")).toEqual(["NegativeAmount"]);
  });

  test("a case both operations spell alike belongs to the operation that maps it", () => {
    const base = world("rust");
    const value: World = {
      ...base,
      mapping: withCase(withCase(base.mapping, EMPTY_LINES, "Invalid"), NEGATIVE_AMOUNT, "Invalid"),
    };
    const result = evaluate(
      prepare(value),
      withExecution(
        withExecution(
          matchingExecutions(value),
          ISSUE,
          closedSet(observationOf(value, ISSUE), ["AlreadyIssued", "Invalid"]),
        ),
        OPEN,
        closedSet(observationOf(value, OPEN), ["Invalid", "MissingCustomer"]),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(PASS);
    expect(judgement(result, OPEN)).toEqual(PASS);
  });

  const RESPELLED: [string, "rust" | "typescript", Spelling, string][] = [
    ["a snake case spelling", "rust", PASCAL_CASES, "negative_amount"],
    ["a camel case spelling", "rust", PASCAL_CASES, "negativeAmount"],
    ["an upper case spelling", "rust", PASCAL_CASES, "NEGATIVE_AMOUNT"],
    ["a spelling with other letter case", "typescript", KEBAB_CASES, "Negative-Amount"],
    ["a spelling with a trailing space", "typescript", KEBAB_CASES, "negative-amount "],
  ];
  test.each(RESPELLED)(
    "%s of the other operation's case is an unexpected case, not a foreign error",
    (_label, language, cases, spelling) => {
      const value = world(language, cases);
      const own = value.mapping.operations[0].errors.map((entry) => entry.code.case);
      const result = inspectIssue(value, (request) => closedSet(request, [...own, spelling]));
      expect(judgement(result, ISSUE)).toEqual(judged("violation", [unexpected(ISSUE)]));
      expect(observedCases(result, ISSUE, "unexpected-case")).toEqual([spelling]);
    },
  );

  test("the judgement does not depend on the order the cases were observed in", () => {
    const value = world("rust");
    const names = ["Locked", "NegativeAmount", "AlreadyIssued", "Expired"];
    const forward = inspectIssue(value, (request) => closedSet(request, names));
    const backward = inspectIssue(value, (request) => closedSet(request, [...names].reverse()));
    expect(operationOf(backward, ISSUE).findings).toEqual(operationOf(forward, ISSUE).findings);
    expect(judgement(forward, ISSUE)).toEqual(
      judged("violation", [
        missing(ISSUE, EMPTY_LINES),
        unexpected(ISSUE),
        unexpected(ISSUE),
        foreign(ISSUE, NEGATIVE_AMOUNT, OPEN),
      ]),
    );
  });
});

describe("the result contract is judged before the case set", () => {
  test("an operation that declares no result contract is a violation rather than an empty closed set", () => {
    const result = inspectIssue(world("rust"), (request) =>
      completed(
        request,
        resolvedOperation(request, { resultContract: absentFact(request), errorCases: absentFact(request) }),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("violation", [contract(ISSUE, "absent")]));
  });

  test("an operation that returns something other than the standard result is a violation", () => {
    const result = inspectIssue(world("rust"), (request) =>
      completed(
        request,
        resolvedOperation(request, { resultContract: nonStandardResult(request), errorCases: absentFact(request) }),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("violation", [contract(ISSUE, "non-standard")]));
  });

  test("a standard result whose error type names no declaration is a violation", () => {
    const result = inspectIssue(world("rust"), (request) =>
      completed(
        request,
        resolvedOperation(request, {
          resultContract: standardResult(request, "unit"),
          errorCases: absentFact(request),
        }),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("violation", [contract(ISSUE, "unnamed-error-type")]));
  });

  test("an unnamed error type whose cases cannot be listed stays unresolved and keeps its violation", () => {
    const result = inspectIssue(world("rust"), (request) =>
      completed(
        request,
        resolvedOperation(request, {
          resultContract: standardResult(request, "unit"),
          errorCases: unresolvedFact("unsupported-syntax"),
        }),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(
      judged("unresolved", [contract(ISSUE, "unnamed-error-type")], ["unsupported-syntax"]),
    );
  });

  test("a standard result whose error type names a declaration but states no case set is a violation", () => {
    const result = inspectIssue(world("rust"), (request) =>
      completed(
        request,
        resolvedOperation(request, { resultContract: standardResult(request), errorCases: absentFact(request) }),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("violation", [contract(ISSUE, "no-case-set")]));
  });
});

// ---------------------------------------------------------------------------
// Facts the comparison cannot establish
// ---------------------------------------------------------------------------

describe("an operation whose facts are not established never passes", () => {
  const UNRESOLVED: [string, (request: InspectionRequest) => unknown, ReasonCode][] = [
    [
      "an operation the snapshot does not declare",
      (request) => completed(request, unresolvedOperation("target-missing")),
      "target-missing",
    ],
    [
      "an error type imported from a module the snapshot lacks",
      (request) =>
        completed(
          request,
          resolvedOperation(request, {
            resultContract: unresolvedFact("missing-referent"),
            errorCases: unresolvedFact("missing-referent"),
          }),
        ),
      "missing-referent",
    ],
    [
      "a return type only the body states",
      (request) =>
        completed(
          request,
          resolvedOperation(request, {
            resultContract: unresolvedFact("expression-inference-required"),
            errorCases: unresolvedFact("expression-inference-required"),
          }),
        ),
      "expression-inference-required",
    ],
    [
      "a type named Result that is not the configured result",
      (request) =>
        completed(
          request,
          resolvedOperation(request, {
            resultContract: unresolvedFact("shadowed-result-identity"),
            errorCases: unresolvedFact("shadowed-result-identity"),
          }),
        ),
      "shadowed-result-identity",
    ],
    [
      "an error type wider than a closed set",
      (request) =>
        completed(
          request,
          resolvedOperation(request, {
            resultContract: standardResult(request),
            errorCases: unresolvedFact("open-error-type"),
          }),
        ),
      "open-error-type",
    ],
    ["an extractor that failed", () => notCompleted("failed", "execution-failed"), "execution-failed"],
    ["an extractor that is unavailable", () => notCompleted("unavailable", "tool-unavailable"), "tool-unavailable"],
    [
      "a response of an unknown version",
      (request) => ({
        status: "completed",
        response: { schemaVersion: "error-contract/2", requestIdentity: request.requestIdentity, evidence: {} },
      }),
      "unknown-version",
    ],
    [
      "a response that breaks the error contract",
      (request) => completed(request, { operationStatus: "resolved" }),
      "invalid-response",
    ],
    ["a completed execution without a response", () => ({ status: "completed", response: null }), "invalid-response"],
  ];
  test.each(UNRESOLVED)(
    "%s is unresolved with exactly the reasons the error contract reports",
    (_label, execution, code) => {
      const value = world("rust");
      const answer = execution(observationOf(value, ISSUE));
      const result = inspectIssue(value, () => answer);
      const resolved = resolveErrorContract(observationOf(value, ISSUE), answer);
      if (resolved.kind !== "evaluated") throw new Error("the fixture execution is not a valid execution");

      expect(judgement(result, ISSUE)).toEqual(judged("unresolved", [], [code]));
      expect(operationOf(result, ISSUE).unresolvedReasons).toEqual(resolved.result.unresolvedReasons);
      expect(operationOf(result, ISSUE).executionState).toBe(resolved.result.executionState);
      expect(judgement(result, OPEN)).toEqual(PASS);
    },
  );

  test("an open case set reports the cases outside the mapping but judges no case missing", () => {
    const result = inspectIssue(world("rust"), (request) =>
      completed(
        request,
        resolvedOperation(request, {
          resultContract: standardResult(request),
          errorCases: partialCases(request, ["AlreadyIssued", "NegativeAmount", "Locked"], "incomplete-case-set"),
        }),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(
      judged("unresolved", [foreign(ISSUE, NEGATIVE_AMOUNT, OPEN), unexpected(ISSUE)], ["incomplete-case-set"]),
    );
  });

  test("an open case set with only mapped cases is unresolved rather than passing", () => {
    const result = inspectIssue(world("rust"), (request) =>
      completed(
        request,
        resolvedOperation(request, {
          resultContract: standardResult(request),
          errorCases: partialCases(request, ["AlreadyIssued", "EmptyLines"], "incomplete-case-set"),
        }),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("unresolved", [], ["incomplete-case-set"]));
  });

  test("an application type named Result keeps its non-standard result as an established violation", () => {
    const result = inspectIssue(world("rust"), (request) =>
      completed(
        request,
        resolvedOperation(request, {
          resultContract: nonStandardResult(request),
          errorCases: unresolvedFact("shadowed-result-identity"),
        }),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(
      judged("unresolved", [contract(ISSUE, "non-standard")], ["shadowed-result-identity"]),
    );
  });

  test("an unresolved operation does not hide the violation of the other operation", () => {
    const value = world("rust");
    const result = evaluate(
      prepare(value),
      withExecution(
        withExecution(
          matchingExecutions(value),
          ISSUE,
          completed(observationOf(value, ISSUE), unresolvedOperation("target-missing")),
        ),
        OPEN,
        closedSet(observationOf(value, OPEN), ["NegativeAmount"]),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("unresolved", [], ["target-missing"]));
    expect(judgement(result, OPEN)).toEqual(judged("violation", [missing(OPEN, MISSING_CUSTOMER)]));
  });
});

// ---------------------------------------------------------------------------
// Changed mapping, model or snapshot
// ---------------------------------------------------------------------------

describe("a changed mapping, model or snapshot never reuses an earlier observation", () => {
  test("a renamed method is judged from its own observation, and the earlier one is an identity mismatch", () => {
    const before = world("rust");
    const after = withObservation(
      { ...before, mapping: withMethod(before.mapping, ISSUE, "issue_invoice") },
      ISSUE,
      observationRequest("rust", "issue_invoice"),
    );
    const earlier = matchingExecutions(before);
    const request = prepare(after);
    expect(request.requestIdentity).not.toBe(prepare(before).requestIdentity);

    const reused = evaluate(request, earlier);
    expect(reused.requestIdentity).toBe(request.requestIdentity);
    expect(judgement(reused, ISSUE)).toEqual(judged("unresolved", [], ["identity-mismatch"]));
    expect(judgement(reused, OPEN)).toEqual(PASS);

    const fresh = evaluate(
      request,
      withExecution(earlier, ISSUE, completed(observationOf(after, ISSUE), unresolvedOperation("target-missing"))),
    );
    expect(judgement(fresh, ISSUE)).toEqual(judged("unresolved", [], ["target-missing"]));
  });

  test("a respelled case is judged afresh against the same observation", () => {
    const before = world("rust");
    const after: World = { ...before, mapping: withCase(before.mapping, EMPTY_LINES, "NoLines") };
    const executions: ExecutionEntry[] = matchingExecutions(before);
    expect(judgement(evaluate(prepare(before), executions), ISSUE)).toEqual(PASS);

    const request = prepare(after);
    expect(request.requestIdentity).not.toBe(prepare(before).requestIdentity);
    const result = evaluate(request, executions);
    expect(result.requestIdentity).toBe(request.requestIdentity);
    expect(judgement(result, ISSUE)).toEqual(judged("violation", [missing(ISSUE, EMPTY_LINES), unexpected(ISSUE)]));
    expect(observedCases(result, ISSUE, "unexpected-case")).toEqual(["EmptyLines"]);
  });

  test("an error added to the model is judged afresh against the same observation", () => {
    const before = world("rust");
    const after: World = {
      ...before,
      model: withModelError(before.model, ISSUE, LOCKED),
      mapping: withMappedErrors(before.mapping, ISSUE, [
        [ALREADY_ISSUED, "AlreadyIssued"],
        [EMPTY_LINES, "EmptyLines"],
        [LOCKED, "Locked"],
      ]),
    };
    const executions = matchingExecutions(before);
    const request = prepare(after);
    expect(request.model.digest).not.toBe(prepare(before).model.digest);
    expect(request.requestIdentity).not.toBe(prepare(before).requestIdentity);

    const result = evaluate(request, executions);
    expect(judgement(result, ISSUE)).toEqual(judged("violation", [missing(ISSUE, LOCKED)]));
    expect(judgement(result, OPEN)).toEqual(PASS);
  });

  test("an observation of an earlier snapshot is an identity mismatch for every operation", () => {
    const before = world("rust");
    const after: World = {
      ...before,
      observations: [
        { operationRef: ISSUE, request: observationRequest("rust", "issue", { content: CHANGED_SOURCE }) },
        { operationRef: OPEN, request: observationRequest("rust", "open", { content: CHANGED_SOURCE }) },
      ],
    };
    const request = prepare(after);
    const reused = evaluate(request, matchingExecutions(before));
    expect(judgement(reused, ISSUE)).toEqual(judged("unresolved", [], ["identity-mismatch"]));
    expect(judgement(reused, OPEN)).toEqual(judged("unresolved", [], ["identity-mismatch"]));

    const fresh = evaluate(request, matchingExecutions(after));
    expect(judgement(fresh, ISSUE)).toEqual(PASS);
    expect(judgement(fresh, OPEN)).toEqual(PASS);
  });

  test("a response that claims the comparison request identity answers no observation", () => {
    const value = world("rust");
    const request = prepare(value);
    const issue = observationOf(value, ISSUE);
    const result = evaluate(
      request,
      withExecution(
        matchingExecutions(value),
        ISSUE,
        completed(
          issue,
          resolvedOperation(issue, {
            resultContract: standardResult(issue),
            errorCases: closedCases(issue, ["AlreadyIssued", "EmptyLines"]),
          }),
          request.requestIdentity,
        ),
      ),
    );
    expect(judgement(result, ISSUE)).toEqual(judged("unresolved", [], ["identity-mismatch"]));
  });
});

// ---------------------------------------------------------------------------
// Language neutrality
// ---------------------------------------------------------------------------

describe("the same facts give the same judgement in Rust and TypeScript", () => {
  const BRANCHES: [string, (request: InspectionRequest) => unknown][] = [
    ["closed sets that match", (request) => closedSet(request, ["AlreadyIssued", "EmptyLines"])],
    ["a missing case", (request) => closedSet(request, ["AlreadyIssued"])],
    ["an unexpected case", (request) => closedSet(request, ["AlreadyIssued", "EmptyLines", "Locked"])],
    ["a foreign case", (request) => closedSet(request, ["AlreadyIssued", "EmptyLines", "NegativeAmount"])],
    [
      "no result contract",
      (request) =>
        completed(
          request,
          resolvedOperation(request, { resultContract: absentFact(request), errorCases: absentFact(request) }),
        ),
    ],
    [
      "a non-standard result",
      (request) =>
        completed(
          request,
          resolvedOperation(request, { resultContract: nonStandardResult(request), errorCases: absentFact(request) }),
        ),
    ],
    [
      "an unnamed error type",
      (request) =>
        completed(
          request,
          resolvedOperation(request, {
            resultContract: standardResult(request, "unit"),
            errorCases: absentFact(request),
          }),
        ),
    ],
    [
      "an open case set",
      (request) =>
        completed(
          request,
          resolvedOperation(request, {
            resultContract: standardResult(request),
            errorCases: partialCases(request, ["AlreadyIssued", "NegativeAmount"], "incomplete-case-set"),
          }),
        ),
    ],
    [
      "a shadowed result",
      (request) =>
        completed(
          request,
          resolvedOperation(request, {
            resultContract: nonStandardResult(request),
            errorCases: unresolvedFact("shadowed-result-identity"),
          }),
        ),
    ],
    ["a missing operation", (request) => completed(request, unresolvedOperation("target-missing"))],
    ["a failed extractor", () => notCompleted("failed", "execution-failed")],
  ];
  test.each(BRANCHES)("%s", (_label, execution) => {
    const [rust, typescript] = (["rust", "typescript"] as const).map((language) =>
      inspectIssue(world(language), execution),
    );
    expect(judgement(typescript, ISSUE)).toEqual(judgement(rust, ISSUE));
    expect(judgement(typescript, OPEN)).toEqual(judgement(rust, OPEN));
  });
});

describe("the comparator carries no language-specific analysis", () => {
  const ROOT = resolve(import.meta.dir, "..");
  const LANGUAGE_SPECIFIC = ["tools/ddd/lib/rust/", "tools/ddd/lib/typescript/", "experiments/"];

  /** Every module and package reachable from `entries`, type-only imports and re-exports included. */
  function dependencies(entries: readonly string[]): { files: string[]; packages: string[] } {
    const files = new Set<string>();
    const packages = new Set<string>();
    const pending = entries.map((entry) => resolve(ROOT, entry));
    for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
      if (files.has(file)) continue;
      files.add(file);
      for (const { fileName } of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
        if (fileName.startsWith(".")) pending.push(resolve(dirname(file), fileName));
        else packages.add(fileName);
      }
    }
    return {
      files: [...files].map((file) => relative(ROOT, file).split(sep).join("/")),
      packages: [...packages],
    };
  }
  const languageModules = (files: readonly string[]) =>
    files.filter((file) => LANGUAGE_SPECIFIC.some((prefix) => file.startsWith(prefix)));
  const compilerPackages = (packages: readonly string[]) =>
    packages.filter((name) => name === "typescript" || name.startsWith("typescript/"));

  test("reaches no Rust or TypeScript analysis module and not the compiler package", () => {
    const directory = "tools/ddd/lib/operation-error-set";
    const entries = readdirSync(join(ROOT, directory))
      .filter((name) => name.endsWith(".ts"))
      .map((name) => `${directory}/${name}`);
    const reached = dependencies(entries);
    expect(languageModules(reached.files)).toEqual([]);
    expect(compilerPackages(reached.packages)).toEqual([]);
  });

  test("the same scan finds the compiler package and a language module where they are imported", () => {
    expect(compilerPackages(dependencies(["tools/ddd/lib/typescript/error-contract/index.ts"]).packages)).toEqual([
      "typescript",
    ]);
    expect(languageModules(dependencies(["scripts/verify-error-contract.ts"]).files)).toContain(
      "tools/ddd/lib/rust/error-contract/index.ts",
    );
  });
});

/**
 * The operation error-set comparison run from both languages' verification paths over one
 * shared fixture: a canonical model with one command and one generation method, a Rust
 * mapping and a TypeScript mapping that share every business id, a Rust workspace, and a
 * TypeScript project in each code representation. Each module of a project is one
 * scenario; a scenario is reached by pointing the mapping at its module.
 *
 * Every expectation below is written from the scenario, not copied from a run. The Rust
 * path needs the native extractor that `bun run prepare:native` installs.
 */

import { describe, expect, test } from "bun:test";
import type { AggregateMapping } from "../tools/ddd/lib/aggregate-mapping/contract.ts";
import type { InspectionRequest, ReasonCode, SourceInput } from "../tools/ddd/lib/error-contract/contract.ts";
import { resolveErrorContract } from "../tools/ddd/lib/error-contract/inspection.ts";
import {
  inspectOperationErrorSet,
  prepareOperationErrorSetRequest,
} from "../tools/ddd/lib/operation-error-set/index.ts";
import { observeRustOperations } from "../tools/ddd/lib/operation-error-set-verification/rust.ts";
import {
  loadScenarioMapping,
  loadScenarioModel,
  scenarioSources,
} from "../tools/ddd/lib/operation-error-set-verification/scenario.ts";
import { observeTypeScriptOperations } from "../tools/ddd/lib/operation-error-set-verification/typescript.ts";
import {
  ALREADY_ISSUED,
  atModule,
  EMPTY_LINES,
  edit,
  ISSUE,
  LOCKED,
  MISSING_CUSTOMER,
  NEGATIVE_AMOUNT,
  OPEN,
  withCase,
  withMappedErrors,
  withMethod,
  withModelError,
} from "./fixtures/operation-error-set/values.ts";

type Observed = Awaited<ReturnType<typeof observeRustOperations>>;
type ScenarioProject = Parameters<typeof scenarioSources>[0];
type PreparedRequest = Extract<ReturnType<typeof prepareOperationErrorSetRequest>, { kind: "prepared" }>["request"];
type EvaluatedResult = Extract<ReturnType<typeof inspectOperationErrorSet>, { kind: "evaluated" }>["result"];

/** Rust runs a native process per operation, so a test that observes several scenarios needs room. */
const TIMEOUT = 120_000;

const MODEL = loadScenarioModel();
const MAPPINGS = { rust: loadScenarioMapping("rust"), typescript: loadScenarioMapping("typescript") } as const;

interface Project {
  readonly name: ScenarioProject;
  readonly language: "rust" | "typescript";
  readonly observe: (mapping: AggregateMapping, sources: readonly SourceInput[]) => Promise<Observed>;
  /** Where the language places the operations of a mapping that names `module`. */
  readonly file: (module: string) => string;
  readonly declarationPath: (module: string) => readonly string[];
  /** The mapped module's command error type, before and after one case is dropped from it. */
  readonly dropEmptyLines: { readonly from: string; readonly to: string };
  readonly spelling: { readonly noLines: string; readonly locked: string };
}

const TYPESCRIPT_DROP = { from: '"already-issued" | "empty-lines";', to: '"already-issued";' };
const PROJECTS: readonly Project[] = [
  {
    name: "rust",
    language: "rust",
    observe: (mapping, sources) => observeRustOperations(mapping, sources),
    file: (module) => `billing-domain/src/${module}.rs`,
    declarationPath: (module) => [module, "Invoice"],
    dropEmptyLines: { from: "    AlreadyIssued,\n    EmptyLines,\n}", to: "    AlreadyIssued,\n}" },
    spelling: { noLines: "NoLines", locked: "Locked" },
  },
  {
    name: "typescript-class",
    language: "typescript",
    observe: async (mapping, sources) => observeTypeScriptOperations("class", mapping, sources),
    file: (module) => `billing-domain/src/${module}.ts`,
    declarationPath: () => ["Invoice"],
    dropEmptyLines: TYPESCRIPT_DROP,
    spelling: { noLines: "no-lines", locked: "locked" },
  },
  {
    name: "typescript-companion",
    language: "typescript",
    observe: async (mapping, sources) => observeTypeScriptOperations("companion", mapping, sources),
    file: (module) => `billing-domain/src/${module}.ts`,
    declarationPath: () => ["Invoice"],
    dropEmptyLines: TYPESCRIPT_DROP,
    spelling: { noLines: "no-lines", locked: "locked" },
  },
];
const [RUST, TYPESCRIPT_CLASS, TYPESCRIPT_COMPANION] = PROJECTS;
const PROJECT_TABLE: [string, Project][] = PROJECTS.map((project) => [project.name, project]);

function mappingAt(project: Project, module: string): AggregateMapping {
  return atModule(MAPPINGS[project.language], module);
}

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

async function run(project: Project, mapping: AggregateMapping, sources: readonly SourceInput[]) {
  const observed = await project.observe(mapping, sources);
  const request = prepare({ model: MODEL, mapping, observations: observed.observations });
  return { observed, request, result: evaluate(request, observed.executions) };
}

function changedSources(project: Project): SourceInput[] {
  const path = project.file("invoice");
  const sources = scenarioSources(project.name);
  if (!sources.some((source) => source.path === path)) throw new Error(`the ${project.name} sources lack ${path}`);
  return sources.map((source) =>
    source.path === path
      ? { ...source, content: edit(source.content, project.dropEmptyLines.from, project.dropEmptyLines.to) }
      : source,
  );
}

// ---------------------------------------------------------------------------
// Language-neutral judgement
// ---------------------------------------------------------------------------

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
  const found = result.operations.filter((entry) => entry.operationRef === operationRef);
  if (found.length !== 1) throw new Error(`expected one result for ${operationRef}, found ${found.length}`);
  return {
    ruleResult: found[0].ruleResult,
    findings: sortedByJson(found[0].findings.map(meaning)),
    reasons: [...new Set(found[0].unresolvedReasons.map((issue) => issue.code))].sort(),
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
const contract = (operationRef: string, detail: "absent" | "non-standard") => ({
  code: "result-contract",
  operationRef,
  detail,
});

interface Expected {
  readonly issue: Judgement;
  readonly open: Judgement;
}
const both = (issue: Judgement, open: Judgement): Expected => ({ issue, open });
const unresolvedBoth = (code: ReasonCode): Expected =>
  both(judged("unresolved", [], [code]), judged("unresolved", [], [code]));

async function judgedAt(project: Project, module: string): Promise<{ project: ScenarioProject } & Expected> {
  const { result } = await run(project, mappingAt(project, module), scenarioSources(project.name));
  return { project: project.name, issue: judgement(result, ISSUE), open: judgement(result, OPEN) };
}

// ---------------------------------------------------------------------------
// The shared fixture and the two verification paths
// ---------------------------------------------------------------------------

describe("the shared fixture", () => {
  test(
    "gives both languages one model with one command and one generation method, and the same business ids",
    async () => {
      const [rust, typescript] = await Promise.all(
        [RUST, TYPESCRIPT_CLASS].map((project) =>
          run(project, mappingAt(project, "invoice"), scenarioSources(project.name)),
        ),
      );
      expect(rust.request.model).toEqual(typescript.request.model);
      expect(rust.request.operations.map((operation) => [operation.operationRef, operation.kind])).toEqual([
        [ISSUE, "command"],
        [OPEN, "factory"],
      ]);

      const businessIds = (mapping: AggregateMapping) =>
        mapping.operations.map((operation) => [
          operation.operation_ref,
          operation.errors.map((entry) => entry.error_ref),
        ]);
      const cases = (mapping: AggregateMapping) =>
        mapping.operations.flatMap((operation) => operation.errors.map((entry) => entry.code.case));
      expect(businessIds(MAPPINGS.typescript)).toEqual(businessIds(MAPPINGS.rust));
      expect(businessIds(MAPPINGS.rust)).toEqual([
        [ISSUE, [ALREADY_ISSUED, EMPTY_LINES]],
        [OPEN, [NEGATIVE_AMOUNT, MISSING_CUSTOMER]],
      ]);
      expect(cases(MAPPINGS.typescript)).not.toEqual(cases(MAPPINGS.rust));
    },
    TIMEOUT,
  );

  test.each(PROJECT_TABLE)(
    "the %s path observes each mapped operation where its language places the mapped module and type",
    async (_name, project) => {
      const observed = await project.observe(mappingAt(project, "invoice"), scenarioSources(project.name));
      const methods: Record<string, string> = { [ISSUE]: "issue", [OPEN]: "open" };
      const packageName = (request: InspectionRequest) =>
        (request.language === "rust" ? request.cargoCondition.packages : request.typeScriptCondition.packages).find(
          (entry) => entry.packageId === request.target.packageId,
        )?.name;
      expect(
        sortedByJson(
          observed.observations.map(({ operationRef, request }) => ({
            operationRef,
            language: request.language,
            file: request.target.file,
            declarationPath: request.target.declarationPath,
            operation: request.target.operation,
            package: packageName(request),
          })),
        ),
      ).toEqual(
        sortedByJson(
          [ISSUE, OPEN].map((operationRef) => ({
            operationRef,
            language: project.language,
            file: project.file("invoice"),
            declarationPath: project.declarationPath("invoice"),
            operation: methods[operationRef],
            package: "billing-domain",
          })),
        ),
      );
      expect(sortedByJson(observed.executions.map((entry) => entry.operationRef))).toEqual(sortedByJson([ISSUE, OPEN]));
    },
    TIMEOUT,
  );

  test(
    "the TypeScript paths reach operations in the code representation of their own project",
    async () => {
      const companionSteps = async (project: Project) => {
        const observed = await project.observe(mappingAt(project, "invoice"), scenarioSources(project.name));
        return sortedByJson(
          observed.observations.map(({ operationRef, request }) => {
            const execution = observed.executions.find((entry) => entry.operationRef === operationRef)?.execution;
            const outcome = resolveErrorContract(request, execution);
            if (outcome.kind !== "evaluated" || outcome.result.evidence?.operationStatus !== "resolved")
              throw new Error(`${project.name} did not resolve ${operationRef}: ${JSON.stringify(outcome)}`);
            return [operationRef, outcome.result.evidence.resolutionPath.some((step) => step.kind === "companion")];
          }),
        );
      };
      expect(await companionSteps(TYPESCRIPT_CLASS)).toEqual(
        sortedByJson([
          [ISSUE, false],
          [OPEN, false],
        ]),
      );
      expect(await companionSteps(TYPESCRIPT_COMPANION)).toEqual(
        sortedByJson([
          [ISSUE, true],
          [OPEN, true],
        ]),
      );
    },
    TIMEOUT,
  );

  test(
    "observations from a TypeScript project are refused for the Rust mapping",
    async () => {
      const observed = await TYPESCRIPT_CLASS.observe(
        mappingAt(TYPESCRIPT_CLASS, "invoice"),
        scenarioSources(TYPESCRIPT_CLASS.name),
      );
      const outcome = prepareOperationErrorSetRequest({
        model: MODEL,
        mapping: mappingAt(RUST, "invoice"),
        observations: observed.observations,
      });
      expect(outcome.kind).toBe("input-rejected");
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// Scenarios: Rust enums and TypeScript closed unions compared
// ---------------------------------------------------------------------------

describe("Rust, TypeScript class and TypeScript companion give one language-neutral result", () => {
  const SHARED: [string, string, Expected][] = [
    ["the mapped closed sets", "invoice", both(PASS, PASS)],
    [
      "a case each operation leaves out",
      "missing",
      both(judged("violation", [missing(ISSUE, EMPTY_LINES)]), judged("violation", [missing(OPEN, MISSING_CUSTOMER)])),
    ],
    [
      "a case no operation maps",
      "extra",
      both(judged("violation", [unexpected(ISSUE)]), judged("violation", [unexpected(OPEN)])),
    ],
    [
      "a case the other operation maps",
      "foreign",
      both(
        judged("violation", [foreign(ISSUE, NEGATIVE_AMOUNT, OPEN)]),
        judged("violation", [foreign(OPEN, ALREADY_ISSUED, ISSUE)]),
      ),
    ],
    [
      "no result contract and a result that is not the standard result",
      "contract",
      both(judged("violation", [contract(ISSUE, "absent")]), judged("violation", [contract(OPEN, "non-standard")])),
    ],
    ["error types imported from a module the snapshot lacks", "unreferenced", unresolvedBoth("missing-referent")],
    ["return types only the bodies state", "inferred", unresolvedBoth("expression-inference-required")],
    ["a mapped type without the mapped operations", "undeclared", unresolvedBoth("target-missing")],
  ];
  test.each(SHARED)(
    "%s",
    async (_label, module, expected) => {
      const observed = await Promise.all(PROJECTS.map((project) => judgedAt(project, module)));
      expect(observed).toEqual(PROJECTS.map((project) => ({ project: project.name, ...expected })));
    },
    TIMEOUT,
  );

  const PER_LANGUAGE: [string, string, Record<"rust" | "typescript", Expected>][] = [
    [
      "an application type named Result is never the standard result",
      "shadowed",
      {
        // The Rust extractor resolves the local declaration as a non-standard result before refusing its
        // case set; the TypeScript extractor refuses the result itself.
        rust: both(
          judged("unresolved", [contract(ISSUE, "non-standard")], ["shadowed-result-identity"]),
          judged("unresolved", [contract(OPEN, "non-standard")], ["shadowed-result-identity"]),
        ),
        typescript: unresolvedBoth("shadowed-result-identity"),
      },
    ],
    [
      "an error set left open never passes",
      "widened",
      { rust: unresolvedBoth("incomplete-case-set"), typescript: unresolvedBoth("open-error-type") },
    ],
  ];
  test.each(PER_LANGUAGE)(
    "%s",
    async (_label, module, expected) => {
      const observed = await Promise.all(PROJECTS.map((project) => judgedAt(project, module)));
      expect(observed).toEqual(PROJECTS.map((project) => ({ project: project.name, ...expected[project.language] })));
    },
    TIMEOUT,
  );

  test(
    "an open Rust enum keeps the cases outside the mapping it does list",
    async () => {
      expect(await judgedAt(RUST, "open_extra")).toEqual({
        project: RUST.name,
        ...both(
          judged("unresolved", [unexpected(ISSUE)], ["incomplete-case-set"]),
          judged("unresolved", [foreign(OPEN, ALREADY_ISSUED, ISSUE)], ["incomplete-case-set"]),
        ),
      });
    },
    TIMEOUT,
  );
});

// ---------------------------------------------------------------------------
// Changed mapping, model or snapshot
// ---------------------------------------------------------------------------

describe.each(PROJECT_TABLE)(
  "the %s path never judges a changed request from an earlier observation",
  (_name, project) => {
    test(
      "a renamed method is observed afresh, and the earlier observation is an identity mismatch",
      async () => {
        const before = await run(project, mappingAt(project, "invoice"), scenarioSources(project.name));
        const renamed = withMethod(mappingAt(project, "invoice"), ISSUE, "issue_invoice");
        const after = await run(project, renamed, scenarioSources(project.name));
        expect(after.request.requestIdentity).not.toBe(before.request.requestIdentity);
        expect(judgement(after.result, ISSUE)).toEqual(judged("unresolved", [], ["target-missing"]));
        expect(judgement(after.result, OPEN)).toEqual(PASS);

        const reused = evaluate(after.request, before.observed.executions);
        expect(judgement(reused, ISSUE)).toEqual(judged("unresolved", [], ["identity-mismatch"]));
        expect(judgement(reused, OPEN)).toEqual(PASS);
      },
      TIMEOUT,
    );

    test(
      "a respelled case is judged afresh against the same observation",
      async () => {
        const before = await run(project, mappingAt(project, "invoice"), scenarioSources(project.name));
        const respelled = withCase(mappingAt(project, "invoice"), EMPTY_LINES, project.spelling.noLines);
        const request = prepare({ model: MODEL, mapping: respelled, observations: before.observed.observations });
        expect(request.requestIdentity).not.toBe(before.request.requestIdentity);

        const result = evaluate(request, before.observed.executions);
        expect(judgement(result, ISSUE)).toEqual(judged("violation", [missing(ISSUE, EMPTY_LINES), unexpected(ISSUE)]));
        expect(judgement(result, OPEN)).toEqual(PASS);
      },
      TIMEOUT,
    );

    test(
      "an error added to the model is judged afresh, and a schema_version 1 model is refused",
      async () => {
        const before = await run(project, mappingAt(project, "invoice"), scenarioSources(project.name));
        const cases = Object.fromEntries(
          mappingAt(project, "invoice").operations.flatMap((operation) =>
            operation.errors.map((entry) => [entry.error_ref, entry.code.case]),
          ),
        );
        const mapping = withMappedErrors(mappingAt(project, "invoice"), ISSUE, [
          [ALREADY_ISSUED, cases[ALREADY_ISSUED]],
          [EMPTY_LINES, cases[EMPTY_LINES]],
          [LOCKED, project.spelling.locked],
        ]);
        const request = prepare({
          model: withModelError(MODEL, ISSUE, LOCKED),
          mapping,
          observations: before.observed.observations,
        });
        expect(request.requestIdentity).not.toBe(before.request.requestIdentity);

        const result = evaluate(request, before.observed.executions);
        expect(judgement(result, ISSUE)).toEqual(judged("violation", [missing(ISSUE, LOCKED)]));
        expect(judgement(result, OPEN)).toEqual(PASS);

        const legacy = prepareOperationErrorSetRequest({
          model: { ...MODEL, schema_version: 1 },
          mapping: mappingAt(project, "invoice"),
          observations: before.observed.observations,
        });
        expect(legacy.kind).toBe("input-rejected");
      },
      TIMEOUT,
    );

    test(
      "changed source is judged from a new snapshot, and the earlier observation is an identity mismatch",
      async () => {
        const mapping = mappingAt(project, "invoice");
        const before = await run(project, mapping, scenarioSources(project.name));
        const after = await run(project, mapping, changedSources(project));
        expect(after.request.requestIdentity).not.toBe(before.request.requestIdentity);
        expect(judgement(after.result, ISSUE)).toEqual(judged("violation", [missing(ISSUE, EMPTY_LINES)]));
        expect(judgement(after.result, OPEN)).toEqual(PASS);

        const reused = evaluate(after.request, before.observed.executions);
        expect(judgement(reused, ISSUE)).toEqual(judged("unresolved", [], ["identity-mismatch"]));
        expect(judgement(reused, OPEN)).toEqual(judged("unresolved", [], ["identity-mismatch"]));
      },
      TIMEOUT,
    );

    test(
      "observations of two snapshots are refused together",
      async () => {
        const mapping = mappingAt(project, "invoice");
        const [before, after] = await Promise.all([
          project.observe(mapping, scenarioSources(project.name)),
          project.observe(mapping, changedSources(project)),
        ]);
        const take = (observed: Observed, operationRef: string) => {
          const found = observed.observations.find((entry) => entry.operationRef === operationRef);
          if (!found) throw new Error(`no observation of ${operationRef}`);
          return found;
        };
        const outcome = prepareOperationErrorSetRequest({
          model: MODEL,
          mapping,
          observations: [take(before, ISSUE), take(after, OPEN)],
        });
        expect(outcome.kind).toBe("input-rejected");
      },
      TIMEOUT,
    );
  },
);

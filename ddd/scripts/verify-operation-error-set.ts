/**
 * Verifies the operation error-set comparison over the shared scenario from the Rust path and both
 * TypeScript paths, and records its evidence.
 *
 * Every expectation below is written from the scenario, not copied from a run. Each path is compared
 * with it, and a changed mapping, model or snapshot is checked never to reuse an earlier observation.
 * Whether a compiler accepts a scenario module is not measured: several modules are written not to.
 */
import { join, resolve } from "node:path";
import ts from "typescript";
import type { AggregateMapping } from "../tools/ddd/lib/aggregate-mapping/contract.ts";
import type { ReasonCode, SourceInput } from "../tools/ddd/lib/error-contract/contract.ts";
import type { ComparisonResult, Finding } from "../tools/ddd/lib/operation-error-set/index.ts";
import {
  inspectOperationErrorSet,
  prepareOperationErrorSetRequest,
  SCHEMA_VERSION,
} from "../tools/ddd/lib/operation-error-set/index.ts";
import { observeRustOperations } from "../tools/ddd/lib/operation-error-set-verification/rust.ts";
import {
  loadScenarioMapping,
  loadScenarioModel,
  type ObservedOperations,
  RUST_PACKAGE_LAYOUT,
  type ScenarioProject,
  scenarioSources,
  TYPESCRIPT_PACKAGE_LAYOUT,
} from "../tools/ddd/lib/operation-error-set-verification/scenario.ts";
import { observeTypeScriptOperations } from "../tools/ddd/lib/operation-error-set-verification/typescript.ts";
import type {
  RustModuleLayout,
  TypeScriptCodeRepresentation,
  TypeScriptModuleLayout,
} from "../tools/ddd/lib/project-settings/contract.ts";
import { projectSettingsPayload } from "../tools/ddd/lib/project-settings/payload.ts";
import type { DomainModel } from "../tools/ddd/lib/schema/model.ts";

const root = resolve(import.meta.dir, "..");

const ISSUE = "command.invoice.issue";
const OPEN = "factory.invoice.open";
const ALREADY_ISSUED = "error.invoice.issue.already-issued";
const EMPTY_LINES = "error.invoice.issue.empty-lines";
const NEGATIVE_AMOUNT = "error.invoice.open.negative-amount";
const MISSING_CUSTOMER = "error.invoice.open.missing-customer";
/** An error the scenario model gains when the model change is checked. */
const LOCKED = "error.invoice.issue.locked";

type Language = "rust" | "typescript";

/** What a finding means independently of the language; the operation is the key it is recorded under. */
interface Meaning {
  readonly code: Finding["code"];
  readonly error?: string;
  readonly owner?: string;
  readonly detail?: string;
}
interface Judgement {
  readonly rule_result: string;
  readonly findings: readonly Meaning[];
  readonly reasons: readonly string[];
}
interface Expected {
  readonly issue: Judgement;
  readonly open: Judgement;
}

function byJson<T>(a: T, b: T): number {
  const [left, right] = [JSON.stringify(a), JSON.stringify(b)];
  return left < right ? -1 : left > right ? 1 : 0;
}
function judged(ruleResult: string, findings: readonly Meaning[] = [], reasons: readonly ReasonCode[] = []): Judgement {
  return { rule_result: ruleResult, findings: [...findings].sort(byJson), reasons: [...reasons].sort() };
}
const PASS = judged("pass");
const missing = (error: string): Meaning => ({ code: "missing-error", error });
const UNEXPECTED: Meaning = { code: "unexpected-case" };
const foreign = (error: string, owner: string): Meaning => ({ code: "foreign-error", error, owner });
const contract = (detail: string): Meaning => ({ code: "result-contract", detail });
const unresolved = (reason: ReasonCode): Expected => ({
  issue: judged("unresolved", [], [reason]),
  open: judged("unresolved", [], [reason]),
});
const shared = (expected: Expected): Readonly<Record<Language, Expected>> => ({ rust: expected, typescript: expected });

function meaningOf(finding: Finding): Meaning {
  switch (finding.code) {
    case "missing-error":
      return { code: finding.code, error: finding.errorRef };
    case "unexpected-case":
      return { code: finding.code };
    case "foreign-error":
      return { code: finding.code, error: finding.errorRef, owner: finding.owner };
    case "result-contract":
      return { code: finding.code, detail: finding.detail };
  }
}
function judgementOf(result: ComparisonResult, operationRef: string): Judgement {
  const found = result.operations.filter((entry) => entry.operationRef === operationRef);
  if (found.length !== 1) throw new Error(`expected one result for ${operationRef}, found ${found.length}`);
  return {
    rule_result: found[0].ruleResult,
    findings: found[0].findings.map(meaningOf).sort(byJson),
    reasons: [...new Set(found[0].unresolvedReasons.map((reason) => reason.code))].sort(),
  };
}

/** Each module of a project is one scenario; `open_extra` exists in the Rust workspace only. */
const SCENARIOS: { module: string; description: string; expected: Partial<Record<Language, Expected>> }[] = [
  { module: "invoice", description: "the mapped closed sets", expected: shared({ issue: PASS, open: PASS }) },
  {
    module: "missing",
    description: "a case each operation leaves out",
    expected: shared({
      issue: judged("violation", [missing(EMPTY_LINES)]),
      open: judged("violation", [missing(MISSING_CUSTOMER)]),
    }),
  },
  {
    module: "extra",
    description: "a case no operation maps",
    expected: shared({ issue: judged("violation", [UNEXPECTED]), open: judged("violation", [UNEXPECTED]) }),
  },
  {
    module: "foreign",
    description: "a case the other operation maps",
    expected: shared({
      issue: judged("violation", [foreign(NEGATIVE_AMOUNT, OPEN)]),
      open: judged("violation", [foreign(ALREADY_ISSUED, ISSUE)]),
    }),
  },
  {
    module: "contract",
    description: "no result contract, and a result that is not the standard result",
    expected: shared({
      issue: judged("violation", [contract("absent")]),
      open: judged("violation", [contract("non-standard")]),
    }),
  },
  {
    module: "shadowed",
    description: "an application type named Result",
    expected: {
      rust: {
        issue: judged("unresolved", [contract("non-standard")], ["shadowed-result-identity"]),
        open: judged("unresolved", [contract("non-standard")], ["shadowed-result-identity"]),
      },
      typescript: unresolved("shadowed-result-identity"),
    },
  },
  {
    module: "widened",
    description: "an error set left open",
    expected: { rust: unresolved("incomplete-case-set"), typescript: unresolved("open-error-type") },
  },
  {
    module: "unreferenced",
    description: "error types imported from a module the snapshot lacks",
    expected: shared(unresolved("missing-referent")),
  },
  {
    module: "inferred",
    description: "return types only the bodies state",
    expected: shared(unresolved("expression-inference-required")),
  },
  {
    module: "undeclared",
    description: "a mapped type without the mapped operations",
    expected: shared(unresolved("target-missing")),
  },
  {
    module: "open_extra",
    description: "an open enum that also lists cases outside its own mapping",
    expected: {
      rust: {
        issue: judged("unresolved", [UNEXPECTED], ["incomplete-case-set"]),
        open: judged("unresolved", [foreign(ALREADY_ISSUED, ISSUE)], ["incomplete-case-set"]),
      },
    },
  },
];

interface Project {
  readonly name: ScenarioProject;
  readonly language: Language;
  readonly observe: (mapping: AggregateMapping, sources: readonly SourceInput[]) => Promise<ObservedOperations>;
  /** The mapped module's command error type, before and after one case is dropped from it. */
  readonly dropEmptyLines: { readonly file: string; readonly from: string; readonly to: string };
  readonly lockedCase: string;
}
const TYPESCRIPT_DROP = {
  file: "billing-domain/src/invoice.ts",
  from: '"already-issued" | "empty-lines";',
  to: '"already-issued";',
};
const RUST: Project = {
  name: "rust",
  language: "rust",
  observe: (mapping, sources) => observeRustOperations(mapping, sources),
  dropEmptyLines: {
    file: "billing-domain/src/invoice.rs",
    from: "    AlreadyIssued,\n    EmptyLines,\n}",
    to: "    AlreadyIssued,\n}",
  },
  lockedCase: "Locked",
};
const PROJECTS: readonly Project[] = [
  RUST,
  {
    name: "typescript-class",
    language: "typescript",
    observe: async (mapping, sources) => observeTypeScriptOperations("class", mapping, sources),
    dropEmptyLines: TYPESCRIPT_DROP,
    lockedCase: "locked",
  },
  {
    name: "typescript-companion",
    language: "typescript",
    observe: async (mapping, sources) => observeTypeScriptOperations("companion", mapping, sources),
    dropEmptyLines: TYPESCRIPT_DROP,
    lockedCase: "locked",
  },
];

const MODEL = loadScenarioModel();
const MAPPINGS: Readonly<Record<Language, AggregateMapping>> = {
  rust: loadScenarioMapping("rust"),
  typescript: loadScenarioMapping("typescript"),
};
const problems: string[] = [];

function mappingAt(project: Project, module: string): AggregateMapping {
  const mapping = MAPPINGS[project.language];
  return { ...mapping, code: { ...mapping.code, module: [module] } };
}
/** The mapping of a project pointed at one module of one package of that project. */
function packageMappingAt(project: Project, packageName: string, module: string): AggregateMapping {
  const mapping = mappingAt(project, module);
  return { ...mapping, code: { ...mapping.code, package: packageName } };
}
function withOperation(
  mapping: AggregateMapping,
  change: (operation: AggregateMapping["operations"][number]) => AggregateMapping["operations"][number],
): AggregateMapping {
  return {
    ...mapping,
    operations: mapping.operations.map((operation) =>
      operation.operation_ref === ISSUE ? change(operation) : operation,
    ),
  };
}
function modelWithLocked(): DomainModel {
  const copy = structuredClone(MODEL);
  const commands = copy.bounded_contexts
    .flatMap((context) => context.aggregates)
    .flatMap((aggregate) => aggregate.commands)
    .filter((command) => command.element_id === ISSUE);
  if (commands.length !== 1) throw new Error(`the scenario model does not state ${ISSUE} once`);
  commands[0].domain_errors.push({
    element_id: LOCKED,
    name: "Locked",
    operation: ISSUE,
    condition: "請求書はロック中である。",
  });
  return copy;
}
function changedSources(project: Project): SourceInput[] {
  const { file, from, to } = project.dropEmptyLines;
  const sources = scenarioSources(project.name);
  const target = sources.find((source) => source.path === file);
  if (!target?.content.includes(from)) throw new Error(`${project.name}: ${file} no longer declares the dropped case`);
  return sources.map((source) =>
    source === target ? { ...source, content: source.content.replace(from, to) } : source,
  );
}

async function run(project: Project, mapping: AggregateMapping, sources: readonly SourceInput[]) {
  const observed = await project.observe(mapping, sources);
  const prepared = prepareOperationErrorSetRequest({ model: MODEL, mapping, observations: observed.observations });
  if (prepared.kind !== "prepared") throw new Error(`${project.name}: preparation refused ${JSON.stringify(prepared)}`);
  return { observed, request: prepared.request, result: evaluate(project, prepared.request, observed.executions) };
}
function evaluate(project: Project, request: unknown, executions: unknown): ComparisonResult {
  const outcome = inspectOperationErrorSet(request, executions);
  if (outcome.kind !== "evaluated") throw new Error(`${project.name}: inspection refused ${JSON.stringify(outcome)}`);
  return outcome.result;
}
function both(result: ComparisonResult): Expected {
  return { issue: judgementOf(result, ISSUE), open: judgementOf(result, OPEN) };
}
function check(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    problems.push(`${label}: expected ${JSON.stringify(expected)}, read ${JSON.stringify(actual)}`);
}

async function scenarioResults() {
  const rows = [];
  for (const scenario of SCENARIOS) {
    const results: Partial<Record<ScenarioProject, Expected>> = {};
    for (const project of PROJECTS) {
      const expected = scenario.expected[project.language];
      if (!expected) continue;
      const { result } = await run(project, mappingAt(project, scenario.module), scenarioSources(project.name));
      results[project.name] = both(result);
      check(`${project.name} ${scenario.module}`, results[project.name], expected);
    }
    rows.push({ module: scenario.module, description: scenario.description, results });
  }
  return rows;
}

/**
 * Where each project module layout places the mapped module. Written from the layout contract, not
 * read from the path under test, so a path that answered one layout for every package fails one of
 * the two rows.
 */
const RUST_LAYOUT_FILE: Readonly<Record<RustModuleLayout, (packageName: string, module: string) => string>> = {
  file: (packageName, module) => `${packageName}/src/${module}.rs`,
  "mod-rs": (packageName, module) => `${packageName}/src/${module}/mod.rs`,
};
/**
 * The same for the TypeScript project module layouts, under the source root the project settings
 * state. `index-file` writes a module with children as its directory entry, and the scenario gives
 * every module of that package a child.
 */
const TYPESCRIPT_LAYOUT_FILE: Readonly<
  Record<TypeScriptModuleLayout, (packageName: string, module: string) => string>
> = {
  "named-file": (packageName, module) => `${packageName}/src/${module}.ts`,
  "index-file": (packageName, module) => `${packageName}/src/${module}/index.ts`,
};
function scenarioModule(
  language: Language,
  module: string,
): { module: string; description: string; expected: Expected } {
  const scenario = SCENARIOS.find((entry) => entry.module === module);
  if (!scenario) throw new Error(`the scenario table does not state ${module}`);
  const expected = scenario.expected[language];
  if (!expected) throw new Error(`the scenario table does not judge ${module} from ${language}`);
  return { module, description: scenario.description, expected };
}
/**
 * The modules read from every layout. The scenario that owns a module states its judgement, which
 * the layout does not change, so a module the scenario does not judge from the language stops the run.
 */
const LAYOUT_MODULES = (language: Language) => [
  scenarioModule(language, "invoice"),
  scenarioModule(language, "missing"),
];

/**
 * The Rust workspace owns one package per project module layout, and a mapping reaches either by
 * naming its package. The scenarios above are read from the `file` package; this reads every package
 * the scenario writes, so the same judgements are recorded from both layouts, against the file and
 * the settings each layout gives the mapped module.
 */
async function moduleLayoutResults() {
  const rows = [];
  for (const [packageName, layout] of RUST_PACKAGE_LAYOUT) {
    const settings = projectSettingsPayload({ languages: ["rust"], rust: { moduleLayout: layout }, typescript: null });
    for (const entry of LAYOUT_MODULES("rust")) {
      const { observed, result } = await run(
        RUST,
        packageMappingAt(RUST, packageName, entry.module),
        scenarioSources(RUST.name),
      );
      const observedFiles = [...new Set(observed.observations.map(({ request }) => request.target.file))];
      const results = both(result);
      const label = `rust ${layout} ${entry.module}`;
      check(label, results, entry.expected);
      check(`${label} file`, observedFiles, [RUST_LAYOUT_FILE[layout](packageName, entry.module)]);
      for (const { operationRef, request } of observed.observations)
        check(`${label} settings of ${operationRef}`, request.settings, settings);
      rows.push({
        package: packageName,
        module_layout: layout,
        module: entry.module,
        description: entry.description,
        files: observedFiles,
        results,
      });
    }
  }
  return rows;
}

/** The code representation each TypeScript project is written in, which its settings name. */
const REPRESENTATION: Readonly<Partial<Record<ScenarioProject, TypeScriptCodeRepresentation>>> = {
  "typescript-class": "class",
  "typescript-companion": "companion",
};

/**
 * Each TypeScript project owns one package per project module layout as well, and is read the same
 * way from both, in each code representation.
 */
async function typeScriptModuleLayoutResults() {
  const rows = [];
  for (const project of PROJECTS.filter((entry) => entry.language === "typescript")) {
    const codeRepresentation = REPRESENTATION[project.name];
    if (!codeRepresentation) throw new Error(`${project.name} names no code representation`);
    for (const [packageName, layout] of TYPESCRIPT_PACKAGE_LAYOUT) {
      const settings = projectSettingsPayload({
        languages: ["typescript"],
        rust: null,
        typescript: { moduleLayout: layout, codeRepresentation },
      });
      for (const entry of LAYOUT_MODULES("typescript")) {
        const { observed, result } = await run(
          project,
          packageMappingAt(project, packageName, entry.module),
          scenarioSources(project.name),
        );
        const observedFiles = [...new Set(observed.observations.map(({ request }) => request.target.file))];
        const results = both(result);
        const label = `${project.name} ${layout} ${entry.module}`;
        check(label, results, entry.expected);
        check(`${label} file`, observedFiles, [TYPESCRIPT_LAYOUT_FILE[layout](packageName, entry.module)]);
        for (const { operationRef, request } of observed.observations)
          check(`${label} settings of ${operationRef}`, request.settings, settings);
        rows.push({
          project: project.name,
          package: packageName,
          module_layout: layout,
          module: entry.module,
          description: entry.description,
          files: observedFiles,
          results,
        });
      }
    }
  }
  return rows;
}

/** A changed mapping, model or snapshot is judged afresh, and an earlier observation is never reused. */
async function changeResults(project: Project) {
  const mapping = mappingAt(project, "invoice");
  const sources = scenarioSources(project.name);
  const before = await run(project, mapping, sources);
  const identityChanged = (after: { readonly requestIdentity: string }) =>
    after.requestIdentity !== before.request.requestIdentity;

  const renamed = await run(
    project,
    withOperation(mapping, (operation) => ({ ...operation, code: { ...operation.code, method: "issue_invoice" } })),
    sources,
  );
  const renamedReuse = both(evaluate(project, renamed.request, before.observed.executions));
  check(
    `${project.name} mapped method`,
    [identityChanged(renamed.request), both(renamed.result).issue],
    [true, judged("unresolved", [], ["target-missing"])],
  );
  check(`${project.name} mapped method, earlier observation`, renamedReuse, {
    issue: judged("unresolved", [], ["identity-mismatch"]),
    open: PASS,
  });

  const locked = withOperation(mapping, (operation) => ({
    ...operation,
    errors: [...operation.errors, { error_ref: LOCKED, code: { case: project.lockedCase } }],
  }));
  const extended = prepareOperationErrorSetRequest({
    model: modelWithLocked(),
    mapping: locked,
    observations: before.observed.observations,
  });
  if (extended.kind !== "prepared") throw new Error(`${project.name}: the extended model was refused`);
  const extendedResult = both(evaluate(project, extended.request, before.observed.executions));
  check(
    `${project.name} model content`,
    [identityChanged(extended.request), extendedResult],
    [true, { issue: judged("violation", [missing(LOCKED)]), open: PASS }],
  );
  const legacy = prepareOperationErrorSetRequest({
    model: { ...MODEL, schema_version: 1 },
    mapping,
    observations: before.observed.observations,
  });
  check(`${project.name} model version`, legacy.kind, "input-rejected");

  const changed = changedSources(project);
  const after = await run(project, mapping, changed);
  const afterReuse = both(evaluate(project, after.request, before.observed.executions));
  check(
    `${project.name} snapshot`,
    [identityChanged(after.request), both(after.result)],
    [true, { issue: judged("violation", [missing(EMPTY_LINES)]), open: PASS }],
  );
  check(`${project.name} snapshot, earlier observation`, afterReuse, unresolved("identity-mismatch"));

  const take = (observed: ObservedOperations, operationRef: string) =>
    observed.observations.filter((entry) => entry.operationRef === operationRef);
  const mixed = prepareOperationErrorSetRequest({
    model: MODEL,
    mapping,
    observations: [...take(before.observed, ISSUE), ...take(after.observed, OPEN)],
  });
  check(`${project.name} mixed snapshots`, mixed.kind, "input-rejected");

  const otherLanguage = prepareOperationErrorSetRequest({
    model: MODEL,
    mapping: MAPPINGS[project.language === "rust" ? "typescript" : "rust"],
    observations: before.observed.observations,
  });
  check(`${project.name} observations for the other language`, otherLanguage.kind, "input-rejected");

  return {
    project: project.name,
    request_identity: before.request.requestIdentity,
    mapped_method: {
      identity_changed: identityChanged(renamed.request),
      fresh: both(renamed.result),
      earlier_observation: renamedReuse,
    },
    model_content: { identity_changed: identityChanged(extended.request), result: extendedResult },
    model_version_1: legacy.kind,
    snapshot: {
      identity_changed: identityChanged(after.request),
      fresh: both(after.result),
      earlier_observation: afterReuse,
    },
    mixed_snapshots: mixed.kind,
    observations_for_the_other_language: otherLanguage.kind,
  };
}

function version(argv: string[]): string {
  const result = Bun.spawnSync(argv, { cwd: root, stdout: "pipe", stderr: "pipe" });
  return result.stdout.toString().trim();
}

try {
  const scenarios = await scenarioResults();
  const moduleLayouts = await moduleLayoutResults();
  const typeScriptModuleLayouts = await typeScriptModuleLayoutResults();
  const changes = [];
  for (const project of PROJECTS) changes.push(await changeResults(project));
  const report = {
    contract: SCHEMA_VERSION,
    error_contract: "error-contract/1",
    platform: `${process.platform}-${process.arch}`,
    versions: {
      rustc: version(["rustc", "--version"]),
      cargo: version(["cargo", "--version"]),
      bun: Bun.version,
      typescript: ts.version,
      syn: "3.0.5",
    },
    projects: PROJECTS.map((project) => ({ name: project.name, language: project.language })),
    scenarios,
    rust_module_layouts: moduleLayouts,
    typescript_module_layouts: typeScriptModuleLayouts,
    changes,
    unverified: [
      "matching the mapped error type spelling against the resolved declaration name",
      "compiler acceptance of the scenario modules",
      "production sensor and approval gate integration",
      "error paths, state preservation and invariants of a running application",
    ],
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--write"))
    await Bun.write(join(root, "docs/developers/evidence/operation-error-set.json"), output);
  console.log(output);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

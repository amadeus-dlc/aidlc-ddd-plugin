/**
 * Verifies the fixed TypeScript business-error contract scenario and records its evidence.
 *
 * Resolution and compiler acceptance are measured separately: the extractor
 * resolves one operation from the frozen snapshot, and a second program built
 * from the project's own tsconfig is the only source of acceptance here.
 *
 * Nothing in this gate needs a Rust toolchain or a native executable.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import type { ContractResult, ReasonCode, TypeScriptCondition } from "../tools/ddd/lib/error-contract/index.ts";
import { resolveErrorContract } from "../tools/ddd/lib/error-contract/index.ts";
import { freezeInput } from "../tools/ddd/lib/error-contract-verification/input.ts";
import {
  TYPESCRIPT_RESULT,
  TYPESCRIPT_SELECTION,
  TYPESCRIPT_WORKSPACE,
  type TypeScriptPackageName,
  typeScriptWorkspaceSources,
} from "../tools/ddd/lib/error-contract-verification/typescript-scenario.ts";
import { projectSettingsPayload } from "../tools/ddd/lib/project-settings/payload.ts";
import {
  extractTypeScriptErrorContract,
  resolveTypeScriptCondition,
  TS_ERROR_CONTRACT_TOOLCHAIN,
} from "../tools/ddd/lib/typescript/error-contract/index.ts";

const root = resolve(import.meta.dir, "..");

/**
 * The modules of the fixed scenario the compiler is expected to reject, why, and
 * the diagnostics it is expected to report for each. Every other module of the
 * project must type check, so a refusal by resolution can never be mistaken for
 * a refusal by the compiler. The diagnostic code, not the message, is what this
 * gate compares: a rejection that moves to another cause is a changed scenario
 * even when the same module is still rejected, and a reworded message is not.
 */
const REJECTED_MODULES: Record<string, { readonly reason: string; readonly codes: readonly number[] }> = {
  "billing-domain/src/limits/cycle.ts": {
    // The unresolved chain also leaves each alias without its arity, which is
    // why the circularity is reported alongside a use that is not generic.
    reason: "a type alias chain that references itself",
    codes: [2315, 2456],
  },
  "billing-domain/src/limits/missing.ts": {
    reason: "an import whose module is not in the project",
    codes: [2307],
  },
};

/** Each case states the reference form it is written in and the one reason it reports. */
const CASES: {
  name: string;
  owner: TypeScriptPackageName;
  file: string;
  declarationPath: string[];
  operation: string;
  step: string | null;
  expected: ReasonCode | null;
}[] = [
  {
    name: "declared-name",
    owner: "billing-domain",
    file: "billing-domain/src/invoice.ts",
    declarationPath: ["Invoice"],
    operation: "issue",
    step: "direct",
    expected: null,
  },
  {
    name: "import-alias",
    owner: "billing-domain",
    file: "billing-domain/src/invoice.ts",
    declarationPath: ["Invoice"],
    operation: "renamed",
    step: "import-alias",
    expected: null,
  },
  {
    name: "type-only-import",
    owner: "billing-domain",
    file: "billing-domain/src/invoice.ts",
    declarationPath: ["Invoice"],
    operation: "typeOnly",
    step: "import-type",
    expected: null,
  },
  {
    name: "renamed-re-export",
    owner: "billing-domain",
    file: "billing-domain/src/invoice/line.ts",
    declarationPath: ["Reexported"],
    operation: "issue",
    step: "re-export",
    expected: null,
  },
  {
    name: "transparent-type-alias",
    owner: "billing-domain",
    file: "billing-domain/src/invoice/line.ts",
    declarationPath: ["Aliased"],
    operation: "issue",
    step: "type-alias",
    expected: null,
  },
  {
    name: "package-entry-point",
    owner: "billing-use-case",
    file: "billing-use-case/src/invoice/line.ts",
    declarationPath: ["Line"],
    operation: "viaEntry",
    step: "package-entry",
    expected: null,
  },
  {
    name: "path-into-internals",
    owner: "billing-use-case",
    file: "billing-use-case/src/invoice/line.ts",
    declarationPath: ["Line"],
    operation: "viaInternalPath",
    step: "internal-path",
    expected: null,
  },
  {
    name: "companion-generation-method",
    owner: "billing-use-case",
    file: "billing-use-case/src/invoice/index.ts",
    declarationPath: ["Entry"],
    operation: "create",
    step: "companion",
    expected: null,
  },
  {
    name: "escape-type",
    owner: "billing-domain",
    file: "billing-domain/src/limits.ts",
    declarationPath: ["EscapeAny"],
    operation: "issue",
    step: null,
    expected: "escape-type",
  },
  {
    name: "open-error-type",
    owner: "billing-domain",
    file: "billing-domain/src/limits.ts",
    declarationPath: ["WideUnion"],
    operation: "issue",
    step: null,
    expected: "open-error-type",
  },
  {
    name: "unchecked-assertion",
    owner: "billing-domain",
    file: "billing-domain/src/limits.ts",
    declarationPath: ["Asserted"],
    operation: "issue",
    step: null,
    expected: "unchecked-assertion",
  },
  {
    name: "expression-inference-required",
    owner: "billing-domain",
    file: "billing-domain/src/limits.ts",
    declarationPath: ["Documented"],
    operation: "issue",
    step: null,
    expected: "expression-inference-required",
  },
  {
    name: "shadowed-result-identity",
    owner: "billing-domain",
    file: "billing-domain/src/limits/shadowed.ts",
    declarationPath: ["Shadowed"],
    operation: "issue",
    step: null,
    expected: "shadowed-result-identity",
  },
  {
    name: "missing-referent",
    owner: "billing-domain",
    file: "billing-domain/src/limits/missing.ts",
    declarationPath: ["MissingReferent"],
    operation: "issue",
    step: null,
    expected: "missing-referent",
  },
  {
    name: "alias-cycle",
    owner: "billing-domain",
    file: "billing-domain/src/limits/cycle.ts",
    declarationPath: ["Cyclic"],
    operation: "issue",
    step: null,
    expected: "alias-cycle",
  },
];

function inspect(
  condition: TypeScriptCondition,
  sources: ReturnType<typeof typeScriptWorkspaceSources>,
  entry: (typeof CASES)[number],
): ContractResult {
  const owner = condition.packages.find((candidate) => candidate.name === entry.owner);
  if (!owner) throw new Error(`condition has no package ${entry.owner}`);
  const frozen = freezeInput({
    language: "typescript",
    typeScriptCondition: condition,
    target: {
      packageId: owner.packageId,
      targetName: owner.tsconfigPath,
      file: entry.file,
      declarationPath: entry.declarationPath,
      operation: entry.operation,
    },
    sources,
    settings: projectSettingsPayload({
      languages: ["typescript"],
      rust: null,
      typescript: TYPESCRIPT_SELECTION[entry.owner],
    }),
    toolchain: TS_ERROR_CONTRACT_TOOLCHAIN,
  });
  const outcome = resolveErrorContract(frozen.request, {
    status: "completed",
    response: extractTypeScriptErrorContract(frozen),
  });
  if (outcome.kind !== "evaluated") throw new Error(`contract rejected the request: ${JSON.stringify(outcome)}`);
  return outcome.result;
}

const parseHost: ts.ParseConfigHost = {
  useCaseSensitiveFileNames: true,
  readDirectory: (path, extensions, exclude, include, depth) =>
    ts.sys.readDirectory(path, extensions, exclude, include, depth),
  fileExists: (path) => existsSync(path),
  readFile: (path) => (existsSync(path) ? readFileSync(path, "utf8") : undefined),
};
function parsed(configPath: string): ts.ParsedCommandLine {
  return ts.parseJsonConfigFileContent(
    ts.readConfigFile(configPath, (file) => parseHost.readFile(file)).config,
    parseHost,
    dirname(configPath),
    undefined,
    configPath,
  );
}

/**
 * The fixed scenario is type checked only here, from its own tsconfig and its own
 * package manifests. The manifests stand in for the workspace links a package
 * manager would install, so acceptance never borrows the inspection's own answer
 * about which file a specifier names.
 */
interface ScenarioDiagnostic {
  readonly code: number;
  readonly text: string;
}
interface ScenarioDiagnostics {
  /** Diagnostics a module of the scenario carries, by project-relative path. */
  readonly modules: Map<string, ScenarioDiagnostic[]>;
  /** Diagnostics the compiler reports for the configuration itself, which name no module. */
  readonly project: ScenarioDiagnostic[];
}
function compileScenario(): ScenarioDiagnostics {
  const references = parsed(join(TYPESCRIPT_WORKSPACE, "tsconfig.json")).projectReferences ?? [];
  const paths: Record<string, string[]> = {};
  for (const reference of references) {
    const manifest = JSON.parse(readFileSync(join(reference.path, "package.json"), "utf8")) as {
      name: string;
      exports: Record<string, string>;
    };
    for (const [subpath, target] of Object.entries(manifest.exports))
      paths[subpath === "." ? manifest.name : `${manifest.name}/${subpath.slice(2)}`] = [join(reference.path, target)];
  }
  const modules = new Map<string, ScenarioDiagnostic[]>();
  const project: ScenarioDiagnostic[] = [];
  const add = (into: ScenarioDiagnostic[], entry: ScenarioDiagnostic): ScenarioDiagnostic[] =>
    into.some((seen) => seen.text === entry.text) ? into : [...into, entry];
  for (const reference of references) {
    const configuration = parsed(join(reference.path, "tsconfig.json"));
    // The path mapping states absolute targets, so it needs no `baseUrl` to be
    // read against: the option is deprecated in this Compiler API version and
    // setting it would reject the scenario configuration itself.
    const program = ts.createProgram(configuration.fileNames, { ...configuration.options, paths, noEmit: true });
    for (const diagnostic of [...configuration.errors, ...ts.getPreEmitDiagnostics(program)]) {
      const entry = {
        code: diagnostic.code,
        text: `${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
      };
      // A configuration or global diagnostic names no file and is kept apart
      // rather than dropped: it rejects the scenario as a whole.
      if (!diagnostic.file) {
        if (!project.some((seen) => seen.text === entry.text)) project.push(entry);
        continue;
      }
      const file = relative(TYPESCRIPT_WORKSPACE, diagnostic.file.fileName).split(sep).join("/");
      modules.set(file, add(modules.get(file) ?? [], entry));
    }
  }
  return { modules, project };
}

const problems: string[] = [];
try {
  const resolution = resolveTypeScriptCondition({
    workspaceRoot: TYPESCRIPT_WORKSPACE,
    resultDefinition: TYPESCRIPT_RESULT,
  });
  if (resolution.kind !== "resolved")
    throw new Error(`project condition unavailable: ${JSON.stringify(resolution.reasons)}`);
  const condition = resolution.condition;
  const sources = typeScriptWorkspaceSources();

  // The same operation under two project conditions must not reuse the earlier answer.
  const withdrawn: TypeScriptCondition = {
    ...condition,
    packages: condition.packages.map((entry) =>
      entry.name === "billing-domain"
        ? { ...entry, entryPoints: entry.entryPoints.filter((point) => point.subpath !== ".") }
        : entry,
    ),
  };
  const entryCase = CASES.find((entry) => entry.name === "package-entry-point");
  if (!entryCase) throw new Error("the package entry point case is missing");
  const published = inspect(condition, sources, entryCase);
  const unpublished = inspect(withdrawn, sources, entryCase);
  if (published.requestIdentity === unpublished.requestIdentity)
    problems.push("a changed project condition did not change the request identity");
  if (!unpublished.unresolvedReasons.some((reason) => reason.code === "missing-referent"))
    problems.push("withdrawing an entry point did not withdraw the reference that used it");

  const compiled = compileScenario();
  const rejected = [...compiled.modules.keys()].sort();
  const expectedRejected = Object.keys(REJECTED_MODULES).sort();
  if (JSON.stringify(rejected) !== JSON.stringify(expectedRejected))
    problems.push(`the compiler rejected ${rejected.join(",") || "no module"}, expected ${expectedRejected.join(",")}`);
  if (compiled.project.length)
    problems.push(
      `the compiler rejected the scenario configuration: ${compiled.project.map((entry) => entry.text).join("; ")}`,
    );
  for (const file of expectedRejected) {
    const read = [...new Set((compiled.modules.get(file) ?? []).map((entry) => entry.code))].sort((a, b) => a - b);
    const expected = [...REJECTED_MODULES[file].codes].sort((a, b) => a - b);
    if (JSON.stringify(read) !== JSON.stringify(expected))
      problems.push(`${file}: expected diagnostic ${expected.join(",")}, read ${read.join(",") || "none"}`);
  }

  const rows = [];
  for (const entry of CASES) {
    const result = inspect(condition, sources, entry);
    const codes = result.unresolvedReasons.map((reason) => reason.code);
    const steps =
      result.evidence?.operationStatus === "resolved" ? result.evidence.resolutionPath.map((step) => step.kind) : [];
    const cases =
      result.evidence?.operationStatus === "resolved" && result.evidence.errorCases.status === "resolved"
        ? result.evidence.errorCases.value.items.map((item) => item.name)
        : [];
    if (entry.expected) {
      if (!codes.includes(entry.expected))
        problems.push(`${entry.name}: expected reason ${entry.expected}, read ${codes.join(",") || "none"}`);
      // A case that must resolve cleanly is the one this gate would otherwise never check.
    } else if (codes.length) problems.push(`${entry.name}: expected no reason, read ${codes.join(",")}`);
    if (entry.step && !steps.includes(entry.step as (typeof steps)[number]))
      problems.push(`${entry.name}: expected step ${entry.step}, read ${steps.join(",") || "none"}`);
    rows.push({
      name: entry.name,
      resolution_step: entry.step,
      // Resolution and acceptance are separate observations: most refused cases compile.
      compiler_accepted: !compiled.modules.has(entry.file),
      error_cases: cases,
      resolution_reasons: codes,
    });
  }

  const report = {
    contract: "error-contract/1",
    language: "typescript",
    platform: `${process.platform}-${process.arch}`,
    versions: { typescript: ts.version, bun: Bun.version },
    project_condition: {
      module: condition.module,
      module_resolution: condition.moduleResolution,
      target: condition.target,
      resolution_conditions: condition.resolutionConditions,
      packages: condition.packages.map((entry) => ({
        name: entry.name,
        version: entry.version,
        entry_points: entry.entryPoints.map((point) => point.subpath),
        project_references: entry.projectReferences.length,
      })),
      result_definition: condition.resultDefinition.modulePath,
    },
    project_conditions: [
      { condition: "published-entry", request_identity: published.requestIdentity },
      { condition: "withdrawn-entry", request_identity: unpublished.requestIdentity },
    ],
    fixed_scenario: expectedRejected.map((file) => ({
      module: file,
      compiler_accepted: false,
      reason: REJECTED_MODULES[file].reason,
      expected_diagnostic_codes: [...REJECTED_MODULES[file].codes],
      compiler_diagnostics: (compiled.modules.get(file) ?? []).map((entry) => entry.text),
    })),
    project_diagnostics: compiled.project.map((entry) => entry.text),
    cases: rows,
    unverified: [
      "arbitrary monorepo layouts and package manifests",
      "conditional and pattern entry points",
      "type features beyond transparent aliases and closed literal unions",
      "third-party result libraries",
      "framework and runtime integration",
      "comparing the case set with canonical errors",
      "production sensor migration",
    ],
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--write"))
    await Bun.write(join(root, "docs/developers/evidence/error-contract-typescript.json"), output);
  console.log(output);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

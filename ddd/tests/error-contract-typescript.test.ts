import { describe, expect, test } from "bun:test";
import type {
  ContractResult,
  ErrorCaseSet,
  JsonValue,
  SourceInput,
  TypeReference,
  TypeScriptCondition,
  TypeScriptPackage,
} from "../tools/ddd/lib/error-contract/contract.ts";
import { validateResponse } from "../tools/ddd/lib/error-contract/evidence.ts";
import { resolveErrorContract } from "../tools/ddd/lib/error-contract/inspection.ts";
import { type FrozenTask, freezeInput } from "../tools/ddd/lib/error-contract-verification/input.ts";
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

const BASE: TypeScriptCondition = (() => {
  const outcome = resolveTypeScriptCondition({
    workspaceRoot: TYPESCRIPT_WORKSPACE,
    resultDefinition: TYPESCRIPT_RESULT,
  });
  if (outcome.kind !== "resolved") throw new Error(`project condition unavailable: ${JSON.stringify(outcome)}`);
  return outcome.condition;
})();
const SOURCES = typeScriptWorkspaceSources();
const SHARED_CASES = ["already-issued", "empty"];

interface Spec {
  package?: TypeScriptPackageName;
  file: string;
  declarationPath: readonly string[];
  operation: string;
  sources?: readonly SourceInput[];
  settings?: { readonly [key: string]: JsonValue };
  condition?: (base: TypeScriptCondition) => TypeScriptCondition;
}
function task(spec: Spec): FrozenTask {
  const owner: TypeScriptPackageName = spec.package ?? "billing-domain";
  const condition = spec.condition ? spec.condition(BASE) : BASE;
  const entry = condition.packages.find((candidate) => candidate.name === owner);
  if (!entry) throw new Error(`condition has no package ${owner}`);
  return freezeInput({
    language: "typescript",
    typeScriptCondition: condition,
    target: {
      packageId: entry.packageId,
      targetName: entry.tsconfigPath,
      file: spec.file,
      declarationPath: [...spec.declarationPath],
      operation: spec.operation,
    },
    sources: spec.sources ?? SOURCES,
    settings:
      spec.settings ??
      projectSettingsPayload({ languages: ["typescript"], rust: null, typescript: TYPESCRIPT_SELECTION[owner] }),
    toolchain: TS_ERROR_CONTRACT_TOOLCHAIN,
  });
}
function inspect(spec: Spec): ContractResult {
  const frozen = task(spec);
  const outcome = resolveErrorContract(frozen.request, {
    status: "completed",
    response: extractTypeScriptErrorContract(frozen),
  });
  if (outcome.kind !== "evaluated") throw new Error(JSON.stringify(outcome));
  return outcome.result;
}
function resolvedEvidence(result: ContractResult) {
  if (result.evidence?.operationStatus !== "resolved")
    throw new Error(`operation unresolved: ${JSON.stringify(result.unresolvedReasons)}`);
  return result.evidence;
}
function errorSymbol(result: ContractResult): string {
  const contract = resolvedEvidence(result).resultContract;
  if (contract.status !== "resolved" || !contract.value.standardResult || contract.value.errorType.kind !== "nominal")
    throw new Error(`no nominal error type: ${JSON.stringify(contract)}`);
  return contract.value.errorType.symbolId;
}
function standardResult(result: ContractResult): boolean {
  const contract = result.evidence?.operationStatus === "resolved" ? result.evidence.resultContract : null;
  return contract?.status === "resolved" && contract.value.standardResult;
}
function caseSet(result: ContractResult): ErrorCaseSet {
  const cases = resolvedEvidence(result).errorCases;
  if (cases.status !== "resolved") throw new Error(`error case set unresolved: ${JSON.stringify(cases)}`);
  return cases.value;
}
function caseNames(result: ContractResult): string[] {
  return caseSet(result).items.map((entry) => entry.name);
}
function stepKinds(result: ContractResult): string[] {
  return resolvedEvidence(result).resolutionPath.map((entry) => entry.kind);
}
function codes(result: ContractResult): string[] {
  return result.unresolvedReasons.map((entry) => entry.code);
}
/** Replaces one source of the fixed snapshot, leaving the workspace on disk alone. */
function withSource(path: string, content: string): SourceInput[] {
  const replaced = SOURCES.map((source) => (source.path === path ? { path, content } : source));
  if (!replaced.some((source) => source.content === content)) throw new Error(`snapshot has no source ${path}`);
  return replaced;
}
function withPackages(base: TypeScriptCondition, extra: readonly TypeScriptPackage[]): TypeScriptCondition {
  return { ...base, packages: [...base.packages, ...extra] };
}
function domainPackage(condition: TypeScriptCondition): TypeScriptPackage {
  const found = condition.packages.find((entry) => entry.name === "billing-domain");
  if (!found) throw new Error("condition has no package billing-domain");
  return found;
}

/** One operation per supported reference form, across both code representations. */
const VARIANTS: [string, TypeScriptPackageName, string, string[], string, string][] = [
  [
    "a name written as it is declared",
    "billing-domain",
    "billing-domain/src/invoice.ts",
    ["Invoice"],
    "issue",
    "direct",
  ],
  ["an import alias", "billing-domain", "billing-domain/src/invoice.ts", ["Invoice"], "renamed", "import-alias"],
  ["a type-only import", "billing-domain", "billing-domain/src/invoice.ts", ["Invoice"], "typeOnly", "import-type"],
  ["a renamed re-export", "billing-domain", "billing-domain/src/invoice/line.ts", ["Reexported"], "issue", "re-export"],
  [
    "a transparent type alias",
    "billing-domain",
    "billing-domain/src/invoice/line.ts",
    ["Aliased"],
    "issue",
    "type-alias",
  ],
  [
    "a declared package entry point",
    "billing-use-case",
    "billing-use-case/src/invoice/line.ts",
    ["Line"],
    "viaEntry",
    "package-entry",
  ],
  [
    "a path into another package's internals",
    "billing-use-case",
    "billing-use-case/src/invoice/line.ts",
    ["Line"],
    "viaInternalPath",
    "internal-path",
  ],
  [
    "a companion instance operation",
    "billing-use-case",
    "billing-use-case/src/invoice/index.ts",
    ["Entry"],
    "issue",
    "package-entry",
  ],
  [
    "a companion generation method",
    "billing-use-case",
    "billing-use-case/src/invoice/index.ts",
    ["Entry"],
    "create",
    "package-entry",
  ],
];

describe("every supported reference form reaches the same declaration", () => {
  test.each(VARIANTS)(
    "%s resolves to the standard result and the shared closed error set",
    (_form, owner, file, declarationPath, operation, kind) => {
      const result = inspect({ package: owner, file, declarationPath, operation });
      expect(result.executionState).toBe("completed");
      expect(result.unresolvedReasons).toEqual([]);
      expect(standardResult(result)).toBe(true);
      expect(caseNames(result)).toEqual(SHARED_CASES);
      expect(caseSet(result).completeness).toBe("complete");
      expect(stepKinds(result)).toContain(kind);
    },
  );

  test("both module layouts and both code representations reach one error identity", () => {
    const results = VARIANTS.map(([, owner, file, declarationPath, operation]) =>
      inspect({ package: owner, file, declarationPath, operation }),
    );
    expect(new Set(results.map(errorSymbol)).size).toBe(1);
    expect(new Set(results.map((result) => caseNames(result).join(",")))).toEqual(new Set([SHARED_CASES.join(",")]));
    expect(new Set(results.map((result) => stepKinds(result).join(">"))).size).toBeGreaterThan(1);
  });

  test("a type-only reference is kept as a dependency and a value import is not reported as one", () => {
    const typeOnly = inspect({
      file: "billing-domain/src/invoice.ts",
      declarationPath: ["Invoice"],
      operation: "typeOnly",
    });
    expect(stepKinds(typeOnly)).toContain("import-type");
    for (const operation of ["issue", "renamed"]) {
      const plain = inspect({ file: "billing-domain/src/invoice.ts", declarationPath: ["Invoice"], operation });
      expect(stepKinds(plain)).not.toContain("import-type");
      expect(errorSymbol(plain)).toBe(errorSymbol(typeOnly));
    }
  });

  test("the declared entry point and the path into the internals stay apart at the same final type", () => {
    const entry = inspect({
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/line.ts",
      declarationPath: ["Line"],
      operation: "viaEntry",
    });
    const internal = inspect({
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/line.ts",
      declarationPath: ["Line"],
      operation: "viaInternalPath",
    });
    expect(errorSymbol(entry)).toBe(errorSymbol(internal));
    expect(stepKinds(entry)).toContain("package-entry");
    expect(stepKinds(entry)).not.toContain("internal-path");
    expect(stepKinds(internal)).toContain("internal-path");
    expect(stepKinds(internal)).not.toContain("package-entry");
  });

  test("a relative path inside one package is not reported as a bypassed entry point", () => {
    const result = inspect({
      file: "billing-domain/src/invoice/line.ts",
      declarationPath: ["Reexported"],
      operation: "issue",
    });
    expect(stepKinds(result)).not.toContain("internal-path");
    expect(stepKinds(result)).toContain("re-export");
  });
});

describe("the inspected code representation", () => {
  test("names the class operation, the companion operation and the generation method apart", () => {
    const classOperation = inspect({
      file: "billing-domain/src/invoice.ts",
      declarationPath: ["Invoice"],
      operation: "issue",
    });
    const companionOperation = inspect({
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/index.ts",
      declarationPath: ["Entry"],
      operation: "issue",
    });
    const generation = inspect({
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/index.ts",
      declarationPath: ["Entry"],
      operation: "create",
    });

    const identities = [classOperation, companionOperation, generation].map(
      (result) => resolvedEvidence(result).operation,
    );
    expect(new Set(identities.map((identity) => identity.symbolId)).size).toBe(3);
    expect(identities[0].packageId).not.toBe(identities[1].packageId);
    expect(identities.map((identity) => identity.operation)).toEqual(["issue", "issue", "create"]);
  });

  test("a generation method states its own type as the success type", () => {
    const generation = inspect({
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/index.ts",
      declarationPath: ["Entry"],
      operation: "create",
    });
    const instance = inspect({
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/index.ts",
      declarationPath: ["Entry"],
      operation: "issue",
    });
    const contract = resolvedEvidence(generation).resultContract;
    if (contract.status !== "resolved" || !contract.value.standardResult)
      throw new Error("expected a resolved standard result");
    expect(contract.value.successType.kind).toBe("nominal");
    if (contract.value.successType.kind === "nominal")
      expect(contract.value.successType.symbolId).not.toBe(errorSymbol(generation));

    const instanceContract = resolvedEvidence(instance).resultContract;
    if (instanceContract.status !== "resolved" || !instanceContract.value.standardResult)
      throw new Error("expected a resolved standard result");
    expect(instanceContract.value.successType).toEqual({ kind: "unit" });
    expect(errorSymbol(generation)).toBe(errorSymbol(instance));
  });

  test("a representation that is not the inspected one does not reach the declaration anyway", () => {
    const result = inspect({
      file: "billing-domain/src/invoice.ts",
      declarationPath: ["Invoice"],
      operation: "issue",
      settings: projectSettingsPayload({
        languages: ["typescript"],
        rust: null,
        typescript: { moduleLayout: "named-file", codeRepresentation: "companion" },
      }),
    });
    expect(codes(result)).toContain("target-missing");
    expect(standardResult(result)).toBe(false);
  });

  test("settings that name no representation leave the inspection unresolved", () => {
    const result = inspect({
      file: "billing-domain/src/invoice.ts",
      declarationPath: ["Invoice"],
      operation: "issue",
      settings: {},
    });
    expect(codes(result)).toContain("unsupported-syntax");
    expect(standardResult(result)).toBe(false);
  });
});

describe("a class operation whose declared return type is not the standard result", () => {
  const PLAIN = { file: "billing-domain/src/plain.ts", declarationPath: ["Plain"] };
  function nonStandardResultType(result: ContractResult): TypeReference {
    const contract = resolvedEvidence(result).resultContract;
    if (contract.status !== "resolved" || contract.value.standardResult)
      throw new Error(`expected a resolved result that is not the standard result: ${JSON.stringify(contract)}`);
    return contract.value.resultType;
  }
  function lastResolved(result: ContractResult): string | undefined {
    return resolvedEvidence(result).resolutionPath.at(-1)?.resolved;
  }

  test("returning nothing states neither a result contract nor a case set", () => {
    const result = inspect({ ...PLAIN, operation: "close" });
    const evidence = resolvedEvidence(result);
    expect(result.unresolvedReasons).toEqual([]);
    expect(evidence.resultContract.status).toBe("absent");
    expect(evidence.errorCases.status).toBe("absent");

    // The same spelling as the success type of the standard result is a unit success, not an absent contract.
    const standard = resolvedEvidence(
      inspect({ file: "billing-domain/src/invoice.ts", declarationPath: ["Invoice"], operation: "issue" }),
    ).resultContract;
    expect(standard).toMatchObject({
      status: "resolved",
      value: { standardResult: true, successType: { kind: "unit" } },
    });
  });

  test("returning a declaration of the same module states that declaration and how it was reached", () => {
    const result = inspect({ ...PLAIN, operation: "copy" });
    const resultType = nonStandardResultType(result);
    expect(result.unresolvedReasons).toEqual([]);
    expect(resultType.kind).toBe("nominal");
    expect(resolvedEvidence(result).errorCases.status).toBe("absent");
    expect(stepKinds(result)).toEqual(["direct"]);
    if (resultType.kind === "nominal") expect(lastResolved(result)).toBe(resultType.symbolId);
  });

  test("returning a declaration imported under a second name keeps the import on the path", () => {
    const result = inspect({ ...PLAIN, operation: "billed" });
    const resultType = nonStandardResultType(result);
    expect(result.unresolvedReasons).toEqual([]);
    expect(stepKinds(result)).toEqual(["import-alias"]);
    expect(resultType.kind).toBe("nominal");
    if (resultType.kind === "nominal") expect(lastResolved(result)).toBe(resultType.symbolId);
  });
});

describe("bounded resolution reports its own reason for each category", () => {
  const CATEGORIES: [string, string, string[], string][] = [
    ["an error type that is any", "billing-domain/src/limits.ts", ["EscapeAny"], "escape-type"],
    ["an error type that is unknown", "billing-domain/src/limits.ts", ["EscapeUnknown"], "escape-type"],
    [
      "a union widened by a member that is not a case",
      "billing-domain/src/limits.ts",
      ["WideUnion"],
      "open-error-type",
    ],
    ["a union member that carries no case", "billing-domain/src/limits.ts", ["Optional"], "open-error-type"],
    [
      "a named error type widened by a member that is not a case",
      "billing-domain/src/limits.ts",
      ["WidenedAlias"],
      "open-error-type",
    ],
    ["a contract stated only by an assertion", "billing-domain/src/limits.ts", ["Asserted"], "unchecked-assertion"],
    [
      "a return type only the body establishes",
      "billing-domain/src/limits.ts",
      ["Inferred"],
      "expression-inference-required",
    ],
    [
      "a spelling that appears only in comments and strings",
      "billing-domain/src/limits.ts",
      ["Documented"],
      "expression-inference-required",
    ],
    [
      "an application type named Result",
      "billing-domain/src/limits/shadowed.ts",
      ["Shadowed"],
      "shadowed-result-identity",
    ],
    ["an import with no referent", "billing-domain/src/limits/missing.ts", ["MissingReferent"], "missing-referent"],
    ["a cyclic alias chain", "billing-domain/src/limits/cycle.ts", ["Cyclic"], "alias-cycle"],
  ];

  test.each(CATEGORIES)("%s reports %s", (_label, file, declarationPath, expected) => {
    expect(codes(inspect({ file, declarationPath, operation: "issue" }))).toContain(expected);
  });

  test("no category is reported with another category's reason", () => {
    const observed = CATEGORIES.map(([, file, declarationPath]) =>
      codes(inspect({ file, declarationPath, operation: "issue" })),
    );
    for (const [index, [, , , expected]] of CATEGORIES.entries())
      for (const other of new Set(CATEGORIES.map(([, , , code]) => code)))
        if (other !== expected) expect(observed[index]).not.toContain(other);
  });

  test("an application type named Result is never accepted as the standard result", () => {
    const result = inspect({
      file: "billing-domain/src/limits/shadowed.ts",
      declarationPath: ["Shadowed"],
      operation: "issue",
    });
    expect(standardResult(result)).toBe(false);
  });

  test("an error type that cannot be closed is unresolved rather than an empty closed set", () => {
    for (const declarationPath of [["WideUnion"], ["Optional"], ["WidenedAlias"]]) {
      const result = inspect({ file: "billing-domain/src/limits.ts", declarationPath, operation: "issue" });
      const cases = resolvedEvidence(result).errorCases;
      expect(cases.status).toBe("unresolved");
      if (cases.status === "unresolved") expect(cases.reasons.map((entry) => entry.code)).toContain("open-error-type");
    }
  });

  test("a source the compiler cannot scan is reported as a syntax error", () => {
    const result = inspect({
      file: "billing-domain/src/invoice.ts",
      declarationPath: ["Invoice"],
      operation: "issue",
      sources: withSource("billing-domain/src/invoice.ts", "/* this comment never closes\nexport class Invoice {}\n"),
    });
    expect(codes(result)).toContain("syntax-error");
    expect(codes(result)).not.toContain("unsupported-syntax");
    expect(standardResult(result)).toBe(false);
  });
});

describe("a spelling that is not in type position", () => {
  test("is not the operation's declared result contract", () => {
    const result = inspect({
      file: "billing-domain/src/limits.ts",
      declarationPath: ["Documented"],
      operation: "issue",
    });
    expect(resolvedEvidence(result).resultContract.status).toBe("unresolved");
    expect(standardResult(result)).toBe(false);
  });

  test("is a case name when it is written as a type", () => {
    const result = inspect({ file: "billing-domain/src/limits.ts", declarationPath: ["Noted"], operation: "issue" });
    expect(standardResult(result)).toBe(true);
    expect(caseNames(result)).toEqual(["Result<void, IssueInvoiceError>"]);
    expect(caseSet(result).completeness).toBe("complete");
    expect(errorSymbol(result)).not.toBe(
      errorSymbol(inspect({ file: "billing-domain/src/invoice.ts", declarationPath: ["Invoice"], operation: "issue" })),
    );
  });
});

describe("symbol identity", () => {
  test("two declarations that share a name in two modules are two symbols", () => {
    const shared = inspect({ file: "billing-domain/src/invoice.ts", declarationPath: ["Invoice"], operation: "issue" });
    const elsewhere = inspect({
      file: "billing-domain/src/naming.ts",
      declarationPath: ["Naming"],
      operation: "issue",
    });
    expect(errorSymbol(elsewhere)).not.toBe(errorSymbol(shared));
    expect(caseNames(elsewhere)).toEqual(["declared-elsewhere", "still-elsewhere"]);
    expect(caseNames(shared)).toEqual(SHARED_CASES);
  });

  test("two operations that share a name in two packages are two symbols at one error identity", () => {
    const domain = inspect({ file: "billing-domain/src/invoice.ts", declarationPath: ["Invoice"], operation: "issue" });
    const useCase = inspect({
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/index.ts",
      declarationPath: ["Entry"],
      operation: "issue",
    });
    expect(resolvedEvidence(domain).operation.symbolId).not.toBe(resolvedEvidence(useCase).operation.symbolId);
    expect(resolvedEvidence(domain).operation.packageId).not.toBe(resolvedEvidence(useCase).operation.packageId);
    expect(errorSymbol(domain)).toBe(errorSymbol(useCase));
  });

  test("two packages that share a name are not merged into one candidate", () => {
    const fork = (version: string, root: string) => (base: TypeScriptCondition) =>
      withPackages(base, [
        {
          ...domainPackage(base),
          packageId: `path:${root}#billing-domain@${version}`,
          version,
          packageRoot: root,
          tsconfigPath: `${root}/tsconfig.json`,
          entryPoints: [{ subpath: ".", target: `${root}/src/index.ts` }],
        },
      ]);
    const spec = {
      package: "billing-use-case" as const,
      file: "billing-use-case/src/invoice/line.ts",
      declarationPath: ["Line"],
      operation: "viaEntry",
    };

    const sameVersion = inspect({ ...spec, condition: fork("0.1.0", "billing-domain-fork") });
    expect(codes(sameVersion)).toContain("multiple-package-versions");
    expect(codes(sameVersion)).not.toContain("unsupported-version-resolution");
    expect(standardResult(sameVersion)).toBe(false);

    const otherVersion = inspect({ ...spec, condition: fork("0.2.0", "billing-domain-next") });
    expect(codes(otherVersion)).toContain("unsupported-version-resolution");
    expect(codes(otherVersion)).not.toContain("multiple-package-versions");
    expect(standardResult(otherVersion)).toBe(false);
  });

  test("a reference across a package boundary the project references do not carry is refused", () => {
    const result = inspect({
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/line.ts",
      declarationPath: ["Line"],
      operation: "viaEntry",
      condition: (base) => ({
        ...base,
        packages: base.packages.map((entry) =>
          entry.name === "billing-use-case" ? { ...entry, projectReferences: [] } : entry,
        ),
      }),
    });
    expect(codes(result)).toContain("invalid-project-reference");
    expect(codes(result)).not.toContain("missing-referent");
    expect(standardResult(result)).toBe(false);
  });

  test("a scoped package name is one name, not a scope and a subpath", () => {
    const line = "billing-use-case/src/invoice/line.ts";
    const source = SOURCES.find((entry) => entry.path === line);
    if (!source) throw new Error(`snapshot has no source ${line}`);
    const spec = {
      package: "billing-use-case" as const,
      file: line,
      declarationPath: ["Line"],
      sources: withSource(line, source.content.replaceAll('"billing-domain', '"@billing/domain')),
      condition: (base: TypeScriptCondition) => ({
        ...base,
        packages: base.packages.map((entry) =>
          entry.name === "billing-domain" ? { ...entry, name: "@billing/domain" } : entry,
        ),
      }),
    };

    const entry = inspect({ ...spec, operation: "viaEntry" });
    expect(entry.unresolvedReasons).toEqual([]);
    expect(stepKinds(entry)).toContain("package-entry");
    expect(standardResult(entry)).toBe(true);
    expect(caseNames(entry)).toEqual(SHARED_CASES);

    const internal = inspect({ ...spec, operation: "viaInternalPath" });
    expect(errorSymbol(internal)).toBe(errorSymbol(entry));
  });

  test("a bare specifier that names only a scope resolves to no package", () => {
    const line = "billing-use-case/src/invoice/line.ts";
    const source = SOURCES.find((entry) => entry.path === line);
    if (!source) throw new Error(`snapshot has no source ${line}`);
    const result = inspect({
      package: "billing-use-case",
      file: line,
      declarationPath: ["Line"],
      operation: "viaEntry",
      sources: withSource(line, source.content.replaceAll('"billing-domain"', '"@billing"')),
      condition: (base) => ({
        ...base,
        packages: base.packages.map((entry) =>
          entry.name === "billing-domain" ? { ...entry, name: "@billing/domain" } : entry,
        ),
      }),
    });
    expect(codes(result)).toContain("missing-referent");
    expect(standardResult(result)).toBe(false);
  });
});

describe("the shared contract carries no Compiler API detail", () => {
  test("a response holds nothing but the values its own serialization can carry", () => {
    const frozen = task({ file: "billing-domain/src/invoice.ts", declarationPath: ["Invoice"], operation: "issue" });
    const response = extractTypeScriptErrorContract(frozen);
    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
    expect(validateResponse(response, frozen.request)).toMatchObject({ valid: true });
  });

  test("no recorded identity or location names the compiler's own file layout", () => {
    const evidence = resolvedEvidence(
      inspect({
        package: "billing-use-case",
        file: "billing-use-case/src/invoice/line.ts",
        declarationPath: ["Line"],
        operation: "viaEntry",
      }),
    );
    const spellings = [
      evidence.operation.symbolId,
      ...evidence.operationEvidence.map((entry) => entry.file),
      ...evidence.resolutionPath.flatMap((entry) => [entry.reference, entry.resolved, entry.location.file]),
      ...(evidence.resultContract.status === "resolved" && evidence.resultContract.value.standardResult
        ? [evidence.resultContract.value.errorType, evidence.resultContract.value.successType]
            .filter((reference) => reference.kind === "nominal")
            .map((reference) => reference.symbolId)
        : []),
    ];
    expect(spellings.length).toBeGreaterThan(0);
    for (const spelling of spellings) {
      expect(spelling.startsWith("/")).toBe(false);
      expect(spelling).not.toContain("/input/");
      expect(spelling).not.toContain("/lib/lib.");
      expect(spelling).not.toContain("node_modules");
      expect(spelling).not.toContain(TYPESCRIPT_WORKSPACE);
    }
  });
});

describe("a project condition change inside one inspection process", () => {
  test("re-derives the result and refuses the previous condition's response", () => {
    const spec: Spec = {
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/line.ts",
      declarationPath: ["Line"],
      operation: "viaEntry",
    };
    const published = inspect(spec);
    expect(stepKinds(published)).toContain("package-entry");
    expect(caseNames(published)).toEqual(SHARED_CASES);

    // Withdrawing the entry point leaves the same specifier without a published target.
    const withdrawn: Spec = {
      ...spec,
      condition: (base) => ({
        ...base,
        packages: base.packages.map((entry) =>
          entry.name === "billing-domain"
            ? { ...entry, entryPoints: entry.entryPoints.filter((point) => point.subpath !== ".") }
            : entry,
        ),
      }),
    };

    const before = task(spec);
    const after = task(withdrawn);
    expect(after.request.requestIdentity).not.toBe(before.request.requestIdentity);

    const earlier = extractTypeScriptErrorContract(before);
    expect(validateResponse(earlier, after.request)).toMatchObject({
      valid: false,
      issue: { code: "identity-mismatch", subject: "response.requestIdentity" },
    });
    const reused = resolveErrorContract(after.request, { status: "completed", response: earlier });
    expect(reused).toMatchObject({ kind: "evaluated", result: { evidence: null } });
    if (reused.kind === "evaluated") expect(codes(reused.result)).toContain("identity-mismatch");

    const recomputed = inspect(withdrawn);
    expect(codes(recomputed)).toContain("missing-referent");
    expect(standardResult(recomputed)).toBe(false);
    expect(
      recomputed.evidence?.operationStatus === "resolved"
        ? recomputed.evidence.resolutionPath.map((entry) => entry.kind)
        : [],
    ).not.toContain("package-entry");

    // The first condition is still the first condition: nothing was cached across the change.
    const again = inspect(spec);
    expect(again.requestIdentity).toBe(before.request.requestIdentity);
    expect(caseNames(again)).toEqual(SHARED_CASES);
    expect(stepKinds(again)).toContain("package-entry");
  });
});

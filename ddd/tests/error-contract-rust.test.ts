import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type {
  CargoCondition,
  CargoPackage,
  ContractResult,
  ErrorCaseSet,
  SourceInput,
} from "../tools/ddd/lib/error-contract/contract.ts";
import { resolveErrorContract } from "../tools/ddd/lib/error-contract/inspection.ts";
import { freezeInput } from "../tools/ddd/lib/error-contract-verification/input.ts";
import {
  LAYOUT,
  type PackageName,
  WORKSPACE,
  workspaceSources,
} from "../tools/ddd/lib/error-contract-verification/scenario.ts";
import { projectSettingsPayload } from "../tools/ddd/lib/project-settings/payload.ts";
import { resolveCargoCondition } from "../tools/ddd/lib/rust/error-contract/cargo-condition.ts";
import {
  convertRustResponse,
  extractRust,
  RUST_TOOLCHAIN,
  rustVersions,
} from "../tools/ddd/lib/rust/error-contract/index.ts";

const MANIFEST = join(WORKSPACE, "Cargo.toml");

function hostTriple(): string {
  const probe = Bun.spawnSync(["rustc", "-vV"], { stdout: "pipe", stderr: "pipe" });
  const host = /^host: (.+)$/m.exec(probe.stdout.toString())?.[1];
  if (!host) throw new Error("rustc host target unavailable");
  return host;
}
const TRIPLE = hostTriple();

const SOURCES = workspaceSources();

const conditions = new Map<string, Promise<CargoCondition>>();
function condition(features: readonly string[]): Promise<CargoCondition> {
  const key = [...features].sort().join(" ");
  const existing = conditions.get(key);
  if (existing) return existing;
  const pending = resolveCargoCondition({ manifestPath: MANIFEST, targetTriple: TRIPLE, features }).then((outcome) => {
    if (outcome.kind !== "resolved") throw new Error(`Cargo condition unavailable: ${JSON.stringify(outcome)}`);
    return outcome.condition;
  });
  conditions.set(key, pending);
  return pending;
}

interface Spec {
  package?: PackageName;
  file?: string;
  declarationPath: readonly string[];
  operation: string;
  features?: readonly string[];
  sources?: readonly SourceInput[];
  extraPackages?: readonly CargoPackage[];
}
async function task(spec: Spec) {
  const owner: PackageName = spec.package ?? "billing-domain";
  const base = await condition(spec.features ?? []);
  const entry = base.packages.find((candidate) => candidate.name === owner);
  if (!entry) throw new Error(`condition has no package ${owner}`);
  return freezeInput({
    language: "rust",
    cargoCondition: spec.extraPackages ? { ...base, packages: [...base.packages, ...spec.extraPackages] } : base,
    target: {
      packageId: entry.packageId,
      targetName: entry.targets[0].name,
      file: spec.file ?? entry.targets[0].srcPath,
      declarationPath: [...spec.declarationPath],
      operation: spec.operation,
    },
    sources: spec.sources ?? SOURCES,
    settings: projectSettingsPayload({
      languages: ["rust"],
      rust: { moduleLayout: LAYOUT[owner] },
      typescript: null,
    }),
    toolchain: RUST_TOOLCHAIN,
  });
}
async function inspect(spec: Spec): Promise<ContractResult> {
  const frozen = await task(spec);
  const observed = await extractRust(frozen);
  const outcome = resolveErrorContract(frozen.request, observed.execution);
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

/** One operation per supported reference form, written in both project module layouts. */
const VARIANTS: [string, PackageName, string, string[], string][] = [
  ["direct", "billing-domain", "billing-domain/src/invoice.rs", ["invoice", "Invoice"], "direct"],
  ["fully qualified", "billing-domain", "billing-domain/src/invoice.rs", ["invoice", "Qualified"], "qualified"],
  ["renamed import", "billing-domain", "billing-domain/src/invoice.rs", ["invoice", "Renamed"], "use-rename"],
  [
    "renamed re-export",
    "billing-domain",
    "billing-domain/src/invoice/line.rs",
    ["invoice", "line", "Reexported"],
    "re-export",
  ],
  [
    "transparent alias",
    "billing-domain",
    "billing-domain/src/invoice/line.rs",
    ["invoice", "line", "Aliased"],
    "type-alias",
  ],
  ["direct", "billing-use-case", "billing-use-case/src/invoice/mod.rs", ["invoice", "Invoice"], "direct"],
  ["fully qualified", "billing-use-case", "billing-use-case/src/invoice/mod.rs", ["invoice", "Qualified"], "qualified"],
  ["renamed import", "billing-use-case", "billing-use-case/src/invoice/mod.rs", ["invoice", "Renamed"], "use-rename"],
  [
    "renamed re-export",
    "billing-use-case",
    "billing-use-case/src/invoice/line.rs",
    ["invoice", "line", "Reexported"],
    "re-export",
  ],
  [
    "transparent alias",
    "billing-use-case",
    "billing-use-case/src/invoice/line.rs",
    ["invoice", "line", "Aliased"],
    "type-alias",
  ],
];

test("the native extractor answers the error contract protocol version probe", async () => {
  expect(await rustVersions()).toEqual(RUST_TOOLCHAIN);
});

describe("every supported reference form reaches the same declaration", () => {
  test.each(VARIANTS)(
    "%s in %s resolves to the standard result and the shared error enum",
    async (_form, owner, file, declarationPath, kind) => {
      const result = await inspect({ package: owner, file, declarationPath, operation: "issue" });
      expect(result.executionState).toBe("completed");
      expect(result.unresolvedReasons).toEqual([]);
      expect(standardResult(result)).toBe(true);
      expect(caseNames(result)).toEqual(["AlreadyIssued", "Empty"]);
      expect(caseSet(result).completeness).toBe("complete");
      expect(stepKinds(result)).toContain(kind);
    },
  );
  test("both module layouts resolve the ten variants to one error identity and differ only in path", async () => {
    const results = await Promise.all(
      VARIANTS.map(([, owner, file, declarationPath]) =>
        inspect({ package: owner, file, declarationPath, operation: "issue" }),
      ),
    );
    const symbols = new Set(results.map(errorSymbol));
    expect(symbols.size).toBe(1);
    expect(new Set(results.map((result) => caseNames(result).join(",")))).toEqual(new Set(["AlreadyIssued,Empty"]));
    expect(new Set(results.map((result) => stepKinds(result).join(">"))).size).toBeGreaterThan(1);

    const fileLayout = results.slice(0, 5).map(stepKinds);
    const modRsLayout = results.slice(5).map(stepKinds);
    for (let index = 0; index < fileLayout.length; index++) {
      expect(fileLayout[index]).not.toContain("dependency-rename");
      expect(modRsLayout[index]).toContain("dependency-rename");
    }
  });
  test("a concrete Self resolves through the owner of its inherent impl", async () => {
    const result = await inspect({
      file: "billing-domain/src/invoice.rs",
      declarationPath: ["invoice", "Created"],
      operation: "create",
    });
    expect(standardResult(result)).toBe(true);
    const selfStep = resolvedEvidence(result).resolutionPath.find((entry) => entry.kind === "self-type");
    if (!selfStep) throw new Error(`no self-type step: ${JSON.stringify(stepKinds(result))}`);
    const contract = resolvedEvidence(result).resultContract;
    if (contract.status !== "resolved" || !contract.value.standardResult)
      throw new Error("expected a resolved standard result");
    expect(contract.value.successType).toEqual({ kind: "nominal", symbolId: selfStep.resolved });
    expect(errorSymbol(result)).not.toBe(selfStep.resolved);
  });
  test("a spelling inside a doc comment or a string literal is not a declared result", async () => {
    const result = await inspect({
      file: "billing-domain/src/invoice.rs",
      declarationPath: ["invoice", "Undeclared"],
      operation: "issue",
    });
    expect(resolvedEvidence(result).resultContract.status).toBe("absent");
    expect(resolvedEvidence(result).errorCases.status).toBe("absent");
    expect(standardResult(result)).toBe(false);
  });
});

describe("bounded resolution reports its own reason for each category", () => {
  const CATEGORIES: [string, string[], string][] = [
    ["an application type named Result", ["limits", "shadowed", "Invoice"], "shadowed-result-identity"],
    ["an error set that is left open", ["limits", "open", "Invoice"], "incomplete-case-set"],
    ["a case behind an unknown condition", ["limits", "unknown_condition", "Invoice"], "unknown-cfg"],
    ["an error declared by a macro", ["limits", "generated", "Invoice"], "macro-generated"],
    ["an error reached through an associated type", ["limits", "projection", "Invoice"], "associated-type-required"],
    ["an error that depends on trait selection", ["limits", "selection", "Invoice"], "trait-selection-required"],
    ["a return type only the body establishes", ["limits", "inference", "Invoice"], "expression-inference-required"],
    ["an open type argument", ["limits", "unbound", "Invoice"], "unsupported-type-argument"],
  ];
  test.each(CATEGORIES)("%s reports %s", async (_label, declarationPath, expected) => {
    const result = await inspect({
      file: "billing-domain/src/limits.rs",
      declarationPath,
      operation: "issue",
    });
    expect(codes(result)).toContain(expected);
  });
  test("no category is reported with another category's reason", async () => {
    const observed = await Promise.all(
      CATEGORIES.map(async ([, declarationPath]) =>
        codes(await inspect({ file: "billing-domain/src/limits.rs", declarationPath, operation: "issue" })),
      ),
    );
    for (let index = 0; index < CATEGORIES.length; index++)
      for (let other = 0; other < CATEGORIES.length; other++)
        if (index !== other) expect(observed[index]).not.toContain(CATEGORIES[other][2]);
  });
  test("an application type named Result is never accepted as the standard result", async () => {
    const result = await inspect({
      file: "billing-domain/src/limits.rs",
      declarationPath: ["limits", "shadowed", "Invoice"],
      operation: "issue",
    });
    expect(standardResult(result)).toBe(false);
  });
  test("an open error set is reported as partial rather than as a closed set", async () => {
    const result = await inspect({
      file: "billing-domain/src/limits.rs",
      declarationPath: ["limits", "open", "Invoice"],
      operation: "issue",
    });
    expect(standardResult(result)).toBe(true);
    expect(caseSet(result).completeness).toBe("partial");
    expect(caseSet(result).reasons.map((entry) => entry.code)).toContain("incomplete-case-set");
    expect(caseSet(result).items.map((entry) => entry.name)).toEqual(["Known"]);
  });
});

describe("source that parses but that the compiler rejects", () => {
  const CASES: [string, string, string, string][] = [
    [
      "a cyclic alias chain",
      "pub enum IssueInvoiceError { Only }\npub type A<T> = B<T>;\npub type B<T> = A<T>;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> A<()> { loop {} } }\n",
      "issue",
      "alias-cycle",
    ],
    [
      "an import with no referent",
      "use missing::IssueInvoiceError;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), IssueInvoiceError> { loop {} } }\n",
      "issue",
      "missing-referent",
    ],
    [
      "two glob imports offering the same name",
      "pub mod a { pub enum E { One } }\npub mod b { pub enum E { Two } }\npub use a::*;\npub use b::*;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n",
      "issue",
      "ambiguous-candidate",
    ],
    [
      "a type alias applied with the wrong number of arguments",
      "pub enum E { Only }\npub type Outcome<T> = Result<T, E>;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Outcome<(), E> { loop {} } }\n",
      "issue",
      "unsupported-type-argument",
    ],
    [
      "a standard result applied with one argument",
      "pub enum E { Only }\npub struct Invoice;\nimpl Invoice { pub fn create() -> Result<Self> { loop {} } }\n",
      "create",
      "unsupported-type-argument",
    ],
  ];
  test.each(CASES)("%s reports %s without claiming a syntax error", async (_label, content, operation, expected) => {
    const result = await inspect({
      declarationPath: ["Invoice"],
      operation,
      sources: [{ path: "billing-domain/src/lib.rs", content }],
    });
    expect(codes(result)).toContain(expected);
    expect(codes(result)).not.toContain("syntax-error");
    expect(standardResult(result)).toBe(false);
  });
  test("a source syn cannot parse is reported as a syntax error", async () => {
    const result = await inspect({
      declarationPath: ["Invoice"],
      operation: "issue",
      sources: [{ path: "billing-domain/src/lib.rs", content: "pub struct Invoice {\n" }],
    });
    expect(codes(result)).toContain("syntax-error");
  });
});

describe("an attribute the contract does not interpret keeps its own reason", () => {
  /** One source per place an attribute is read, so every projection is observed. */
  const POSITIONS: [string, string[], string, (attribute: string) => string, string, string][] = [
    [
      "a module declaration",
      ["inner", "Invoice"],
      "issue",
      (attribute) =>
        `${attribute}\npub mod inner {\npub enum E { Only }\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n}\n`,
      '#[path = "other.rs"]',
      "unsupported-syntax",
    ],
    [
      "a type declaration",
      ["Invoice"],
      "issue",
      (attribute) =>
        `${attribute}\npub enum E { Only }\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n`,
      "#[repr(C)]",
      "unsupported-syntax",
    ],
    [
      "a use binding",
      ["Invoice"],
      "issue",
      (attribute) =>
        `pub mod m { pub enum E { Only } }\n${attribute}\nuse crate::m::E;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n`,
      "#[allow(unused_imports)]",
      "unsupported-syntax",
    ],
    [
      "an impl block",
      ["Invoice"],
      "issue",
      (attribute) =>
        `pub enum E { Only }\npub struct Invoice;\n${attribute}\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n`,
      "#[automatically_derived]",
      "unsupported-syntax",
    ],
    [
      "the inspected function",
      ["Invoice"],
      "issue",
      (attribute) =>
        `pub enum E { Only }\npub struct Invoice;\nimpl Invoice { ${attribute} pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n`,
      "#[inline]",
      "unsupported-syntax",
    ],
    [
      "an enum variant",
      ["Invoice"],
      "issue",
      (attribute) =>
        `pub enum E { Only, ${attribute} Extra }\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n`,
      "#[deprecated]",
      "unsupported-syntax",
    ],
  ];
  function attributed(source: string, declarationPath: string[], operation: string): Promise<ContractResult> {
    return inspect({
      declarationPath,
      operation,
      sources: [{ path: "billing-domain/src/lib.rs", content: source }],
    });
  }

  test.each(POSITIONS)(
    "%s behind a condition the selected features do not settle reports unknown-cfg",
    async (_label, declarationPath, operation, source) => {
      const result = await attributed(source("#[cfg(fuzzing)]"), declarationPath, operation);
      expect(codes(result)).toContain("unknown-cfg");
    },
  );
  test.each(POSITIONS)(
    "%s carrying an attribute the contract does not model reports its own reason instead",
    async (_label, declarationPath, operation, source, attribute, expected) => {
      const result = await attributed(source(attribute), declarationPath, operation);
      expect(codes(result)).toContain(expected);
      expect(codes(result)).not.toContain("unknown-cfg");
    },
  );
  test("a derive is reported as macro generated rather than as an unknown condition", async () => {
    const result = await attributed(
      "#[derive(Debug)]\npub enum E { Only }\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), E> { loop {} } }\n",
      ["Invoice"],
      "issue",
    );
    expect(codes(result)).toContain("macro-generated");
    expect(codes(result)).not.toContain("unknown-cfg");
  });
});

describe("the file that declares a child module", () => {
  const ROOT =
    "pub mod invoice;\npub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> Result<(), crate::invoice::E> { loop {} } }\n";
  const CHILD = "pub enum E { Only }\n";

  test("is a competing candidate when both layout spellings declare it", async () => {
    const result = await inspect({
      declarationPath: ["Invoice"],
      operation: "issue",
      sources: [
        { path: "billing-domain/src/lib.rs", content: ROOT },
        { path: "billing-domain/src/invoice.rs", content: CHILD },
        { path: "billing-domain/src/invoice/mod.rs", content: CHILD },
      ],
    });
    expect(codes(result)).toContain("ambiguous-candidate");
    expect(codes(result)).not.toContain("missing-referent");
  });
  test("is an absent referent when no file declares it", async () => {
    const result = await inspect({
      declarationPath: ["Invoice"],
      operation: "issue",
      sources: [{ path: "billing-domain/src/lib.rs", content: ROOT }],
    });
    expect(codes(result)).toContain("missing-referent");
    expect(codes(result)).not.toContain("ambiguous-candidate");
  });
});

describe("a path written from the current module", () => {
  /**
   * `Direct` writes the name on its own; `Scoped` writes it through the given path.
   * Both sit inside `inner` rather than at the crate root, because that is the only
   * position where the current module and the crate root are different modules.
   */
  function source(written: string): string {
    return [
      "pub mod inner {",
      "pub enum E { AlreadyIssued, Empty }",
      "pub struct Direct;",
      "impl Direct { pub fn issue(&mut self) -> Result<(), E> { loop {} } }",
      "pub struct Scoped;",
      `impl Scoped { pub fn issue(&mut self) -> Result<(), ${written}> { loop {} } }`,
      "}",
      "",
    ].join("\n");
  }
  function scoped(written: string, owner: string): Promise<ContractResult> {
    return inspect({
      declarationPath: ["inner", owner],
      operation: "issue",
      sources: [{ path: "billing-domain/src/lib.rs", content: source(written) }],
    });
  }

  test("reaches the same declaration as the name written on its own", async () => {
    const [direct, viaSelf] = await Promise.all([scoped("self::E", "Direct"), scoped("self::E", "Scoped")]);
    expect(errorSymbol(viaSelf)).toBe(errorSymbol(direct));
    expect(caseNames(viaSelf)).toEqual(["AlreadyIssued", "Empty"]);
    expect(caseNames(direct)).toEqual(["AlreadyIssued", "Empty"]);
    expect(stepKinds(viaSelf)).toContain("qualified");
  });
  test("is not the same starting module as a path written from the parent", async () => {
    const result = await scoped("super::E", "Scoped");
    expect(codes(result)).toContain("missing-referent");
    expect(standardResult(result)).toBe(false);
  });
});

describe("package identity", () => {
  test("two declarations that share a name in two packages are two symbols", async () => {
    const domain = await inspect({
      package: "billing-domain",
      file: "billing-domain/src/invoice.rs",
      declarationPath: ["invoice", "Invoice"],
      operation: "issue",
    });
    const useCase = await inspect({
      package: "billing-use-case",
      file: "billing-use-case/src/invoice/mod.rs",
      declarationPath: ["invoice", "Invoice"],
      operation: "issue",
    });
    expect(resolvedEvidence(domain).operation.symbolId).not.toBe(resolvedEvidence(useCase).operation.symbolId);
    expect(resolvedEvidence(domain).operation.packageId).not.toBe(resolvedEvidence(useCase).operation.packageId);
    expect(errorSymbol(domain)).toBe(errorSymbol(useCase));
    expect(stepKinds(useCase)).toContain("dependency-rename");
  });
  test.each([
    ["a raw identifier", "raw", "Raw"],
    ["its plain spelling", "plain", "Plain"],
    ["a type inside a module of the same name", "nested", "Nested"],
  ])("%s reaches its own declaration", async (_label, operation, expectedCase) => {
    const result = await inspect({
      file: "billing-domain/src/naming.rs",
      declarationPath: ["naming", "Invoice"],
      operation,
    });
    expect(standardResult(result)).toBe(true);
    expect(caseNames(result)).toEqual([expectedCase]);
  });
  test("the three colliding names resolve to three symbols", async () => {
    const symbols = await Promise.all(
      ["raw", "plain", "nested"].map(async (operation) =>
        errorSymbol(
          await inspect({ file: "billing-domain/src/naming.rs", declarationPath: ["naming", "Invoice"], operation }),
        ),
      ),
    );
    expect(new Set(symbols).size).toBe(3);
  });
  test("two packages that share a name are not merged into one candidate", async () => {
    const duplicate = (suffix: string): CargoPackage => ({
      packageId: `path+file:///fixture/duplicate-${suffix}#0.${suffix}.0`,
      name: "duplicate",
      edition: "2021",
      targets: [{ kind: "lib", name: "duplicate", srcPath: `duplicate-${suffix}/src/lib.rs` }],
      features: [],
      dependencyRenames: [],
    });
    const spec: Spec = {
      declarationPath: ["Invoice"],
      extraPackages: [duplicate("1"), duplicate("2")],
      operation: "issue",
      sources: [
        {
          path: "billing-domain/src/lib.rs",
          content:
            "pub struct Invoice;\nimpl Invoice { pub fn issue(&mut self) -> core::result::Result<(), duplicate::E> { loop {} } }\n",
        },
        { path: "duplicate-1/src/lib.rs", content: "pub enum E { One }\n" },
        { path: "duplicate-2/src/lib.rs", content: "pub enum E { Two }\n" },
      ],
    };
    const candidates = (await task(spec)).request.cargoCondition.packages.filter((entry) => entry.name === "duplicate");
    expect(candidates.map((entry) => entry.packageId)).toEqual([duplicate("1").packageId, duplicate("2").packageId]);

    const result = await inspect(spec);
    expect(codes(result)).toContain("multiple-package-versions");
    expect(standardResult(result)).toBe(false);
  });
});

describe("a build condition change inside one inspection process", () => {
  test("re-derives the case set and refuses the previous condition's response", async () => {
    const spec: Spec = {
      file: "billing-domain/src/invoice.rs",
      declarationPath: ["invoice", "Invoice"],
      operation: "issue",
    };
    const withoutFeature = await inspect(spec);
    expect(caseNames(withoutFeature)).toEqual(["AlreadyIssued", "Empty"]);

    const enabled = { ...spec, features: ["billing-use-case/extra-case"] };
    const withFeature = await inspect(enabled);
    expect(caseNames(withFeature)).toEqual(["AlreadyIssued", "Empty", "Rejected"]);
    expect(withFeature.requestIdentity).not.toBe(withoutFeature.requestIdentity);

    const first = await task(spec);
    const second = await task(enabled);
    const native = JSON.parse((await extractRust(first)).stdout);
    expect(convertRustResponse(native, second)).toBe("invalid-native-response");

    const converted = convertRustResponse(native, first);
    expect(typeof converted).toBe("object");
    const reused = resolveErrorContract(second.request, { status: "completed", response: converted });
    expect(reused).toMatchObject({ kind: "evaluated", result: { evidence: null } });
    if (reused.kind === "evaluated") expect(codes(reused.result)).toContain("identity-mismatch");
  });
});

describe("the frozen inspection input", () => {
  test("rejects a changed source and a claimed parser version before extraction", async () => {
    const frozen = await task({
      file: "billing-domain/src/invoice.rs",
      declarationPath: ["invoice", "Invoice"],
      operation: "issue",
    });
    await expect(
      extractRust({ ...frozen, input: { ...frozen.input, toolchain: [{ name: "syn", version: "1" }] } }),
    ).rejects.toThrow("toolchain identity mismatch");
    await expect(
      extractRust({
        ...frozen,
        input: {
          ...frozen.input,
          sources: [...frozen.input.sources.slice(1), { path: frozen.input.sources[0].path, content: "// changed\n" }],
        },
      }),
    ).rejects.toThrow("frozen input identity mismatch");
  });
  test("rejects a native response whose echoed identity does not match", async () => {
    const frozen = await task({
      file: "billing-domain/src/invoice.rs",
      declarationPath: ["invoice", "Invoice"],
      operation: "issue",
    });
    const raw = JSON.parse((await extractRust(frozen)).stdout);
    for (const change of [{ protocol_version: 2 }, { request_identity: "bad" }, { target: {} }])
      expect(convertRustResponse({ ...raw, ...change }, frozen)).toBe("invalid-native-response");
    expect(convertRustResponse(raw, frozen)).not.toBe("invalid-native-response");
  });
});

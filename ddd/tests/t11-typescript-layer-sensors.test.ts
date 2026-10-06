/**
 * The TypeScript use-case and interface-adapter gates (T-11-03): what the golden runner cannot
 * compare — the line and the words each finding names — plus that each scene means what the same
 * scene means to `ddd-rust-use-case` / `ddd-rust-interface-adapter`, that each gate reads only the
 * sources its rules decide from, and that nothing either gate cannot decide passes.
 *
 * Most cases are evaluated inside the test process through the same runtime the entries use; the
 * entries themselves are spawned where the process boundary is what is observed.
 */

import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, realpathSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  evaluateTypeScriptInterfaceAdapter,
  evaluateTypeScriptUseCase,
} from "../tools/ddd/lib/rules/typescript/evaluate.ts";
import { passedType } from "../tools/ddd/lib/rules/typescript/symbols.ts";
import { runSensor } from "../tools/ddd/lib/runtime/runtime.ts";
import { classifyTypeScriptExtractor, typeScriptExtractorIssue } from "../tools/ddd/lib/typescript/compiler/launch.ts";
import { ALL_CASES } from "./golden/catalog.ts";
import {
  type GoldenCase,
  judgeSensorRun,
  materializeCase,
  runGoldenCase,
  type SensorRun,
  type SensorVerdict,
  spawnSensor,
} from "./golden/runner.ts";
import { DOMAIN_DIR, DOMAIN_FILE } from "./golden/typescript/cases.ts";
import {
  COMMAND_API_DIR,
  commandApi,
  INTERFACE_ADAPTER_RUST_COUNTERPARTS,
  QUERY_USE_CASE_DIR,
  queryUseCase,
  TYPESCRIPT_INTERFACE_ADAPTER_CASES,
  TYPESCRIPT_INTERFACE_ADAPTER_SENSOR,
} from "./golden/typescript/interface-adapter-cases.ts";
import {
  INTERFACE_ADAPTER_DIR,
  interfaceAdapterPackage,
  type LayerPackage,
  layerCase,
  REPRESENTATIONS,
  USE_CASE_DIR,
  useCasePackage,
} from "./golden/typescript/layer-fixture.ts";
import {
  TYPESCRIPT_USE_CASE_CASES,
  TYPESCRIPT_USE_CASE_SENSOR,
  USE_CASE_RUST_COUNTERPARTS,
} from "./golden/typescript/use-case-cases.ts";

const PRODUCT_TOOLS_DIR = resolve(import.meta.dir, "../tools");
const SUPPORTED_WORKSPACE = resolve(import.meta.dir, "fixtures/operation-error-set/typescript-class-workspace");
/** Loading the multi-megabyte compiler, or copying the tree that carries it, is bounded real work. */
const LAUNCH_TIMEOUT_MS = 60_000;

const UC_FILE = `${USE_CASE_DIR}/src/index.ts`;
const ADAPTER_FILE = `${INTERFACE_ADAPTER_DIR}/src/index.ts`;
const COMMAND_API_FILE = `${COMMAND_API_DIR}/src/index.ts`;
const QUERY_USE_CASE_FILE = `${QUERY_USE_CASE_DIR}/src/index.ts`;
const QUERY_API_FILE = "packages/query/interface-adapter/billing-query-api/src/index.ts";
const SOURCE_MANIFEST = "construction/u1/code-generation/source-manifest.json";

beforeAll(() => {
  // The first classification loads the distributed compiler; every later one in this process reuses it.
  if (classifyTypeScriptExtractor(SUPPORTED_WORKSPACE).kind !== "ready")
    throw new Error("the distributed compiler did not launch");
}, LAUNCH_TIMEOUT_MS);

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});

const EVALUATORS = {
  [TYPESCRIPT_USE_CASE_SENSOR]: evaluateTypeScriptUseCase,
  [TYPESCRIPT_INTERFACE_ADAPTER_SENSOR]: evaluateTypeScriptInterfaceAdapter,
} as const;

/** Runs `testCase` through its gate's evaluation inside this process, as the entry runs it. */
function runInProcess(testCase: GoldenCase): SensorRun {
  const evaluate = EVALUATORS[testCase.sensor as keyof typeof EVALUATORS];
  if (!evaluate) throw new Error(`${testCase.name} is a case of ${testCase.sensor}, no layer gate`);
  const { root, outputPath } = materializeCase(testCase);
  const out: string[] = [];
  const err: string[] = [];
  try {
    const exitCode = runSensor(
      { sensor_id: testCase.sensor, severity: "blocking", evaluate: (context, api) => evaluate(context, api) },
      ["--stage", testCase.stage, "--output-path", outputPath],
      { stdout: (text) => out.push(text), stderr: (text) => err.push(text) },
    );
    return { exitCode, stdout: out.join("").trim(), stderr: err.join("") };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function verdictOf(testCase: GoldenCase): SensorVerdict {
  const run = runInProcess(testCase);
  if (run.exitCode !== 0) throw new Error(`${testCase.name} stopped with ${run.exitCode}: ${run.stderr}`);
  return JSON.parse(run.stdout) as SensorVerdict;
}

const LAYER_CASES = [...TYPESCRIPT_USE_CASE_CASES, ...TYPESCRIPT_INTERFACE_ADAPTER_CASES];

function caseNamed(sensor: string, name: string): GoldenCase {
  const found = LAYER_CASES.find((entry) => entry.sensor === sensor && entry.name === name);
  if (!found) throw new Error(`missing ${sensor} case ${name}`);
  return structuredClone(found);
}

const useCase = (name: string) => caseNamed(TYPESCRIPT_USE_CASE_SENSOR, name);
const adapterCase = (name: string) => caseNamed(TYPESCRIPT_INTERFACE_ADAPTER_SENSOR, name);

function sourceOf(testCase: GoldenCase, path: string): string {
  const source = testCase.workspace?.[path];
  if (source === undefined) throw new Error(`${testCase.name} carries no ${path}`);
  return source;
}

/** The 1-based line of the first line of `source` containing `text`. */
function lineOf(source: string, text: string): number {
  const index = source.split("\n").findIndex((line) => line.includes(text));
  if (index < 0) throw new Error(`the fixture has no line containing ${text}`);
  return index + 1;
}

function findingsOf(testCase: GoldenCase, rule: string): SensorVerdict["findings"] {
  return verdictOf(testCase).findings.filter((entry) => entry.rule_id === rule);
}

/** A use-case gate case over the class aggregate with `files` as the use-case package's sources. */
function useCaseWith(files: Readonly<Record<string, string>>, others: readonly LayerPackage[] = []): GoldenCase {
  return layerCase(
    TYPESCRIPT_USE_CASE_SENSOR,
    "class",
    "probe",
    { pkg: useCasePackage(files), others },
    { pass: true, rules: [] },
  );
}

/** An interface-adapter gate case over the class aggregate, claiming the entry of `pkg`. */
function adapterWith(pkg: LayerPackage, others: readonly LayerPackage[] = []): GoldenCase {
  return layerCase(TYPESCRIPT_INTERFACE_ADAPTER_SENSOR, "class", "probe", { pkg, others }, { pass: true, rules: [] });
}

/** `testCase` claiming `claims` (project-root relative) instead of what it claimed. */
function claiming(testCase: GoldenCase, claims: readonly string[]): GoldenCase {
  testCase.files[SOURCE_MANIFEST] = JSON.stringify({
    stage: "code-generation",
    unit: "u1",
    version: 1,
    writes: claims.map((path) => ({ path })),
  });
  return testCase;
}

// --- the golden cases, evaluated in process ----------------------------------------------------

describe("typescript layer golden cases decided in process", () => {
  for (const testCase of LAYER_CASES) {
    test(`${testCase.sensor} / ${testCase.name}`, () => {
      expect(judgeSensorRun(testCase, runInProcess(testCase)).problems).toEqual([]);
    });
  }
});

// --- the type an execute parameter hands over ---------------------------------------------------

describe("the wrappings that hand over the same type are removed from a parameter type", () => {
  test.each([
    ["Invoice", "Invoice"],
    ["Array<Invoice>", "Invoice"],
    ["ReadonlyArray<Invoice>", "Invoice"],
    ["Invoice[]", "Invoice"],
    ["readonly Invoice[]", "Invoice"],
    ["Readonly<Invoice> | null", "Invoice"],
    ["Array<Invoice | undefined>", "Invoice"],
    ["Readonly<ReadonlyArray<Invoice | null>> | undefined", "Invoice"],
    ["Record<string, Invoice>", "Record<string, Invoice>"],
    ["Invoice | Ledger", "Invoice | Ledger"],
  ])("%s hands over %s", (written, passed) => {
    expect(passedType(written)).toBe(passed);
  });
});

// --- what each use-case finding names ------------------------------------------------------------

describe("the use-case findings name the argument, the use case, the getter and the line", () => {
  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "an aggregate argument of a class method execute is reported on its declaration (%s)",
    (representation) => {
      const testCase = useCase(`violation-h-${representation}`);
      const reported = findingsOf(testCase, "h");
      expect(reported.map((entry) => [entry.file, entry.message])).toEqual([
        [UC_FILE, "execute receives aggregate Invoice directly; pass ids and value objects"],
      ]);
      expect(reported[0].line).toBe(lineOf(sourceOf(testCase, UC_FILE), "execute(invoice: Invoice)"));
    },
  );

  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "an aggregate argument of a top-level function execute is reported on its declaration (%s)",
    (representation) => {
      const testCase = useCase(`violation-h-function-${representation}`);
      const reported = findingsOf(testCase, "h");
      expect(reported.map((entry) => entry.message)).toEqual([
        "execute receives aggregate Invoice directly; pass ids and value objects",
      ]);
      expect(reported[0].line).toBe(lineOf(sourceOf(testCase, UC_FILE), "export function execute"));
    },
  );

  test("an aggregate inside a readonly array is still the aggregate", () => {
    const reported = findingsOf(useCase("violation-h-readonly-array-class"), "h");
    expect(reported).toHaveLength(1);
    expect(reported[0].message).toContain("aggregate Invoice directly");
  });

  test("a use case calling another is reported at the call, naming the called class by file and name", () => {
    const testCase = useCase("violation-i-class");
    const reported = findingsOf(testCase, "i");
    expect(reported.map((entry) => [entry.file, entry.message])).toEqual([
      [UC_FILE, `use case calls ${UC_FILE}#FinishInvoiceUseCase.execute`],
    ]);
    expect(reported[0].line).toBe(lineOf(sourceOf(testCase, UC_FILE), "other.execute();"));
  });

  test("a use case imported under another name is named where it is declared", () => {
    const reported = findingsOf(useCase("violation-i-imported-class"), "i");
    expect(reported.map((entry) => entry.message)).toEqual([
      `use case calls ${USE_CASE_DIR}/src/finish.ts#FinishInvoiceUseCase.execute`,
    ]);
  });

  test("a use case held in a field of the calling class is reported at the call", () => {
    const testCase = useCase("violation-i-field-class");
    const reported = findingsOf(testCase, "i");
    expect(reported).toHaveLength(1);
    expect(reported[0].line).toBe(lineOf(sourceOf(testCase, UC_FILE), "this.#finish.execute();"));
  });

  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "a getter called through an import alias is reported from the use-case layer (%s)",
    (representation) => {
      const testCase = useCase(`violation-d-alias-${representation}`);
      const reported = findingsOf(testCase, "d");
      expect(reported.map((entry) => [entry.file, entry.message])).toEqual([
        [UC_FILE, "getter total called from use-case layer (Tell, Don't Ask)"],
      ]);
      expect(reported[0].line).toBe(lineOf(sourceOf(testCase, UC_FILE), "return invoice.total();"));
    },
  );

  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "a getter result used in a calculation before it reaches the repository is a getter call (%s)",
    (representation) => {
      const testCase = useCase(`violation-d-repository-arithmetic-${representation}`);
      const reported = findingsOf(testCase, "d");
      expect(reported.map((entry) => entry.message)).toEqual([
        "getter id called from use-case layer (Tell, Don't Ask)",
      ]);
      expect(reported[0].line).toBe(lineOf(sourceOf(testCase, UC_FILE), "repo.remove(invoice.id() + 1);"));
    },
  );

  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "a getter result bound to a const and handed unchanged to the repository port passes (%s)",
    (representation) => {
      const verdict = verdictOf(useCase(`clean-d-repository-local-${representation}`));
      expect(verdict.pass).toBe(true);
      expect(verdict.findings).toEqual([]);
    },
  );

  test("the same forwarding to a port not named as a repository is a getter call", () => {
    const reported = findingsOf(useCase("violation-d-repository-unrelated-port-class"), "d");
    expect(reported.map((entry) => entry.message)).toEqual(["getter id called from use-case layer (Tell, Don't Ask)"]);
  });

  test.each([
    ["violation-g-use-case-to-interface-adapter-import-class", "layer-forbidden", UC_FILE],
    ["violation-g-use-case-type-only-class", "type-only", UC_FILE],
    ["violation-g-use-case-external-io-class", "external-io", UC_FILE],
    ["violation-g-use-case-to-interface-adapter-package-json-class", "layer-forbidden", `${USE_CASE_DIR}/package.json`],
  ])("%s is one finding whose message names the %s decision", (name, decision, file) => {
    const reported = findingsOf(useCase(name), "g");
    expect(reported).toHaveLength(1);
    expect(reported[0].file).toBe(file);
    expect(reported[0].message).toContain(decision);
  });
});

// --- what each interface-adapter finding names ----------------------------------------------------

describe("the interface-adapter findings name the side, the reference, the port and the construction", () => {
  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "a type-only import of the query side from the command side is a cross-side reference (%s)",
    (representation) => {
      const reported = findingsOf(adapterCase(`violation-k-type-only-${representation}`), "k");
      expect(reported.map((entry) => [entry.file, entry.line])).toEqual([[COMMAND_API_FILE, 1]]);
      expect(reported[0].message).toContain("type-only");
    },
  );

  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "the same import spelled only in a comment and a string is no cross-side reference (%s)",
    (representation) => {
      const verdict = verdictOf(adapterCase(`clean-k-commented-import-${representation}`));
      expect(verdict.pass).toBe(true);
      expect(verdict.findings.filter((entry) => entry.rule_id === "k")).toEqual([]);
    },
  );

  test("a query-side import of a domain type is reported on the import and names the type", () => {
    const reported = findingsOf(adapterCase("violation-l-class"), "l");
    expect(reported.map((entry) => [entry.file, entry.line, entry.message])).toEqual([
      [QUERY_USE_CASE_FILE, 1, "query side references domain type / repository port Invoice"],
    ]);
  });

  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "a query-side re-export of a domain type is reported on the re-export and names the type (%s)",
    (representation) => {
      const reported = findingsOf(adapterCase(`violation-l-reexport-${representation}`), "l");
      expect(reported.map((entry) => [entry.file, entry.line, entry.message])).toEqual([
        [QUERY_API_FILE, 1, "query side references domain type / repository port Invoice"],
      ]);
    },
  );

  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "a cross-side dependency the package.json alone states is reported on the package.json (%s)",
    (representation) => {
      const reported = findingsOf(adapterCase(`violation-k-package-json-${representation}`), "k");
      expect(reported.map((entry) => [entry.file, entry.message])).toEqual([
        [
          `${COMMAND_API_DIR}/package.json`,
          "cross-side reference @acme/billing-command-api -> @acme/billing-query-dao via package.json",
        ],
      ]);
    },
  );

  test("a query-side type-only import of the repository port names the port", () => {
    const reported = findingsOf(adapterCase("violation-l-repository-class"), "l");
    expect(reported.map((entry) => entry.message)).toEqual([
      "query side references domain type / repository port InvoiceRepository",
    ]);
  });

  test.each([
    ["violation-m-media-class", "repository port DynamoDbInvoiceRepository names a storage medium"],
    ["violation-m-media-type-literal-class", "repository port DynamoDbInvoiceRepository names a storage medium"],
    ["violation-m-aggregate-name-class", "repository port CustomerRepository is not <Aggregate>Repository"],
    ["violation-m-implementation-name-class", "repository type PaymentRepository is not <Aggregate>Repository"],
    ["violation-m-implementation-name-companion", "repository type PaymentRepository is not <Aggregate>Repository"],
  ])("%s is reported as the Rust gate words it", (name, message) => {
    const reported = findingsOf(adapterCase(name), "m");
    expect(reported.map((entry) => [entry.file, entry.message])).toEqual([[ADAPTER_FILE, message]]);
    expect(reported[0].line).toBe(1);
  });

  test.each([
    ["violation-n-class", "new-expression", 'return new Invoice("x", 0);'],
    ["violation-n-companion", "typed-object-literal", "const restored: Invoice"],
    ["violation-n-type-assertion-class", "type-assertion", "return value as Invoice;"],
    ["violation-n-type-assertion-companion", "type-assertion", "return value as Invoice;"],
  ])("%s names the construction that bypasses the factory", (name, kind, construct) => {
    const testCase = adapterCase(name);
    const reported = findingsOf(testCase, "n");
    expect(reported.map((entry) => [entry.file, entry.message])).toEqual([
      [ADAPTER_FILE, `adapter constructs Invoice via ${kind} instead of a full constructor`],
    ]);
    expect(reported[0].line).toBe(lineOf(sourceOf(testCase, ADAPTER_FILE), construct));
  });

  test.each([
    ["violation-g-interface-adapter-to-rmu-class", "layer-forbidden", ADAPTER_FILE],
    ["violation-g-interface-adapter-type-only-class", "type-only", ADAPTER_FILE],
    ["violation-g-interface-adapter-package-json-class", "layer-forbidden", `${INTERFACE_ADAPTER_DIR}/package.json`],
  ])("%s is one finding whose message names the %s decision", (name, decision, file) => {
    const reported = findingsOf(adapterCase(name), "g");
    expect(reported).toHaveLength(1);
    expect(reported[0].file).toBe(file);
    expect(reported[0].message).toContain(decision);
  });
});

// --- the same meaning as the Rust layer gates ------------------------------------------------------

/** The member a finding names, with Rust's path separator spelled as TypeScript's member access. */
const normalized = (message: string) => message.replaceAll("::", ".");
const rustVerdicts = new Map<string, SensorVerdict>();

function rustVerdict(sensor: string, name: string): SensorVerdict {
  const key = `${sensor}/${name}`;
  const cached = rustVerdicts.get(key);
  if (cached) return cached;
  const rustCase = ALL_CASES.find((entry) => entry.sensor === sensor && entry.name === name);
  if (!rustCase) throw new Error(`missing Rust case ${key}`);
  const verdict = runGoldenCase(PRODUCT_TOOLS_DIR, rustCase).verdict;
  if (!verdict) throw new Error(`${key} has no verdict`);
  rustVerdicts.set(key, verdict);
  return verdict;
}

const rulesOf = (verdict: SensorVerdict) => [...new Set(verdict.findings.map((entry) => entry.rule_id))].sort();

for (const [rustSensor, typescriptSensor, counterparts] of [
  ["ddd-rust-use-case", TYPESCRIPT_USE_CASE_SENSOR, USE_CASE_RUST_COUNTERPARTS],
  ["ddd-rust-interface-adapter", TYPESCRIPT_INTERFACE_ADAPTER_SENSOR, INTERFACE_ADAPTER_RUST_COUNTERPARTS],
] as const) {
  describe(`each scene means what the same scene of ${rustSensor} means`, () => {
    for (const [rustName, typescriptName] of Object.entries(counterparts)) {
      test.each(REPRESENTATIONS.map((representation) => [`${typescriptName}-${representation}`]))(
        `${rustName} and %s`,
        (name) => {
          const rust = rustVerdict(rustSensor, rustName);
          const typescript = verdictOf(caseNamed(typescriptSensor, name));
          expect(typescript.pass).toBe(rust.pass);
          expect(rulesOf(typescript)).toEqual(rulesOf(rust));
          // Rules d, h, l and m name a type and a member; both gates name the same ones in the same words.
          for (const rule of ["d", "h", "l", "m"]) {
            const messages = (verdict: SensorVerdict) =>
              verdict.findings.filter((entry) => entry.rule_id === rule).map((entry) => normalized(entry.message));
            expect(messages(typescript)).toEqual(messages(rust));
          }
        },
        LAUNCH_TIMEOUT_MS,
      );
    }
  });
}

// --- what each gate reads and reports ---------------------------------------------------------------

const THING: LayerPackage = {
  dir: "packages/misc/billing-thing",
  name: "@acme/billing-thing",
  files: { "src/index.ts": "export class Thing {}\n" },
};

describe("each gate reads the sources its rules decide from, and reports what the Rust gate reports", () => {
  test("the use-case gate does not report the layer of a claimed package it does not decide", () => {
    const testCase = claiming(useCaseWith({ "src/index.ts": "export class IssueInvoiceUseCase {}\n" }, [THING]), [
      UC_FILE,
      `${THING.dir}/src/index.ts`,
    ]);
    const verdict = verdictOf(testCase);
    expect(verdict.findings).toEqual([]);
    expect(verdict.pass).toBe(true);
  });

  test("a claimed file no package owns is reported by the use-case gate", () => {
    const testCase = claiming(useCaseWith({ "src/index.ts": "export class IssueInvoiceUseCase {}\n" }), [
      UC_FILE,
      "scripts/seed.ts",
    ]);
    (testCase.workspace ?? {})["scripts/seed.ts"] = "export const seed = 1;\n";
    const verdict = verdictOf(testCase);
    expect(verdict.pass).toBe(false);
    expect(verdict.findings.map((entry) => [entry.rule_id, entry.file])).toEqual([
      ["layer.unowned", "../../../../../scripts/seed.ts"],
    ]);
  });

  test("an unreadable source of the interface-adapter package does not stop the use-case gate", () => {
    const verdict = verdictOf(
      useCaseWith({ "src/index.ts": "export class IssueInvoiceUseCase {}\n" }, [
        interfaceAdapterPackage({ "src/index.ts": "const = ;\n" }),
      ]),
    );
    expect(verdict.pass).toBe(true);
  });

  // `repository-adapter-surface` resolves the port an adapter implements from the use-case package that declares
  // it, so a use-case source the facts cannot describe may hide that declaration and stops the gate.
  test("an unreadable source of the use-case package stops the interface-adapter gate, which resolves ports from it", () => {
    const run = runInProcess(
      adapterWith(interfaceAdapterPackage({ "src/index.ts": "export class Adapter {}\n" }), [
        useCasePackage({ "src/index.ts": "const = ;\n" }),
      ]),
    );
    expectStopped(run);
  });

  test("a query-side file of the use-case layer is decided by the interface-adapter gate", () => {
    const reported = findingsOf(adapterCase("violation-l-type-only-class"), "l");
    expect(reported.map((entry) => entry.file)).toEqual([QUERY_USE_CASE_FILE]);
  });

  test("a top-level function execute declared in the same file is no other use case", () => {
    const verdict = verdictOf(
      useCaseWith({ "src/index.ts": "function execute(): void {}\n\nexport function go(): void {\n  execute();\n}\n" }),
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.findings).toEqual([]);
  });
});

// --- nothing undecidable passes --------------------------------------------------------------------

function expectStopped(run: SensorRun): void {
  expect(run.exitCode, run.stdout).toBe(127);
  expect(run.stdout).toBe("");
}

/** Use-case sources a rule or the facts cannot decide, each with the construct the stop names. */
const USE_CASE_UNDECIDED: [string, string, string][] = [
  [
    "execute called by name where the file declares a class of that name",
    "class execute {}\n\nexport function go(): void {\n  execute();\n}\n",
    "execute();",
  ],
  [
    "execute called by name where the file declares a variable of that name",
    "const execute = (): void => {};\n\nexport function go(): void {\n  execute();\n}\n",
    "execute();",
  ],
  ["a syntax error", "export class IssueInvoiceUseCase {}\nconst = ;\n", "const = ;"],
  ["a decorator", "@sealed\nexport class IssueInvoiceUseCase {}\n", "@sealed"],
  [
    "a getter receiver without a stated type",
    'import { Invoice } from "@acme/billing-domain";\n\nexport function run(): string {\n  const invoice = Invoice.open("x", 0);\n  return invoice.id();\n}\n',
    "return invoice.id();",
  ],
  [
    "an execute receiver without a stated type",
    "export function run(): void {\n  const other = make();\n  other.execute();\n}\n",
    "other.execute();",
  ],
  [
    "an execute parameter without a stated type",
    "export class IssueInvoiceUseCase {\n  execute(invoice): void {}\n}\n",
    "execute(invoice)",
  ],
  [
    "an execute parameter holding the aggregate in another type",
    'import { Invoice } from "@acme/billing-domain";\n\nexport class IssueInvoiceUseCase {\n  execute(byId: Map<string, Invoice>): void {}\n}\n',
    "execute(byId",
  ],
  [
    "a function execute declared in another file",
    'import { execute } from "./run.ts";\n\nexport function go(): void {\n  execute();\n}\n',
    "  execute();",
  ],
  [
    "a specifier the package does not map",
    'import { X } from "#internal";\n\nexport class IssueInvoiceUseCase {}\n',
    "#internal",
  ],
];

describe("what the use-case gate cannot decide stops it", () => {
  test.each(USE_CASE_UNDECIDED)(
    "%s in a claimed use-case source stops the gate on its line",
    (_label, source, construct) => {
      const run = runInProcess(
        useCaseWith({ "src/index.ts": source, "src/run.ts": "export function execute(): void {}\n" }),
      );
      expectStopped(run);
      expect(run.stderr).toContain(`${UC_FILE}:${lineOf(source, construct)}`);
    },
  );

  test("an unreadable unclaimed source of the use-case package stops the gate", () => {
    const run = runInProcess(
      useCaseWith({ "src/index.ts": "export class IssueInvoiceUseCase {}\n", "src/other.ts": "const = ;\n" }),
    );
    expectStopped(run);
    expect(run.stderr).toContain(`${USE_CASE_DIR}/src/other.ts:1 syntax-error`);
  });

  // A name imported from a source of a package whose sources were not all read is decided from what was read.
  test("an alias of a repository port in a read source of the adapter package is followed to the port", () => {
    const clean = [
      'import type { Port } from "./port.ts";',
      "export class InMemoryInvoiceRepository implements Port {}",
      "",
    ].join("\n\n");
    const read = claiming(
      adapterWith(interfaceAdapterPackage({ "src/index.ts": clean, "src/port.ts": ADAPTER_PORT_ALIAS })),
      [ADAPTER_FILE, `${INTERFACE_ADAPTER_DIR}/src/port.ts`],
    );
    const verdict = verdictOf(read);
    expect(verdict.findings).toEqual([]);
    expect(verdict.pass).toBe(true);
  });

  test("a declaration other than an alias in a read source is no reason to stop the gate", () => {
    const files = {
      "src/index.ts":
        'import type { Ticker } from "./ticker.ts";\n\nexport class Clock implements Ticker {\n  tick(): void {}\n}\n',
      "src/ticker.ts": "export interface Ticker {\n  tick(): void;\n}\n",
    };
    const read = claiming(adapterWith(interfaceAdapterPackage(files)), [
      ADAPTER_FILE,
      `${INTERFACE_ADAPTER_DIR}/src/ticker.ts`,
    ]);
    expect(verdictOf(read).pass).toBe(true);
    expectStopped(runInProcess(adapterWith(interfaceAdapterPackage(files))));
  });

  // A package whose sources were not all read says nothing of the file an import names through its other files.
  const claimAdapter = (
    files: Record<string, string>,
    claimed: readonly string[],
    others: readonly LayerPackage[] = [],
  ) =>
    claiming(adapterWith(interfaceAdapterPackage(files), others), [
      ADAPTER_FILE,
      ...claimed.map((file) => `${INTERFACE_ADAPTER_DIR}/${file}`),
    ]);
  const implementing = (specifier: string) =>
    `import type { Port } from "${specifier}";\n\nexport class InMemoryInvoiceRepository implements Port {}\n`;

  test("a same-named declaration in another read source does not stand for an unread file the import names", () => {
    const files = {
      "src/index.ts": implementing("./port.ts"),
      "src/port.ts": ADAPTER_PORT_ALIAS,
      "src/other.ts": "export interface Port {\n  unrelated(): void;\n}\n",
    };
    const run = runInProcess(claimAdapter(files, ["src/other.ts"]));
    expectStopped(run);
    expect(run.stderr).toContain(
      `${ADAPTER_FILE}:${lineOf(files["src/index.ts"], "export class InMemoryInvoiceRepository")}`,
    );
    const read = claimAdapter(files, ["src/other.ts", "src/port.ts"]);
    expect(verdictOf(read).pass).toBe(true);
  });

  test("a same-named alias in another read source is not followed for a read file that declares something else", () => {
    const repository = useCasePackage({
      "src/index.ts": "export interface InvoiceRepository {\n  findById(id: string): string;\n}\n",
    });
    const files = {
      "src/index.ts":
        'import type { Ticker } from "./ticker.ts";\n\nexport class Clock implements Ticker {\n  tick(): void {}\n}\n',
      "src/ticker.ts": "export interface Ticker {\n  tick(): void;\n}\n",
      "src/other.ts":
        'import type { InvoiceRepository } from "@acme/billing-use-case";\n\nexport type Ticker = InvoiceRepository;\n',
    };
    const read = claimAdapter(files, ["src/ticker.ts", "src/other.ts"], [repository]);
    const verdict = verdictOf(read);
    expect(verdict.findings).toEqual([]);
    expect(verdict.pass).toBe(true);
  });

  test("a file that only re-exports the name is not followed, and stops the gate", () => {
    const files = {
      "src/index.ts": implementing("./ports.ts"),
      "src/ports.ts": 'export type { Port } from "./port.ts";\n',
      "src/port.ts": ADAPTER_PORT_ALIAS,
    };
    const run = runInProcess(claimAdapter(files, ["src/ports.ts", "src/port.ts"]));
    expectStopped(run);
    expect(run.stderr).toContain(
      `${ADAPTER_FILE}:${lineOf(files["src/index.ts"], "export class InMemoryInvoiceRepository")}`,
    );
    const direct = { ...files, "src/index.ts": implementing("./port.ts") };
    expect(verdictOf(claimAdapter(direct, ["src/ports.ts", "src/port.ts"])).pass).toBe(true);
  });

  test("an unreadable unclaimed source of the domain package stops the gate", () => {
    const testCase = useCaseWith({ "src/index.ts": "export class IssueInvoiceUseCase {}\n" });
    (testCase.workspace ?? {})[`${DOMAIN_DIR}/src/amount.ts`] = "const = ;\n";
    const run = runInProcess(testCase);
    expectStopped(run);
    expect(run.stderr).toContain(`${DOMAIN_DIR}/src/amount.ts:1 syntax-error`);
  });

  test("a use-case package the root tsconfig.json does not reference stops the gate", () => {
    const testCase = useCaseWith({ "src/index.ts": "export class IssueInvoiceUseCase {}\n" });
    (testCase.workspace ?? {})["tsconfig.json"] =
      `${JSON.stringify({ files: [], references: [{ path: `./${DOMAIN_DIR}` }] })}\n`;
    const run = runInProcess(testCase);
    expectStopped(run);
    expect(run.stderr).toContain(`does not reference ${USE_CASE_DIR}`);
  });

  test.each(REPRESENTATIONS.map((representation) => [representation]))(
    "an untyped getter receiver stops the gate over the %s aggregate too",
    (representation) => {
      const source =
        'import { Invoice } from "@acme/billing-domain";\n\nexport function run(): string {\n  const invoice = Invoice.open("x", 0);\n  return invoice.id();\n}\n';
      const run = runInProcess(
        layerCase(
          TYPESCRIPT_USE_CASE_SENSOR,
          representation,
          "untyped-getter",
          { pkg: useCasePackage({ "src/index.ts": source }) },
          { pass: true, rules: [] },
        ),
      );
      expectStopped(run);
      expect(run.stderr).toContain(`${UC_FILE}:${lineOf(source, "return invoice.id();")}`);
    },
  );
});

/** An alias of a repository port, which the adapter package declares in a source of its own. */
const ADAPTER_PORT_ALIAS = [
  'import type { InvoiceRepository } from "@acme/billing-use-case";',
  "export type Port = InvoiceRepository;",
  "",
].join("\n");

/** Interface-adapter sources a rule or the facts cannot decide, each with the construct the stop names. */
const ADAPTER_UNDECIDED: [string, LayerPackage, string, string][] = [
  [
    "a query-side namespace import of the domain package",
    queryUseCase('import * as billing from "@acme/billing-domain";\n\nexport type Row = billing.Invoice;\n'),
    QUERY_USE_CASE_FILE,
    "import * as billing",
  ],
  [
    "a query-side dynamic import of the domain package",
    queryUseCase(
      'export async function load(): Promise<unknown> {\n  return await import("@acme/billing-domain");\n}\n',
    ),
    QUERY_USE_CASE_FILE,
    'import("@acme/billing-domain")',
  ],
  [
    "a query-side import type of the domain package",
    queryUseCase('export type Row = import("@acme/billing-domain").Invoice;\n'),
    QUERY_USE_CASE_FILE,
    "export type Row",
  ],
  [
    "a query-side export * of the domain package",
    queryUseCase('export * from "@acme/billing-domain";\n'),
    QUERY_USE_CASE_FILE,
    "export * from",
  ],
  ["a syntax error", commandApi("export class CommandApi {}\nconst = ;\n"), COMMAND_API_FILE, "const = ;"],
  [
    "a repository port named through an alias that is not one named type",
    interfaceAdapterPackage({
      "src/index.ts": [
        "export interface InvoiceRepository {\n  findById(id: string): string;\n}",
        "type Port = InvoiceRepository & { readonly tag: true };",
        "export class InMemoryInvoiceRepository implements Port {}",
        "",
      ].join("\n\n"),
    }),
    ADAPTER_FILE,
    "export class InMemoryInvoiceRepository",
  ],
  [
    "a repository port named through an alias of a source the gate did not read",
    interfaceAdapterPackage({
      "src/index.ts": [
        'import type { Port } from "./port.ts";',
        "export class InMemoryInvoiceRepository implements Port {}",
        "",
      ].join("\n\n"),
      "src/port.ts": ADAPTER_PORT_ALIAS,
    }),
    ADAPTER_FILE,
    "export class InMemoryInvoiceRepository",
  ],
  [
    "a construction whose type holds the aggregate in another type",
    interfaceAdapterPackage({
      "src/index.ts":
        'import { Invoice } from "@acme/billing-domain";\n\nexport const byId = {} as Record<string, Invoice>;\n',
    }),
    ADAPTER_FILE,
    "export const byId",
  ],
];

describe("what the interface-adapter gate cannot decide stops it", () => {
  test.each(ADAPTER_UNDECIDED)("%s stops the gate on its line", (_label, pkg, file, construct) => {
    const run = runInProcess(adapterWith(pkg));
    expectStopped(run);
    expect(run.stderr).toContain(`${file}:${lineOf(pkg.files["src/index.ts"] ?? "", construct)}`);
  });

  test("an unreadable unclaimed source of the domain package stops the gate", () => {
    const testCase = adapterWith(interfaceAdapterPackage({ "src/index.ts": "export class Adapter {}\n" }));
    (testCase.workspace ?? {})[`${DOMAIN_DIR}/src/amount.ts`] = "const = ;\n";
    const run = runInProcess(testCase);
    expectStopped(run);
    expect(run.stderr).toContain(`${DOMAIN_DIR}/src/amount.ts:1 syntax-error`);
  });
});

// --- the entries -------------------------------------------------------------------------------------

/** A private copy of the tools tree whose vendored compiler manifest is gone. */
function toolsWithoutCompiler(): { tools: string; vendor: string } {
  // The real path, because the stopped entry reports the vendor directory it resolved from its own file.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ddd-typescript-layer-tools-")));
  temporary.push(root);
  const tools = join(root, "tools");
  cpSync(PRODUCT_TOOLS_DIR, tools, { recursive: true });
  const vendor = join(tools, "ddd/lib/typescript/vendor");
  unlinkSync(join(vendor, "manifest.json"));
  return { tools, vendor };
}

const ENTRY_CASES: [string, GoldenCase, string][] = [
  [TYPESCRIPT_USE_CASE_SENSOR, useCase("clean-h-id-class"), UC_FILE],
  [TYPESCRIPT_INTERFACE_ADAPTER_SENSOR, adapterCase("clean-repository-class"), ADAPTER_FILE],
];

describe("the entries stop, and answer without the compiler where there is nothing to decide", () => {
  test.each(ENTRY_CASES)(
    "%s stops on an unparsable claimed source with no verdict on stdout",
    (sensor, clean, file) => {
      const testCase = structuredClone(clean);
      const workspace = testCase.workspace ?? {};
      workspace[file] = `${sourceOf(testCase, file)}const = ;\n`;
      const run = spawnSensor(PRODUCT_TOOLS_DIR, testCase);
      expectStopped(run);
      expect(run.stderr).toContain(`${sensor}: tool unavailable: `);
      expect(run.stderr).toContain(`${file}:${lineOf(workspace[file], "const = ;")} syntax-error`);
    },
    LAUNCH_TIMEOUT_MS,
  );

  test.each(ENTRY_CASES)(
    "%s stops as uninspectable when the compiler cannot be launched",
    (sensor, clean) => {
      const { tools, vendor } = toolsWithoutCompiler();
      const project = mkdtempSync(join(tmpdir(), "ddd-typescript-layer-project-"));
      temporary.push(project);
      const outcome = classifyTypeScriptExtractor(project, vendor);
      expect(outcome.kind).toBe("compiler-missing");
      const run = spawnSensor(tools, clean);
      expectStopped(run);
      expect(run.stderr).toContain(`${sensor}: tool unavailable: ${typeScriptExtractorIssue(outcome).message}\n`);
    },
    LAUNCH_TIMEOUT_MS,
  );

  test.each(ENTRY_CASES)(
    "%s answers without the compiler when only domain sources are claimed",
    (_sensor, clean) => {
      const { tools } = toolsWithoutCompiler();
      const run = spawnSensor(tools, claiming(structuredClone(clean), [DOMAIN_FILE]));
      expect(run.exitCode, run.stderr).toBe(0);
      const verdict = JSON.parse(run.stdout) as SensorVerdict;
      expect(verdict.pass).toBe(true);
      expect(verdict.findings).toEqual([]);
    },
    LAUNCH_TIMEOUT_MS,
  );
});

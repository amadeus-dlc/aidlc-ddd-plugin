/**
 * The TypeScript domain gate (T-11-02): what the golden runner cannot compare — the line, the type
 * and the member each finding names — plus that its findings mean what the Rust domain gate's mean,
 * that state hiding is decided as the state-evidence inspection decides it, and that nothing it
 * cannot decide passes: an unresolved construct, an unread file and a compiler that does not launch
 * all stop the gate the way T-11-01 stops an inspection.
 *
 * Most cases are evaluated inside the test process through the same runtime the entry uses, so the
 * rule code they reach is measured; the entry itself is spawned where the process boundary is what
 * is observed.
 */

import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { evaluateTypeScriptDomain } from "../tools/ddd/lib/rules/typescript/evaluate.ts";
import { runSensor } from "../tools/ddd/lib/runtime/runtime.ts";
import {
  classifyTypeScriptExtractor,
  type TypeScriptExtractorFailureKind,
  typeScriptExtractorIssue,
} from "../tools/ddd/lib/typescript/compiler/launch.ts";
import { SUPPORTED_COMPILER_API_VERSION } from "../tools/ddd/lib/typescript/compiler/settings.ts";
import {
  type GoldenCase,
  judgeSensorRun,
  materializeCase,
  runGoldenCase,
  type SensorRun,
  type SensorVerdict,
  spawnSensor,
} from "./golden/runner.ts";
import { RUST_CASES } from "./golden/rust/cases.ts";
import {
  CLASS_CLEAN,
  COMPANION_CLEAN,
  DOMAIN_DIR,
  DOMAIN_FILE,
  DOMAIN_INDEX,
  edit,
  RUST_COUNTERPARTS,
  SKIPPED_STATE,
  TYPESCRIPT_CASES,
  TYPESCRIPT_SENSOR,
  tsCase,
  USE_CASE,
} from "./golden/typescript/cases.ts";

const PRODUCT_TOOLS_DIR = resolve(import.meta.dir, "../tools");
const SUPPORTED_WORKSPACE = resolve(import.meta.dir, "fixtures/operation-error-set/typescript-class-workspace");
const STATE_EVIDENCE = resolve(import.meta.dir, "fixtures/state-exposure-languages");
/** Loading the multi-megabyte compiler, or copying the tree that carries it, is bounded real work. */
const LAUNCH_TIMEOUT_MS = 60_000;

beforeAll(() => {
  // The first classification loads the distributed compiler; every later one in this process reuses it.
  if (classifyTypeScriptExtractor(SUPPORTED_WORKSPACE).kind !== "ready")
    throw new Error("the distributed compiler did not launch");
}, LAUNCH_TIMEOUT_MS);

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});
function temporaryDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(root);
  return root;
}

/** Runs `testCase` through the gate's evaluation inside this process, as the entry runs it. */
function runInProcess(testCase: GoldenCase): SensorRun {
  const { root, outputPath } = materializeCase(testCase);
  const out: string[] = [];
  const err: string[] = [];
  try {
    const exitCode = runSensor(
      {
        sensor_id: TYPESCRIPT_SENSOR,
        severity: "blocking",
        evaluate: (context, api) => evaluateTypeScriptDomain(context, api),
      },
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

function caseNamed(name: string): GoldenCase {
  const found = TYPESCRIPT_CASES.find((entry) => entry.name === name);
  if (!found) throw new Error(`missing TypeScript case ${name}`);
  return structuredClone(found);
}

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

function findingsOf(name: string, rule: string): SensorVerdict["findings"] {
  return verdictOf(caseNamed(name)).findings.filter((entry) => entry.rule_id === rule);
}

const PEEK_CALL = "\nexport function peek(invoice: Invoice): number {\n  return invoice.total();\n}\n";

/** A case of no expectation of its own: the clean class with the domain source replaced. */
function withDomainSource(name: string, source: string): GoldenCase {
  return tsCase(name, { source }, { pass: true, rules: [] });
}

// --- the golden cases, evaluated in process ----------------------------------------------------

describe("typescript golden cases decided in process", () => {
  for (const testCase of TYPESCRIPT_CASES) {
    test(testCase.name, () => {
      expect(judgeSensorRun(testCase, runInProcess(testCase)).problems).toEqual([]);
    });
  }
});

// --- what each finding names ---------------------------------------------------------------------

describe("the findings name the member, the method and the line", () => {
  test("a public class field is reported on its declaration under the type and member name", () => {
    const testCase = caseNamed("violation-a-class");
    const reported = findingsOf("violation-a-class", "a");
    expect(reported).toHaveLength(1);
    expect(reported[0].message).toBe("public field Invoice.id in domain layer");
    expect(reported[0].line).toBe(lineOf(sourceOf(testCase, DOMAIN_FILE), "  id: string;"));
  });

  test("a private keyword field is reported, because the keyword does not hide it at run time", () => {
    const reported = findingsOf("violation-a-class-private", "a");
    expect(reported).toHaveLength(1);
    expect(reported[0].message).toContain("Invoice.amount");
  });

  test("a protected parameter property is reported as a field of the class", () => {
    const reported = findingsOf("violation-a-class-parameter-property", "a");
    expect(reported).toHaveLength(1);
    expect(reported[0].message).toContain("Invoice.id");
  });

  test("a companion property is reported once, on the type literal that declares it", () => {
    const testCase = caseNamed("violation-a-companion");
    const reported = findingsOf("violation-a-companion", "a");
    expect(reported).toHaveLength(1);
    expect(reported[0].message).toBe("public field Invoice.id in domain layer");
    expect(reported[0].line).toBe(lineOf(sourceOf(testCase, DOMAIN_FILE), "readonly id: string;"));
  });

  test.each(["violation-b-class", "violation-b-companion"])(
    "%s reports the undeclared mutating method and the command it would need",
    (name) => {
      const reported = findingsOf(name, "b");
      expect(reported).toHaveLength(1);
      expect(reported[0].message).toBe("mutating method Invoice.rename is not declared as command.invoice.rename");
    },
  );

  test("an undeclared class method is reported on its declaration", () => {
    const testCase = caseNamed("violation-b-class");
    const [reported] = findingsOf("violation-b-class", "b");
    expect(reported.line).toBe(lineOf(sourceOf(testCase, DOMAIN_FILE), "rename(): void {"));
  });

  test.each(["violation-d-class", "violation-d-companion"])("%s reports the getter at its call", (name) => {
    const testCase = caseNamed(name);
    const reported = findingsOf(name, "d");
    expect(reported).toHaveLength(1);
    expect(reported[0].message).toBe("getter total called from domain layer (Tell, Don't Ask)");
    expect(reported[0].line).toBe(lineOf(sourceOf(testCase, DOMAIN_FILE), "return invoice.total();"));
  });

  test.each([
    [
      "a class method that only pushes onto a field stated as an array",
      edit(
        edit(CLASS_CLEAN, "#issued = false;", "#issued = false;\n  #lines: string[] = [];"),
        "total(): number {",
        "addLine(line: string): void {\n    this.#lines.push(line);\n  }\n\n  total(): number {",
      ),
    ],
    [
      "a companion method that only pushes onto closure state",
      edit(
        edit(
          edit(COMPANION_CLEAN, "issue(): void;", "issue(): void; addLine(line: string): void;"),
          "const state = { id, amount, issued: false };",
          "const state = { id, amount, issued: false };\n    const lines: string[] = [];",
        ),
        "      total() {",
        "      addLine(line: string) {\n        lines.push(line);\n      },\n      total() {",
      ),
    ],
  ])("%s is an undeclared mutation", (_label, source) => {
    const verdict = verdictOf(withDomainSource("collection-mutation", source));
    expect(verdict.findings.map((entry) => [entry.rule_id, entry.message])).toEqual([
      ["b", "mutating method Invoice.addLine is not declared as command.invoice.add-line"],
    ]);
  });

  test("a companion getter that returns closure state itself is reported at its call", () => {
    const source = `${edit(COMPANION_CLEAN, "return state.amount;", "return amount;")}${PEEK_CALL}`;
    const reported = verdictOf(withDomainSource("closure-getter", source)).findings;
    expect(reported.map((entry) => [entry.rule_id, entry.line])).toEqual([
      ["d", lineOf(source, "return invoice.total();")],
    ]);
  });

  test("a method returning a module constant is not a getter", () => {
    const source = `const CURRENCY = "JPY";\n${edit(
      CLASS_CLEAN,
      "total(): number {",
      "currency(): string {\n    return CURRENCY;\n  }\n\n  total(): number {",
    )}\nexport function label(invoice: Invoice): string {\n  return invoice.currency();\n}\n`;
    expect(verdictOf(withDomainSource("module-constant", source)).findings).toEqual([]);
  });

  test("a post-init method is an incomplete construction, not an undeclared command", () => {
    const verdict = verdictOf(caseNamed("violation-c-post-init"));
    expect(verdict.findings.map((entry) => entry.rule_id)).toEqual(["c"]);
    expect(verdict.findings[0].message).toContain("reset");
  });

  test("a construction inside a template substitution is reported on its line", () => {
    const testCase = caseNamed("violation-c-template-substitution");
    const reported = findingsOf("violation-c-template-substitution", "c");
    expect(reported).toHaveLength(1);
    expect(reported[0].line).toBe(lineOf(sourceOf(testCase, DOMAIN_FILE), "export const label"));
  });

  test("each import through a path the package does not export is reported on its own line", () => {
    const reported = findingsOf("violation-g-private-path", "g");
    expect(reported.map((entry) => [entry.file, entry.line])).toEqual([
      [DOMAIN_FILE, 1],
      [DOMAIN_FILE, 2],
    ]);
    for (const entry of reported) expect(entry.message).toContain("private-path");
  });

  test("each wildcard re-export of the public entry is reported on its own line", () => {
    const reported = findingsOf("violation-g-wildcard-reexport", "g");
    expect(reported.map((entry) => [entry.file, entry.line])).toEqual([
      [DOMAIN_INDEX, 1],
      [DOMAIN_INDEX, 2],
    ]);
    for (const entry of reported) expect(entry.message).toContain("wildcard-reexport");
  });

  test.each([
    ["violation-g-class", "layer-forbidden", DOMAIN_FILE],
    ["violation-g-type-only", "type-only", DOMAIN_FILE],
    ["violation-g-alias", "alias", DOMAIN_FILE],
    ["violation-g-external-io", "external-io", DOMAIN_FILE],
    ["violation-g-package-json-dependency", "layer-forbidden", `${DOMAIN_DIR}/package.json`],
  ])("%s is one finding whose message names the %s decision", (name, decision, file) => {
    const reported = findingsOf(name, "g");
    expect(reported).toHaveLength(1);
    expect(reported[0].file).toBe(file);
    expect(reported[0].message).toContain(decision);
  });

  test("a type-only dependency on a forbidden layer is also named layer-forbidden", () => {
    const [finding] = findingsOf("violation-g-type-only", "g");
    expect(finding.message).toContain("layer-forbidden");
  });
});

// --- the same meaning as the Rust domain gate -------------------------------------------------------

/** The member a finding names, with Rust's path separator spelled as TypeScript's member access. */
const normalized = (message: string) => message.replaceAll("::", ".");

describe("each scene means what the Rust domain gate's same scene means", () => {
  for (const [rustName, representations] of Object.entries(RUST_COUNTERPARTS)) {
    test.each(representations.map((name) => [name]))(
      `${rustName} and %s`,
      (name) => {
        const rustCase = RUST_CASES.find((entry) => entry.name === rustName && entry.sensor === "ddd-rust-domain");
        if (!rustCase) throw new Error(`missing Rust case ${rustName}`);
        const rust = runGoldenCase(PRODUCT_TOOLS_DIR, rustCase).verdict;
        if (!rust) throw new Error(`${rustName} has no verdict`);
        const typescript = verdictOf(caseNamed(name));
        expect(typescript.pass).toBe(rust.pass);
        const rules = (verdict: SensorVerdict) => [...new Set(verdict.findings.map((entry) => entry.rule_id))].sort();
        expect(rules(typescript)).toEqual(rules(rust));
        // Rules a, b and d name a type and a member; both gates name the same ones in the same words.
        for (const rule of ["a", "b", "d"]) {
          const messages = (verdict: SensorVerdict) =>
            verdict.findings.filter((entry) => entry.rule_id === rule).map((entry) => normalized(entry.message));
          expect(messages(typescript)).toEqual(messages(rust));
        }
      },
      LAUNCH_TIMEOUT_MS,
    );
  }
});

// --- the state-evidence decisions --------------------------------------------------------------------

interface StateEvidenceCase {
  readonly caseId: string;
  readonly sourceFile: string;
  readonly language: string;
  readonly expected: { readonly result?: { readonly ruleResult: string; readonly findings: { memberId: string }[] } };
}

const STATE_EVIDENCE_CASES = (
  JSON.parse(readFileSync(join(STATE_EVIDENCE, "cases.json"), "utf8")) as StateEvidenceCase[]
).filter((entry) => entry.language === "typescript");

/** The fixture as the only model file of the domain package; the model is skipped so only a decides. */
function stateEvidenceCase(entry: StateEvidenceCase): GoldenCase {
  return tsCase(
    `state-evidence-${entry.caseId}`,
    {
      files: {
        "src/index.ts": "export const ready = true;\n",
        "src/model.ts": readFileSync(join(STATE_EVIDENCE, entry.sourceFile), "utf8"),
      },
      claims: [`${DOMAIN_DIR}/src/model.ts`],
      modules: [["model"]],
      state: SKIPPED_STATE,
    },
    { pass: true, rules: [] },
  );
}

describe("state hiding is decided as the state-evidence inspection decides it", () => {
  test("the shared fixtures cover both representations and all three answers", () => {
    expect(STATE_EVIDENCE_CASES.map((entry) => entry.caseId).sort()).toEqual([
      "ts-class-mixed",
      "ts-class-private",
      "ts-class-public",
      "ts-class-unresolved",
      "ts-companion-private",
      "ts-companion-public",
      "ts-companion-unresolved",
    ]);
  });

  for (const entry of STATE_EVIDENCE_CASES) {
    const expected = entry.expected.result;
    test(`${entry.caseId} (${expected?.ruleResult})`, () => {
      if (!expected) throw new Error(`${entry.caseId} records no evaluated result`);
      const run = runInProcess(stateEvidenceCase(entry));
      if (expected.ruleResult === "unresolved") {
        // What the inspection leaves unresolved never passes the gate: it stops as uninspectable.
        expect(run.exitCode).toBe(127);
        expect(run.stdout).toBe("");
        return;
      }
      expect(run.exitCode, run.stderr).toBe(0);
      const verdict = JSON.parse(run.stdout) as SensorVerdict;
      const hidden = verdict.findings.filter((finding) => finding.rule_id === "a");
      if (expected.ruleResult === "pass") {
        expect(verdict.pass).toBe(true);
        expect(hidden).toEqual([]);
        return;
      }
      expect(verdict.pass).toBe(false);
      expect(hidden.map((finding) => finding.message)).toEqual(
        expected.findings.map((finding) => `public field ${finding.memberId.replace("::", ".")} in domain layer`),
      );
    });
  }
});

// --- nothing undecidable passes --------------------------------------------------------------------

function expectStopped(run: SensorRun): void {
  expect(run.exitCode, run.stdout).toBe(127);
  expect(run.stdout).toBe("");
}

const FACT_UNRESOLVED: [string, string][] = [
  ["decorator", "@sealed class A {}"],
  ["computed-name", "class A { [keys.main]() {} }"],
  ["object-spread", "const policy = { ...defaults, limit: 1 };"],
  ["binding-pattern", "const { a } = source;"],
  ["import-equals", 'import fs = require("fs");'],
  ["export-assignment", "export = foo;"],
  ["dynamic-import", "import(name);"],
  ["namespace", "namespace N { export const x = 1; }"],
  ["dynamic-callee", "handlers[kind]();"],
];

describe("what the facts leave unresolved stops the gate", () => {
  test.each(FACT_UNRESOLVED)("%s in a claimed domain file is listed and stops the gate", (reason, snippet) => {
    const source = `${CLASS_CLEAN}${snippet}\n`;
    const run = runInProcess(withDomainSource(`unresolved-${reason}`, source));
    expectStopped(run);
    expect(run.stderr).toContain(`domain-facts.unresolved: ${DOMAIN_FILE}:${lineOf(source, snippet)} ${reason}`);
  });

  test("a syntax error in a claimed domain file stops the gate and names the line", () => {
    const source = `${CLASS_CLEAN}const = ;\n`;
    const run = runInProcess(withDomainSource("unresolved-syntax-claimed", source));
    expectStopped(run);
    expect(run.stderr).toContain(`${DOMAIN_FILE}:${lineOf(source, "const = ;")} syntax-error`);
  });

  test("a syntax error in an unclaimed source of the domain package also stops the gate", () => {
    const testCase = tsCase(
      "unresolved-syntax-unclaimed",
      { files: { "src/index.ts": "const = ;\n", "src/invoice.ts": CLASS_CLEAN } },
      { pass: true, rules: [] },
    );
    const run = runInProcess(testCase);
    expectStopped(run);
    expect(run.stderr).toContain(`${DOMAIN_INDEX}:1 syntax-error`);
  });

  test("an unresolved construct in an unclaimed source of the domain package also stops the gate", () => {
    const testCase = tsCase(
      "unresolved-namespace-unclaimed",
      { files: { "src/index.ts": "namespace N {}\n", "src/invoice.ts": CLASS_CLEAN } },
      { pass: true, rules: [] },
    );
    const run = runInProcess(testCase);
    expectStopped(run);
    expect(run.stderr).toContain(`domain-facts.unresolved: ${DOMAIN_INDEX}:1 namespace`);
  });

  test(
    "the entry itself stops with no verdict on stdout",
    () => {
      const source = `${CLASS_CLEAN}const = ;\n`;
      const run = spawnSensor(PRODUCT_TOOLS_DIR, withDomainSource("unresolved-syntax-entry", source));
      expectStopped(run);
      expect(run.stderr).toContain(`${TYPESCRIPT_SENSOR}: tool unavailable: `);
      expect(run.stderr).toContain(`${DOMAIN_FILE}:${lineOf(source, "const = ;")} syntax-error`);
    },
    LAUNCH_TIMEOUT_MS,
  );
});

const COMPANION_INSTANCE = `    const instance: Invoice = {
      [brand]: true,
      issue() {
        state.issued = true;
      },
      total() {
        return state.amount;
      },
    };
    return instance;
`;

/** Sources a rule of this gate cannot decide from the facts; each names the construct it stops on. */
const RULE_UNRESOLVED: [string, string, string | undefined][] = [
  [
    "a class accessor",
    edit(
      CLASS_CLEAN,
      "total(): number {",
      "get amount(): number {\n    return this.#amount;\n  }\n\n  total(): number {",
    ),
    "get amount()",
  ],
  [
    "a class with a base class",
    `class Base {}\n${edit(CLASS_CLEAN, "export class Invoice {", "export class Invoice extends Base {")}`,
    "export class Invoice extends Base",
  ],
  [
    "a declared class field",
    edit(CLASS_CLEAN, "#issued = false;", "#issued = false;\n  declare note: string;"),
    "declare note",
  ],
  [
    "an abstract class field",
    edit(
      edit(CLASS_CLEAN, "export class Invoice {", "export abstract class Invoice {"),
      "#issued = false;",
      "#issued = false;\n  abstract note: string;",
    ),
    "abstract note",
  ],
  [
    "a computed class member keyed by an identifier",
    `const key = "k";\n${edit(CLASS_CLEAN, "#issued = false;", "#issued = false;\n  [key]() {}")}`,
    "[key]() {}",
  ],
  ["an exported brand", edit(COMPANION_CLEAN, "const brand:", "export const brand:"), undefined],
  ["a brand from the global registry", edit(COMPANION_CLEAN, 'Symbol("Invoice")', 'Symbol.for("Invoice")'), undefined],
  [
    "a brand without a unique symbol type",
    edit(COMPANION_CLEAN, "const brand: unique symbol =", "const brand ="),
    undefined,
  ],
  ["a companion with no instance", edit(COMPANION_CLEAN, COMPANION_INSTANCE, "    return make(state);\n"), undefined],
  [
    "a companion instance that lacks a method of its type",
    edit(COMPANION_CLEAN, "      total() {\n        return state.amount;\n      },\n", ""),
    undefined,
  ],
  [
    "a spread in a companion instance",
    edit(COMPANION_CLEAN, "[brand]: true,\n", "[brand]: true,\n      ...extra,\n"),
    undefined,
  ],
  [
    "a companion instance made by an assertion",
    edit(COMPANION_CLEAN, "    return instance;\n", "    return instance as Invoice;\n"),
    "return instance as Invoice;",
  ],
  [
    "a getter receiver without a type annotation",
    `${CLASS_CLEAN}\nexport function peek(): number {\n  const invoice = Invoice.open("x", 0);\n  return invoice.total();\n}\n`,
    "return invoice.total();",
  ],
  [
    "a getter receiver annotated with a union",
    `${CLASS_CLEAN}\nexport function peek(invoice: Invoice | Draft): number {\n  return invoice.total();\n}\n`,
    "return invoice.total();",
  ],
];

describe("what the rules cannot decide stops the gate", () => {
  test.each(RULE_UNRESOLVED)("%s", (_label, source, construct) => {
    const run = runInProcess(withDomainSource("unresolved-rule", source));
    expectStopped(run);
    expect(run.stderr).toContain(DOMAIN_FILE);
    if (construct !== undefined) expect(run.stderr).toContain(`${DOMAIN_FILE}:${lineOf(source, construct)}`);
  });

  test.each([
    ["a relative path out of every package", `import { X } from "../../../../shared/x.ts";\n${CLASS_CLEAN}`],
    ["an import specifier the package does not map", `import { X } from "#internal";\n${CLASS_CLEAN}`],
  ])("a dependency through %s stops the gate", (_label, source) => {
    const run = runInProcess(
      tsCase(
        "unresolved-dependency",
        { source, extra: { "shared/x.ts": "export class X {}\n" } },
        { pass: true, rules: [] },
      ),
    );
    expectStopped(run);
  });

  test("a dependency on a package that states no exports stops the gate", () => {
    const run = runInProcess(
      tsCase(
        "unresolved-exports",
        {
          source: `import { IssueInvoiceUseCase } from "@acme/billing-use-case";\n${CLASS_CLEAN}`,
          others: [{ ...USE_CASE, manifest: { exports: undefined } }],
        },
        { pass: true, rules: [] },
      ),
    );
    expectStopped(run);
  });

  test("a domain package the root tsconfig.json does not reference stops the gate", () => {
    const testCase = tsCase("unreferenced-domain-package", { others: [USE_CASE] }, { pass: true, rules: [] });
    const workspace = testCase.workspace ?? {};
    workspace["tsconfig.json"] = `${JSON.stringify({ files: [], references: [{ path: `./${USE_CASE.dir}` }] })}\n`;
    const run = runInProcess(testCase);
    expectStopped(run);
    expect(run.stderr).toContain(`does not reference ${DOMAIN_DIR}`);
  });

  test("a string key spelled like the brand is not a brand and never passes", () => {
    const source = edit(
      edit(COMPANION_CLEAN, "readonly [brand]: true;", 'readonly "[brand]": true;'),
      "[brand]: true,\n",
      '"[brand]": true,\n',
    );
    const run = runInProcess(withDomainSource("string-key-brand", source));
    if (run.exitCode === 127) {
      expect(run.stdout).toBe("");
      return;
    }
    expect(run.exitCode, run.stderr).toBe(0);
    const verdict = JSON.parse(run.stdout) as SensorVerdict;
    expect(verdict.pass).toBe(false);
    expect(verdict.findings.some((entry) => entry.rule_id === "a" && entry.message.includes("[brand]"))).toBe(true);
  });

  test("two files naming one module path leave that module unresolved", () => {
    const verdict = verdictOf(
      tsCase(
        "packaging-module-collision",
        { addFiles: { "src/invoice/index.ts": "export const other = 1;\n" } },
        { pass: false, rules: [] },
      ),
    );
    expect(verdict.pass).toBe(false);
    const unresolved = verdict.findings.filter((entry) => entry.rule_id === "domain-packaging.unresolved");
    expect(unresolved).toHaveLength(1);
    expect([DOMAIN_FILE, `${DOMAIN_DIR}/src/invoice/index.ts`]).toContain(unresolved[0].file);
  });
});

// --- dependencies followed by package name and by exports ----------------------------------------

const INFRASTRUCTURE_DIR = "packages/infrastructure/billing-infrastructure";

/** The infrastructure package, publishing what `exports` states. */
function infrastructure(exports: Readonly<Record<string, string | null>>) {
  return {
    dir: INFRASTRUCTURE_DIR,
    name: "@acme/billing-infrastructure",
    files: {
      "src/index.ts": "export class Clock {}\n",
      "src/events.ts": "export class Events {}\n",
      "src/internal/x.ts": "export class X {}\n",
    },
    manifest: { exports },
  };
}

describe("one key of exports decides a subpath, as Node resolves it", () => {
  test("a key equal to the subpath publishes it over a broader pattern mapped to null", () => {
    const verdict = verdictOf(
      tsCase(
        "exports-exact-over-null-pattern",
        {
          source: `import { Events } from "@acme/billing-infrastructure/events";\n${CLASS_CLEAN}`,
          others: [infrastructure({ ".": "./src/index.ts", "./events": "./src/events.ts", "./*": null })],
        },
        { pass: true, rules: [] },
      ),
    );
    expect(verdict.findings.filter((entry) => entry.rule_id === "g")).toEqual([]);
  });

  test("a pattern mapped to null withholds a subpath when its prefix is the longest", () => {
    const reported = verdictOf(
      tsCase(
        "exports-longer-null-pattern",
        {
          source: `import { X } from "@acme/billing-infrastructure/internal/x";\n${CLASS_CLEAN}`,
          others: [infrastructure({ ".": "./src/index.ts", "./*": "./src/*.ts", "./internal/*": null })],
        },
        { pass: false, rules: ["g"] },
      ),
    ).findings.filter((entry) => entry.rule_id === "g");
    expect(reported.map((entry) => [entry.file, entry.line])).toEqual([[DOMAIN_FILE, 1]]);
    expect(reported[0].message).toContain("private-path");
  });
});

const WILDCARD_INDEX = 'export * from "./invoice.ts";\n';

describe("export * where the package does not tell which of its files it publishes", () => {
  test("a package without exports passes when no claimed source writes export *", () => {
    const verdict = verdictOf(
      tsCase("no-exports-no-wildcard", { manifest: { exports: undefined } }, { pass: true, rules: [] }),
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.findings).toEqual([]);
  });

  test.each([
    ["states no exports", undefined],
    ["points its exports at a build output", { ".": "./dist/index.js" }],
  ])("export * in a package that %s stops the gate on its line", (_label, exports) => {
    const run = runInProcess(
      tsCase(
        "wildcard-undecidable-entry",
        {
          files: { "src/index.ts": WILDCARD_INDEX, "src/invoice.ts": CLASS_CLEAN },
          manifest: { exports },
          claims: [DOMAIN_INDEX, DOMAIN_FILE],
        },
        { pass: true, rules: [] },
      ),
    );
    expectStopped(run);
    expect(run.stderr).toContain(`${DOMAIN_INDEX}:1 `);
  });
});

const MONEY = {
  dir: "packages/domain/money-domain",
  name: "@acme/money-domain",
  files: {
    "src/index.ts":
      "export class Money {\n  #value: number;\n\n  constructor(value: number) {\n    this.#value = value;\n  }\n}\n",
  },
};
const MONEY_CONSTRUCTION = `import { Money } from "@acme/money-domain";\n${CLASS_CLEAN}export const price = new Money(1);\n`;
/** A second package of the workspace stating the same name as `USE_CASE`. */
const USE_CASE_COPY = { ...USE_CASE, dir: "packages/use-case/billing-use-case-copy" };

/** `testCase` with the root `tsconfig.json` referencing only the packages in `dirs`. */
function referencing(testCase: GoldenCase, dirs: readonly string[]): GoldenCase {
  const workspace = testCase.workspace ?? {};
  workspace["tsconfig.json"] =
    `${JSON.stringify({ files: [], references: dirs.map((dir) => ({ path: `./${dir}` })) })}\n`;
  return testCase;
}

describe("a package of the workspace the root tsconfig.json does not reference is still judged", () => {
  test("importing an unreferenced use-case package by name is a layer-forbidden dependency", () => {
    const testCase = tsCase(
      "unreferenced-use-case-import",
      { source: `import { IssueInvoiceUseCase } from "@acme/billing-use-case";\n${CLASS_CLEAN}`, others: [USE_CASE] },
      { pass: false, rules: ["g"] },
    );
    const reported = verdictOf(referencing(testCase, [DOMAIN_DIR])).findings.filter((entry) => entry.rule_id === "g");
    expect(reported.map((entry) => [entry.file, entry.line])).toEqual([[DOMAIN_FILE, 1]]);
    expect(reported[0].message).toContain("layer-forbidden");
  });

  test("an installed copy under node_modules is not a package of the workspace", () => {
    const testCase = tsCase(
      "installed-copy-not-workspace-package",
      {
        source: `import { IssueInvoiceUseCase } from "@acme/billing-use-case";\n${CLASS_CLEAN}`,
        others: [USE_CASE],
        extra: {
          "node_modules/@acme/billing-use-case/package.json": `${JSON.stringify({ name: USE_CASE.name, version: "0.1.0" })}\n`,
        },
      },
      { pass: false, rules: ["g"] },
    );
    const reported = verdictOf(referencing(testCase, [DOMAIN_DIR])).findings.filter((entry) => entry.rule_id === "g");
    expect(reported.map((entry) => [entry.file, entry.line])).toEqual([[DOMAIN_FILE, 1]]);
    expect(reported[0].message).toContain("layer-forbidden");
  });

  test("depending on an unreferenced use-case package in package.json is a layer-forbidden dependency", () => {
    const testCase = tsCase(
      "unreferenced-use-case-manifest",
      { manifest: { dependencies: { "@acme/billing-use-case": "0.1.0" } }, others: [USE_CASE] },
      { pass: false, rules: ["g"] },
    );
    const reported = verdictOf(referencing(testCase, [DOMAIN_DIR])).findings.filter((entry) => entry.rule_id === "g");
    expect(reported.map((entry) => entry.file)).toEqual([`${DOMAIN_DIR}/package.json`]);
    expect(reported[0].message).toContain("layer-forbidden");
  });

  test("constructing a type of a referenced domain package elsewhere is an incomplete construction", () => {
    const testCase = tsCase(
      "referenced-domain-construction",
      { source: MONEY_CONSTRUCTION, others: [MONEY] },
      {
        pass: false,
        rules: ["c"],
      },
    );
    const reported = verdictOf(referencing(testCase, [DOMAIN_DIR, MONEY.dir])).findings;
    expect(reported.map((entry) => [entry.rule_id, entry.file, entry.line])).toEqual([
      ["c", DOMAIN_FILE, lineOf(MONEY_CONSTRUCTION, "new Money(1)")],
    ]);
  });

  test("constructing a type of an unreferenced domain package stops the gate on its line", () => {
    const testCase = tsCase(
      "unreferenced-domain-construction",
      { source: MONEY_CONSTRUCTION, others: [MONEY] },
      {
        pass: true,
        rules: [],
      },
    );
    const run = runInProcess(referencing(testCase, [DOMAIN_DIR]));
    expectStopped(run);
    expect(run.stderr).toContain(`${DOMAIN_FILE}:${lineOf(MONEY_CONSTRUCTION, "new Money(1)")} `);
  });

  test("two packages of the workspace stating the imported name stop the gate on the import", () => {
    const run = runInProcess(
      tsCase(
        "duplicate-package-name",
        {
          source: `import { IssueInvoiceUseCase } from "@acme/billing-use-case";\n${CLASS_CLEAN}`,
          others: [USE_CASE, USE_CASE_COPY],
        },
        { pass: true, rules: [] },
      ),
    );
    expectStopped(run);
    expect(run.stderr).toContain(`${DOMAIN_FILE}:1 `);
  });

  test("two packages of the workspace stating a package.json dependency name stop the gate on the manifest", () => {
    const run = runInProcess(
      tsCase(
        "duplicate-package-name-manifest",
        {
          manifest: { dependencies: { "@acme/billing-use-case": "0.1.0" } },
          others: [USE_CASE, USE_CASE_COPY],
        },
        { pass: true, rules: [] },
      ),
    );
    expectStopped(run);
    expect(run.stderr).toContain(`${DOMAIN_DIR}/package.json dependency "@acme/billing-use-case"`);
  });
});

const BILLING_FILE = `${DOMAIN_DIR}/src/billing.ts`;

/** The clean class, with `billing` written in a second claimed file of the domain package. */
function withBillingFile(name: string, billing: string): GoldenCase {
  return tsCase(
    name,
    { addFiles: { "src/billing.ts": billing }, modules: [["billing"]], claims: [BILLING_FILE] },
    { pass: true, rules: [] },
  );
}

describe("a type name is resolved through the import that names it", () => {
  test.each([
    [
      "a named import",
      'import { Invoice } from "./invoice.ts";\nexport const make = () => new Invoice("x", 0);\n',
      "c",
      "new Invoice",
    ],
    [
      "an aliased import",
      'import { Invoice as Billed } from "./invoice.ts";\nexport const make = () => new Billed("x", 0);\n',
      "c",
      "new Billed",
    ],
    [
      "a namespace import",
      'import * as billing from "./invoice.ts";\nexport const make = (value: unknown) => value as billing.Invoice;\n',
      "c",
      "as billing.Invoice",
    ],
    [
      "a named import naming a getter receiver",
      'import { Invoice } from "./invoice.ts";\nexport function peek(invoice: Invoice): number {\n  return invoice.total();\n}\n',
      "d",
      "invoice.total()",
    ],
  ])("%s resolves to the domain type of the other file", (_label, billing, rule, construct) => {
    const verdict = verdictOf(withBillingFile("imported-type", billing));
    expect(verdict.findings.map((entry) => [entry.rule_id, entry.file, entry.line])).toEqual([
      [rule, BILLING_FILE, lineOf(billing, construct)],
    ]);
  });

  test("the same name without an import names no domain type", () => {
    const verdict = verdictOf(withBillingFile("unimported-type", 'export const make = () => new Invoice("x", 0);\n'));
    expect(verdict.findings.filter((entry) => entry.rule_id === "c")).toEqual([]);
  });
});

describe("only the wrappings that build a type are removed from a constructed type", () => {
  test.each([
    ["Readonly<Invoice>", 'export const draft: Readonly<Invoice> = { id: "x" };\n'],
    ["Invoice | null", 'export const draft: Invoice | null = { id: "x" };\n'],
    ["Readonly<Invoice> | undefined", 'export const draft: Readonly<Invoice> | undefined = { id: "x" };\n'],
  ])("an object literal typed as %s builds the domain type (c)", (_label, body) => {
    const billing = `import { Invoice } from "./invoice.ts";\n${body}`;
    const verdict = verdictOf(withBillingFile("wrapped-construction", billing));
    expect(verdict.findings.filter((entry) => entry.rule_id === "c").map((entry) => [entry.file, entry.line])).toEqual([
      [BILLING_FILE, lineOf(billing, "export const draft")],
    ]);
  });

  test.each([
    [
      "a type literal holding the domain type",
      "export const result: { ok: true; value: Invoice } = { ok: true, value: undefined as never };\n",
    ],
    ["an application of another type", "export const byId = { a: undefined as never } as Record<string, Invoice>;\n"],
    // An array hands the type over to a use case, but does not build it.
    ["an array of the domain type", "export const all = { a: undefined as never } as Invoice[];\n"],
  ])("an object literal typed by %s is undecided rather than a construction", (_label, body) => {
    const billing = `import { Invoice } from "./invoice.ts";\n${body}`;
    const run = runInProcess(withBillingFile("containing-type", billing));
    expectStopped(run);
    expect(run.stderr).toContain("constructed type");
  });
});

/** The companion with its `issue` renamed, so a write in it is an undeclared mutation (b). */
const COMPANION_RENAMED = edit(edit(COMPANION_CLEAN, "issue(): void;", "rename(): void;"), "issue() {", "rename() {");

describe("closure state is found where the name is written, through destructuring too", () => {
  test("a callback parameter of the same name elsewhere in the method does not hide the write (b)", () => {
    const source = edit(
      COMPANION_RENAMED,
      "state.issued = true;",
      "state.issued = true;\n        [0].forEach((state) => state);",
    );
    expect(verdictOf(withDomainSource("shadowed-callback", source)).findings.map((entry) => entry.rule_id)).toContain(
      "b",
    );
  });

  test("a write through destructured closure state is a write (b)", () => {
    const source = edit(
      edit(
        edit(COMPANION_CLEAN, "issue(): void;", "issue(): void; rename(): void;"),
        "const state = { id, amount, issued: false };",
        "const state = { id, amount, issued: false };\n    const { lines } = { lines: [] as string[] };",
      ),
      "[brand]: true,\n",
      '[brand]: true,\n      rename() {\n        lines.push("x");\n      },\n',
    );
    expect(verdictOf(withDomainSource("destructured-write", source)).findings.map((entry) => entry.rule_id)).toContain(
      "b",
    );
  });

  test("returning destructured closure state is a getter, and calling it is a getter call (d)", () => {
    const source = `${edit(
      edit(
        COMPANION_CLEAN,
        "const state = { id, amount, issued: false };",
        "const state = { id, amount, issued: false };\n    const { amount: owed } = state;",
      ),
      "return state.amount;",
      "return owed;",
    )}${PEEK_CALL}`;
    expect(verdictOf(withDomainSource("destructured-getter", source)).findings.map((entry) => entry.rule_id)).toContain(
      "d",
    );
  });
});

describe("an imports specifier is resolved through the key Node selects", () => {
  test("an exact key written after a matching pattern decides, not the pattern", () => {
    // The pattern would place `#internal/special` inside the package; the exact key sends it out of
    // the package, where this gate does not follow it, so the dependency stops the gate.
    const run = runInProcess(
      tsCase(
        "imports-exact-key",
        {
          source: `import { X } from "#internal/special";\n${CLASS_CLEAN}`,
          addFiles: { "src/internal/special.ts": "export class X {}\n" },
          manifest: { imports: { "#internal/*": "./src/internal/*.ts", "#internal/special": "../../shared/x.ts" } },
          extra: { "shared/x.ts": "export class X {}\n" },
        },
        { pass: true, rules: [] },
      ),
    );
    expectStopped(run);
  });
});

// --- a compiler that cannot be launched --------------------------------------------------------------

const PRODUCT_VENDOR_DIR = join(PRODUCT_TOOLS_DIR, "ddd/lib/typescript/vendor");
const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const reporting = (version: string) => `module.exports = { version: ${JSON.stringify(version)} };\n`;
const THROWING = 'throw new Error("the vendored compiler failed to evaluate");\n';

/** A private copy of the tools tree whose vendored compiler is left as `arrange` leaves it. */
function toolsWithVendor(arrange: (vendorDir: string) => void): { tools: string; vendor: string } {
  // The real path, because the stopped entry reports the vendor directory it resolved from its own file.
  const root = realpathSync(temporaryDir("ddd-typescript-domain-tools-"));
  const tools = join(root, "tools");
  cpSync(PRODUCT_TOOLS_DIR, tools, { recursive: true });
  const vendor = join(tools, "ddd/lib/typescript/vendor");
  arrange(vendor);
  return { tools, vendor };
}

function installCompiler(vendor: string, body: string): void {
  writeFileSync(join(vendor, "typescript.js"), body);
  writeFileSync(join(vendor, "manifest.json"), `${JSON.stringify({ "typescript.js": { sha256: sha256(body) } })}\n`);
}

const LAUNCH_FAILURES: [TypeScriptExtractorFailureKind, string, (vendor: string) => void][] = [
  ["compiler-missing", "the manifest is gone", (vendor) => unlinkSync(join(vendor, "manifest.json"))],
  [
    "checksum-mismatch",
    "the bytes are not the recorded ones",
    (vendor) => writeFileSync(join(vendor, "typescript.js"), THROWING),
  ],
  ["load-failed", "the compiler throws while it loads", (vendor) => installCompiler(vendor, THROWING)],
  ["version-mismatch", "the compiler is of another version", (vendor) => installCompiler(vendor, reporting("5.9.3"))],
];

describe("a compiler that cannot be launched stops the gate as T-11-01 does", () => {
  test.each(LAUNCH_FAILURES)(
    "%s: %s",
    (kind, _label, arrange) => {
      const { tools, vendor } = toolsWithVendor(arrange);
      const outcome = classifyTypeScriptExtractor(temporaryDir("ddd-typescript-domain-project-"), vendor);
      expect(outcome.kind).toBe(kind);
      const run = spawnSensor(tools, caseNamed("clean-class"));
      expectStopped(run);
      expect(run.stderr).toContain(
        `${TYPESCRIPT_SENSOR}: tool unavailable: ${typeScriptExtractorIssue(outcome).message}\n`,
      );
    },
    LAUNCH_TIMEOUT_MS,
  );

  test(
    "project-condition-mismatch: a package states compiler settings outside the supported range",
    () => {
      const testCase = tsCase(
        "launch-project-condition",
        { compilerOptions: { module: "commonjs" } },
        { pass: true, rules: [] },
      );
      const { root } = materializeCase(testCase);
      temporary.push(root);
      const outcome = classifyTypeScriptExtractor(root, PRODUCT_VENDOR_DIR);
      expect(outcome.kind).toBe("project-condition-mismatch");
      const run = spawnSensor(PRODUCT_TOOLS_DIR, testCase);
      expectStopped(run);
      expect(run.stderr).toContain(
        `${TYPESCRIPT_SENSOR}: tool unavailable: ${typeScriptExtractorIssue(outcome).message}\n`,
      );
    },
    LAUNCH_TIMEOUT_MS,
  );

  test(
    "a run with no TypeScript claim answers without the compiler",
    () => {
      const { tools } = toolsWithVendor((vendor) => unlinkSync(join(vendor, "manifest.json")));
      const testCase = tsCase(
        "launch-no-typescript-claim",
        { extra: { "docs/notes.md": "# notes\n" }, claims: ["docs/notes.md"] },
        { pass: true, rules: [] },
      );
      const run = spawnSensor(tools, testCase);
      expect(run.exitCode, run.stderr).toBe(0);
      const verdict = JSON.parse(run.stdout) as SensorVerdict;
      expect(verdict.pass).toBe(true);
      expect(verdict.note).toContain("no typescript sources claimed");
    },
    LAUNCH_TIMEOUT_MS,
  );

  test(
    "a run claiming only files outside the domain layer answers without the compiler",
    () => {
      const { tools } = toolsWithVendor((vendor) => unlinkSync(join(vendor, "manifest.json")));
      const testCase = tsCase(
        "launch-no-domain-target",
        { others: [USE_CASE], claims: [`${USE_CASE.dir}/src/index.ts`] },
        { pass: true, rules: [] },
      );
      const run = spawnSensor(tools, testCase);
      expect(run.exitCode, run.stderr).toBe(0);
      expect((JSON.parse(run.stdout) as SensorVerdict).pass).toBe(true);
    },
    LAUNCH_TIMEOUT_MS,
  );

  test("the supported version the stand-in compilers differ from is the distributed one", () => {
    expect(SUPPORTED_COMPILER_API_VERSION).not.toBe("5.9.3");
    expect(JSON.parse(readFileSync(join(PRODUCT_VENDOR_DIR, "manifest.json"), "utf8"))["typescript.js"].sha256).toBe(
      sha256(readFileSync(join(PRODUCT_VENDOR_DIR, "typescript.js"))),
    );
  });
});

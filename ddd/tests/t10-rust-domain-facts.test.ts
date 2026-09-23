/**
 * Rules (a) and (d) decided on native extractor facts (T-10-02).
 *
 * The golden suite fixes which rule fires on which file; this file fixes what the golden runner
 * cannot compare — how many findings a declaration produces, the line each one carries, and the
 * member or method name it reports — plus what the gates do when the extractor cannot be launched.
 */

import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { type GoldenCase, materializeCase, runGoldenCase, type SensorVerdict, scriptNameFor } from "./golden/runner.ts";
import { RUST_CASES } from "./golden/rust/cases.ts";
import { EXPLICIT_RETURN, TUPLE_RESTRICTED } from "./golden/rust/domain-facts-cases.ts";

const toolsDir = join(import.meta.dir, "..", "tools");
const DOMAIN = "packages/domain/billing-domain/src/lib.rs";

const temporary: string[] = [];
afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});

function caseNamed(name: string): GoldenCase {
  const source = RUST_CASES.find((entry) => entry.name === name);
  if (!source) throw new Error(`missing Rust fixture ${name}`);
  return structuredClone(source);
}

/** The clean domain fixture, optionally with another crate source, and no expectation of its own. */
function domainCase(name: string, lib?: string): GoldenCase {
  const source = caseNamed("clean-domain");
  if (!source.workspace) throw new Error("the clean domain fixture carries no workspace");
  return {
    ...source,
    name,
    workspace: lib === undefined ? source.workspace : { ...source.workspace, [DOMAIN]: lib },
    expect: { pass: true, rules: [] },
  };
}

function findingsOf(name: string, lib: string, rule: string): SensorVerdict["findings"] {
  const result = runGoldenCase(toolsDir, domainCase(name, lib));
  if (!result.verdict) throw new Error(`${name}: ${result.problems.join("; ")}`);
  return result.verdict.findings.filter((entry) => entry.rule_id === rule);
}

/** The 1-based line of the fixture's declaration, so an expected line is read off the input. */
function lineOf(source: string, declaration: string): number {
  const index = source.split("\n").findIndex((line) => line.includes(declaration));
  if (index < 0) throw new Error(`the fixture has no line containing ${declaration}`);
  return index + 1;
}

// --- (a) public members -----------------------------------------------------

test("a restricted tuple member is reported on its own line and its private neighbour is not", () => {
  const reported = findingsOf("domain-facts-tuple-restricted", TUPLE_RESTRICTED, "a");
  expect(reported).toHaveLength(1);
  expect(reported[0].line).toBe(lineOf(TUPLE_RESTRICTED, "pub(crate) i64"));
  expect(reported[0].message).toContain("Invoice.0");
});

test("each public tuple member is reported under its own ordinal", () => {
  const lib = "pub struct Invoice(i64);\npub struct Pair(\n    pub i64,\n    pub u32,\n);\n";
  const reported = findingsOf("domain-facts-tuple-pair", lib, "a");
  expect(reported).toHaveLength(2);
  expect(reported.map((entry) => entry.line)).toEqual([lineOf(lib, "pub i64"), lineOf(lib, "pub u32")]);
  expect(reported[0].message).toContain("Pair.0");
  expect(reported[1].message).toContain("Pair.1");
});

test("restricted, raw and non-ASCII field names keep their declaration line and their spelling", () => {
  const lib = `pub struct Invoice(i64);
pub mod invoice {
    pub struct A { pub(super) x: i64 }
    pub struct B { pub(in crate::invoice) y: i64 }
}
pub struct C { pub r#type: i64 }
pub struct D { pub 合計: i64 }
`;
  const reported = findingsOf("domain-facts-visibility-matrix", lib, "a");
  expect(reported.map((entry) => entry.line)).toEqual([
    lineOf(lib, "pub(super) x"),
    lineOf(lib, "pub(in crate::invoice) y"),
    lineOf(lib, "pub r#type"),
    lineOf(lib, "pub 合計"),
  ]);
  const names = reported.map((entry) => entry.message);
  expect(names[0]).toContain("A.x");
  expect(names[1]).toContain("B.y");
  expect(names[2]).toContain("C.r#type");
  expect(names[3]).toContain("D.合計");
});

// --- (d) getter calls -------------------------------------------------------

test("a getter whose body is an explicit return is reported at its call, and a same-named method of another type is not", () => {
  const reported = findingsOf("domain-facts-explicit-return", EXPLICIT_RETURN, "d");
  expect(reported).toHaveLength(1);
  expect(reported[0].line).toBe(lineOf(EXPLICIT_RETURN, "pub fn peek"));
});

test("a getter whose body is a tail expression keeps being reported at its call", () => {
  const lib = `pub struct Invoice { amount: i64 }
impl Invoice { pub fn total(&self) -> i64 { self.amount } }
pub fn peek(inv: &Invoice) -> i64 { inv.total() }
`;
  const reported = findingsOf("domain-facts-tail-expression", lib, "d");
  expect(reported).toHaveLength(1);
  expect(reported[0].line).toBe(lineOf(lib, "pub fn peek"));
});

test("a raw identifier getter is not absorbed into the name of another type's method", () => {
  const lib = `pub struct Invoice { amount: i64 }
impl Invoice { pub fn r#total(&self) -> i64 { self.amount } }
pub struct Ledger { entries: i64 }
impl Ledger { pub fn total(&self) -> i64 { self.entries + 1 } }
pub fn peek(inv: &Invoice) -> i64 { inv.r#total() }
pub fn count(ledger: &Ledger) -> i64 { ledger.total() }
`;
  const reported = findingsOf("domain-facts-raw-identifier", lib, "d");
  expect(reported).toHaveLength(1);
  expect(reported[0].line).toBe(lineOf(lib, "pub fn peek"));
  expect(reported[0].message).toContain("r#total");
});

// --- an extractor that cannot be launched -----------------------------------

const HOST_KEY = `${process.platform}-${process.arch}`;
const EXTRACTOR_NAME = "ddd-rust-syn-spike";
const PRODUCT_BIN_DIR = join(toolsDir, "ddd", "bin");
/** The protocol the rule (a) / (d) decision base is read over, fixed by the inspection contract. */
const DOMAIN_FACTS_VERSION = 4;

interface InstallationOptions {
  /** Omit the host row from the manifest, leaving this platform unrecorded. */
  readonly recorded?: false;
  /** Leave the installation directory without the extractor file. */
  readonly present?: false;
  /** Install the file without any execute bit. */
  readonly executable?: false;
  /** Record a digest the installed bytes do not produce. */
  readonly digest?: "stale";
  /** Leave the protocol probe without an answer by exiting non-zero. */
  readonly probe?: "fails";
  /** Answer the probe with a protocol the adapter does not accept. */
  readonly protocol?: number;
}

function extractorStub(options: InstallationOptions): string {
  const answer = `echo '{"protocol_version":${options.protocol ?? DOMAIN_FACTS_VERSION},"extractor":"0.0.0","syn":"3.0.5"}'`;
  return [
    "#!/bin/sh",
    'case "$1" in',
    `  --*-version) ${options.probe === "fails" ? "exit 1" : answer} ;;`,
    "  *) exit 1 ;;",
    "esac",
    "",
  ].join("\n");
}

/** A private copy of the distributed tools tree whose installed extractor meets one condition. */
function toolsWithExtractor(options: InstallationOptions): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-domain-facts-tools-"));
  temporary.push(root);
  const tools = join(root, "tools");
  cpSync(toolsDir, tools, {
    recursive: true,
    filter: (source) => source !== PRODUCT_BIN_DIR && !source.startsWith(`${PRODUCT_BIN_DIR}${sep}`),
  });
  const bin = join(tools, "ddd", "bin");
  mkdirSync(bin, { recursive: true });
  const body = extractorStub(options);
  const recorded = createHash("sha256")
    .update(options.digest === "stale" ? `${body}# recorded from other bytes\n` : body)
    .digest("hex");
  const rows = options.recorded === false ? {} : { [HOST_KEY]: { target: "unit-test-triple", sha256: recorded } };
  writeFileSync(join(bin, "manifest.json"), `${JSON.stringify(rows, null, 2)}\n`);
  if (options.present !== false) {
    mkdirSync(join(bin, HOST_KEY), { recursive: true });
    const binary = join(bin, HOST_KEY, EXTRACTOR_NAME);
    writeFileSync(binary, body);
    chmodSync(binary, options.executable === false ? 0o644 : 0o755);
  }
  return tools;
}

/** The same private copy, carrying the product installation unchanged. */
function toolsWithProductExtractor(): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-domain-facts-product-"));
  temporary.push(root);
  const tools = join(root, "tools");
  cpSync(toolsDir, tools, { recursive: true });
  return tools;
}

function runGate(tools: string, testCase: GoldenCase): { exitCode: number; stdout: string; stderr: string } {
  const { root, outputPath } = materializeCase(testCase);
  try {
    const proc = Bun.spawnSync(
      ["bun", join(tools, scriptNameFor(testCase.sensor)), "--stage", testCase.stage, "--output-path", outputPath],
      { stdout: "pipe", stderr: "pipe" },
    );
    return { exitCode: proc.exitCode ?? 0, stdout: proc.stdout.toString().trim(), stderr: proc.stderr.toString() };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("the private copy of the tools tree reports the product verdict while its extractor is untouched", () => {
  const result = runGate(toolsWithProductExtractor(), domainCase("domain-facts-product-control"));
  expect(result.exitCode, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).pass).toBe(true);
});

/** Every condition that stops a launch, each one on its own, as the launch classification names them. */
const BLOCKED: [string, InstallationOptions][] = [
  ["is not recorded for this platform", { recorded: false }],
  ["is not installed", { present: false }],
  ["carries no execute permission", { executable: false }],
  ["does not hash to the recorded digest", { digest: "stale" }],
  ["never answers the protocol probe", { probe: "fails" }],
  ["answers another protocol", { protocol: 1 }],
];

test.each(BLOCKED)("the domain gate stops instead of passing when the extractor %s", (_label, options) => {
  const result = runGate(toolsWithExtractor(options), domainCase("domain-facts-blocked"));
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
});

// Every condition above stops at the launch classification. The two below get past it: the
// extractor is launchable and the batch is what leaves the rules without facts.

test("the domain gate stops when the extractor answers the probe but not the batch", () => {
  // The stub answers every `--*-version` probe and fails anything else, so the launch classifies
  // as ready and the batch request is the call that comes back empty-handed.
  const result = runGate(toolsWithExtractor({}), domainCase("domain-facts-batch-unanswered"));
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
});

test("a claimed file the extractor cannot parse stops the gate and reports why", () => {
  const result = runGate(toolsWithProductExtractor(), domainCase("domain-facts-unparsed", "pub struct {\n"));
  expect(result.exitCode).toBe(127);
  // An unread file must not be answered as "nothing public is declared", and the reason the
  // extractor gave has to survive to the reader.
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain(`${DOMAIN}:1 syntax-error`);
});

test("the use-case gate, which decides the same rule, also stops instead of passing", () => {
  const result = runGate(toolsWithExtractor({ present: false }), caseNamed("violation-h"));
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
});

test("the interface-adapter gate, which decides neither rule, keeps reporting its verdict", () => {
  const result = runGate(toolsWithExtractor({ present: false }), caseNamed("clean-repository"));
  expect(result.exitCode, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).pass).toBe(true);
});

// The conditions above all have a file for rules (a) and (d) to decide. The two below keep the
// extractor unusable and vary only what the run claims, which is what decides whether those rules
// have anything to decide at all.

const SOURCE_MANIFEST = "construction/u1/code-generation/source-manifest.json";

/** The same case with its declared writes replaced, so the claim set is the only thing that moves. */
function claiming(testCase: GoldenCase, writes: readonly string[]): GoldenCase {
  if (!(SOURCE_MANIFEST in testCase.files)) throw new Error(`the fixture carries no ${SOURCE_MANIFEST}`);
  return {
    ...testCase,
    files: {
      ...testCase.files,
      [SOURCE_MANIFEST]: JSON.stringify({
        stage: "code-generation",
        unit: "u1",
        version: 1,
        writes: writes.map((path) => ({ path })),
      }),
    },
  };
}

test("with no Rust source claimed, both gates that decide on the extractor report a verdict without it", () => {
  const tools = toolsWithExtractor({ present: false });
  // Both gates, because both declare a rule that reads the extractor and neither has a file to
  // decide here; the domain gate declares (a) and (d), the use-case gate declares (d).
  for (const source of [domainCase("domain-facts-no-claims"), caseNamed("violation-h")]) {
    const result = runGate(tools, claiming(source, []));
    expect(result.exitCode, `${source.sensor}: ${result.stderr}`).toBe(0);
    const verdict: SensorVerdict = JSON.parse(result.stdout);
    expect(verdict.pass, source.sensor).toBe(true);
    expect(verdict.findings_count, source.sensor).toBe(0);
  }
});

test("with the extractor not installed, the domain gate answers a use-case claim and stops on a domain one", () => {
  // Both runs use the same two-crate workspace and the same uninstalled extractor; only the claimed
  // path differs, so the layer of the claim is what decides between a verdict and the terminal.
  const tools = toolsWithExtractor({ present: false });
  const onDomainGate: GoldenCase = {
    ...caseNamed("violation-h"),
    sensor: "ddd-rust-domain",
    name: "domain-facts-claim-layer",
    expect: { pass: true, rules: [] },
  };

  const outside = runGate(tools, claiming(onDomainGate, ["packages/use-case/billing-use-case/src/lib.rs"]));
  expect(outside.exitCode, outside.stderr).toBe(0);
  const verdict: SensorVerdict = JSON.parse(outside.stdout);
  expect(verdict.pass).toBe(true);
  expect(verdict.findings_count).toBe(0);

  const inside = runGate(tools, claiming(onDomainGate, [DOMAIN]));
  expect(inside.exitCode).toBe(127);
  expect(inside.stdout).toBe("");
});

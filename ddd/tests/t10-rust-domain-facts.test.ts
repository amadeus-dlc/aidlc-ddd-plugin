/**
 * Rules (a) and (d) decided on native extractor facts (T-10-02).
 *
 * The golden suite fixes which rule fires on which file; this file fixes what the golden runner
 * cannot compare — how many findings a declaration produces, the line each one carries, and the
 * member or method name it reports — plus what the gates do when the extractor cannot be launched.
 */

import { afterEach, expect, test } from "bun:test";
import { join } from "node:path";
import {
  type InstallationOptions,
  removeExtractorTools,
  toolsWithExtractor,
  toolsWithProductExtractor,
} from "./golden/extractor-tools.ts";
import { type GoldenCase, runGoldenCase, type SensorVerdict, spawnSensor } from "./golden/runner.ts";
import { RUST_CASES } from "./golden/rust/cases.ts";
import { EXPLICIT_RETURN, TUPLE_RESTRICTED } from "./golden/rust/domain-facts-cases.ts";

const toolsDir = join(import.meta.dir, "..", "tools");
const DOMAIN = "packages/domain/billing-domain/src/lib.rs";

afterEach(removeExtractorTools);

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

// Two functions may each declare a type of the same name with a method of the same name and a
// different body. They are separate declarations, so the facts are joined per declaration rather
// than per name: neither one can make the answer for the other, or for the file, undecidable.
test("two function-local methods of one name and two bodies keep the gate answering", () => {
  const lib = `pub struct Invoice { amount: i64 }
impl Invoice { pub fn total(&self) -> i64 { return self.amount; } }
pub fn peek(inv: &Invoice) -> i64 { inv.total() }
#[cfg(test)]
mod tests {
    #[test]
    fn one() {
        struct Stub(i64);
        impl Stub { fn total(&self) -> i64 { self.0 } }
        let _ = Stub(1).total();
    }
    #[test]
    fn two() {
        struct Stub(i64);
        impl Stub { fn total(&self) -> i64 { self.0 + 1 } }
        let _ = Stub(1).total();
    }
}
`;
  const reported = findingsOf("domain-facts-local-name-collision", lib, "d");
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

test("the private copy of the tools tree reports the product verdict while its extractor is untouched", () => {
  const result = spawnSensor(toolsWithProductExtractor(), domainCase("domain-facts-product-control"));
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
  const result = spawnSensor(toolsWithExtractor(options), domainCase("domain-facts-blocked"));
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
});

// Every condition above stops at the launch classification. The two below get past it: the
// extractor is launchable and the batch is what leaves the rules without facts.

test("the domain gate stops when the extractor answers the probe but not the batch", () => {
  // The stub answers every `--*-version` probe and fails anything else, so the launch classifies
  // as ready and the batch request is the call that comes back empty-handed.
  const result = spawnSensor(toolsWithExtractor({}), domainCase("domain-facts-batch-unanswered"));
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
});

test("a claimed file the extractor cannot parse stops the gate and reports why", () => {
  const result = spawnSensor(toolsWithProductExtractor(), domainCase("domain-facts-unparsed", "pub struct {\n"));
  expect(result.exitCode).toBe(127);
  // An unread file must not be answered as "nothing public is declared", and the reason the
  // extractor gave has to survive to the reader.
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain(`${DOMAIN}:1 syntax-error`);
});

test("the use-case gate, which decides the same rule, also stops instead of passing", () => {
  const result = spawnSensor(toolsWithExtractor({ present: false }), caseNamed("violation-h"));
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
});

// The interface-adapter gate reports rule (g), whose dependency edges are built from the same
// `use` facts, and it resolves its own types through the same program. It therefore decides on the
// extractor like the other two, and stops on the same condition rather than answering without it.
test("the interface-adapter gate, which decides on the same facts, also stops instead of passing", () => {
  const result = spawnSensor(toolsWithExtractor({ present: false }), caseNamed("clean-repository"));
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
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

test("with no Rust source claimed, every gate that decides on the extractor reports a verdict without it", () => {
  const tools = toolsWithExtractor({ present: false });
  // Every Rust gate decides on the extractor, and none of them has a file to decide here, so the
  // classification of an extractor none of their rules reaches cannot change the verdict.
  for (const source of [
    domainCase("domain-facts-no-claims"),
    caseNamed("violation-h"),
    caseNamed("clean-repository"),
  ]) {
    const result = spawnSensor(tools, claiming(source, []));
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

  const outside = spawnSensor(tools, claiming(onDomainGate, ["packages/use-case/billing-use-case/src/lib.rs"]));
  expect(outside.exitCode, outside.stderr).toBe(0);
  const verdict: SensorVerdict = JSON.parse(outside.stdout);
  expect(verdict.pass).toBe(true);
  expect(verdict.findings_count).toBe(0);

  const inside = spawnSensor(tools, claiming(onDomainGate, [DOMAIN]));
  expect(inside.exitCode).toBe(127);
  expect(inside.stdout).toBe("");
});

// --- a claimed file the inspection itself cannot read -------------------------

const ORPHAN = "packages/domain/billing-domain/src/orphan.rs";

/** A public member, so a claim that was read reports rule (a) and one that was not reports nothing. */
const ORPHAN_SOURCE = "pub struct Orphan {\n    pub amount: i64,\n}\n";

/**
 * The clean domain fixture with one more source of the same crate that no `mod` declares, claimed on
 * its own. The module walk never reaches it, so the only thing that reads it is the inspection's own
 * read of the claimed files — which `modes` is what takes away.
 */
function orphanClaimCase(name: string, readable: boolean): GoldenCase {
  const source = caseNamed("clean-domain");
  if (!source.workspace) throw new Error("the clean domain fixture carries no workspace");
  return claiming(
    {
      ...source,
      name,
      workspace: { ...source.workspace, [ORPHAN]: ORPHAN_SOURCE },
      ...(readable ? {} : { modes: { [ORPHAN]: 0o000 } }),
      expect: { pass: true, rules: [] },
    },
    [ORPHAN],
  );
}

function reportedPairs(stdout: string): [string, string, number | undefined][] {
  const verdict: SensorVerdict = JSON.parse(stdout);
  return verdict.findings
    .map((entry): [string, string, number | undefined] => [entry.rule_id, entry.file, entry.line])
    .sort((left, right) => left[0].localeCompare(right[0], "en"));
}

/** What a claim outside every module root is reported as, whether or not it could be read. */
const ORPHAN_UNREACHABLE: [string, string, number | undefined] = ["domain-packaging.unresolved", ORPHAN, undefined];

// Dropping read permission does nothing for a superuser, whose read succeeds regardless, so the two
// tests below either observe the unreadable claim or do not run at all.
const RUNNING_AS_SUPERUSER = process.getuid?.() === 0;

test.skipIf(RUNNING_AS_SUPERUSER)("a claimed file the inspection cannot read is inspected without it", () => {
  const readable = spawnSensor(toolsDir, orphanClaimCase("domain-facts-orphan-readable", true));
  expect(readable.exitCode, readable.stderr).toBe(0);
  expect(reportedPairs(readable.stdout)).toEqual([["a", ORPHAN, 2], ORPHAN_UNREACHABLE]);

  // Only the read permission of the claimed file differs between the two runs. A claim the inspection
  // could not read carries no declarations for the per-file rules, and it is not a file the extractor
  // was asked about and failed to read, so it is not this run's terminal either: the gate answers, and
  // what it still reports about the claim is that it sits outside every module root.
  const sealed = spawnSensor(toolsDir, orphanClaimCase("domain-facts-orphan-sealed", false));
  expect(sealed.exitCode, sealed.stderr).toBe(0);
  expect(reportedPairs(sealed.stdout)).toEqual([ORPHAN_UNREACHABLE]);
});

test.skipIf(RUNNING_AS_SUPERUSER)("the same unreadable claim is still a file the rules have to decide", () => {
  // The test above shows the gate answers this claim while the extractor is installed. Here the same
  // claim is the whole claim set and the extractor is not installed, so a verdict would mean the
  // unreadable claim had been dropped from what the rules decide over — which is what separates it
  // from the empty claim set two tests above, where there is genuinely nothing to decide.
  const result = spawnSensor(
    toolsWithExtractor({ present: false }),
    orphanClaimCase("domain-facts-orphan-sealed-blocked", false),
  );
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
});

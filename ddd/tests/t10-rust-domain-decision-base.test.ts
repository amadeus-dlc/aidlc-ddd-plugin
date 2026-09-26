/**
 * The decision base of the remaining domain rules (T-10-03): (b), (c), (g) and `domain-packaging.*`.
 *
 * The golden suite fixes which rule fires on which file. This file fixes what that comparison cannot
 * see, and what the switch of decision base has to keep or change:
 *
 * - the line a finding sends a reader to, which the golden runner leaves out of its comparison;
 * - the regions that carry the same characters without declaring anything — a `macro_rules!` body,
 *   a string literal, a raw string literal, a line comment and a nested block comment — which have
 *   to stay outside every one of these rules;
 * - the module constructs that stay unresolved and the one that stays resolved, so that moving the
 *   module walk onto the extractor neither loses a refusal nor invents one;
 * - the files the gate is not allowed to answer without, which is what makes a rule decided on the
 *   extractor rather than on a parser that reads a broken file as an empty one.
 */

import { expect, test } from "bun:test";
import { join } from "node:path";
import { type GoldenCase, runGoldenCase, type SensorVerdict, spawnSensor } from "./golden/runner.ts";
import { RUST_CASES } from "./golden/rust/cases.ts";

const toolsDir = join(import.meta.dir, "..", "tools");
const DOMAIN = "packages/domain/billing-domain/src/lib.rs";
const USE_CASE = "packages/use-case/billing-use-case/src/lib.rs";
const SOURCE_MANIFEST = "construction/u1/code-generation/source-manifest.json";

function caseNamed(name: string): GoldenCase {
  const source = RUST_CASES.find((entry) => entry.name === name);
  if (!source) throw new Error(`missing Rust fixture ${name}`);
  return structuredClone(source);
}

/**
 * The clean domain fixture with some of its workspace replaced and no expectation of its own, so a
 * test reads the verdict itself instead of the runner's (rule_id, file) comparison. Its record
 * already carries the fixture mapping, whose declarations cover the crate root and an `invoice`
 * package, so a module named `invoice` is a declared package rather than an undeclared one.
 */
function domainCase(name: string, workspace: Record<string, string>): GoldenCase {
  const source = caseNamed("clean-domain");
  if (!source.workspace) throw new Error("the clean domain fixture carries no workspace");
  return {
    ...source,
    name,
    workspace: { ...source.workspace, ...workspace },
    expect: { pass: true, rules: [] },
  };
}

function verdictOf(testCase: GoldenCase): SensorVerdict {
  const result = runGoldenCase(toolsDir, testCase);
  if (!result.verdict) throw new Error(`${testCase.name}: ${result.problems.join("; ")}`);
  return result.verdict;
}

function reported(verdict: SensorVerdict, rule: string): SensorVerdict["findings"] {
  return verdict.findings.filter((entry) => entry.rule_id === rule);
}

/** The 1-based line of the fixture's declaration, so an expected line is read off the input. */
function lineOf(source: string, declaration: string): number {
  const index = source.split("\n").findIndex((line) => line.includes(declaration));
  if (index < 0) throw new Error(`the fixture has no line containing ${declaration}`);
  return index + 1;
}

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

/** The aggregate the fixture model declares, with the one command that model gives it. */
const INVOICE = `pub struct Invoice {
    id: String,
    amount: i64,
}
impl Invoice {
    pub fn issue(&mut self) {}
}
`;

/**
 * The regions that carry source characters without declaring anything. Every rule here reads the
 * same five: a `macro_rules!` body, a string literal, a raw string literal with more than one hash,
 * a line comment, and a nested block comment. `text` is spelled into each of them.
 */
function lookalikes(text: string): string {
  return `macro_rules! declare {
    () => {
        ${text}
    };
}
const DOC: &str = "${text.replace(/"/g, '\\"')}";
const RAW: &str = r##"${text}"##;
// ${text}
/* /* ${text} */ */
`;
}

// --- (b) undeclared mutation ------------------------------------------------

test("a mutating method the model does not declare is reported on its own declaration line", () => {
  const lib = `pub struct Invoice {
    id: String,
    amount: i64,
}
impl Invoice {
    pub fn issue(&mut self) {}
    pub fn rename(&mut self, name: String) { self.id = name; }
}
`;
  const verdict = verdictOf(domainCase("decision-base-b-undeclared", { [DOMAIN]: lib }));
  const findings = reported(verdict, "b");
  expect(findings).toHaveLength(1);
  expect(findings[0].file).toBe(DOMAIN);
  expect(findings[0].line).toBe(lineOf(lib, "pub fn rename"));
  expect(verdict.pass).toBe(false);
});

test("the same mutating method spelled in a macro body, a literal or a comment declares nothing", () => {
  const lib = `${INVOICE}${lookalikes("impl Invoice { pub fn rename(&mut self) {} }")}`;
  const verdict = verdictOf(domainCase("decision-base-b-lookalike", { [DOMAIN]: lib }));
  expect(reported(verdict, "b")).toEqual([]);
  expect(verdict.pass, verdict.note).toBe(true);
});

// --- (c) incomplete construction --------------------------------------------

test("a domain type built outside its inherent impl is reported on the line that builds it", () => {
  const lib = `${INVOICE}pub fn build() -> Invoice {
    Invoice { id: String::new(), amount: 0 }
}
`;
  const verdict = verdictOf(domainCase("decision-base-c-outside", { [DOMAIN]: lib }));
  const findings = reported(verdict, "c");
  expect(findings).toHaveLength(1);
  expect(findings[0].file).toBe(DOMAIN);
  expect(findings[0].line).toBe(lineOf(lib, "Invoice { id: String::new(), amount: 0 }"));
  expect(verdict.pass).toBe(false);
});

test("the same construction inside the inherent impl, and spelled in a literal or a comment, is not", () => {
  const lib = `pub struct Invoice {
    id: String,
    amount: i64,
}
impl Invoice {
    pub fn new(id: String) -> Self { Invoice { id, amount: 0 } }
    pub fn issue(&mut self) {}
}
const DOC: &str = "Invoice { id: String::new(), amount: 0 }";
// Invoice { id: String::new(), amount: 0 }
/* /* Invoice { id: String::new(), amount: 0 } */ */
`;
  const verdict = verdictOf(domainCase("decision-base-c-inside", { [DOMAIN]: lib }));
  expect(reported(verdict, "c")).toEqual([]);
  expect(verdict.pass, verdict.note).toBe(true);
});

// --- (g) dependency direction ------------------------------------------------

test("a use path into a forbidden layer is reported on the line of that use", () => {
  const lib = `use billing_interface_adapter::Adapter;
${INVOICE}`;
  const source = caseNamed("violation-g");
  if (!source.workspace) throw new Error("the dependency fixture carries no workspace");
  const verdict = verdictOf({
    ...source,
    name: "decision-base-g-use",
    workspace: { ...source.workspace, [DOMAIN]: lib },
    expect: { pass: true, rules: [] },
  });
  const findings = reported(verdict, "g");
  expect(findings).toHaveLength(1);
  expect(findings[0].file).toBe(DOMAIN);
  expect(findings[0].line).toBe(lineOf(lib, "use billing_interface_adapter::Adapter;"));
  expect(verdict.pass).toBe(false);
});

test("the same use path spelled in a macro body, a literal or a comment is not a dependency", () => {
  const lib = `${INVOICE}${lookalikes("use billing_interface_adapter::Adapter;")}`;
  const source = caseNamed("violation-g");
  if (!source.workspace) throw new Error("the dependency fixture carries no workspace");
  const verdict = verdictOf({
    ...source,
    name: "decision-base-g-lookalike",
    workspace: { ...source.workspace, [DOMAIN]: lib },
    expect: { pass: true, rules: [] },
  });
  expect(reported(verdict, "g")).toEqual([]);
  expect(verdict.pass, verdict.note).toBe(true);
});

// --- domain-packaging: the module walk ---------------------------------------

test("a declared module with one source file is matched rather than left uncovered or unresolved", () => {
  const verdict = verdictOf(
    domainCase("decision-base-module-declared", {
      [DOMAIN]: `pub mod invoice;\n${INVOICE}`,
      "packages/domain/billing-domain/src/invoice.rs": "pub struct Number;\n",
    }),
  );
  expect(reported(verdict, "domain-packaging.unresolved")).toEqual([]);
  expect(reported(verdict, "domain-packaging.coverage")).toEqual([]);
  expect(verdict.pass, verdict.note).toBe(true);
});

test("a mod declaration spelled only in a comment or a literal is not followed to a missing file", () => {
  // Without a `src/invoice.rs`, a followed `mod invoice;` would have nowhere to go and would be
  // refused. Nothing is refused here, which is what says these characters declared no module.
  const lib = `${INVOICE}${lookalikes("mod invoice;")}`;
  const verdict = verdictOf(domainCase("decision-base-module-lookalike", { [DOMAIN]: lib }));
  expect(reported(verdict, "domain-packaging.unresolved")).toEqual([]);
  expect(verdict.pass, verdict.note).toBe(true);
});

test("a cfg(test) module is auxiliary, so it is neither unresolved nor an undeclared package", () => {
  const lib = `${INVOICE}#[cfg(test)]
mod tests {
    #[test]
    fn one() {}
}
`;
  const verdict = verdictOf(domainCase("decision-base-module-cfg-test", { [DOMAIN]: lib }));
  expect(reported(verdict, "domain-packaging.unresolved")).toEqual([]);
  expect(reported(verdict, "domain-packaging.coverage")).toEqual([]);
  expect(verdict.pass, verdict.note).toBe(true);
});

test("an item-position macro call is reported as unresolved and stops the verdict from passing", () => {
  const lib = `${INVOICE}domain_modules!();
`;
  const verdict = verdictOf(domainCase("decision-base-item-macro", { [DOMAIN]: lib }));
  const findings = reported(verdict, "domain-packaging.unresolved");
  expect(findings.map((entry) => entry.file)).toEqual([DOMAIN]);
  expect(findings[0].line).toBe(lineOf(lib, "domain_modules!();"));
  expect(verdict.pass).toBe(false);
});

test("a named macro definition that is never called declares no module and is not unresolved", () => {
  const lib = `${INVOICE}macro_rules! domain_modules {
    () => { mod generated; };
}
`;
  const verdict = verdictOf(domainCase("decision-base-macro-definition", { [DOMAIN]: lib }));
  expect(reported(verdict, "domain-packaging.unresolved")).toEqual([]);
  expect(verdict.pass, verdict.note).toBe(true);
});

test("a path attribute that names exactly one existing file is followed, not refused", () => {
  const verdict = verdictOf(
    domainCase("decision-base-path-resolved", {
      [DOMAIN]: `#[path = "billing/invoice.rs"] mod invoice;\n${INVOICE}`,
      "packages/domain/billing-domain/src/billing/invoice.rs": "pub struct Number;\n",
    }),
  );
  expect(reported(verdict, "domain-packaging.unresolved")).toEqual([]);
  expect(reported(verdict, "domain-packaging.coverage")).toEqual([]);
  expect(verdict.pass, verdict.note).toBe(true);
});

test("a path attribute naming a file the batch does not carry is reported where it is written", () => {
  // The batch is gathered by the `.rs` name, and Rust accepts any name in a `#[path]`. Only the
  // target's name differs from the case above, which is what separates a declaration the walk may
  // follow from one it may not — and the run still answers, rather than reporting a file it never
  // asked the extractor about as one the extractor did not read.
  const lib = `#[path = "generated.txt"] mod generated;\n${INVOICE}`;
  const result = spawnSensor(
    toolsDir,
    domainCase("decision-base-path-uncovered", {
      [DOMAIN]: lib,
      "packages/domain/billing-domain/src/generated.txt": "pub struct Generated;\n",
    }),
  );
  expect(result.exitCode, result.stderr).toBe(0);
  const verdict = JSON.parse(result.stdout) as SensorVerdict;
  const unresolved = reported(verdict, "domain-packaging.unresolved");
  expect(unresolved.map((entry) => [entry.file, entry.line])).toEqual([[DOMAIN, lineOf(lib, "mod generated;")]]);
  expect(verdict.findings.some((entry) => entry.file.endsWith("generated.txt"))).toBe(false);
});

test("a path attribute behind cfg_attr names no single file and is reported on its mod declaration", () => {
  const lib = `#[cfg_attr(feature = "alternate", path = "billing.rs")] mod invoice;
${INVOICE}`;
  const verdict = verdictOf(domainCase("decision-base-path-conditional", { [DOMAIN]: lib }));
  const findings = reported(verdict, "domain-packaging.unresolved");
  expect(findings.map((entry) => entry.file)).toEqual([DOMAIN]);
  expect(findings[0].line).toBe(lineOf(lib, "mod invoice;"));
  expect(verdict.pass).toBe(false);
});

// --- who reports a macro the inspection cannot expand -------------------------

/**
 * One file carrying every macro shape the inspection can meet while still answering, each on its own
 * line: an item-position call at the top level and one inside a `mod` body, an expression-position
 * call inside a function, and the built-in attributes (`cfg`, `cfg_attr`, `derive`, `allow`, `test`)
 * that are not macro expansion at all. What reports each shape is then read off the verdict per line,
 * rather than per file. An attribute that is not built in is left out: in a file rule (a) decides from
 * it stops the gate instead of answering, which `t10-rust-domain-facts.test.ts` observes.
 */
const MACRO_SHAPES = `${INVOICE}domain_modules!();
pub mod inner {
    inner_modules!();
}
pub fn compute() -> i64 {
    let value = compute_amount!();
    value
}
#[cfg(feature = "alternate")]
mod alternate;
#[cfg_attr(test, path = "billing.rs")]
mod billing;
#[derive(Clone)]
#[allow(dead_code)]
pub struct Builtin;
#[cfg(test)]
mod tests {
    #[test]
    fn one() {}
}
`;

/**
 * The `<producer>: <file>:<line> <detail>` parts of a note that speak about `file`, split into the
 * producer that wrote each one and the line it names. A note is read per part because that is the
 * unit a producer contributes; the whole string says nothing about which of them reported what.
 */
function noteRefs(note: string | undefined, file: string): { producer: string; line: number }[] {
  const refs: { producer: string; line: number }[] = [];
  for (const part of (note ?? "").split("; ")) {
    const separator = part.indexOf(": ");
    if (separator < 0) continue;
    const named = part.slice(separator + 2);
    if (!named.startsWith(`${file}:`)) continue;
    const line = Number.parseInt(named.slice(file.length + 1), 10);
    if (Number.isNaN(line)) continue;
    refs.push({ producer: part.slice(0, separator), line });
  }
  return refs;
}

function linesOf(source: string, declarations: readonly string[]): number[] {
  return declarations.map((declaration) => lineOf(source, declaration)).sort((a, b) => a - b);
}

test("every note the macro shapes produce is written by the extractor", () => {
  const verdict = verdictOf(domainCase("decision-base-macro-producers", { [DOMAIN]: MACRO_SHAPES }));
  const producers = [...new Set(noteRefs(verdict.note, DOMAIN).map((ref) => ref.producer))].sort();
  expect(producers, verdict.note).toEqual(["domain-facts.unresolved", "syntax.unresolved"]);
});

test("only the macro shapes that can hide a module declaration are refused", () => {
  const verdict = verdictOf(domainCase("decision-base-macro-refusals", { [DOMAIN]: MACRO_SHAPES }));
  const refused = reported(verdict, "domain-packaging.unresolved")
    .map((entry) => entry.line)
    .sort((a, b) => (a ?? 0) - (b ?? 0));
  expect(refused, verdict.note).toEqual(
    linesOf(MACRO_SHAPES, ["domain_modules!();", "inner_modules!();", "mod alternate;", "mod billing;"]),
  );
});

test("an expression macro is reported by nobody", () => {
  // It cannot hide a module declaration, so the module walk has nothing to refuse about it and the
  // decision base is complete without it. It is the one shape this file reports nothing at all for,
  // which is what a reader of a verdict has to be able to tell.
  const verdict = verdictOf(domainCase("decision-base-macro-unreported", { [DOMAIN]: MACRO_SHAPES }));
  const silent = linesOf(MACRO_SHAPES, ["let value = compute_amount!();"]);
  expect(
    noteRefs(verdict.note, DOMAIN).filter((ref) => silent.includes(ref.line)),
    verdict.note,
  ).toEqual([]);
  expect(
    verdict.findings.filter(
      (entry) => entry.file === DOMAIN && entry.line !== undefined && silent.includes(entry.line),
    ),
  ).toEqual([]);
});

// --- the identifier a decision-base file is named by --------------------------

/**
 * The clean domain fixture whose declared `invoice` module is a symbolic link to a source of the
 * same crate. The walk reaches the module through the link, reads the real file behind it, and asks
 * the extractor about that real file — so the two runs below differ only in whether the real file
 * can be read, which is what tells a file the gate could not decide from apart from one it could.
 */
function linkedModuleCase(name: string, linked: string): GoldenCase {
  return {
    ...domainCase(name, {
      [DOMAIN]: `pub mod invoice;\n${INVOICE}`,
      "packages/domain/billing-domain/src/billing/invoice.rs": linked,
    }),
    links: { "packages/domain/billing-domain/src/invoice.rs": "billing/invoice.rs" },
  };
}

test("a module reached through a link to a source of its own crate is decided from that source", () => {
  const result = spawnSensor(toolsDir, linkedModuleCase("decision-base-module-linked", "pub struct Number;\n"));
  expect(result.exitCode, result.stderr).toBe(0);
  const verdict = JSON.parse(result.stdout) as SensorVerdict;
  expect(reported(verdict, "domain-packaging.unresolved")).toEqual([]);
  expect(reported(verdict, "domain-packaging.coverage")).toEqual([]);
  expect(verdict.pass, verdict.note).toBe(true);
});

test("the same link whose real source the extractor cannot read stops the gate on that source", () => {
  const result = spawnSensor(toolsDir, linkedModuleCase("decision-base-module-linked-unreadable", "pub struct {\n"));
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("packages/domain/billing-domain/src/billing/invoice.rs");
});

test("a link whose real source the batch does not carry is reported where the link is declared", () => {
  // The link is named `.rs` and the file it resolves to is not. The batch is gathered by the name of
  // the file the walk reads, so that is the name this declaration has to be judged by — only the
  // real file's name differs from the case above, and the run still answers rather than stopping on
  // a file it never asked the extractor about.
  const lib = `pub mod invoice;\n${INVOICE}`;
  const result = spawnSensor(toolsDir, {
    ...domainCase("decision-base-module-linked-uncovered", {
      [DOMAIN]: lib,
      "packages/domain/billing-domain/src/billing/invoice.txt": "pub struct Number;\n",
    }),
    links: { "packages/domain/billing-domain/src/invoice.rs": "billing/invoice.txt" },
  });
  expect(result.exitCode, result.stderr).toBe(0);
  const verdict = JSON.parse(result.stdout) as SensorVerdict;
  const unresolved = reported(verdict, "domain-packaging.unresolved");
  expect(unresolved.map((entry) => [entry.file, entry.line])).toEqual([[DOMAIN, lineOf(lib, "pub mod invoice;")]]);
  expect(verdict.findings.some((entry) => entry.file.endsWith("invoice.txt"))).toBe(false);
});

// --- the files the gate may not answer without --------------------------------

/**
 * The domain gate on the two-crate workspace, claiming the domain source alone. Only the use-case
 * crate's own source moves between the two runs below, so it is the one thing that decides between
 * a verdict and the terminal.
 */
function domainGateOverProgram(name: string, useCase: string): GoldenCase {
  const source = caseNamed("violation-h");
  if (!source.workspace) throw new Error("the two-crate fixture carries no workspace");
  return claiming(
    {
      ...source,
      sensor: "ddd-rust-domain",
      name,
      workspace: { ...source.workspace, [DOMAIN]: INVOICE, [USE_CASE]: useCase },
      expect: { pass: true, rules: [] },
    },
    [DOMAIN],
  );
}

test("with every program source readable, the domain gate reports its verdict", () => {
  const result = spawnSensor(
    toolsDir,
    domainGateOverProgram("decision-base-program-readable", "pub struct IssueInvoice;\n"),
  );
  expect(result.exitCode, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).pass).toBe(true);
});

test("a program source the extractor cannot read stops the gate instead of reading it as empty", () => {
  // The unreadable file is in another crate of the same program than the claim. The rules of this
  // gate are decided over the whole program, so a file that could hide a declaration from them is
  // not answerable as "this file declares nothing"; the run has to stop and say which file it was.
  const result = spawnSensor(toolsDir, domainGateOverProgram("decision-base-program-unreadable", "pub struct {\n"));
  expect(result.exitCode).toBe(127);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain(USE_CASE);
});

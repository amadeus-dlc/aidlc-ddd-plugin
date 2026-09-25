import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { modelDocument } from "./golden/model-document.ts";
import { fixtureMapping } from "./golden/package-fixture.ts";

const toolsDir = join(import.meta.dir, "..", "tools");

const MODEL = `schema_version: 2
bounded_contexts:
  - element_id: bc.billing
    name: Billing
    aggregates:
      - element_id: aggregate.invoice
        name: Invoice
        bounded_context: bc.billing
        root_element: entity.invoice
        states: [draft, issued]
        elements:
          - { element_id: entity.invoice, kind: entity, name: Invoice, aggregate: aggregate.invoice }
        invariants:
          - { element_id: invariant.invoice.total-positive, name: TotalPositive, aggregate: aggregate.invoice, statement: non-negative }
        commands:
          - element_id: command.invoice.issue
            name: Issue
            aggregate: aggregate.invoice
            effect: transition
            state_effect: transitions
            transitions: [transition.invoice.issue]
            domain_errors:
              - { element_id: error.invoice.issue.already-issued, name: AlreadyIssued, operation: command.invoice.issue, condition: not draft }
            events: [event.invoice.issued]
            idempotency: { strategy: none }
        events:
          - { element_id: event.invoice.issued, name: Issued, aggregate: aggregate.invoice, produced_by: command.invoice.issue }
        transitions:
          - { element_id: transition.invoice.issue, name: Issue, aggregate: aggregate.invoice, from_state: draft, to_state: issued, command: command.invoice.issue }
lineage: []
`;

interface Crate {
  path: string;
  name: string;
  lib: string;
  deps?: string[];
}

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop() as string, { recursive: true, force: true });
});

function write(root: string, rel: string, content: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function buildProject(crates: Crate[], options: { model?: string; stageStatus?: string } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "ddd-u5-"));
  tempDirs.push(root);
  const members = crates.map((crate) => `"${crate.path}"`).join(", ");
  write(root, "Cargo.toml", `[workspace]\nmembers = [${members}]\nresolver = "2"\n`);
  for (const crate of crates) {
    const deps = (crate.deps ?? []).map((dep) => {
      const target = crates.find((candidate) => candidate.name === dep);
      if (!target) throw new Error(`unknown dependency ${dep}`);
      return `${dep} = { path = "${join("..", target.path).split("\\").join("/")}" }`;
    });
    write(
      root,
      `${crate.path}/Cargo.toml`,
      `[package]\nname = "${crate.name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${deps.join("\n")}\n`,
    );
    write(root, `${crate.path}/src/lib.rs`, crate.lib);
  }

  const record = "aidlc/spaces/default/intents/i1";
  write(
    root,
    `${record}/aidlc-state.md`,
    `## Stage Progress\n${options.stageStatus ?? "- [x] ddd-domain-modeling — EXECUTE"}\n`,
  );
  write(
    root,
    `${record}/inception/ddd-domain-modeling/ddd-domain-model-yaml.md`,
    modelDocument(options.model ?? MODEL),
  );
  write(root, `${record}/inception/domain-design/ddd-aggregate-mapping.md`, fixtureMapping());
  write(root, `${record}/construction/u1/code-generation/code-summary.md`, "# code summary\n");
  write(
    root,
    `${record}/construction/u1/code-generation/source-manifest.json`,
    JSON.stringify({
      stage: "code-generation",
      unit: "u1",
      version: 1,
      writes: crates.map((crate) => ({ path: `${crate.path}/src/lib.rs` })),
    }),
  );
  return root;
}

interface Verdict {
  pass: boolean;
  rules: string[];
  /** `<rule_id>@<line>` per finding, in report order: the position the gate sends a reader to. */
  located: string[];
  note?: string;
}

function runSensor(sensor: string, proj: string, stage = "code-generation"): Verdict {
  const output = join(proj, "aidlc/spaces/default/intents/i1/construction/u1/code-generation/code-summary.md");
  const proc = Bun.spawnSync(
    ["bun", join(toolsDir, `ddd-sensor-rust-${sensor}.ts`), "--stage", stage, "--output-path", output],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const stdout = proc.stdout.toString().trim();
  if (!stdout) throw new Error(`no verdict (exit ${proc.exitCode}): ${proc.stderr.toString()}`);
  const verdict = JSON.parse(stdout) as {
    pass: boolean;
    findings: { rule_id: string; line?: number }[];
    note?: string;
  };
  return {
    pass: verdict.pass,
    rules: verdict.findings.map((f) => f.rule_id),
    located: verdict.findings.map((f) => `${f.rule_id}@${f.line ?? "-"}`),
    ...(verdict.note ? { note: verdict.note } : {}),
  };
}

const USE_CASE_LIB = "packages/use-case/billing-use-case/src/lib.rs";

/** A use-case crate holding `lib`, over a domain crate whose only aggregate type is `Invoice`. */
function useCaseProject(lib: string): string {
  return buildProject([
    { path: "packages/domain/billing-domain", name: "billing-domain", lib: "pub struct Invoice;\n" },
    { path: "packages/use-case/billing-use-case", name: "billing-use-case", lib, deps: ["billing-domain"] },
  ]);
}

/** An interface-adapter crate holding `lib`, with no other crate in the workspace. */
function adapterProject(lib: string): string {
  return buildProject([
    { path: "packages/interface-adapter/billing-interface-adapter", name: "billing-interface-adapter", lib },
  ]);
}

/** A query-side crate holding `lib`, over a domain crate whose only aggregate type is `Invoice`. */
function queryProject(lib: string): string {
  return buildProject([
    { path: "packages/domain/billing-domain", name: "billing-domain", lib: "pub struct Invoice;\n" },
    {
      path: "packages/query/use-case/billing-query-use-case",
      name: "billing-query-use-case",
      lib,
      deps: ["billing-domain"],
    },
  ]);
}

const DOMAIN_CLEAN = `pub struct Invoice {
    id: String,
    amount: i64,
}
impl Invoice {
    pub fn issue(&mut self) {}
    pub fn total(&self) -> i64 { self.amount }
}
`;

describe("ddd-rust-domain", () => {
  test("passes a clean domain crate", () => {
    const proj = buildProject([{ path: "packages/domain/billing-domain", name: "billing-domain", lib: DOMAIN_CLEAN }]);
    const result = runSensor("domain", proj);
    expect(result.rules).toEqual([]);
    expect(result.pass).toBe(true);
  });

  test("reports a public field (a)", () => {
    const lib = DOMAIN_CLEAN.replace("id: String,", "pub id: String,");
    const proj = buildProject([{ path: "packages/domain/billing-domain", name: "billing-domain", lib }]);
    expect(runSensor("domain", proj).rules).toContain("a");
  });

  test("reports an undeclared mutation (b)", () => {
    const lib = DOMAIN_CLEAN.replace("pub fn issue(&mut self) {}", "pub fn rename(&mut self) {}");
    const proj = buildProject([{ path: "packages/domain/billing-domain", name: "billing-domain", lib }]);
    expect(runSensor("domain", proj).rules).toContain("b");
  });

  test("reports a getter call (d)", () => {
    const lib = `${DOMAIN_CLEAN}\npub fn peek(inv: &Invoice) -> i64 { inv.total() }\n`;
    const proj = buildProject([{ path: "packages/domain/billing-domain", name: "billing-domain", lib }]);
    expect(runSensor("domain", proj).rules).toContain("d");
  });

  test("reports a forbidden dependency (g)", () => {
    const lib = `use billing_interface_adapter::Adapter;\n${DOMAIN_CLEAN}`;
    const proj = buildProject([
      { path: "packages/domain/billing-domain", name: "billing-domain", lib },
      {
        path: "packages/interface-adapter/billing-interface-adapter",
        name: "billing-interface-adapter",
        lib: "pub struct Adapter;\n",
      },
    ]);
    expect(runSensor("domain", proj).rules).toContain("g");
  });

  test("passes with a note when the model is skipped", () => {
    const proj = buildProject([{ path: "packages/domain/billing-domain", name: "billing-domain", lib: DOMAIN_CLEAN }], {
      stageStatus: "- [S] ddd-domain-modeling — SKIP",
    });
    const result = runSensor("domain", proj);
    expect(result.pass).toBe(true);
    expect(result.note ?? "").toContain("domain-modeling is SKIP");
  });
});

describe("ddd-rust-use-case", () => {
  test("reports an aggregate argument to execute (h)", () => {
    const lib = `use billing_domain::Invoice;\npub struct IssueInvoice;\nimpl IssueInvoice {\n    pub fn execute(&self, invoice: Invoice) {}\n}\n`;
    expect(runSensor("use-case", useCaseProject(lib)).located).toEqual(["h@4"]);
  });

  /**
   * A function declaring `execute` outside an impl block carries the same argument decision an impl
   * method carries. Four positions are exercised here, because a declaration set that misses one of
   * them turns its finding into a silent pass.
   */
  test.each([
    ["at the top level", "use billing_domain::Invoice;\npub fn execute(invoice: Invoice) {}\n", "h@2"],
    [
      "inside an inline module",
      "use billing_domain::Invoice;\npub mod inner {\n    use super::Invoice;\n    pub fn execute(invoice: Invoice) {}\n}\n",
      "h@4",
    ],
    [
      "inside another function's body",
      "use billing_domain::Invoice;\npub fn outer() {\n    fn execute(invoice: Invoice) {}\n}\n",
      "h@3",
    ],
    [
      "as a trait method that writes a body",
      "use billing_domain::Invoice;\npub trait Runner {\n    fn execute(&self, invoice: Invoice) {}\n}\n",
      "h@3",
    ],
  ])("reports an aggregate argument to an execute declared %s (h)", (_label, lib, expected) => {
    expect(runSensor("use-case", useCaseProject(lib)).located).toEqual([expected]);
  });

  /** A trait method without a body binds no parameter this rule has an argument to decide on. */
  test("does not report a trait method that declares no body (h)", () => {
    const lib = "use billing_domain::Invoice;\npub trait Runner {\n    fn execute(&self, invoice: Invoice);\n}\n";
    const result = runSensor("use-case", useCaseProject(lib));
    expect(result.located).toEqual([]);
    expect(result.pass).toBe(true);
  });

  /**
   * An unexpanded macro can declare an `execute` no answer here can see. It produces no finding, and
   * the reason it produces none is carried to the reader rather than left out of the verdict.
   */
  test("does not report an execute an unexpanded macro may declare, and says the expansion is missing (h)", () => {
    const lib = "use billing_domain::Invoice;\nmake_use_case!{ fn execute(invoice: Invoice) {} }\n";
    const result = runSensor("use-case", useCaseProject(lib));
    expect(result.located).toEqual([]);
    expect(result.note ?? "").toContain(`domain-facts.unresolved: ${USE_CASE_LIB}:2 macro-expansion`);
  });

  test("reports use-case chaining (i)", () => {
    const lib = `pub struct FinishInvoice;\nimpl FinishInvoice { pub fn execute(&self) {} }\npub struct IssueInvoice;\nimpl IssueInvoice {\n    pub fn run(&self, other: &FinishInvoice) { other.execute(); }\n}\n`;
    const proj = buildProject([{ path: "packages/use-case/billing-use-case", name: "billing-use-case", lib }]);
    expect(runSensor("use-case", proj).rules).toContain("i");
  });
});

describe("ddd-rust-interface-adapter", () => {
  /**
   * A finding against a declaration sends a reader to the line the declaration starts on. The
   * attributes written above it are not part of that declaration and must not move the line.
   */
  test("reports a repository trait with a medium word (m)", () => {
    const lib = '#[doc = "the port"]\npub trait DynamoDbInvoiceRepository {}\n';
    expect(runSensor("interface-adapter", adapterProject(lib)).located).toEqual(["m@2"]);
  });

  test("reports a repository port trait that does not name its aggregate (m)", () => {
    const lib = "pub trait InvoiceRepository {}\npub trait PaymentRepository {}\n";
    expect(runSensor("interface-adapter", adapterProject(lib)).located).toEqual(["m@2"]);
  });

  /**
   * Port traits and repository types are two separate declaration sets. A struct and an enum both
   * declare a repository type, so both are read from the set the implementations come from.
   */
  test("reports a repository struct or enum that does not name its aggregate (m)", () => {
    const lib =
      "pub trait InvoiceRepository {}\n#[derive(Clone)]\n#[allow(dead_code)]\npub struct PaymentRepository;\npub enum LedgerRepository { Empty }\n";
    expect(runSensor("interface-adapter", adapterProject(lib)).located).toEqual(["m@4", "m@5"]);
  });

  test("reports a restoration bypass (n)", () => {
    const lib = `use billing_domain::Invoice;\npub fn build() -> Invoice { Invoice { id: String::new() } }\n`;
    const proj = buildProject([
      { path: "packages/domain/billing-domain", name: "billing-domain", lib: "pub struct Invoice { id: String }\n" },
      {
        path: "packages/interface-adapter/billing-interface-adapter",
        name: "billing-interface-adapter",
        lib,
        deps: ["billing-domain"],
      },
    ]);
    expect(runSensor("interface-adapter", proj).located).toEqual(["n@2"]);
  });

  test("reports a query-side domain import (l)", () => {
    const lib = "#[allow(unused_imports)]\nuse billing_domain::Invoice;\npub fn read() -> u8 { 0 }\n";
    expect(runSensor("interface-adapter", queryProject(lib)).located).toEqual(["l@2"]);
  });

  /**
   * Rule `l` matches the literal text after the last `::`, so a glob, a rename and a multi-name
   * group each leave it a last segment that matches no domain type — even though the rename and
   * the group do take `Invoice` in. That is an existing gap, recorded for the parent issue in
   * [completion tasks](../docs/developers/completion-tasks.md) rather than closed here; what this
   * test fixes is the parity the migration has to keep, which is that reading the imports from
   * another answer must not turn one of them into a match the reader was never shown before.
   */
  test("does not report a query-side glob, rename or multi-name group import (l)", () => {
    const lib =
      "use billing_domain::*;\nuse billing_domain::Invoice as Bill;\nuse billing_domain::{Invoice, Ledger};\npub fn read() -> u8 { 0 }\n";
    const result = runSensor("interface-adapter", queryProject(lib));
    expect(result.located).toEqual([]);
    expect(result.pass).toBe(true);
  });
});

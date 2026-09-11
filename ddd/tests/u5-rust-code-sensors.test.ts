import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const toolsDir = join(import.meta.dir, "..", "tools");

const MODEL = `schema_version: 1
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
              - { element_id: error.invoice.issue.already-issued, name: AlreadyIssued, command: command.invoice.issue, condition: not draft }
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
    `## Stage Progress\n${options.stageStatus ?? "- [x] domain-modeling — EXECUTE"}\n`,
  );
  write(root, `${record}/inception/domain-modeling/domain-model.yaml`, options.model ?? MODEL);
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

function runSensor(
  sensor: string,
  proj: string,
  stage = "code-generation",
): { pass: boolean; rules: string[]; note?: string } {
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
  const verdict = JSON.parse(stdout) as { pass: boolean; findings: { rule_id: string }[]; note?: string };
  return {
    pass: verdict.pass,
    rules: verdict.findings.map((f) => f.rule_id),
    ...(verdict.note ? { note: verdict.note } : {}),
  };
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
      stageStatus: "- [S] domain-modeling — SKIP",
    });
    const result = runSensor("domain", proj);
    expect(result.pass).toBe(true);
    expect(result.note ?? "").toContain("domain-modeling is SKIP");
  });
});

describe("ddd-rust-use-case", () => {
  test("reports an aggregate argument to execute (h)", () => {
    const lib = `use billing_domain::Invoice;\npub struct IssueInvoice;\nimpl IssueInvoice {\n    pub fn execute(&self, invoice: Invoice) {}\n}\n`;
    const proj = buildProject([
      { path: "packages/domain/billing-domain", name: "billing-domain", lib: "pub struct Invoice;\n" },
      { path: "packages/use-case/billing-use-case", name: "billing-use-case", lib, deps: ["billing-domain"] },
    ]);
    expect(runSensor("use-case", proj).rules).toContain("h");
  });

  test("reports use-case chaining (i)", () => {
    const lib = `pub struct IssueInvoice;\nimpl IssueInvoice {\n    pub fn run(&self, other: &IssueInvoice) { other.execute(); }\n}\n`;
    const proj = buildProject([{ path: "packages/use-case/billing-use-case", name: "billing-use-case", lib }]);
    expect(runSensor("use-case", proj).rules).toContain("i");
  });
});

describe("ddd-rust-interface-adapter", () => {
  test("reports a repository with a medium word (m)", () => {
    const lib = "pub struct DynamoDbInvoiceRepository;\n";
    const proj = buildProject([
      { path: "packages/interface-adapter/billing-interface-adapter", name: "billing-interface-adapter", lib },
    ]);
    expect(runSensor("interface-adapter", proj).rules).toContain("m");
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
    expect(runSensor("interface-adapter", proj).rules).toContain("n");
  });
});

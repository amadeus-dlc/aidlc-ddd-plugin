/**
 * Rust golden cases (U5 BR10). Each case carries a `workspace/` (project-root
 * relative) plus the record files; the runner aligns workspace_root by writing
 * the workspace at the temp project root and the record under its aidlc/ tree.
 */

import type { GoldenCase } from "../runner.ts";

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

function project(
  crates: Crate[],
  state?: string,
  claims?: string[],
): Pick<GoldenCase, "workspace" | "files" | "state"> {
  const workspace: Record<string, string> = {
    "Cargo.toml": `[workspace]\nmembers = [${crates.map((crate) => `"${crate.path}"`).join(", ")}]\nresolver = "2"\n`,
  };
  for (const crate of crates) {
    const deps = (crate.deps ?? []).map((dep) => {
      const target = crates.find((candidate) => candidate.name === dep);
      if (!target) throw new Error(`unknown dep ${dep}`);
      return `${dep} = { path = "../${target.path.split("/").slice(-1)[0]}" }`;
    });
    workspace[`${crate.path}/Cargo.toml`] =
      `[package]\nname = "${crate.name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${deps.join("\n")}\n`;
    workspace[`${crate.path}/src/lib.rs`] = crate.lib;
  }
  const claimed = claims ?? crates.map((crate) => `${crate.path}/src/lib.rs`);
  const files: Record<string, string> = {
    "construction/u1/code-generation/code-summary.md": "# code summary\n",
    "construction/u1/code-generation/source-manifest.json": JSON.stringify({
      stage: "code-generation",
      unit: "u1",
      version: 1,
      writes: claimed.map((path) => ({ path })),
    }),
    "inception/ddd-domain-modeling/domain-model.yaml": MODEL,
  };
  return { workspace, files, ...(state ? { state } : {}) };
}

const STATE = "## Stage Progress\n- [x] ddd-domain-modeling — EXECUTE\n- [x] code-generation — EXECUTE\n";
const OUTPUT = "construction/u1/code-generation/code-summary.md";

const DOMAIN_CLEAN = `pub struct Invoice {
    id: String,
    amount: i64,
}
impl Invoice {
    pub fn issue(&mut self) {}
    pub fn total(&self) -> i64 { self.amount }
}
`;

function domainCase(
  name: string,
  lib: string,
  expect: GoldenCase["expect"],
  extra: Crate[] = [],
  state = STATE,
): GoldenCase {
  const crates: Crate[] = [{ path: "packages/domain/billing-domain", name: "billing-domain", lib }, ...extra];
  return {
    sensor: "ddd-rust-domain",
    name,
    stage: "code-generation",
    output: OUTPUT,
    ...project(crates, state),
    expect: withFiles(expect, "packages/domain/billing-domain/src/lib.rs"),
  };
}

function withFiles(expect: GoldenCase["expect"], path: string): GoldenCase["expect"] {
  const files: Record<string, string> = {};
  for (const rule of expect.rules) files[rule] = path;
  return { ...expect, files };
}

export const RUST_CASES: GoldenCase[] = [
  domainCase("clean-domain", DOMAIN_CLEAN, { pass: true, rules: [] }),
  domainCase("violation-a", DOMAIN_CLEAN.replace("id: String,", "pub id: String,"), { pass: false, rules: ["a"] }),
  domainCase("violation-b", DOMAIN_CLEAN.replace("pub fn issue(&mut self) {}", "pub fn rename(&mut self) {}"), {
    pass: false,
    rules: ["b"],
  }),
  domainCase(
    "violation-c-literal",
    `${DOMAIN_CLEAN}\npub fn build() -> Invoice { Invoice { id: String::new(), amount: 0 } }\n`,
    { pass: false, rules: ["c"] },
  ),
  domainCase("violation-c-default", `#[derive(Default)]\n${DOMAIN_CLEAN}`, { pass: false, rules: ["c"] }),
  domainCase("violation-d", `${DOMAIN_CLEAN}\npub fn peek(inv: &Invoice) -> i64 { inv.total() }\n`, {
    pass: false,
    rules: ["d"],
  }),
  domainCase("violation-g", `use billing_interface_adapter::Adapter;\n${DOMAIN_CLEAN}`, { pass: false, rules: ["g"] }, [
    {
      path: "packages/interface-adapter/billing-interface-adapter",
      name: "billing-interface-adapter",
      lib: "pub struct Adapter;\n",
    },
  ]),
  domainCase(
    "clean-model-skipped",
    DOMAIN_CLEAN,
    { pass: true, rules: [], note_contains: "domain-modeling is SKIP" },
    [],
    "## Stage Progress\n- [S] ddd-domain-modeling — SKIP\n- [x] code-generation — EXECUTE\n",
  ),

  {
    sensor: "ddd-rust-use-case",
    name: "violation-h",
    stage: "code-generation",
    output: OUTPUT,
    ...project(
      [
        { path: "packages/domain/billing-domain", name: "billing-domain", lib: "pub struct Invoice;\n" },
        {
          path: "packages/use-case/billing-use-case",
          name: "billing-use-case",
          lib: "use billing_domain::Invoice;\npub struct IssueInvoice;\nimpl IssueInvoice {\n    pub fn execute(&self, invoice: Invoice) {}\n}\n",
          deps: ["billing-domain"],
        },
      ],
      STATE,
      ["packages/use-case/billing-use-case/src/lib.rs"],
    ),
    expect: withFiles({ pass: false, rules: ["h"] }, "packages/use-case/billing-use-case/src/lib.rs"),
  },
  {
    sensor: "ddd-rust-use-case",
    name: "violation-i",
    stage: "code-generation",
    output: OUTPUT,
    ...project(
      [
        {
          path: "packages/use-case/billing-use-case",
          name: "billing-use-case",
          lib: "pub struct IssueInvoice;\nimpl IssueInvoice {\n    pub fn run(&self, other: &IssueInvoice) { other.execute(); }\n}\n",
        },
      ],
      STATE,
    ),
    expect: withFiles({ pass: false, rules: ["i"] }, "packages/use-case/billing-use-case/src/lib.rs"),
  },

  {
    sensor: "ddd-rust-interface-adapter",
    name: "clean-repository",
    stage: "code-generation",
    output: OUTPUT,
    ...project([
      {
        path: "packages/interface-adapter/billing-interface-adapter",
        name: "billing-interface-adapter",
        lib: "pub trait InvoiceRepository {}\npub struct InMemoryInvoiceRepository;\nimpl InvoiceRepository for InMemoryInvoiceRepository {}\n",
      },
    ]),
    expect: { pass: true, rules: [] },
  },
  {
    sensor: "ddd-rust-interface-adapter",
    name: "violation-m-media",
    stage: "code-generation",
    output: OUTPUT,
    ...project([
      {
        path: "packages/interface-adapter/billing-interface-adapter",
        name: "billing-interface-adapter",
        lib: "pub trait DynamoDbInvoiceRepository {}\n",
      },
    ]),
    expect: withFiles({ pass: false, rules: ["m"] }, "packages/interface-adapter/billing-interface-adapter/src/lib.rs"),
  },
  {
    sensor: "ddd-rust-interface-adapter",
    name: "violation-n",
    stage: "code-generation",
    output: OUTPUT,
    ...project(
      [
        { path: "packages/domain/billing-domain", name: "billing-domain", lib: "pub struct Invoice { id: String }\n" },
        {
          path: "packages/interface-adapter/billing-interface-adapter",
          name: "billing-interface-adapter",
          lib: "use billing_domain::Invoice;\npub fn build() -> Invoice { Invoice { id: String::new() } }\n",
          deps: ["billing-domain"],
        },
      ],
      STATE,
      ["packages/interface-adapter/billing-interface-adapter/src/lib.rs"],
    ),
    expect: withFiles({ pass: false, rules: ["n"] }, "packages/interface-adapter/billing-interface-adapter/src/lib.rs"),
  },
  {
    sensor: "ddd-rust-interface-adapter",
    name: "violation-k",
    stage: "code-generation",
    output: OUTPUT,
    ...project(
      [
        {
          path: "packages/command/interface-adapter/billing-command-api",
          name: "billing-command-api",
          lib: "use billing_query_dao::Dao;\npub struct CommandApi;\n",
          deps: ["billing-query-dao"],
        },
        {
          path: "packages/query/interface-adapter/billing-query-dao",
          name: "billing-query-dao",
          lib: "pub struct Dao;\n",
        },
      ],
      STATE,
      ["packages/command/interface-adapter/billing-command-api/src/lib.rs"],
    ),
    expect: withFiles(
      { pass: false, rules: ["k"] },
      "packages/command/interface-adapter/billing-command-api/src/lib.rs",
    ),
  },
  {
    sensor: "ddd-rust-interface-adapter",
    name: "violation-l",
    stage: "code-generation",
    output: OUTPUT,
    ...project(
      [
        { path: "packages/domain/billing-domain", name: "billing-domain", lib: "pub struct Invoice;\n" },
        {
          path: "packages/query/use-case/billing-query-use-case",
          name: "billing-query-use-case",
          lib: "use billing_domain::Invoice;\npub fn read() -> Invoice { todo!() }\n",
          deps: ["billing-domain"],
        },
      ],
      STATE,
      ["packages/query/use-case/billing-query-use-case/src/lib.rs"],
    ),
    expect: withFiles({ pass: false, rules: ["l"] }, "packages/query/use-case/billing-query-use-case/src/lib.rs"),
  },
];

import { posix } from "node:path";
import { fixtureMapping, withFixturePackages } from "../package-fixture.ts";
/**
 * Rust golden cases (U5 BR10). Each case carries a `workspace/` (project-root
 * relative) plus the record files; the runner aligns workspace_root by writing
 * the workspace at the temp project root and the record under its aidlc/ tree.
 */

import { modelDocument } from "../model-document.ts";
import type { GoldenCase } from "../runner.ts";
import { domainFactsCases } from "./domain-facts-cases.ts";
import { getterArgumentCases } from "./getter-argument-cases.ts";
import { t2Cases } from "./t2-cases.ts";

/** The canonical model the code gates are decided against; the TypeScript cases share it. */
export const MODEL = `schema_version: 2
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
            event: event.invoice.issued
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
  /**
   * When set, the crate also gets a `src/main.rs`, which Cargo's auto-discovery
   * turns into a second (bin) target alongside the lib. Only the mixed-targets
   * case needs this; every other crate stays lib-only.
   */
  bin?: string;
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
      return `${dep} = { path = "${posix.relative(crate.path, target.path)}" }`;
    });
    workspace[`${crate.path}/Cargo.toml`] =
      `[package]\nname = "${crate.name}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${deps.join("\n")}\n`;
    workspace[`${crate.path}/src/lib.rs`] = crate.lib;
    if (crate.bin !== undefined) workspace[`${crate.path}/src/main.rs`] = crate.bin;
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
    "inception/ddd-domain-modeling/ddd-domain-model-yaml.md": modelDocument(MODEL),
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

/**
 * The declared command `issue` taking something other than `&mut self`: a command changes the
 * aggregate's state, so it borrows it mutably, whatever it returns. The first one returns the event
 * without changing state, the shape of a decision-only method.
 */
const ISSUE_TYPES = "pub enum InvoiceEvent {\n    Issued,\n}\npub enum IssueInvoiceError {\n    AlreadyIssued,\n}\n";
function withIssue(signature: string): string {
  return `${DOMAIN_CLEAN.replace(
    "pub fn issue(&mut self) {}",
    `pub fn issue(${signature}) -> Result<InvoiceEvent, IssueInvoiceError> { Ok(InvoiceEvent::Issued) }`,
  )}${ISSUE_TYPES}`;
}
const RUST_COMMAND_RECEIVER_CASES: readonly (readonly [string, string])[] = [
  ["violation-b-command-ref-self", withIssue("&self")],
  ["violation-b-command-by-value", withIssue("self")],
  ["violation-b-command-mut-self-value", withIssue("mut self")],
];
/** A method named like the command on a type bound to no aggregate is not the command. */
const UNBOUND_ISSUE = `${DOMAIN_CLEAN}pub struct Stamp {
    mark: i64,
}
impl Stamp {
    pub fn issue(&self) -> bool { self.mark > 0 }
}
`;

const BASE_RUST_CASES: GoldenCase[] = [
  domainCase("clean-domain", DOMAIN_CLEAN, { pass: true, rules: [] }),
  domainCase("violation-a", DOMAIN_CLEAN.replace("id: String,", "pub id: String,"), { pass: false, rules: ["a"] }),
  domainCase("violation-b", DOMAIN_CLEAN.replace("pub fn issue(&mut self) {}", "pub fn rename(&mut self) {}"), {
    pass: false,
    rules: ["b"],
  }),
  ...RUST_COMMAND_RECEIVER_CASES.map(([name, lib]) => domainCase(name, lib, { pass: false, rules: ["b"] })),
  // A command that borrows the aggregate mutably and returns its one event is the shape a command has.
  domainCase(
    "clean-b-command-returns-event",
    `${DOMAIN_CLEAN.replace(
      "pub fn issue(&mut self) {}",
      "pub fn issue(&mut self) -> Result<InvoiceEvent, IssueInvoiceError> { Ok(InvoiceEvent::Issued) }",
    )}${ISSUE_TYPES}`,
    { pass: true, rules: [] },
  ),
  domainCase("clean-b-unbound-type-method", UNBOUND_ISSUE, { pass: true, rules: [] }),
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
          lib: "pub struct FinishInvoice;\nimpl FinishInvoice { pub fn execute(&self) {} }\npub struct IssueInvoice;\nimpl IssueInvoice {\n    pub fn run(&self, other: &FinishInvoice) { other.execute(); }\n}\n",
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

  // ---- U2 layer diagnostics (BR10.2) ------------------------------------
  // These three are reported by the domain sensor's `report_layer_diagnostics`
  // and are raised against the crate's Cargo.toml, not its sources, so they
  // cannot use `withFiles` (which assumes src/lib.rs).
  {
    sensor: "ddd-rust-domain",
    name: "violation-layer-unknown",
    stage: "code-generation",
    output: OUTPUT,
    ...project(
      [
        { path: "packages/domain/billing-domain", name: "billing-domain", lib: DOMAIN_CLEAN },
        { path: "packages/misc/billing-thing", name: "billing-thing", lib: "pub struct Thing;\n" },
      ],
      STATE,
      ["packages/domain/billing-domain/src/lib.rs", "packages/misc/billing-thing/src/lib.rs"],
    ),
    expect: {
      pass: false,
      rules: ["layer.unknown"],
      files: { "layer.unknown": "packages/misc/billing-thing/Cargo.toml" },
    },
  },
  {
    sensor: "ddd-rust-domain",
    name: "violation-layer-conflict",
    stage: "code-generation",
    output: OUTPUT,
    ...project(
      // The name suffix says domain, the placement says use-case. A conflicting
      // crate resolves to layer `unknown`, so the case also carries a well-placed
      // domain crate: with no domain file to evaluate the context is empty and
      // `evaluate.ts` returns before it reports layer diagnostics at all.
      [
        { path: "packages/domain/billing-core-domain", name: "billing-core-domain", lib: DOMAIN_CLEAN },
        { path: "packages/use-case/billing-domain", name: "billing-domain", lib: "pub struct Placeholder;\n" },
      ],
      STATE,
      ["packages/domain/billing-core-domain/src/lib.rs", "packages/use-case/billing-domain/src/lib.rs"],
    ),
    expect: {
      pass: false,
      rules: ["layer.conflict"],
      files: { "layer.conflict": "packages/use-case/billing-domain/Cargo.toml" },
    },
  },
  {
    sensor: "ddd-rust-domain",
    name: "violation-layer-mixed-targets",
    stage: "code-generation",
    output: OUTPUT,
    ...project(
      [
        {
          path: "packages/domain/billing-domain",
          name: "billing-domain",
          lib: DOMAIN_CLEAN,
          bin: "fn main() {}\n",
        },
      ],
      STATE,
      ["packages/domain/billing-domain/src/lib.rs"],
    ),
    expect: {
      pass: false,
      rules: ["layer.mixed-targets"],
      files: { "layer.mixed-targets": "packages/domain/billing-domain/Cargo.toml" },
    },
  },
];

export const RUST_CASES: GoldenCase[] = [
  ...BASE_RUST_CASES,
  ...t2Cases(BASE_RUST_CASES),
  ...getterArgumentCases(BASE_RUST_CASES),
  ...domainFactsCases(BASE_RUST_CASES),
].map((entry) => {
  const path = "inception/domain-design/ddd-aggregate-mapping.md";
  return {
    ...entry,
    files: { ...entry.files, [path]: entry.files[path] ? withFixturePackages(entry.files[path]) : fixtureMapping() },
  };
});

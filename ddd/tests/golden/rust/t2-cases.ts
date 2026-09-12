import type { GoldenCase } from "../runner.ts";

const DOMAIN = "packages/domain/billing-domain/src/lib.rs";
const USE_CASE = "packages/use-case/billing-use-case/src/lib.rs";
const MODEL = "inception/ddd-domain-modeling/ddd-domain-model-yaml.md";

export function t2Cases(base: readonly GoldenCase[]): GoldenCase[] {
  const clone = (name: string, nextName: string): GoldenCase & { workspace: Record<string, string> } => {
    const source = base.find((entry) => entry.name === name);
    if (!source?.workspace) throw new Error(`missing Rust fixture ${name}`);
    return { ...structuredClone(source), workspace: structuredClone(source.workspace), name: nextName };
  };
  const value = clone("violation-h", "clean-h-value-object");
  value.workspace[DOMAIN] = "pub struct Invoice;\npub struct Amount { value: i64 }\n";
  value.workspace[USE_CASE] =
    "use billing_domain::Amount;\npub struct IssueInvoice;\nimpl IssueInvoice { pub fn execute(&self, amount: Amount) {} }\n";
  value.files[MODEL] = value.files[MODEL].replace(
    "        invariants:",
    "          - { element_id: vo.amount, kind: value-object, name: Amount, aggregate: aggregate.invoice }\n        invariants:",
  );
  value.expect = { pass: true, rules: [] };
  const port = clone("violation-i", "clean-i-port-execute");
  port.workspace[USE_CASE] =
    "pub trait PaymentPort { fn execute(&self); }\npub struct IssueInvoice;\nimpl IssueInvoice { pub fn execute(&self, port: &impl PaymentPort) { port.execute(); } }\n";
  port.expect = { pass: true, rules: [] };
  const split = clone("clean-domain", "violation-b-split-impl");
  const operations = "packages/domain/billing-domain/src/operations.rs";
  split.workspace[DOMAIN] = "pub struct Invoice { amount: i64 }\nmod operations;\n";
  split.workspace[operations] =
    "use super::Invoice;\nimpl Invoice { pub fn set_amount(&mut self, amount: i64) { self.amount = amount; } }\n";
  const manifest = "construction/u1/code-generation/source-manifest.json";
  split.files[manifest] = JSON.stringify({
    stage: "code-generation",
    unit: "u1",
    version: 1,
    writes: [{ path: operations }],
  });
  split.expect = { pass: false, rules: ["b"], files: { b: operations } };
  const command = structuredClone(split);
  command.name = "clean-b-split-command";
  command.workspace[operations] =
    "use super::Invoice;\nimpl Invoice { pub fn issue(&mut self) { self.amount = 1; } }\n";
  command.expect = { pass: true, rules: [] };
  const arbitrary = clone("clean-domain", "violation-b-arbitrary-apply");
  arbitrary.workspace[DOMAIN] =
    "pub struct Invoice { amount: i64 }\nimpl Invoice { pub fn apply(&mut self, amount: i64) { self.amount = amount; } }\n";
  arbitrary.expect = { pass: false, rules: ["b"], files: { b: DOMAIN } };
  const replay = clone("clean-domain", "clean-b-declared-replay");
  replay.workspace[DOMAIN] =
    "pub struct Invoice { amount: i64 }\npub struct Issued { amount: i64 }\nimpl Invoice { pub fn apply_event(&mut self, event: Issued) { self.amount = event.amount; } }\n";
  replay.files["inception/domain-design/ddd-aggregate-mapping.md"] = `# 集約写像

\`\`\`yaml
schema_version: 1
model_ref: inception/ddd-domain-modeling/ddd-domain-model-yaml.md
aggregate_mappings:
  - aggregate_ref: aggregate.invoice
    programming_model: class
    persistence_method: event-sourcing
    crate: billing-domain
    module: crate
    ports: []
    repository: InvoiceRepository
    reference_ids: [entity.invoice, event.invoice.issued]
    replay_methods:
      - { method: apply_event, event_ref: event.invoice.issued }
\`\`\`
`;
  replay.expect = { pass: true, rules: [] };
  const alias = clone("violation-h", "violation-h-import-alias");
  alias.workspace[USE_CASE] =
    "use billing_domain::Invoice as Bill;\npub struct IssueInvoice;\nimpl IssueInvoice { pub fn execute(&self, invoice: Box<Bill>) {} }\n";
  const local = clone("violation-h", "clean-h-local-name-collision");
  local.workspace[USE_CASE] =
    "pub struct Invoice;\npub struct IssueInvoice;\nimpl IssueInvoice { pub fn execute(&self, value: Invoice) {} }\n";
  local.expect = { pass: true, rules: [] };
  const getter = clone("violation-h", "clean-d-unrelated-getter-name");
  getter.workspace[DOMAIN] =
    "pub struct Invoice { amount: i64 }\nimpl Invoice { pub fn total(&self) -> i64 { self.amount } }\n";
  getter.workspace[USE_CASE] =
    "pub struct Statistics;\nimpl Statistics { pub fn total(&self) -> i64 { 42 } }\npub fn render(stats: &Statistics) -> i64 { stats.total() }\n";
  getter.expect = { pass: true, rules: [] };
  const cases = [value, port, split, command, arbitrary, replay, alias, local, getter];
  for (const [name, source] of [
    ["type-alias", "use billing_domain::Invoice; type Bill = Invoice; pub fn execute(invoice: Option<Bill>) {}"],
    ["qualified", "pub fn execute(invoice: std::sync::Arc<billing_domain::Invoice>) {}"],
    ["grouped-alias", "use billing_domain::{Invoice as Bill}; pub fn execute(invoice: Bill) {}"],
    ["imported-box", "use std::boxed::Box; use billing_domain::Invoice; pub fn execute(invoice: Box<Invoice>) {}"],
  ]) {
    const entry = clone("violation-h", `violation-h-${name}`);
    entry.workspace[USE_CASE] = `${source}\n`;
    cases.push(entry);
  }
  const fieldPort = structuredClone(port);
  fieldPort.name = "clean-i-field-port";
  fieldPort.workspace[USE_CASE] =
    "pub trait PaymentPort { fn execute(&self); }\npub struct IssueInvoice { port: Box<dyn PaymentPort> }\nimpl IssueInvoice { pub fn execute(&self) { self.port.execute(); } }\n";
  cases.push(fieldPort);
  const fieldUseCase = clone("violation-i", "violation-i-field-use-case");
  fieldUseCase.workspace[USE_CASE] =
    "pub struct FinishInvoice; impl FinishInvoice { pub fn execute(&self) {} }\npub struct IssueInvoice { finish: FinishInvoice }\nimpl IssueInvoice { pub fn execute(&self) { self.finish.execute(); } }\n";
  cases.push(fieldUseCase);
  const ufcs = clone("violation-i", "violation-i-associated-call");
  ufcs.workspace[USE_CASE] =
    "pub struct FinishInvoice; impl FinishInvoice { pub fn execute(&self) {} }\npub struct IssueInvoice; impl IssueInvoice { pub fn execute(&self, other: &FinishInvoice) { FinishInvoice::execute(other); } }\n";
  cases.push(ufcs);
  const crossFile = clone("violation-i", "violation-i-imported-use-case");
  crossFile.workspace[USE_CASE] =
    "mod finish; use finish::FinishInvoice as Done;\npub struct IssueInvoice; impl IssueInvoice { pub fn execute(&self, other: &Done) { other.execute(); } }\n";
  crossFile.workspace["packages/use-case/billing-use-case/src/finish.rs"] =
    "pub struct FinishInvoice; impl FinishInvoice { pub fn execute(&self) {} }\n";
  cases.push(crossFile);
  const shadow = clone("violation-i", "clean-i-untyped-shadow");
  shadow.workspace[USE_CASE] =
    "pub struct FinishInvoice; impl FinishInvoice { pub fn execute(&self) {} }\npub trait PaymentPort { fn execute(&self); }\npub struct IssueInvoice; impl IssueInvoice { pub fn execute(&self, other: &FinishInvoice, port: &impl PaymentPort) { let other = port; other.execute(); } }\n";
  shadow.expect = { pass: true, rules: [], note_contains: "rule i not evaluated" };
  cases.push(shadow);
  const patternShadow = structuredClone(shadow);
  patternShadow.name = "clean-i-pattern-shadow";
  patternShadow.workspace[USE_CASE] =
    "pub struct FinishInvoice; impl FinishInvoice { pub fn execute(&self) {} }\npub trait PaymentPort { fn execute(&self); }\npub struct IssueInvoice; impl IssueInvoice { pub fn execute(&self, other: &FinishInvoice, port: Option<&dyn PaymentPort>) { if let Some(other) = port { other.execute(); } } }\n";
  cases.push(patternShadow);
  const trait = structuredClone(split);
  trait.name = "violation-b-trait-impl";
  trait.workspace[operations] =
    "use super::Invoice;\npub trait Change { fn change(&mut self); }\nimpl Change for Invoice { fn change(&mut self) { self.amount = 2; } }\n";
  cases.push(trait);
  const immutable = structuredClone(value);
  immutable.name = "violation-b-value-object";
  immutable.sensor = "ddd-rust-domain";
  immutable.workspace[DOMAIN] += "impl Amount { pub fn issue(&mut self) { self.value = 2; } }\n";
  immutable.files[manifest] = JSON.stringify({
    stage: "code-generation",
    unit: "u1",
    version: 1,
    writes: [{ path: DOMAIN }],
  });
  immutable.expect = { pass: false, rules: ["b"], files: { b: DOMAIN } };
  cases.push(immutable);
  const getterAlias = clone("violation-h", "violation-d-getter-alias");
  getterAlias.workspace[DOMAIN] = getter.workspace[DOMAIN];
  getterAlias.workspace[USE_CASE] =
    "use billing_domain::Invoice as Bill; pub fn render(inv: &Bill) -> i64 { inv.total() }\n";
  getterAlias.expect = { pass: false, rules: ["d"], files: { d: USE_CASE } };
  cases.push(getterAlias);
  const getterSplit = clone("violation-d", "violation-d-split-getter");
  getterSplit.workspace[DOMAIN] =
    "pub struct Invoice { amount: i64 }\nmod operations;\npub fn peek(inv: &Invoice) -> i64 { inv.total() }\n";
  getterSplit.workspace[operations] =
    "use super::Invoice; impl Invoice { pub fn total(&self) -> i64 { self.amount } }\n";
  cases.push(getterSplit);
  const mapping = "inception/domain-design/ddd-aggregate-mapping.md";
  for (const [name, from, to] of [
    ["state-sourcing", "persistence_method: event-sourcing", "persistence_method: state-sourcing"],
    ["wrong-crate", "crate: billing-domain", "crate: other-domain"],
    ["wrong-module", "module: crate", "module: other"],
    ["unknown-event", "event_ref: event.invoice.issued", "event_ref: event.invoice.unknown"],
    ["unlisted-method", "method: apply_event", "method: another"],
    [
      "duplicate-method",
      "      - { method: apply_event, event_ref: event.invoice.issued }",
      "      - { method: apply_event, event_ref: event.invoice.issued }\n      - { method: apply_event, event_ref: event.invoice.issued }",
    ],
  ]) {
    const entry = structuredClone(replay);
    entry.name = `violation-b-replay-${name}`;
    entry.files[mapping] = entry.files[mapping].replace(from, to);
    entry.expect = { pass: false, rules: ["b"], files: { b: DOMAIN } };
    cases.push(entry);
  }
  const scalar = structuredClone(replay);
  scalar.name = "violation-b-replay-scalar";
  scalar.workspace[DOMAIN] = scalar.workspace[DOMAIN]
    .replace("event: Issued", "event: i64")
    .replace("event.amount", "event");
  scalar.expect = { pass: false, rules: ["b"], files: { b: DOMAIN } };
  cases.push(scalar);
  const splitReplay = structuredClone(replay);
  splitReplay.name = "clean-b-split-replay";
  splitReplay.workspace[DOMAIN] =
    "pub struct Invoice { amount: i64 }\npub struct Issued { amount: i64 }\nmod operations;\n";
  splitReplay.workspace[operations] =
    "use super::{Invoice, Issued};\nimpl Invoice { pub fn apply_event(&mut self, event: Issued) { self.amount = event.amount; } }\n";
  splitReplay.files[manifest] = split.files[manifest];
  cases.push(splitReplay);
  const ambiguous = clone("clean-domain", "clean-b-ambiguous-model-name");
  ambiguous.workspace[DOMAIN] =
    "mod left { pub struct Invoice; impl Invoice { pub fn issue(&mut self) {} } }\nmod right { pub struct Invoice; impl Invoice { pub fn issue(&mut self) {} } }\n";
  ambiguous.expect = { pass: true, rules: [], note_contains: "model.unresolved" };
  cases.push(ambiguous);
  const primitive = structuredClone(value);
  primitive.name = "clean-h-domain-primitive";
  primitive.files[MODEL] = primitive.files[MODEL]
    .replace("vo.amount", "primitive.amount")
    .replace("kind: value-object", "kind: domain-primitive, attributes: [{ name: value, type: integer }]");
  cases.push(primitive);
  const own = clone("violation-i", "clean-i-own-associated-call");
  own.workspace[USE_CASE] =
    "pub struct IssueInvoice; impl IssueInvoice { pub fn execute(&self) {} pub fn run(&self) { IssueInvoice::execute(self); } }\n";
  own.expect = { pass: true, rules: [] };
  cases.push(own);
  return cases;
}

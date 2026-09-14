import type { GoldenCase } from "../runner.ts";

const DOMAIN = "packages/domain/billing-domain/src/lib.rs";
const USE_CASE = "packages/use-case/billing-use-case/src/lib.rs";
const domain = `pub struct Invoice { id: i64 }
impl Invoice { pub fn id(&self) -> i64 { self.id } }
pub trait InvoiceRepository { fn remove(&self, id: i64); fn by_ref(&self, id: &i64); }
`;

export function getterArgumentCases(base: readonly GoldenCase[]): GoldenCase[] {
  const source = base.find((entry) => entry.name === "violation-h");
  if (!source) throw new Error("missing use-case fixture");
  const make = (name: string, code: string, pass: boolean, domainCode = domain): GoldenCase => ({
    ...structuredClone(source),
    name: `${pass ? "clean" : "violation"}-d-repository-${name}`,
    workspace: { ...source.workspace, [DOMAIN]: domainCode, [USE_CASE]: code },
    expect: { pass, rules: pass ? [] : ["d"], files: { d: USE_CASE } },
  });
  const fn = (body: string) =>
    `use billing_domain::{Invoice, InvoiceRepository};
     pub fn run(invoice: &Invoice, repo: &impl InvoiceRepository) { ${body} }`;
  const cases = [
    make("argument", fn("repo.remove(invoice.id());"), true),
    make("borrow", fn("repo.by_ref(&(invoice.id()));"), true),
    make("local", fn("let id = invoice.id(); repo.remove(id);"), true),
    make("local-alias", fn("let id = invoice.id(); let key = id; repo.remove(key);"), true),
    make("local-borrow", fn("let id: i64 = invoice.id(); repo.by_ref(&id);"), true),
    make("multiple-uses", fn("let id = invoice.id(); repo.remove(id); repo.remove(id);"), true),
    make("business-branch", fn("if invoice.id() == 42 { repo.remove(42); }"), false),
    make("arithmetic", fn("repo.remove(invoice.id() + 1);"), false),
    make("argument-branch", fn("repo.remove(if invoice.id() == 42 { 1 } else { 2 });"), false),
    make("transformation", fn("repo.remove(invoice.id().abs());"), false),
    make("local-business-use", fn("let id = invoice.id(); if id == 42 { repo.remove(id); }"), false),
    make("local-unused", fn("let id = invoice.id();"), false),
    make("local-mutable", fn("let mut id = invoice.id(); id += 1; repo.remove(id);"), false),
    make("local-macro", fn('let id = invoice.id(); println!("{}", id); repo.remove(id);'), false),
    make("local-closure", fn("let id = invoice.id(); let check = || id == 42; repo.remove(id);"), false),
    make("mutable-borrow", fn("repo.by_ref(&mut invoice.id());"), false),
    make("unknown-method", fn("repo.unknown(invoice.id());"), false),
    make("local-repo-shadow", fn("let repo = unknown(); repo.remove(invoice.id());"), false),
    make("unrelated-function", fn("remove(invoice.id());"), false),
    make(
      "unrelated-port",
      `use billing_domain::Invoice;
      pub trait AuditPort { fn remove(&self, id: i64); }
      pub fn run(invoice: &Invoice, other: &dyn AuditPort) { other.remove(invoice.id()); }`,
      false,
    ),
    make("mixed-consumers", fn("let id = invoice.id(); repo.remove(id); log(id);"), false),
    make("mixed-getters", fn("repo.remove(invoice.id()); if invoice.id() > 0 {}"), false),
    make("local-shadow-business", fn("let id = invoice.id(); { let id = 0; repo.remove(id); } if id == 42 {}"), false),
    make("local-shadow-safe", fn("let id = invoice.id(); { let id = 0; if id == 42 {} } repo.remove(id);"), true),
    make("local-closure-shadow", fn("let id = invoice.id(); let check = |id: i64| id == 42; repo.remove(id);"), true),
    make("local-shadow-initializer", fn("let id = invoice.id(); let id = id + 1; repo.remove(id);"), false),
    make(
      "name-collision",
      `use billing_domain::Invoice;
      pub struct InvoiceRepository;
      impl InvoiceRepository { pub fn remove(&self, id: i64) {} }
      pub fn run(invoice: &Invoice, repo: &InvoiceRepository) { repo.remove(invoice.id()); }`,
      false,
    ),
    make(
      "import-alias",
      `use billing_domain::{Invoice, InvoiceRepository as Port};
      pub fn run(invoice: &Invoice, repo: &dyn Port) { repo.remove(invoice.id()); }`,
      true,
    ),
    make(
      "type-alias",
      `use billing_domain::Invoice; type Port = dyn billing_domain::InvoiceRepository;
      pub fn run(invoice: &Invoice, repo: &Port) { repo.remove(invoice.id()); }`,
      true,
    ),
    make(
      "field-port",
      `use billing_domain::{Invoice, InvoiceRepository};
      pub struct RemoveInvoice { repo: Box<dyn InvoiceRepository> }
      impl RemoveInvoice { pub fn run(&self, invoice: &Invoice) { self.repo.remove(invoice.id()); } }`,
      true,
    ),
    make(
      "use-case-port",
      `use billing_domain::Invoice;
      pub trait InvoiceRepository { fn remove(&self, id: i64); }
      pub fn run(invoice: &Invoice, repo: &dyn InvoiceRepository) { repo.remove(invoice.id()); }`,
      true,
    ),
  ];
  const domainCase = make(
    "domain-layer",
    "",
    false,
    `${domain}
    pub fn run(invoice: &Invoice, repo: &impl InvoiceRepository) { repo.remove(invoice.id()); }`,
  );
  domainCase.sensor = "ddd-rust-domain";
  domainCase.files["construction/u1/code-generation/source-manifest.json"] = JSON.stringify({
    stage: "code-generation",
    unit: "u1",
    version: 1,
    writes: [{ path: DOMAIN }],
  });
  domainCase.expect.files = { d: DOMAIN };
  cases.push(domainCase);
  return cases;
}

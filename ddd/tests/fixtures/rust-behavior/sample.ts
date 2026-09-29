/**
 * The Rust sample of the invoice aggregate the shared behavior scenarios run against (T-11-07), written
 * once per module layout (`file`, `mod-rs`), with the record the Rust gates read.
 *
 * Each sample is a Cargo workspace of three crates under `packages/command/`: a domain crate holding
 * the `invoice` aggregate with its child module `invoice::line`; a use-case crate declaring the
 * repository port and the use case that issues an invoice; and an interface-adapter crate implementing
 * that port in memory. The parent module has a child so the two layouts place it in different files;
 * only the file of that parent changes with the layout. The use-case and interface-adapter crates hold
 * leaf modules alone, so they are the same in both samples.
 *
 * The aggregate is the one the TypeScript samples generate (tests/fixtures/typescript-generation/
 * samples.ts): the same canonical model, and a mapping of the same shape with the Rust spelling of each
 * method and error case. The Rust code-generation instructions carry no code example, so this sample
 * is a test fixture of its own rather than a copy of those instructions.
 */

import { layoutConfig } from "../../golden/module-layout/cases.ts";
import type { GoldenCase } from "../../golden/runner.ts";
import { generationSamples } from "../typescript-generation/samples.ts";

export type RustModuleLayout = "file" | "mod-rs";

const LAYOUTS: readonly RustModuleLayout[] = ["file", "mod-rs"];

const DOMAIN_SENSOR = "ddd-rust-domain";
const USE_CASE_SENSOR = "ddd-rust-use-case";
const INTERFACE_ADAPTER_SENSOR = "ddd-rust-interface-adapter";
const LAYOUT_SENSOR = "ddd-rust-module-layout";

const OUTPUT = "construction/u1/code-generation/code-summary.md";
const SOURCE_MANIFEST = "construction/u1/code-generation/source-manifest.json";
const MODEL_PATH = "inception/ddd-domain-modeling/ddd-domain-model-yaml.md";
const MAPPING_PATH = "inception/domain-design/ddd-aggregate-mapping.md";
const STATE = "## Stage Progress\n- [x] ddd-domain-modeling — EXECUTE\n- [x] code-generation — EXECUTE\n";

const DOMAIN_CRATE = "billing-domain";
const USE_CASE_CRATE = "billing-use-case";
const INTERFACE_ADAPTER_CRATE = "billing-interface-adapter";
const DOMAIN_DIR = `packages/command/${DOMAIN_CRATE}`;
const USE_CASE_DIR = `packages/command/${USE_CASE_CRATE}`;
const INTERFACE_ADAPTER_DIR = `packages/command/${INTERFACE_ADAPTER_CRATE}`;

/** The project-relative file of the `invoice` parent module under `layout`. */
export function parentModuleFile(layout: RustModuleLayout): string {
  return layout === "file" ? `${DOMAIN_DIR}/src/invoice.rs` : `${DOMAIN_DIR}/src/invoice/mod.rs`;
}

/** The file of the parent module the other layout uses; a sample never writes it. */
export function otherParentModuleFile(layout: RustModuleLayout): string {
  return parentModuleFile(layout === "file" ? "mod-rs" : "file");
}

const DOMAIN_LIB = `pub mod invoice;
`;

const INVOICE_LINE = `#[derive(Clone)]
pub struct InvoiceLine {
    amount: i64,
}

impl InvoiceLine {
    pub fn of(amount: i64) -> Self {
        InvoiceLine { amount }
    }

    pub fn add_to(&self, total: i64) -> i64 {
        total + self.amount
    }
}
`;

const INVOICE = `pub mod line;

use self::line::InvoiceLine;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OpenInvoiceError {
    MissingCustomer,
    NegativeTotal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AddInvoiceLineError {
    AlreadyIssued,
    NegativeTotal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssueInvoiceError {
    AlreadyIssued,
    EmptyLines,
}

/// The invoice total: the invariant forbids a negative one.
fn sum_of(lines: &[InvoiceLine]) -> i64 {
    lines.iter().fold(0, |sum, line| line.add_to(sum))
}

#[derive(Clone)]
pub struct Invoice {
    customer: String,
    lines: Vec<InvoiceLine>,
    issued: bool,
}

impl Invoice {
    pub fn open(customer: &str, lines: Vec<InvoiceLine>) -> Result<Self, OpenInvoiceError> {
        if customer.is_empty() {
            return Err(OpenInvoiceError::MissingCustomer);
        }
        if sum_of(&lines) < 0 {
            return Err(OpenInvoiceError::NegativeTotal);
        }
        Ok(Invoice { customer: customer.to_string(), lines, issued: false })
    }

    /// Rebuilds a persisted invoice. A state the invariants forbid is corrupt storage, not a business
    /// error, so it panics rather than returning one.
    pub fn restore(customer: &str, lines: Vec<InvoiceLine>, issued: bool) -> Self {
        if customer.is_empty() || (issued && lines.is_empty()) || sum_of(&lines) < 0 {
            panic!("corrupt invoice state");
        }
        Invoice { customer: customer.to_string(), lines, issued }
    }

    pub fn add_line(&mut self, line: InvoiceLine) -> Result<(), AddInvoiceLineError> {
        if self.issued {
            return Err(AddInvoiceLineError::AlreadyIssued);
        }
        if line.add_to(sum_of(&self.lines)) < 0 {
            return Err(AddInvoiceLineError::NegativeTotal);
        }
        self.lines.push(line);
        Ok(())
    }

    pub fn issue(&mut self) -> Result<(), IssueInvoiceError> {
        if self.issued {
            return Err(IssueInvoiceError::AlreadyIssued);
        }
        if self.lines.is_empty() {
            return Err(IssueInvoiceError::EmptyLines);
        }
        self.issued = true;
        Ok(())
    }

    pub fn is_billed_to(&self, customer: &str) -> bool {
        self.customer == customer
    }

    pub fn total(&self) -> i64 {
        sum_of(&self.lines)
    }

    pub fn lines(&self) -> Vec<InvoiceLine> {
        self.lines.clone()
    }
}
`;

const USE_CASE_LIB = `pub mod invoice_repository;
pub mod issue_invoice;
`;

const INVOICE_REPOSITORY_PORT = `use billing_domain::invoice::Invoice;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InvoiceNotFound;

pub trait InvoiceRepository {
    fn find_by_id(&self, invoice_id: &str) -> Result<Invoice, InvoiceNotFound>;
    fn store(&self, invoice_id: &str, invoice: Invoice);
}
`;

const ISSUE_INVOICE = `use billing_domain::invoice::IssueInvoiceError;

use crate::invoice_repository::{InvoiceNotFound, InvoiceRepository};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssueInvoiceFailure {
    NotFound(InvoiceNotFound),
    Rejected(IssueInvoiceError),
}

pub struct IssueInvoice<'a> {
    invoice_repository: &'a dyn InvoiceRepository,
}

impl<'a> IssueInvoice<'a> {
    pub fn new(invoice_repository: &'a dyn InvoiceRepository) -> Self {
        IssueInvoice { invoice_repository }
    }

    pub fn execute(&self, invoice_id: &str) -> Result<(), IssueInvoiceFailure> {
        let mut invoice = self.invoice_repository.find_by_id(invoice_id).map_err(IssueInvoiceFailure::NotFound)?;
        invoice.issue().map_err(IssueInvoiceFailure::Rejected)?;
        self.invoice_repository.store(invoice_id, invoice);
        Ok(())
    }
}
`;

const INTERFACE_ADAPTER_LIB = `pub mod in_memory_invoice_repository;
`;

const IN_MEMORY_INVOICE_REPOSITORY = `use std::cell::RefCell;
use std::collections::HashMap;

use billing_domain::invoice::line::InvoiceLine;
use billing_domain::invoice::Invoice;
use billing_use_case::invoice_repository::{InvoiceNotFound, InvoiceRepository};

pub struct InvoiceRecord {
    pub customer: String,
    pub amounts: Vec<i64>,
    pub issued: bool,
}

/// The invoices stored here take precedence over the records they were first read from.
pub struct InMemoryInvoiceRepository {
    records: HashMap<String, InvoiceRecord>,
    stored: RefCell<HashMap<String, Invoice>>,
}

impl InMemoryInvoiceRepository {
    pub fn new(records: HashMap<String, InvoiceRecord>) -> Self {
        InMemoryInvoiceRepository { records, stored: RefCell::new(HashMap::new()) }
    }
}

impl InvoiceRepository for InMemoryInvoiceRepository {
    fn find_by_id(&self, invoice_id: &str) -> Result<Invoice, InvoiceNotFound> {
        if let Some(stored) = self.stored.borrow().get(invoice_id) {
            return Ok(stored.clone());
        }
        let record = self.records.get(invoice_id).ok_or(InvoiceNotFound)?;
        let lines: Vec<InvoiceLine> = record.amounts.iter().map(|amount| InvoiceLine::of(*amount)).collect();
        Ok(Invoice::restore(&record.customer, lines, record.issued))
    }

    fn store(&self, invoice_id: &str, invoice: Invoice) {
        self.stored.borrow_mut().insert(invoice_id.to_string(), invoice);
    }
}
`;

const WORKSPACE_MANIFEST = `[workspace]
resolver = "2"
members = [
    "${DOMAIN_DIR}",
    "${USE_CASE_DIR}",
    "${INTERFACE_ADAPTER_DIR}",
]
`;

function crateManifest(name: string, dependencies: readonly string[]): string {
  const lines = ["[package]", `name = "${name}"`, 'version = "0.1.0"', 'edition = "2021"', "publish = false", ""];
  if (dependencies.length > 0) {
    lines.push("[dependencies]", ...dependencies.map((dependency) => `${dependency} = { path = "../${dependency}" }`), "");
  }
  return lines.join("\n");
}

const location = (module: readonly string[]) =>
  `{ language: rust, package: ${DOMAIN_CRATE}, module: [${module.join(", ")}] }`;

/** The implementation mapping placing the aggregate at `[invoice]` and naming each operation's error type. */
const MAPPING = [
  "# Aggregate mapping",
  "",
  "```yaml",
  "schema_version: 2",
  `model_ref: ${MODEL_PATH}`,
  "aggregate_mappings:",
  "  - aggregate_ref: aggregate.invoice",
  "    programming_model: class",
  "    persistence_method: state-sourcing",
  "    reference_ids: [entity.invoice]",
  `    code: { language: rust, package: ${DOMAIN_CRATE}, module: [invoice], type: Invoice }`,
  "    operations:",
  "      - operation_ref: factory.invoice.open",
  "        code: { method: open, error_type: OpenInvoiceError }",
  "        errors:",
  "          - { error_ref: error.invoice.open.missing-customer, code: { case: MissingCustomer } }",
  "          - { error_ref: error.invoice.open.negative-total, code: { case: NegativeTotal } }",
  "      - operation_ref: command.invoice.add-line",
  "        code: { method: add_line, error_type: AddInvoiceLineError }",
  "        errors:",
  "          - { error_ref: error.invoice.add-line.already-issued, code: { case: AlreadyIssued } }",
  "          - { error_ref: error.invoice.add-line.negative-total, code: { case: NegativeTotal } }",
  "      - operation_ref: command.invoice.issue",
  "        code: { method: issue, error_type: IssueInvoiceError }",
  "        errors:",
  "          - { error_ref: error.invoice.issue.already-issued, code: { case: AlreadyIssued } }",
  "          - { error_ref: error.invoice.issue.empty-lines, code: { case: EmptyLines } }",
  "domain_packages:",
  `  - { term: Billing, model_refs: [bc.billing], rationale: owns the billing business, code: ${location([])} }`,
  `  - { term: Invoice, model_refs: [aggregate.invoice], rationale: opens and issues invoices, code: ${location(["invoice"])} }`,
  `  - { term: Invoice line, model_refs: [vo.invoice-line], rationale: the amounts an invoice adds up, code: ${location(["invoice", "line"])} }`,
  "```",
  "",
].join("\n");

/** The canonical model document the TypeScript samples are generated from, shared as it is. */
function modelDocument(): string {
  const document = generationSamples()[0]?.domainCase.files[MODEL_PATH];
  if (document === undefined) throw new Error(`the TypeScript generation samples carry no ${MODEL_PATH}`);
  return document;
}

export interface RustBehaviorSample {
  readonly layout: RustModuleLayout;
  /** Project-root relative path -> content of every file of the project. */
  readonly workspace: Readonly<Record<string, string>>;
  /** Project-root relative path -> content of the Rust sources the sample generates. */
  readonly sources: Readonly<Record<string, string>>;
  /** The run of the Rust domain gate over the sample. */
  readonly domainCase: GoldenCase;
  /** The run of the Rust use-case gate over the same project and record. */
  readonly useCaseCase: GoldenCase;
  /** The run of the Rust interface-adapter gate over the same project and record. */
  readonly interfaceAdapterCase: GoldenCase;
  /** The run of the Rust module layout gate over the same project and record. */
  readonly layoutCase: GoldenCase;
}

/** The generated project for one module layout. */
function rustBehaviorSample(layout: RustModuleLayout): RustBehaviorSample {
  const sources: Record<string, string> = {
    [`${DOMAIN_DIR}/src/lib.rs`]: DOMAIN_LIB,
    [parentModuleFile(layout)]: INVOICE,
    [`${DOMAIN_DIR}/src/invoice/line.rs`]: INVOICE_LINE,
    [`${USE_CASE_DIR}/src/lib.rs`]: USE_CASE_LIB,
    [`${USE_CASE_DIR}/src/invoice_repository.rs`]: INVOICE_REPOSITORY_PORT,
    [`${USE_CASE_DIR}/src/issue_invoice.rs`]: ISSUE_INVOICE,
    [`${INTERFACE_ADAPTER_DIR}/src/lib.rs`]: INTERFACE_ADAPTER_LIB,
    [`${INTERFACE_ADAPTER_DIR}/src/in_memory_invoice_repository.rs`]: IN_MEMORY_INVOICE_REPOSITORY,
  };
  const workspace: Record<string, string> = {
    ".ddd.toml": layoutConfig(layout),
    "Cargo.toml": WORKSPACE_MANIFEST,
    [`${DOMAIN_DIR}/Cargo.toml`]: crateManifest(DOMAIN_CRATE, []),
    [`${USE_CASE_DIR}/Cargo.toml`]: crateManifest(USE_CASE_CRATE, [DOMAIN_CRATE]),
    [`${INTERFACE_ADAPTER_DIR}/Cargo.toml`]: crateManifest(INTERFACE_ADAPTER_CRATE, [DOMAIN_CRATE, USE_CASE_CRATE]),
    ...sources,
  };
  const files: Record<string, string> = {
    [OUTPUT]: "# Code summary\n",
    [SOURCE_MANIFEST]: JSON.stringify({
      stage: "code-generation",
      unit: "u1",
      version: 1,
      writes: Object.keys(sources).map((path) => ({ path })),
    }),
    [MODEL_PATH]: modelDocument(),
    [MAPPING_PATH]: MAPPING,
  };
  const domainCase: GoldenCase = {
    sensor: DOMAIN_SENSOR,
    name: `rust-behavior-sample-${layout}`,
    stage: "code-generation",
    output: OUTPUT,
    workspace,
    files,
    state: STATE,
    expect: { pass: true, rules: [] },
  };
  return {
    layout,
    workspace,
    sources,
    domainCase,
    useCaseCase: { ...domainCase, sensor: USE_CASE_SENSOR },
    interfaceAdapterCase: { ...domainCase, sensor: INTERFACE_ADAPTER_SENSOR },
    layoutCase: { ...domainCase, sensor: LAYOUT_SENSOR },
  };
}

/** Every sample, one per module layout. */
export function rustBehaviorSamples(): RustBehaviorSample[] {
  return LAYOUTS.map(rustBehaviorSample);
}

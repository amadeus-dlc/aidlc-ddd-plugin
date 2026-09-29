/**
 * The Rust sample of the invoice aggregate the shared behavior scenarios run against (T-11-07), written
 * once per module layout (`file`, `mod-rs`), with the record the Rust gates read.
 *
 * Each sample is a Cargo workspace of four crates: the language-extensions crate of the infrastructure
 * layer under `packages/infrastructure/`, which declares `CommandOutcome`, and three crates under
 * `packages/command/` — a domain crate holding the `invoice` aggregate with its child module
 * `invoice::line`; a use-case crate declaring the repository port and the use cases that issue an
 * invoice and record a payment on it; and an interface-adapter crate implementing that port in memory.
 * A command borrows the aggregate mutably and, in one method, decides, changes the state and returns
 * its one event: `add_line` and `issue` return `Result<InvoiceEvent, its own error>`, and
 * `record_payment`, which remembers its recent command ids, returns
 * `Result<CommandOutcome<InvoiceEvent>, its own error>`, applied with its one event or already applied
 * with none. A refused command leaves the state as it was. Being settled is read from the state, not
 * raised as an event. The repository returns each invoice it reads with the version it was read at; a
 * store checks that version and appends the one event of the command. The parent module has a child so the two
 * layouts place it in different files; only the file of that parent changes with the layout. The
 * use-case and interface-adapter crates hold leaf modules alone, so they are the same in both samples.
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

const LANGUAGE_EXTENSIONS_CRATE = "language-extensions";
const LANGUAGE_EXTENSIONS_DIR = `packages/infrastructure/${LANGUAGE_EXTENSIONS_CRATE}`;
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

/** The success side of a command that remembers its command ids: applied with its one event, or already applied. */
const LANGUAGE_EXTENSIONS_LIB = `#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommandOutcome<E> {
    Applied(E),
    AlreadyApplied,
}
`;

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

use language_extensions::CommandOutcome;

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecordPaymentError {
    NotIssued,
    Overpayment,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvoiceEvent {
    LineAdded,
    Issued,
    PaymentRecorded,
}

/// How many payment command ids an invoice remembers: the model's retention_count.
const REMEMBERED_PAYMENTS: usize = 16;

/// The invoice total: the invariant forbids a negative one.
fn sum_of(lines: &[InvoiceLine]) -> i64 {
    lines.iter().fold(0, |sum, line| line.add_to(sum))
}

#[derive(Clone)]
pub struct Invoice {
    customer: String,
    lines: Vec<InvoiceLine>,
    issued: bool,
    paid: i64,
    payment_ids: Vec<String>,
}

impl Invoice {
    pub fn open(customer: &str, lines: Vec<InvoiceLine>) -> Result<Self, OpenInvoiceError> {
        if customer.is_empty() {
            return Err(OpenInvoiceError::MissingCustomer);
        }
        if sum_of(&lines) < 0 {
            return Err(OpenInvoiceError::NegativeTotal);
        }
        Ok(Invoice { customer: customer.to_string(), lines, issued: false, paid: 0, payment_ids: Vec::new() })
    }

    /// Rebuilds a persisted invoice from its whole state. A state the invariants forbid is corrupt
    /// storage, not a business error, so it panics rather than returning one.
    pub fn restore(customer: &str, lines: Vec<InvoiceLine>, issued: bool, paid: i64, payment_ids: Vec<String>) -> Self {
        let total = sum_of(&lines);
        if customer.is_empty() || total < 0 || (issued && lines.is_empty()) {
            panic!("corrupt invoice state");
        }
        if paid < 0 || paid > total || payment_ids.len() > REMEMBERED_PAYMENTS {
            panic!("corrupt invoice state");
        }
        if !issued && (paid != 0 || !payment_ids.is_empty()) {
            panic!("corrupt invoice state");
        }
        Invoice { customer: customer.to_string(), lines, issued, paid, payment_ids }
    }

    pub fn add_line(&mut self, line: InvoiceLine) -> Result<InvoiceEvent, AddInvoiceLineError> {
        if self.issued {
            return Err(AddInvoiceLineError::AlreadyIssued);
        }
        if line.add_to(sum_of(&self.lines)) < 0 {
            return Err(AddInvoiceLineError::NegativeTotal);
        }
        self.lines.push(line);
        Ok(InvoiceEvent::LineAdded)
    }

    pub fn issue(&mut self) -> Result<InvoiceEvent, IssueInvoiceError> {
        if self.issued {
            return Err(IssueInvoiceError::AlreadyIssued);
        }
        if self.lines.is_empty() {
            return Err(IssueInvoiceError::EmptyLines);
        }
        self.issued = true;
        Ok(InvoiceEvent::Issued)
    }

    pub fn record_payment(&mut self, payment_id: &str, amount: i64) -> Result<CommandOutcome<InvoiceEvent>, RecordPaymentError> {
        if self.payment_ids.iter().any(|remembered| remembered == payment_id) {
            return Ok(CommandOutcome::AlreadyApplied);
        }
        if !self.issued {
            return Err(RecordPaymentError::NotIssued);
        }
        if self.paid + amount > sum_of(&self.lines) {
            return Err(RecordPaymentError::Overpayment);
        }
        self.paid += amount;
        self.payment_ids.push(payment_id.to_string());
        if self.payment_ids.len() > REMEMBERED_PAYMENTS {
            self.payment_ids.remove(0);
        }
        Ok(CommandOutcome::Applied(InvoiceEvent::PaymentRecorded))
    }

    pub fn is_billed_to(&self, customer: &str) -> bool {
        self.customer == customer
    }

    pub fn is_settled(&self) -> bool {
        self.issued && self.paid == sum_of(&self.lines)
    }

    pub fn total(&self) -> i64 {
        sum_of(&self.lines)
    }

    pub fn paid(&self) -> i64 {
        self.paid
    }

    pub fn lines(&self) -> Vec<InvoiceLine> {
        self.lines.clone()
    }
}
`;

const USE_CASE_LIB = `pub mod invoice_repository;
pub mod issue_invoice;
pub mod record_payment;
`;

const INVOICE_REPOSITORY_PORT = `use billing_domain::invoice::{Invoice, InvoiceEvent};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InvoiceNotFound;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VersionConflict;

/// An invoice one read found, with the version the invoice was at when it was read.
pub struct FoundInvoice {
    pub invoice: Invoice,
    pub version: u64,
}

pub trait InvoiceRepository {
    fn find_by_id(&self, invoice_id: &str) -> Result<FoundInvoice, InvoiceNotFound>;
    /// Saves the invoice and appends the one event of its command if the invoice is still at the
    /// expected version, the one its read found; otherwise saves nothing.
    fn store(&self, invoice_id: &str, invoice: Invoice, expected_version: u64, event: InvoiceEvent) -> Result<(), VersionConflict>;
}
`;

const ISSUE_INVOICE = `use billing_domain::invoice::{Invoice, IssueInvoiceError};

use crate::invoice_repository::{FoundInvoice, InvoiceNotFound, InvoiceRepository, VersionConflict};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssueInvoiceFailure {
    NotFound(InvoiceNotFound),
    Rejected(IssueInvoiceError),
    Conflict(VersionConflict),
}

pub struct IssueInvoice<'a> {
    invoices: &'a dyn InvoiceRepository,
}

impl<'a> IssueInvoice<'a> {
    pub fn new(invoices: &'a dyn InvoiceRepository) -> Self {
        IssueInvoice { invoices }
    }

    pub fn execute(&self, invoice_id: &str) -> Result<(), IssueInvoiceFailure> {
        let found: FoundInvoice = self.invoices.find_by_id(invoice_id).map_err(IssueInvoiceFailure::NotFound)?;
        let mut invoice: Invoice = found.invoice;
        let event = invoice.issue().map_err(IssueInvoiceFailure::Rejected)?;
        self.invoices.store(invoice_id, invoice, found.version, event).map_err(IssueInvoiceFailure::Conflict)
    }
}
`;

const RECORD_PAYMENT = `use billing_domain::invoice::{Invoice, RecordPaymentError};
use language_extensions::CommandOutcome;

use crate::invoice_repository::{FoundInvoice, InvoiceNotFound, InvoiceRepository, VersionConflict};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecordPaymentFailure {
    NotFound(InvoiceNotFound),
    Rejected(RecordPaymentError),
    Conflict(VersionConflict),
}

pub struct RecordPayment<'a> {
    invoices: &'a dyn InvoiceRepository,
}

impl<'a> RecordPayment<'a> {
    pub fn new(invoices: &'a dyn InvoiceRepository) -> Self {
        RecordPayment { invoices }
    }

    pub fn execute(&self, invoice_id: &str, payment_id: &str, amount: i64) -> Result<(), RecordPaymentFailure> {
        let found: FoundInvoice = self.invoices.find_by_id(invoice_id).map_err(RecordPaymentFailure::NotFound)?;
        let mut invoice: Invoice = found.invoice;
        match invoice.record_payment(payment_id, amount).map_err(RecordPaymentFailure::Rejected)? {
            CommandOutcome::Applied(event) => {
                self.invoices.store(invoice_id, invoice, found.version, event).map_err(RecordPaymentFailure::Conflict)
            }
            CommandOutcome::AlreadyApplied => Ok(()),
        }
    }
}
`;

const INTERFACE_ADAPTER_LIB = `pub mod in_memory_invoice_repository;
`;

const IN_MEMORY_INVOICE_REPOSITORY = `use std::cell::RefCell;
use std::collections::HashMap;

use billing_domain::invoice::line::InvoiceLine;
use billing_domain::invoice::{Invoice, InvoiceEvent};
use billing_use_case::invoice_repository::{FoundInvoice, InvoiceNotFound, InvoiceRepository, VersionConflict};

pub struct InvoiceRecord {
    pub customer: String,
    pub amounts: Vec<i64>,
    pub issued: bool,
    pub paid: i64,
    pub payment_ids: Vec<String>,
}

/// The invoices stored here take precedence over the records they were first read from. Every read
/// returns a copy with the version it was read at. A store saves only when the invoice is still at
/// that version, then advances the version by one and appends the one event of the command.
pub struct InMemoryInvoiceRepository {
    records: HashMap<String, InvoiceRecord>,
    stored: RefCell<HashMap<String, Invoice>>,
    versions: RefCell<HashMap<String, u64>>,
    events: RefCell<HashMap<String, Vec<InvoiceEvent>>>,
}

impl InMemoryInvoiceRepository {
    pub fn new(records: HashMap<String, InvoiceRecord>) -> Self {
        InMemoryInvoiceRepository {
            records,
            stored: RefCell::new(HashMap::new()),
            versions: RefCell::new(HashMap::new()),
            events: RefCell::new(HashMap::new()),
        }
    }

    /// How many times the invoice has been stored.
    pub fn version(&self, invoice_id: &str) -> u64 {
        self.versions.borrow().get(invoice_id).copied().unwrap_or(0)
    }

    /// Every event stored with the invoice, in the order the stores appended them.
    pub fn stored_events(&self, invoice_id: &str) -> Vec<InvoiceEvent> {
        self.events.borrow().get(invoice_id).cloned().unwrap_or_default()
    }
}

impl InvoiceRepository for InMemoryInvoiceRepository {
    fn find_by_id(&self, invoice_id: &str) -> Result<FoundInvoice, InvoiceNotFound> {
        let version = self.version(invoice_id);
        if let Some(stored) = self.stored.borrow().get(invoice_id) {
            return Ok(FoundInvoice { invoice: stored.clone(), version });
        }
        let record = self.records.get(invoice_id).ok_or(InvoiceNotFound)?;
        let lines: Vec<InvoiceLine> = record.amounts.iter().map(|amount| InvoiceLine::of(*amount)).collect();
        let invoice = Invoice::restore(&record.customer, lines, record.issued, record.paid, record.payment_ids.clone());
        Ok(FoundInvoice { invoice, version })
    }

    fn store(&self, invoice_id: &str, invoice: Invoice, expected_version: u64, event: InvoiceEvent) -> Result<(), VersionConflict> {
        let current = self.version(invoice_id);
        if expected_version != current {
            return Err(VersionConflict);
        }
        self.versions.borrow_mut().insert(invoice_id.to_string(), current + 1);
        self.events.borrow_mut().entry(invoice_id.to_string()).or_default().push(event);
        self.stored.borrow_mut().insert(invoice_id.to_string(), invoice);
        Ok(())
    }
}
`;

const WORKSPACE_MANIFEST = `[workspace]
resolver = "2"
members = [
    "${LANGUAGE_EXTENSIONS_DIR}",
    "${DOMAIN_DIR}",
    "${USE_CASE_DIR}",
    "${INTERFACE_ADAPTER_DIR}",
]
`;

/** The path from a crate under `packages/command/` to `dependency`. */
function dependencyPath(dependency: string): string {
  return dependency === LANGUAGE_EXTENSIONS_CRATE ? `../../../${LANGUAGE_EXTENSIONS_DIR}` : `../${dependency}`;
}

function crateManifest(name: string, dependencies: readonly string[]): string {
  const lines = ["[package]", `name = "${name}"`, 'version = "0.1.0"', 'edition = "2021"', "publish = false", ""];
  if (dependencies.length > 0) {
    lines.push(
      "[dependencies]",
      ...dependencies.map((dependency) => `${dependency} = { path = "${dependencyPath(dependency)}" }`),
      "",
    );
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
  "    persistence_method: event-sourcing",
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
  "      - operation_ref: command.invoice.record-payment",
  "        code: { method: record_payment, error_type: RecordPaymentError }",
  "        errors:",
  "          - { error_ref: error.invoice.record-payment.not-issued, code: { case: NotIssued } }",
  "          - { error_ref: error.invoice.record-payment.overpayment, code: { case: Overpayment } }",
  "domain_packages:",
  `  - { term: Billing, model_refs: [bc.billing], rationale: owns the billing business, code: ${location([])} }`,
  `  - { term: Invoice, model_refs: [aggregate.invoice], rationale: opens and issues invoices and records their payments, code: ${location(["invoice"])} }`,
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
    [`${LANGUAGE_EXTENSIONS_DIR}/src/lib.rs`]: LANGUAGE_EXTENSIONS_LIB,
    [`${DOMAIN_DIR}/src/lib.rs`]: DOMAIN_LIB,
    [parentModuleFile(layout)]: INVOICE,
    [`${DOMAIN_DIR}/src/invoice/line.rs`]: INVOICE_LINE,
    [`${USE_CASE_DIR}/src/lib.rs`]: USE_CASE_LIB,
    [`${USE_CASE_DIR}/src/invoice_repository.rs`]: INVOICE_REPOSITORY_PORT,
    [`${USE_CASE_DIR}/src/issue_invoice.rs`]: ISSUE_INVOICE,
    [`${USE_CASE_DIR}/src/record_payment.rs`]: RECORD_PAYMENT,
    [`${INTERFACE_ADAPTER_DIR}/src/lib.rs`]: INTERFACE_ADAPTER_LIB,
    [`${INTERFACE_ADAPTER_DIR}/src/in_memory_invoice_repository.rs`]: IN_MEMORY_INVOICE_REPOSITORY,
  };
  const workspace: Record<string, string> = {
    ".ddd.toml": layoutConfig(layout),
    "Cargo.toml": WORKSPACE_MANIFEST,
    [`${LANGUAGE_EXTENSIONS_DIR}/Cargo.toml`]: crateManifest(LANGUAGE_EXTENSIONS_CRATE, []),
    [`${DOMAIN_DIR}/Cargo.toml`]: crateManifest(DOMAIN_CRATE, [LANGUAGE_EXTENSIONS_CRATE]),
    [`${USE_CASE_DIR}/Cargo.toml`]: crateManifest(USE_CASE_CRATE, [DOMAIN_CRATE, LANGUAGE_EXTENSIONS_CRATE]),
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

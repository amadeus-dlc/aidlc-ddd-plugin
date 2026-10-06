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
pub mod money;
`;

const MONEY = `#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Money(f64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParseMoneyError { NonFiniteAmount }

impl Money {
    fn new(value: f64) -> Self { Self(value) }

    pub fn of(value: f64) -> Self {
        Self::parse(value).expect("Money requires a finite amount")
    }

    pub fn parse(value: f64) -> Result<Self, ParseMoneyError> {
        if !value.is_finite() { return Err(ParseMoneyError::NonFiniteAmount); }
        Ok(Self::new(value))
    }

    pub fn zero() -> Self { Self::of(0.0) }

    pub fn add(self, other: Money) -> Money { Self::of(self.0 + other.0) }

    pub fn is_negative(self) -> bool { self.0 < 0.0 }
}
`;

const INVOICE_LINE = `use crate::money::Money;

#[derive(Clone)]
pub struct InvoiceLine {
    amount: Money,
}

impl InvoiceLine {
    fn new(amount: Money) -> Self { Self { amount } }

    pub fn of(amount: Money) -> Self { Self::new(amount) }

    pub fn add_to(&self, total: Money) -> Money {
        total.add(self.amount)
    }
}
`;

const INVOICE = `pub mod line;

use self::line::InvoiceLine;
use crate::money::Money;

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

#[derive(Clone)]
pub struct LineAdded { invoice_id: String, sequence_number: u64, line: InvoiceLine }
impl LineAdded {
    fn new(invoice_id: String, sequence_number: u64, line: InvoiceLine) -> Self { Self { invoice_id, sequence_number, line } }
    pub fn create(invoice_id: &str, sequence_number: u64, line: InvoiceLine) -> Self { Self::new(invoice_id.to_string(), sequence_number, line) }
}

#[derive(Clone)]
pub struct Issued { invoice_id: String, sequence_number: u64 }
impl Issued {
    fn new(invoice_id: String, sequence_number: u64) -> Self { Self { invoice_id, sequence_number } }
    pub fn create(invoice_id: &str, sequence_number: u64) -> Self { Self::new(invoice_id.to_string(), sequence_number) }
}

#[derive(Clone)]
pub enum InvoiceEvent {
    Opened { invoice_id: String, sequence_number: u64, customer: String, lines: Vec<InvoiceLine> },
    LineAdded(LineAdded),
    Issued(Issued),
}

impl InvoiceEvent {
    pub fn invoice_id(&self) -> &str {
        match self {
            InvoiceEvent::Opened { invoice_id, .. } => invoice_id,
            InvoiceEvent::LineAdded(event) => &event.invoice_id,
            InvoiceEvent::Issued(event) => &event.invoice_id,
        }
    }

    pub fn sequence_number(&self) -> u64 {
        match self {
            InvoiceEvent::Opened { sequence_number, .. } => *sequence_number,
            InvoiceEvent::LineAdded(event) => event.sequence_number,
            InvoiceEvent::Issued(event) => event.sequence_number,
        }
    }
}

/// The invoice total: the invariant forbids a negative one.
fn sum_of(lines: &[InvoiceLine]) -> Money {
    lines.iter().fold(Money::zero(), |sum, line| line.add_to(sum))
}

#[derive(Clone)]
pub struct Invoice {
    id: String,
    sequence_number: u64,
    customer: String,
    lines: Vec<InvoiceLine>,
    issued: bool,
}

impl Invoice {
    fn new(id: String, sequence_number: u64, customer: String, lines: Vec<InvoiceLine>, issued: bool) -> Self {
        Self { id, sequence_number, customer, lines, issued }
    }

    pub fn open(id: &str, customer: &str, lines: Vec<InvoiceLine>) -> Result<Self, OpenInvoiceError> {
        if customer.is_empty() {
            return Err(OpenInvoiceError::MissingCustomer);
        }
        if sum_of(&lines).is_negative() {
            return Err(OpenInvoiceError::NegativeTotal);
        }
        Ok(Self::new(id.to_string(), 1, customer.to_string(), lines, false))
    }

    /// Applies the events that follow the snapshot and rejects a corrupt continuation.
    pub fn replay(events: &[InvoiceEvent], snapshot: Invoice) -> Self {
        let mut invoice = snapshot;
        for event in events {
            match event {
                InvoiceEvent::LineAdded(event) => invoice.apply_line_added(event.clone()),
                InvoiceEvent::Issued(event) => invoice.apply_issued(event.clone()),
                InvoiceEvent::Opened { .. } => panic!("corrupt invoice history"),
            }
        }
        invoice
    }

    pub fn add_line(&mut self, line: InvoiceLine) -> Result<LineAdded, AddInvoiceLineError> {
        if self.issued {
            return Err(AddInvoiceLineError::AlreadyIssued);
        }
        if line.add_to(sum_of(&self.lines)).is_negative() {
            return Err(AddInvoiceLineError::NegativeTotal);
        }
        let event = LineAdded::create(&self.id, self.sequence_number + 1, line);
        self.apply_line_added(event.clone());
        Ok(event)
    }

    pub fn issue(&mut self) -> Result<Issued, IssueInvoiceError> {
        if self.issued {
            return Err(IssueInvoiceError::AlreadyIssued);
        }
        if self.lines.is_empty() {
            return Err(IssueInvoiceError::EmptyLines);
        }
        let event = Issued::create(&self.id, self.sequence_number + 1);
        self.apply_issued(event.clone());
        Ok(event)
    }

    pub fn apply_line_added(&mut self, event: LineAdded) {
        if event.invoice_id != self.id || event.sequence_number != self.sequence_number + 1 { panic!("corrupt invoice history"); }
        if self.issued || event.line.add_to(sum_of(&self.lines)).is_negative() { panic!("corrupt invoice history"); }
        self.lines.push(event.line);
        self.sequence_number = event.sequence_number;
    }

    pub fn apply_issued(&mut self, event: Issued) {
        if event.invoice_id != self.id || event.sequence_number != self.sequence_number + 1 { panic!("corrupt invoice history"); }
        if self.issued || self.lines.is_empty() { panic!("corrupt invoice history"); }
        self.issued = true;
        self.sequence_number = event.sequence_number;
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn sequence_number(&self) -> u64 {
        self.sequence_number
    }

    pub fn is_billed_to(&self, customer: &str) -> bool {
        self.customer == customer
    }

    pub fn total(&self) -> Money {
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

const INVOICE_REPOSITORY_PORT = `use billing_domain::invoice::{Invoice, InvoiceEvent};

/// A load or a store that did not complete: a failure of the infrastructure, not a business error.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepositoryError {
    pub message: String,
}

pub trait InvoiceRepository {
    fn find_by_id(&self, invoice_id: &str) -> Result<Option<Invoice>, RepositoryError>;
    fn store(&mut self, event: InvoiceEvent, snapshot: Invoice) -> Result<(), RepositoryError>;
}
`;

const ISSUE_INVOICE = `use billing_domain::invoice::{IssueInvoiceError, InvoiceEvent};

use crate::invoice_repository::{InvoiceRepository, RepositoryError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct InvoiceNotFound;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IssueInvoiceFailure {
    NotFound(InvoiceNotFound),
    Rejected(IssueInvoiceError),
    Repository(RepositoryError),
}

pub struct IssueInvoiceUseCase<'a, R: InvoiceRepository> {
    invoice_repository: &'a mut R,
}

impl<'a, R: InvoiceRepository> IssueInvoiceUseCase<'a, R> {
    pub fn new(invoice_repository: &'a mut R) -> Self {
        IssueInvoiceUseCase { invoice_repository }
    }

    pub fn execute(&mut self, invoice_id: &str) -> Result<(), IssueInvoiceFailure> {
        let Some(mut invoice) = self.invoice_repository.find_by_id(invoice_id).map_err(IssueInvoiceFailure::Repository)? else {
            return Err(IssueInvoiceFailure::NotFound(InvoiceNotFound));
        };
        let event = invoice.issue().map_err(IssueInvoiceFailure::Rejected)?;
        self.invoice_repository.store(InvoiceEvent::Issued(event), invoice).map_err(IssueInvoiceFailure::Repository)?;
        Ok(())
    }
}
`;

const INTERFACE_ADAPTER_LIB = `pub mod in_memory_invoice_repository;
`;

const IN_MEMORY_INVOICE_REPOSITORY = `use std::collections::HashMap;
use std::panic::catch_unwind;

use billing_domain::invoice::{Invoice, InvoiceEvent};
use billing_use_case::invoice_repository::{InvoiceRepository, RepositoryError};

pub struct InMemoryInvoiceRepository {
    events: HashMap<String, Vec<InvoiceEvent>>,
    snapshots: HashMap<String, Invoice>,
    snapshot_interval: u64,
}

impl InMemoryInvoiceRepository {
    pub fn new(snapshot_interval: u64) -> Self {
        assert!(snapshot_interval > 0, "the snapshot interval must be positive");
        Self { events: HashMap::new(), snapshots: HashMap::new(), snapshot_interval }
    }
}

impl InvoiceRepository for InMemoryInvoiceRepository {
    fn find_by_id(&self, invoice_id: &str) -> Result<Option<Invoice>, RepositoryError> {
        let Some(snapshot) = self.snapshots.get(invoice_id) else { return Ok(None); };
        let following: Vec<InvoiceEvent> = self.events.get(invoice_id).into_iter().flatten()
            .filter(|event| event.sequence_number() > snapshot.sequence_number())
            .cloned()
            .collect();
        let snapshot = snapshot.clone();
        catch_unwind(move || Invoice::replay(&following, snapshot)).map(Some)
            .map_err(|_| RepositoryError { message: "corrupt invoice history".to_string() })
    }

    fn store(&mut self, event: InvoiceEvent, snapshot: Invoice) -> Result<(), RepositoryError> {
        if snapshot.id() != event.invoice_id() || snapshot.sequence_number() != event.sequence_number() {
            return Err(RepositoryError { message: "the snapshot is not the aggregate right after the event".to_string() });
        }
        let invoice_id = event.invoice_id().to_string();
        let history = self.events.entry(invoice_id.clone()).or_default();
        let expected = history.last().map_or(1, |last| last.sequence_number() + 1);
        if event.sequence_number() != expected {
            return Err(RepositoryError { message: "the event does not follow the stored events".to_string() });
        }
        let sequence_number = event.sequence_number();
        history.push(event);
        if sequence_number == 1 || sequence_number % self.snapshot_interval == 0 {
            self.snapshots.insert(invoice_id, snapshot);
        }
        Ok(())
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
  "    persistence_method: event-sourcing",
  "    replay_methods:",
  "      - { event_ref: event.invoice.line-added, code: { method: apply_line_added } }",
  "      - { event_ref: event.invoice.issued, code: { method: apply_issued } }",
  "    reference_ids: [entity.invoice]",
  `    code: { language: rust, package: ${DOMAIN_CRATE}, module: [invoice], type: Invoice }`,
  "    operations:",
  "      - operation_ref: factory.invoice.parse-money",
  "        code: { method: parse, error_type: ParseMoneyError }",
  "        errors:",
  "          - { error_ref: error.invoice.parse-money.non-finite-amount, code: { case: NonFiniteAmount } }",
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
  `  - { term: Invoice line, model_refs: [vo.invoice-line], rationale: one amount an invoice adds up, code: ${location(["invoice", "line"])} }`,
  `  - { term: Money, model_refs: [primitive.money], rationale: the amount of a line and the total of an invoice, code: ${location(["money"])} }`,
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
    [`${DOMAIN_DIR}/src/money.rs`]: MONEY,
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

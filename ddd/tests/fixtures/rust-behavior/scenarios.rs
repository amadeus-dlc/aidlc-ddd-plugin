//! The behavior scenarios every language's generated code has to pass (language-independent design
//! §11), stated for the Rust sample: the same four scenarios, steps and values as
//! tests/fixtures/typescript-behavior/scenarios.ts, with each string error case replaced by the
//! Rust variant the aggregate mapping names for the same `error_ref`.
//!
//! This file is the whole library of a harness crate the behavior test writes next to the sample and
//! runs with `cargo test`; the harness depends on the sample's three crates by path, so the sample
//! is compiled and run as written. Each test's name is its scenario id with `_` for `-`.

use std::panic::{catch_unwind, UnwindSafe};

use billing_domain::invoice::line::InvoiceLine;
use billing_domain::invoice::{AddInvoiceLineError, Invoice, InvoiceEvent, Issued, IssueInvoiceError, LineAdded, OpenInvoiceError};
use billing_domain::money::Money;
use billing_interface_adapter::in_memory_invoice_repository::InMemoryInvoiceRepository;
use billing_use_case::invoice_repository::{InvoiceRepository, RepositoryError};
use billing_use_case::issue_invoice::{IssueInvoiceUseCase, IssueInvoiceFailure};

const CUSTOMER: &str = "acme";
const DRAFT: &str = "invoice-draft";
const EMPTY_DRAFT: &str = "invoice-empty";
const ISSUED: &str = "invoice-issued";
const UNKNOWN: &str = "invoice-unknown";
const INTERVAL: u64 = 3;

fn value<T, E: std::fmt::Debug>(result: Result<T, E>) -> T {
    match result {
        Ok(value) => value,
        Err(error) => panic!("expected success, got the error {:?}", error),
    }
}

fn error_of<T, E>(result: Result<T, E>) -> E {
    match result {
        Ok(_) => panic!("expected an error, got success"),
        Err(error) => error,
    }
}

/// Runs `construct` and returns the message it panicked with; fails when it returns instead.
fn panic_message<T>(construct: impl FnOnce() -> T + UnwindSafe) -> String {
    match catch_unwind(construct) {
        Ok(_) => panic!("expected a panic, got a constructed value"),
        Err(payload) => payload
            .downcast_ref::<&str>()
            .map(|message| message.to_string())
            .or_else(|| payload.downcast_ref::<String>().cloned())
            .unwrap_or_default(),
    }
}

fn line(amount: i64) -> InvoiceLine { InvoiceLine::of(Money::of(amount as f64)) }

fn lines(amounts: Vec<i64>) -> Vec<InvoiceLine> { amounts.into_iter().map(line).collect() }

/// The creation event of an invoice just opened: the one event the aggregate does not return itself.
fn opened(invoice: &Invoice, lines: Vec<InvoiceLine>) -> InvoiceEvent {
    InvoiceEvent::Opened {
        invoice_id: invoice.id().to_string(),
        sequence_number: invoice.sequence_number(),
        customer: CUSTOMER.to_string(),
        lines,
    }
}

fn line_added(invoice_id: &str, sequence_number: u64, amount: i64) -> InvoiceEvent {
    InvoiceEvent::LineAdded(LineAdded::create(invoice_id, sequence_number, line(amount)))
}

fn issued_at(invoice_id: &str, sequence_number: u64) -> InvoiceEvent {
    InvoiceEvent::Issued(Issued::create(invoice_id, sequence_number))
}

/// Opens an invoice and stores its creation event with the invoice itself.
fn open_and_store(repository: &mut InMemoryInvoiceRepository, invoice_id: &str, amounts: Vec<i64>) -> Invoice {
    let invoice = value(Invoice::open(invoice_id, CUSTOMER, lines(amounts.clone())));
    value(repository.store(opened(&invoice, lines(amounts)), invoice.clone()));
    invoice
}

/// A repository holding a draft, an empty draft and an issued invoice, each stored through the port.
fn seeded() -> InMemoryInvoiceRepository {
    let mut repository = InMemoryInvoiceRepository::new(INTERVAL);
    open_and_store(&mut repository, DRAFT, vec![100, 20]);
    open_and_store(&mut repository, EMPTY_DRAFT, vec![]);
    let mut issued = open_and_store(&mut repository, ISSUED, vec![5]);
    let event = value(issued.issue());
    value(repository.store(InvoiceEvent::Issued(event), issued));
    repository
}

/// The invoice a repository found; the port answers a missing one with `None`, not a failure.
fn found(result: Result<Option<Invoice>, RepositoryError>) -> Invoice {
    match result {
        Ok(Some(invoice)) => invoice,
        Ok(None) => panic!("expected a stored invoice, found none"),
        Err(error) => panic!("expected a load, got the repository error {:?}", error),
    }
}

fn expect_rejected(result: Result<(), IssueInvoiceFailure>, expected: IssueInvoiceError) {
    match error_of(result) {
        IssueInvoiceFailure::Rejected(error) => assert_eq!(error, expected),
        other => panic!("expected the rejection {:?}, got {:?}", expected, other),
    }
}

fn expect_not_found(result: Result<(), IssueInvoiceFailure>) {
    match error_of(result) {
        IssueInvoiceFailure::NotFound(_) => {}
        other => panic!("expected the invoice not to be found, got {:?}", other),
    }
}

/// scenarios.ts "state-change".
#[test]
fn state_change() {
    let mut invoice = value(Invoice::open(DRAFT, CUSTOMER, vec![line(100)]));
    assert_eq!(invoice.id(), DRAFT);
    assert_eq!(invoice.sequence_number(), 1);
    assert_eq!(invoice.total(), Money::of(100.0));
    let added = value(invoice.add_line(line(50)));
    assert_eq!(InvoiceEvent::LineAdded(added).invoice_id(), DRAFT);
    assert_eq!(invoice.sequence_number(), 2);
    assert_eq!(invoice.total(), Money::of(150.0));
    assert_eq!(invoice.lines().len(), 2);
    let issued = value(invoice.issue());
    assert_eq!(InvoiceEvent::Issued(issued).sequence_number(), 3);
    assert_eq!(invoice.sequence_number(), 3);
    assert_eq!(error_of(invoice.add_line(line(1))), AddInvoiceLineError::AlreadyIssued);
    assert_eq!(error_of(invoice.issue()), IssueInvoiceError::AlreadyIssued);
    assert_eq!(invoice.total(), Money::of(150.0));

    let mut repository = seeded();
    value(IssueInvoiceUseCase::new(&mut repository).execute(DRAFT));
}

/// scenarios.ts "business-error-keeps-state".
#[test]
fn business_error_keeps_state() {
    let mut invoice = value(Invoice::open(DRAFT, CUSTOMER, vec![line(100)]));
    assert_eq!(error_of(invoice.add_line(line(-150))), AddInvoiceLineError::NegativeTotal);
    assert_eq!(invoice.total(), Money::of(100.0));
    assert_eq!(invoice.lines().len(), 1);
    assert_eq!(invoice.sequence_number(), 1);

    let mut empty = value(Invoice::open(EMPTY_DRAFT, CUSTOMER, vec![]));
    assert_eq!(error_of(empty.issue()), IssueInvoiceError::EmptyLines);
    assert_eq!(empty.sequence_number(), 1);
    // Still a draft: a refused issue did not issue it.
    value(empty.add_line(line(10)));
    assert_eq!(empty.sequence_number(), 2);
    value(empty.issue());
    assert_eq!(empty.sequence_number(), 3);

    let mut repository = seeded();
    expect_rejected(IssueInvoiceUseCase::new(&mut repository).execute(ISSUED), IssueInvoiceError::AlreadyIssued);
    expect_rejected(IssueInvoiceUseCase::new(&mut repository).execute(EMPTY_DRAFT), IssueInvoiceError::EmptyLines);
    let mut issued = found(repository.find_by_id(ISSUED));
    assert_eq!(issued.total(), Money::of(5.0));
    assert_eq!(issued.sequence_number(), 2);
    assert_eq!(error_of(issued.add_line(line(1))), AddInvoiceLineError::AlreadyIssued);
    let mut still_empty = found(repository.find_by_id(EMPTY_DRAFT));
    assert_eq!(still_empty.lines().len(), 0);
    assert_eq!(still_empty.sequence_number(), 1);
    value(still_empty.add_line(line(1)));
}

/// scenarios.ts "invalid-value-rejected".
#[test]
fn invalid_value_rejected() {
    assert_eq!(error_of(Invoice::open(DRAFT, "", vec![line(1)])), OpenInvoiceError::MissingCustomer);
    assert_eq!(error_of(Invoice::open(DRAFT, CUSTOMER, vec![line(-1)])), OpenInvoiceError::NegativeTotal);

    // A continuation of the snapshot that does not belong to it is refused, not reported as a business error.
    let snapshot = value(Invoice::open(DRAFT, CUSTOMER, vec![line(10)]));
    let corrupt = "corrupt invoice history";
    let rejected = |events: Vec<InvoiceEvent>, snapshot: Invoice| panic_message(move || Invoice::replay(&events, snapshot));
    assert!(rejected(vec![line_added(UNKNOWN, 2, 1)], snapshot.clone()).contains(corrupt));
    assert!(rejected(vec![line_added(DRAFT, 3, 1)], snapshot.clone()).contains(corrupt));
    assert!(rejected(vec![line_added(DRAFT, 2, 1), line_added(DRAFT, 2, 1)], snapshot.clone()).contains(corrupt));
    let second_opened = InvoiceEvent::Opened { invoice_id: DRAFT.to_string(), sequence_number: 2, customer: CUSTOMER.to_string(), lines: vec![] };
    assert!(rejected(vec![second_opened], snapshot.clone()).contains(corrupt));
    assert!(rejected(vec![issued_at(DRAFT, 2), line_added(DRAFT, 3, 1)], snapshot.clone()).contains(corrupt));
    assert!(rejected(vec![issued_at(DRAFT, 2), issued_at(DRAFT, 3)], snapshot.clone()).contains(corrupt));
    assert!(rejected(vec![line_added(DRAFT, 2, -11)], snapshot).contains(corrupt));
    let empty = value(Invoice::open(DRAFT, CUSTOMER, vec![]));
    assert!(rejected(vec![issued_at(DRAFT, 2)], empty).contains(corrupt));
}

/// scenarios.ts "restore-after-persistence".
#[test]
fn restore_after_persistence() {
    // The snapshot interval is a required argument, and an unusable one is refused.
    assert!(catch_unwind(|| InMemoryInvoiceRepository::new(0)).is_err());

    // What the repository keeps is detached from what the caller keeps.
    let mut isolated = InMemoryInvoiceRepository::new(2);
    let mut first = open_and_store(&mut isolated, DRAFT, vec![7]);
    assert_eq!(found(isolated.find_by_id(DRAFT)).total(), Money::of(7.0));
    value(first.add_line(line(9)));
    assert_eq!(found(isolated.find_by_id(DRAFT)).total(), Money::of(7.0));
    value(found(isolated.find_by_id(DRAFT)).issue());
    open_and_store(&mut isolated, UNKNOWN, vec![11]);
    assert_eq!(found(isolated.find_by_id(UNKNOWN)).total(), Money::of(11.0));

    // Replaying leaves the snapshot it continues as it was.
    let base = value(Invoice::open(DRAFT, CUSTOMER, vec![line(1)]));
    let mut advanced = value(Invoice::open(DRAFT, CUSTOMER, vec![line(1)]));
    let next = value(advanced.add_line(line(2)));
    let replayed = Invoice::replay(&[InvoiceEvent::LineAdded(next)], base.clone());
    assert_eq!(replayed.sequence_number(), 2);
    assert_eq!(replayed.total(), Money::of(3.0));
    assert_eq!(base.sequence_number(), 1);
    assert_eq!(base.total(), Money::of(1.0));

    let repository = seeded();
    let draft = found(repository.find_by_id(DRAFT));
    assert_eq!(draft.total(), Money::of(120.0));
    assert_eq!(draft.lines().len(), 2);
    assert!(draft.is_billed_to(CUSTOMER));
    assert!(!draft.is_billed_to("another-customer"));
    assert_eq!(error_of(found(repository.find_by_id(ISSUED)).issue()), IssueInvoiceError::AlreadyIssued);

    let mut persisted = seeded();
    value(IssueInvoiceUseCase::new(&mut persisted).execute(DRAFT));
    // The appended issuance event determines the next replayed aggregate.
    let mut stored = found(persisted.find_by_id(DRAFT));
    assert_eq!(stored.total(), Money::of(120.0));
    assert_eq!(stored.sequence_number(), 2);
    assert!(stored.is_billed_to(CUSTOMER));
    assert_eq!(error_of(stored.add_line(line(1))), AddInvoiceLineError::AlreadyIssued);
    expect_rejected(IssueInvoiceUseCase::new(&mut persisted).execute(DRAFT), IssueInvoiceError::AlreadyIssued);

    // A missing invoice is no failure of the port; the use case turns it into its own error.
    assert!(matches!(repository.find_by_id(UNKNOWN), Ok(None)));
    expect_not_found(IssueInvoiceUseCase::new(&mut persisted).execute(UNKNOWN));

    // A store that does not extend what is kept is refused, and what is kept stays as it was.
    let mut guarded = InMemoryInvoiceRepository::new(2);
    let mut original = open_and_store(&mut guarded, DRAFT, vec![5]);
    let stranger = value(Invoice::open(UNKNOWN, CUSTOMER, vec![line(1)]));
    assert!(guarded.store(opened(&original, vec![]), stranger).is_err());
    let second = InvoiceEvent::LineAdded(value(original.add_line(line(1))));
    assert!(guarded.store(second.clone(), value(Invoice::open(DRAFT, CUSTOMER, vec![line(5)]))).is_err());
    value(guarded.store(second.clone(), original.clone()));
    assert!(guarded.store(second, original.clone()).is_err());
    value(original.add_line(line(1)));
    let fourth = InvoiceEvent::LineAdded(value(original.add_line(line(1))));
    assert!(guarded.store(fourth, original).is_err());
    let kept = found(guarded.find_by_id(DRAFT));
    assert_eq!(kept.total(), Money::of(6.0));
    assert_eq!(kept.sequence_number(), 2);
    let mut late = value(Invoice::open(UNKNOWN, CUSTOMER, vec![line(1)]));
    let late_event = InvoiceEvent::LineAdded(value(late.add_line(line(1))));
    assert!(guarded.store(late_event, late).is_err());
    assert!(matches!(guarded.find_by_id(UNKNOWN), Ok(None)));

    // The snapshot is replaced at number 1 and at each multiple of the interval, and a read starts from it.
    // A command's event and the aggregate it returned read back the same either way: interval 2 starts from
    // the snapshot at number 2, and interval 3 replays the event at number 2 over the snapshot at number 1.
    let timing = |interval: u64| {
        let mut timed = InMemoryInvoiceRepository::new(interval);
        open_and_store(&mut timed, DRAFT, vec![]);
        let mut loaded = found(timed.find_by_id(DRAFT));
        let added = InvoiceEvent::LineAdded(value(loaded.add_line(line(5))));
        value(timed.store(added, loaded));
        found(timed.find_by_id(DRAFT))
    };
    for interval in [2, 3] {
        let mut read = timing(interval);
        assert_eq!(read.total(), Money::of(5.0));
        assert_eq!(read.sequence_number(), 2);
        value(read.issue());
    }
}

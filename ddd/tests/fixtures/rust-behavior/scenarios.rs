//! The behavior scenarios every language's generated code has to pass (language-independent design
//! §11), stated for the Rust sample: the same four scenarios, steps and values as
//! tests/fixtures/typescript-behavior/scenarios.ts, with each string error case replaced by the
//! Rust variant the aggregate mapping names for the same `error_ref`.
//!
//! This file is the whole library of a harness crate the behavior test writes next to the sample and
//! runs with `cargo test`; the harness depends on the sample's three crates by path, so the sample
//! is compiled and run as written. Each test's name is its scenario id with `_` for `-`.

use std::collections::HashMap;
use std::panic::{catch_unwind, UnwindSafe};

use billing_domain::invoice::line::InvoiceLine;
use billing_domain::invoice::{AddInvoiceLineError, Invoice, InvoiceEvent, Issued, IssueInvoiceError, OpenInvoiceError};
use billing_domain::money::Money;
use billing_interface_adapter::in_memory_invoice_repository::InMemoryInvoiceRepository;
use billing_use_case::invoice_repository::{InvoiceRepository, RepositoryError};
use billing_use_case::issue_invoice::{IssueInvoiceUseCase, IssueInvoiceFailure};

const CUSTOMER: &str = "acme";
const DRAFT: &str = "invoice-draft";
const EMPTY_DRAFT: &str = "invoice-empty";
const ISSUED: &str = "invoice-issued";
const UNKNOWN: &str = "invoice-unknown";

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

fn stream(amounts: Vec<i64>, issued: bool) -> Vec<InvoiceEvent> {
    let lines = amounts.into_iter().map(line).collect();
    let mut history = vec![InvoiceEvent::Opened { customer: CUSTOMER.to_string(), lines }];
    if issued { history.push(InvoiceEvent::Issued(Issued)); }
    history
}

fn records() -> HashMap<String, Vec<InvoiceEvent>> {
    HashMap::from([
        (DRAFT.to_string(), stream(vec![100, 20], false)),
        (EMPTY_DRAFT.to_string(), stream(vec![], false)),
        (ISSUED.to_string(), stream(vec![5], true)),
    ])
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
    let mut invoice = value(Invoice::open(CUSTOMER, vec![line(100)]));
    assert_eq!(invoice.total(), Money::of(100.0));
    value(invoice.add_line(line(50)));
    assert_eq!(invoice.total(), Money::of(150.0));
    assert_eq!(invoice.lines().len(), 2);
    value(invoice.issue());
    assert_eq!(error_of(invoice.add_line(line(1))), AddInvoiceLineError::AlreadyIssued);
    assert_eq!(error_of(invoice.issue()), IssueInvoiceError::AlreadyIssued);
    assert_eq!(invoice.total(), Money::of(150.0));

    let mut repository = InMemoryInvoiceRepository::new(records());
    value(IssueInvoiceUseCase::new(&mut repository).execute(DRAFT));
}

/// scenarios.ts "business-error-keeps-state".
#[test]
fn business_error_keeps_state() {
    let mut invoice = value(Invoice::open(CUSTOMER, vec![line(100)]));
    assert_eq!(error_of(invoice.add_line(line(-150))), AddInvoiceLineError::NegativeTotal);
    assert_eq!(invoice.total(), Money::of(100.0));
    assert_eq!(invoice.lines().len(), 1);

    let mut empty = value(Invoice::open(CUSTOMER, vec![]));
    assert_eq!(error_of(empty.issue()), IssueInvoiceError::EmptyLines);
    // Still a draft: a refused issue did not issue it.
    value(empty.add_line(line(10)));
    value(empty.issue());

    let mut repository = InMemoryInvoiceRepository::new(records());
    expect_rejected(IssueInvoiceUseCase::new(&mut repository).execute(ISSUED), IssueInvoiceError::AlreadyIssued);
    expect_rejected(IssueInvoiceUseCase::new(&mut repository).execute(EMPTY_DRAFT), IssueInvoiceError::EmptyLines);
    let mut issued = found(repository.find_by_id(ISSUED));
    assert_eq!(issued.total(), Money::of(5.0));
    assert_eq!(error_of(issued.add_line(line(1))), AddInvoiceLineError::AlreadyIssued);
    let mut still_empty = found(repository.find_by_id(EMPTY_DRAFT));
    assert_eq!(still_empty.lines().len(), 0);
    value(still_empty.add_line(line(1)));
}

/// scenarios.ts "invalid-value-rejected".
#[test]
fn invalid_value_rejected() {
    assert_eq!(error_of(Invoice::open("", vec![line(1)])), OpenInvoiceError::MissingCustomer);
    assert_eq!(error_of(Invoice::open(CUSTOMER, vec![line(-1)])), OpenInvoiceError::NegativeTotal);
    assert!(panic_message(|| Invoice::restore(&[InvoiceEvent::Opened { customer: "".to_string(), lines: vec![line(1)] }])).contains("corrupt invoice history"));
    assert!(panic_message(|| Invoice::restore(&stream(vec![], true))).contains("corrupt invoice history"));
    assert!(panic_message(|| Invoice::restore(&stream(vec![-1], false))).contains("corrupt invoice history"));
}

/// scenarios.ts "restore-after-persistence".
#[test]
fn restore_after_persistence() {
    let repository = InMemoryInvoiceRepository::new(records());
    let draft = found(repository.find_by_id(DRAFT));
    assert_eq!(draft.total(), Money::of(120.0));
    assert_eq!(draft.lines().len(), 2);
    assert!(draft.is_billed_to(CUSTOMER));
    assert!(!draft.is_billed_to("another-customer"));
    assert_eq!(error_of(found(repository.find_by_id(ISSUED)).issue()), IssueInvoiceError::AlreadyIssued);

    let mut persisted = InMemoryInvoiceRepository::new(records());
    value(IssueInvoiceUseCase::new(&mut persisted).execute(DRAFT));
    // The stored invoice, not the draft record it was read from, is what the next read returns.
    let mut stored = found(persisted.find_by_id(DRAFT));
    assert_eq!(stored.total(), Money::of(120.0));
    assert!(stored.is_billed_to(CUSTOMER));
    assert_eq!(error_of(stored.add_line(line(1))), AddInvoiceLineError::AlreadyIssued);
    expect_rejected(IssueInvoiceUseCase::new(&mut persisted).execute(DRAFT), IssueInvoiceError::AlreadyIssued);

    // A missing invoice is no failure of the port; the use case turns it into its own error.
    assert!(matches!(repository.find_by_id(UNKNOWN), Ok(None)));
    expect_not_found(IssueInvoiceUseCase::new(&mut persisted).execute(UNKNOWN));
}

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
use billing_domain::invoice::{AddInvoiceLineError, Invoice, IssueInvoiceError, OpenInvoiceError};
use billing_interface_adapter::in_memory_invoice_repository::{InMemoryInvoiceRepository, InvoiceRecord};
use billing_use_case::invoice_repository::InvoiceRepository;
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

fn record(amounts: Vec<i64>, issued: bool) -> InvoiceRecord {
    InvoiceRecord { customer: CUSTOMER.to_string(), amounts, issued }
}

/// The persisted records a repository starts from: a draft with lines, a draft without, an issued one.
fn records() -> HashMap<String, InvoiceRecord> {
    HashMap::from([
        (DRAFT.to_string(), record(vec![100, 20], false)),
        (EMPTY_DRAFT.to_string(), record(vec![], false)),
        (ISSUED.to_string(), record(vec![5], true)),
    ])
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
    let mut invoice = value(Invoice::open(CUSTOMER, vec![InvoiceLine::of(100)]));
    assert_eq!(invoice.total(), 100);
    value(invoice.add_line(InvoiceLine::of(50)));
    assert_eq!(invoice.total(), 150);
    assert_eq!(invoice.lines().len(), 2);
    value(invoice.issue());
    assert_eq!(error_of(invoice.add_line(InvoiceLine::of(1))), AddInvoiceLineError::AlreadyIssued);
    assert_eq!(error_of(invoice.issue()), IssueInvoiceError::AlreadyIssued);
    assert_eq!(invoice.total(), 150);

    let repository = InMemoryInvoiceRepository::new(records());
    value(IssueInvoiceUseCase::new(&repository).execute(DRAFT));
}

/// scenarios.ts "business-error-keeps-state".
#[test]
fn business_error_keeps_state() {
    let mut invoice = value(Invoice::open(CUSTOMER, vec![InvoiceLine::of(100)]));
    assert_eq!(error_of(invoice.add_line(InvoiceLine::of(-150))), AddInvoiceLineError::NegativeTotal);
    assert_eq!(invoice.total(), 100);
    assert_eq!(invoice.lines().len(), 1);

    let mut empty = value(Invoice::open(CUSTOMER, vec![]));
    assert_eq!(error_of(empty.issue()), IssueInvoiceError::EmptyLines);
    // Still a draft: a refused issue did not issue it.
    value(empty.add_line(InvoiceLine::of(10)));
    value(empty.issue());

    let repository = InMemoryInvoiceRepository::new(records());
    expect_rejected(IssueInvoiceUseCase::new(&repository).execute(ISSUED), IssueInvoiceError::AlreadyIssued);
    expect_rejected(IssueInvoiceUseCase::new(&repository).execute(EMPTY_DRAFT), IssueInvoiceError::EmptyLines);
    let mut issued = value(repository.find_by_id(ISSUED));
    assert_eq!(issued.total(), 5);
    assert_eq!(error_of(issued.add_line(InvoiceLine::of(1))), AddInvoiceLineError::AlreadyIssued);
    let mut still_empty = value(repository.find_by_id(EMPTY_DRAFT));
    assert_eq!(still_empty.lines().len(), 0);
    value(still_empty.add_line(InvoiceLine::of(1)));
}

/// scenarios.ts "invalid-value-rejected".
#[test]
fn invalid_value_rejected() {
    assert_eq!(error_of(Invoice::open("", vec![InvoiceLine::of(1)])), OpenInvoiceError::MissingCustomer);
    assert_eq!(error_of(Invoice::open(CUSTOMER, vec![InvoiceLine::of(-1)])), OpenInvoiceError::NegativeTotal);
    assert!(panic_message(|| Invoice::restore("", vec![InvoiceLine::of(1)], false)).contains("corrupt invoice state"));
    assert!(panic_message(|| Invoice::restore(CUSTOMER, vec![], true)).contains("corrupt invoice state"));
    assert!(panic_message(|| Invoice::restore(CUSTOMER, vec![InvoiceLine::of(-1)], false)).contains("corrupt invoice state"));
}

/// scenarios.ts "restore-after-persistence".
#[test]
fn restore_after_persistence() {
    let repository = InMemoryInvoiceRepository::new(records());
    let draft = value(repository.find_by_id(DRAFT));
    assert_eq!(draft.total(), 120);
    assert_eq!(draft.lines().len(), 2);
    assert!(draft.is_billed_to(CUSTOMER));
    assert!(!draft.is_billed_to("another-customer"));
    assert_eq!(error_of(value(repository.find_by_id(ISSUED)).issue()), IssueInvoiceError::AlreadyIssued);

    let persisted = InMemoryInvoiceRepository::new(records());
    let issue_invoice = IssueInvoiceUseCase::new(&persisted);
    value(issue_invoice.execute(DRAFT));
    // The stored invoice, not the draft record it was read from, is what the next read returns.
    let mut stored = value(persisted.find_by_id(DRAFT));
    assert_eq!(stored.total(), 120);
    assert!(stored.is_billed_to(CUSTOMER));
    assert_eq!(error_of(stored.add_line(InvoiceLine::of(1))), AddInvoiceLineError::AlreadyIssued);
    expect_rejected(issue_invoice.execute(DRAFT), IssueInvoiceError::AlreadyIssued);

    assert!(repository.find_by_id(UNKNOWN).is_err());
    expect_not_found(issue_invoice.execute(UNKNOWN));
}

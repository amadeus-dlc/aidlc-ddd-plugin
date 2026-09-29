//! The behavior scenarios every language's generated code has to pass (language-independent design
//! §11), stated for the Rust sample: the same seven scenarios, steps and values as
//! tests/fixtures/typescript-behavior/scenarios.ts, with each string error case replaced by the
//! Rust variant the aggregate mapping names for the same `error_ref`, and each `applied` /
//! `already-applied` outcome by the `CommandOutcome` variant of the same name. A Rust command
//! borrows the aggregate mutably, changes it and returns its one event, so where the TypeScript
//! steps go on with the instance a command returned, these go on with the same aggregate.
//!
//! This file is the whole library of a harness crate the behavior test writes next to the sample and
//! runs with `cargo test`; the harness depends on the sample's three crates by path, so the sample
//! is compiled and run as written. Each test's name is its scenario id with `_` for `-`.

use std::collections::HashMap;
use std::panic::{catch_unwind, UnwindSafe};

use billing_domain::invoice::line::InvoiceLine;
use billing_domain::invoice::{AddInvoiceLineError, Invoice, IssueInvoiceError, OpenInvoiceError, RecordPaymentError};
use billing_interface_adapter::in_memory_invoice_repository::{InMemoryInvoiceRepository, InvoiceRecord};
use billing_use_case::invoice_repository::{InvoiceRepository, VersionConflict};
use billing_use_case::issue_invoice::{IssueInvoice, IssueInvoiceFailure};
use billing_use_case::record_payment::{RecordPayment, RecordPaymentFailure};
use language_extensions::CommandOutcome;

const CUSTOMER: &str = "acme";
const DRAFT: &str = "invoice-draft";
const EMPTY_DRAFT: &str = "invoice-empty";
const ISSUED: &str = "invoice-issued";
const UNKNOWN: &str = "invoice-unknown";
const PART_PAID: &str = "invoice-part-paid";

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
    InvoiceRecord { customer: CUSTOMER.to_string(), amounts, issued, paid: 0, payment_ids: Vec::new() }
}

/// The persisted records a repository starts from: a draft with lines, a draft without, an issued one.
fn records() -> HashMap<String, InvoiceRecord> {
    HashMap::from([
        (DRAFT.to_string(), record(vec![100, 20], false)),
        (EMPTY_DRAFT.to_string(), record(vec![], false)),
        (ISSUED.to_string(), record(vec![5], true)),
    ])
}

/// One persisted record of an issued invoice of 100 with 30 paid, remembering `payment_ids`.
fn part_paid_records(payment_ids: Vec<String>) -> HashMap<String, InvoiceRecord> {
    HashMap::from([(
        PART_PAID.to_string(),
        InvoiceRecord { customer: CUSTOMER.to_string(), amounts: vec![100], issued: true, paid: 30, payment_ids },
    )])
}

/// `count` payment command ids, `payment-0` onwards.
fn payment_ids(count: usize) -> Vec<String> {
    (0..count).map(|index| format!("payment-{}", index)).collect()
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

/// The command that remembers its command ids applied: the one event it raised.
fn applied<E, F: std::fmt::Debug>(result: Result<CommandOutcome<E>, F>) -> E {
    match value(result) {
        CommandOutcome::Applied(event) => event,
        CommandOutcome::AlreadyApplied => panic!("expected the command to apply, got already applied"),
    }
}

/// The command was already applied: it raised no event.
fn expect_already_applied<E, F: std::fmt::Debug>(result: Result<CommandOutcome<E>, F>) {
    match value(result) {
        CommandOutcome::AlreadyApplied => {}
        CommandOutcome::Applied(_) => panic!("expected the command to be already applied, got it applied"),
    }
}

fn expect_payment_rejected(result: Result<(), RecordPaymentFailure>, expected: RecordPaymentError) {
    match error_of(result) {
        RecordPaymentFailure::Rejected(error) => assert_eq!(error, expected),
        other => panic!("expected the rejection {:?}, got {:?}", expected, other),
    }
}

/// What the repository has saved of one invoice: its version and the number of events saved with it.
fn saved_of(repository: &InMemoryInvoiceRepository, invoice_id: &str) -> (u64, usize) {
    (repository.version(invoice_id), repository.stored_events(invoice_id).len())
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
    value(IssueInvoice::new(&repository).execute(DRAFT));
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
    expect_rejected(IssueInvoice::new(&repository).execute(ISSUED), IssueInvoiceError::AlreadyIssued);
    expect_rejected(IssueInvoice::new(&repository).execute(EMPTY_DRAFT), IssueInvoiceError::EmptyLines);
    let mut issued = value(repository.find_by_id(ISSUED)).invoice;
    assert_eq!(issued.total(), 5);
    assert_eq!(error_of(issued.add_line(InvoiceLine::of(1))), AddInvoiceLineError::AlreadyIssued);
    let mut still_empty = value(repository.find_by_id(EMPTY_DRAFT)).invoice;
    assert_eq!(still_empty.lines().len(), 0);
    value(still_empty.add_line(InvoiceLine::of(1)));
}

/// scenarios.ts "invalid-value-rejected".
#[test]
fn invalid_value_rejected() {
    assert_eq!(error_of(Invoice::open("", vec![InvoiceLine::of(1)])), OpenInvoiceError::MissingCustomer);
    assert_eq!(error_of(Invoice::open(CUSTOMER, vec![InvoiceLine::of(-1)])), OpenInvoiceError::NegativeTotal);
    assert!(panic_message(|| Invoice::restore("", vec![InvoiceLine::of(1)], false, 0, vec![])).contains("corrupt invoice state"));
    assert!(panic_message(|| Invoice::restore(CUSTOMER, vec![], true, 0, vec![])).contains("corrupt invoice state"));
    assert!(panic_message(|| Invoice::restore(CUSTOMER, vec![InvoiceLine::of(-1)], false, 0, vec![])).contains("corrupt invoice state"));
    // A state paid up to its total and remembering as many ids as the invoice keeps is restored.
    assert_eq!(Invoice::restore(CUSTOMER, vec![InvoiceLine::of(10)], true, 10, payment_ids(16)).paid(), 10);
    assert!(panic_message(|| Invoice::restore(CUSTOMER, vec![InvoiceLine::of(10)], true, 10, payment_ids(17))).contains("corrupt invoice state"));
    assert!(panic_message(|| Invoice::restore(CUSTOMER, vec![InvoiceLine::of(10)], true, 11, payment_ids(16))).contains("corrupt invoice state"));
    assert!(panic_message(|| Invoice::restore(CUSTOMER, vec![InvoiceLine::of(10)], true, -1, vec![])).contains("corrupt invoice state"));
    assert!(panic_message(|| Invoice::restore(CUSTOMER, vec![InvoiceLine::of(10)], false, 5, vec![])).contains("corrupt invoice state"));
    assert!(panic_message(|| Invoice::restore(CUSTOMER, vec![InvoiceLine::of(10)], false, 0, payment_ids(1))).contains("corrupt invoice state"));
}

/// scenarios.ts "restore-after-persistence".
#[test]
fn restore_after_persistence() {
    let repository = InMemoryInvoiceRepository::new(records());
    let draft = value(repository.find_by_id(DRAFT)).invoice;
    assert_eq!(draft.total(), 120);
    assert_eq!(draft.lines().len(), 2);
    assert!(draft.is_billed_to(CUSTOMER));
    assert!(!draft.is_billed_to("another-customer"));
    assert_eq!(error_of(value(repository.find_by_id(ISSUED)).invoice.issue()), IssueInvoiceError::AlreadyIssued);

    let persisted = InMemoryInvoiceRepository::new(records());
    let issue_invoice = IssueInvoice::new(&persisted);
    value(issue_invoice.execute(DRAFT));
    // The stored invoice, not the draft record it was read from, is what the next read returns.
    let mut stored = value(persisted.find_by_id(DRAFT)).invoice;
    assert_eq!(stored.total(), 120);
    assert!(stored.is_billed_to(CUSTOMER));
    assert_eq!(error_of(stored.add_line(InvoiceLine::of(1))), AddInvoiceLineError::AlreadyIssued);
    expect_rejected(issue_invoice.execute(DRAFT), IssueInvoiceError::AlreadyIssued);

    assert!(repository.find_by_id(UNKNOWN).is_err());
    expect_not_found(issue_invoice.execute(UNKNOWN));
}

/// scenarios.ts "duplicate-command-already-applied".
#[test]
fn duplicate_command_already_applied() {
    let mut invoice = value(Invoice::open(CUSTOMER, vec![InvoiceLine::of(100)]));
    value(invoice.issue());
    applied(invoice.record_payment("payment-1", 30));
    assert_eq!(invoice.paid(), 30);
    expect_already_applied(invoice.record_payment("payment-1", 30));
    assert_eq!(invoice.paid(), 30);
    // Only the command id decides: the same id with another amount is the same command again.
    expect_already_applied(invoice.record_payment("payment-1", 50));
    assert_eq!(invoice.paid(), 30);
    applied(invoice.record_payment("payment-2", 30));
    assert_eq!(invoice.paid(), 60);

    let repository = InMemoryInvoiceRepository::new(records());
    value(IssueInvoice::new(&repository).execute(DRAFT));
    let record_payment = RecordPayment::new(&repository);
    value(record_payment.execute(DRAFT, "payment-1", 30));
    let saved = saved_of(&repository, DRAFT);
    value(record_payment.execute(DRAFT, "payment-1", 30));
    assert_eq!(saved_of(&repository, DRAFT), saved);
    assert_eq!(value(repository.find_by_id(DRAFT)).invoice.paid(), 30);

    // A restored invoice decides with the paid amount and the ids its persisted state holds.
    let mut restored = Invoice::restore(CUSTOMER, vec![InvoiceLine::of(100)], true, 30, vec!["payment-1".to_string()]);
    expect_already_applied(restored.record_payment("payment-1", 30));
    assert_eq!(restored.paid(), 30);
    assert_eq!(error_of(restored.record_payment("payment-2", 80)), RecordPaymentError::Overpayment);
    assert_eq!(restored.paid(), 30);

    let remembering = InMemoryInvoiceRepository::new(part_paid_records(vec!["payment-1".to_string()]));
    value(RecordPayment::new(&remembering).execute(PART_PAID, "payment-1", 30));
    assert_eq!(saved_of(&remembering, PART_PAID), (0, 0));
    assert_eq!(value(remembering.find_by_id(PART_PAID)).invoice.paid(), 30);
    // A record that does not remember the id has the payment applied.
    let forgetting = InMemoryInvoiceRepository::new(part_paid_records(vec![]));
    value(RecordPayment::new(&forgetting).execute(PART_PAID, "payment-1", 30));
    assert_eq!(saved_of(&forgetting, PART_PAID), (1, 1));
    assert_eq!(value(forgetting.find_by_id(PART_PAID)).invoice.paid(), 60);
}

/// scenarios.ts "rejected-command-keeps-state".
#[test]
fn rejected_command_keeps_state() {
    let mut draft = value(Invoice::open(CUSTOMER, vec![InvoiceLine::of(100)]));
    assert_eq!(error_of(draft.record_payment("payment-1", 30)), RecordPaymentError::NotIssued);
    assert_eq!(draft.paid(), 0);

    let mut invoice = value(Invoice::open(CUSTOMER, vec![InvoiceLine::of(100)]));
    value(invoice.issue());
    assert_eq!(error_of(invoice.record_payment("payment-1", 150)), RecordPaymentError::Overpayment);
    assert_eq!(invoice.paid(), 0);
    // A refused command is not remembered: the same id is applied once it can be.
    applied(invoice.record_payment("payment-1", 30));
    assert_eq!(invoice.paid(), 30);

    let repository = InMemoryInvoiceRepository::new(records());
    let record_payment = RecordPayment::new(&repository);
    expect_payment_rejected(record_payment.execute(DRAFT, "payment-1", 30), RecordPaymentError::NotIssued);
    value(IssueInvoice::new(&repository).execute(DRAFT));
    let saved = saved_of(&repository, DRAFT);
    expect_payment_rejected(record_payment.execute(DRAFT, "payment-1", 500), RecordPaymentError::Overpayment);
    assert_eq!(saved_of(&repository, DRAFT), saved);
    assert_eq!(value(repository.find_by_id(DRAFT)).invoice.paid(), 0);
    match error_of(record_payment.execute(UNKNOWN, "payment-1", 30)) {
        RecordPaymentFailure::NotFound(_) => {}
        other => panic!("expected the invoice not to be found, got {:?}", other),
    }
}

/// scenarios.ts "one-event-appended-per-command".
#[test]
fn one_event_appended_per_command() {
    let mut invoice = value(Invoice::open(CUSTOMER, vec![InvoiceLine::of(100), InvoiceLine::of(20)]));
    value(invoice.issue());
    applied(invoice.record_payment("payment-1", 20));
    assert!(!invoice.is_settled());
    // The payment that reaches the total settles the invoice and still raises its one event.
    applied(invoice.record_payment("payment-2", 100));
    assert_eq!(invoice.paid(), 120);
    assert!(invoice.is_settled());

    let repository = InMemoryInvoiceRepository::new(records());
    assert_eq!(saved_of(&repository, DRAFT), (0, 0));
    value(IssueInvoice::new(&repository).execute(DRAFT));
    assert_eq!(saved_of(&repository, DRAFT), (1, 1));
    let record_payment = RecordPayment::new(&repository);
    value(record_payment.execute(DRAFT, "payment-1", 20));
    assert_eq!(saved_of(&repository, DRAFT), (2, 2));
    value(record_payment.execute(DRAFT, "payment-2", 100));
    assert_eq!(saved_of(&repository, DRAFT), (3, 3));
    let stored = value(repository.find_by_id(DRAFT)).invoice;
    assert_eq!(stored.paid(), 120);
    assert!(stored.is_settled());

    // A store appends the one event it is handed, checked against the version its own read found.
    let contended = InMemoryInvoiceRepository::new(records());
    value(IssueInvoice::new(&contended).execute(DRAFT));
    let mut first = value(contended.find_by_id(DRAFT));
    let mut second = value(contended.find_by_id(DRAFT));
    let second_event = applied(second.invoice.record_payment("payment-2", 20));
    value(contended.store(DRAFT, second.invoice, second.version, second_event.clone()));
    assert_eq!(saved_of(&contended, DRAFT), (2, 2));
    assert_eq!(contended.stored_events(DRAFT).last(), Some(&second_event));
    value(contended.find_by_id(DRAFT));
    let first_event = applied(first.invoice.record_payment("payment-1", 30));
    assert_eq!(error_of(contended.store(DRAFT, first.invoice, first.version, first_event)), VersionConflict);
    assert_eq!(saved_of(&contended, DRAFT), (2, 2));
    // The refused change was not saved: a new read lacks it, and the same payment applies there.
    let mut reread = value(contended.find_by_id(DRAFT));
    assert_eq!(reread.invoice.paid(), 20);
    let reread_event = applied(reread.invoice.record_payment("payment-1", 30));
    value(contended.store(DRAFT, reread.invoice, reread.version, reread_event));
    assert_eq!(saved_of(&contended, DRAFT), (3, 3));
    assert_eq!(value(contended.find_by_id(DRAFT)).invoice.paid(), 50);
}

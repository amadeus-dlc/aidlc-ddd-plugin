//! The single error declaration that every supported reference variant must reach.
//!
//! The case set depends on the selected feature, so the same source produces a
//! different closed set under a different build condition.

#[cfg(not(feature = "extra-case"))]
pub enum IssueInvoiceError {
    AlreadyIssued,
    Empty,
}

#[cfg(feature = "extra-case")]
pub enum IssueInvoiceError {
    AlreadyIssued,
    Empty,
    Rejected,
}

//! An application type named `Result`. Inside this module it shadows the
//! prelude, so the spelling alone never establishes the standard result.

pub struct Result<T, E>(pub T, pub E);

pub enum IssueInvoiceError {
    AlreadyIssued,
    EmptyLines,
}

pub enum OpenInvoiceError {
    NegativeAmount,
    MissingCustomer,
}

pub struct Invoice;

impl Invoice {
    pub fn issue(&mut self) -> Result<(), IssueInvoiceError> {
        Result((), IssueInvoiceError::AlreadyIssued)
    }

    pub fn open() -> Result<Self, OpenInvoiceError> {
        Result(Self, OpenInvoiceError::NegativeAmount)
    }
}

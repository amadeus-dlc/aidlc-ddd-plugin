//! The command declares no result contract, and the generation method returns
//! its own type instead of the standard result.

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
    pub fn issue(&mut self) {}

    pub fn open() -> Self {
        Self
    }
}

//! Each operation adds one case the mapping gives to the other operation.

pub enum IssueInvoiceError {
    AlreadyIssued,
    EmptyLines,
    NegativeAmount,
}

pub enum OpenInvoiceError {
    NegativeAmount,
    MissingCustomer,
    AlreadyIssued,
}

pub struct Invoice;

impl Invoice {
    pub fn issue(&mut self) -> Result<(), IssueInvoiceError> {
        Ok(())
    }

    pub fn open() -> Result<Self, OpenInvoiceError> {
        Ok(Self)
    }
}

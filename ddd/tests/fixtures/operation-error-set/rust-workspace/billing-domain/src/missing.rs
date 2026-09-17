//! Each operation leaves out one case the mapping names.

pub enum IssueInvoiceError {
    AlreadyIssued,
}

pub enum OpenInvoiceError {
    NegativeAmount,
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

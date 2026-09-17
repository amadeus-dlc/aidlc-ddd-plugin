//! Each operation adds one case that no operation of the mapping names.

pub enum IssueInvoiceError {
    AlreadyIssued,
    EmptyLines,
    Locked,
}

pub enum OpenInvoiceError {
    NegativeAmount,
    MissingCustomer,
    Expired,
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

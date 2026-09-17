//! Each operation returns exactly the closed set of cases the mapping names.

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
        Ok(())
    }

    pub fn open() -> Result<Self, OpenInvoiceError> {
        Ok(Self)
    }
}

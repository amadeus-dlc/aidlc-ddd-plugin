//! Both error enums are left open, so their case lists are not closed sets even
//! though every listed case is one the mapping names.

#[non_exhaustive]
pub enum IssueInvoiceError {
    AlreadyIssued,
    EmptyLines,
}

#[non_exhaustive]
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

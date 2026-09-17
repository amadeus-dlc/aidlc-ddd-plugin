//! Both error enums are left open and each also lists a case outside its own
//! mapping: the command one that no operation names, the generation method one
//! that the command owns. Those cases are known even though the lists are open.

#[non_exhaustive]
pub enum IssueInvoiceError {
    AlreadyIssued,
    EmptyLines,
    Locked,
}

#[non_exhaustive]
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

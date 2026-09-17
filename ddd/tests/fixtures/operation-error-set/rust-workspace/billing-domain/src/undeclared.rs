//! The mapped type exists, but neither mapped operation does.

pub enum IssueInvoiceError {
    AlreadyIssued,
    EmptyLines,
}

pub struct Invoice;

impl Invoice {
    pub fn close(&mut self) -> Result<(), IssueInvoiceError> {
        Ok(())
    }
}

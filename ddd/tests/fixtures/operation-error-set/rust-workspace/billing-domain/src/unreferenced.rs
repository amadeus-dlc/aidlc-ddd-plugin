//! Both error types are imported from a module the snapshot does not contain.

use crate::absent::IssueInvoiceError;
use crate::absent::OpenInvoiceError;

pub struct Invoice;

impl Invoice {
    pub fn issue(&mut self) -> Result<(), IssueInvoiceError> {
        Ok(())
    }

    pub fn open() -> Result<Self, OpenInvoiceError> {
        Ok(Self)
    }
}

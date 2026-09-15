//! The same supported reference variants as `billing_domain::invoice`, written in
//! the other module layout and reached through the renamed dependency `billing`.

pub mod line;

use billing::errors::IssueInvoiceError;
use core::result::Result as Res;

/// Shares its spelling with `billing_domain::invoice::Invoice`; the two
/// declarations are different symbols in different packages.
pub struct Invoice;

impl Invoice {
    pub fn issue(&mut self) -> Result<(), IssueInvoiceError> {
        Ok(())
    }
}

pub struct Qualified;

impl Qualified {
    pub fn issue(&mut self) -> core::result::Result<(), billing::errors::IssueInvoiceError> {
        Ok(())
    }
}

pub struct Renamed;

impl Renamed {
    pub fn issue(&mut self) -> Res<(), IssueInvoiceError> {
        Ok(())
    }
}

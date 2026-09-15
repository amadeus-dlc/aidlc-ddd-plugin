//! Supported reference variants written directly, fully qualified, and through a
//! renamed import. The remaining two variants live in the child module `line`.

pub mod line;

use crate::errors::IssueInvoiceError;
use core::result::Result as Res;

/// Shares its spelling with `billing_use_case::invoice::Invoice`; the two
/// declarations are different symbols in different packages.
pub struct Invoice;

impl Invoice {
    pub fn issue(&mut self) -> Result<(), IssueInvoiceError> {
        Ok(())
    }
}

pub struct Qualified;

impl Qualified {
    pub fn issue(&mut self) -> core::result::Result<(), crate::errors::IssueInvoiceError> {
        Ok(())
    }
}

pub struct Renamed;

impl Renamed {
    pub fn issue(&mut self) -> Res<(), IssueInvoiceError> {
        Ok(())
    }
}

/// Concrete `Self` in an inherent impl, reached through the impl's owner.
pub struct Created;

impl Created {
    pub fn create() -> Result<Self, IssueInvoiceError> {
        Ok(Self)
    }
}

/// The same spelling appears in a doc comment and in a string literal, and the
/// operation itself declares no return type.
///
/// Historical note: this operation used to return `Result<(), IssueInvoiceError>`.
pub struct Undeclared;

impl Undeclared {
    pub fn issue(&mut self) {
        let _note = "Result<(), IssueInvoiceError>";
    }
}

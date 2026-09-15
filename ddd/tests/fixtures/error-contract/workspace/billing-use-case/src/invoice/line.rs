//! The renamed re-export and transparent alias variants, written on top of the
//! renamed dependency.

pub use billing::errors::IssueInvoiceError as Rejected;

pub type Outcome<T> = Result<T, super::IssueInvoiceError>;

pub struct Reexported;

impl Reexported {
    pub fn issue(&mut self) -> Result<(), Rejected> {
        Ok(())
    }
}

pub struct Aliased;

impl Aliased {
    pub fn issue(&mut self) -> Outcome<()> {
        Ok(())
    }
}

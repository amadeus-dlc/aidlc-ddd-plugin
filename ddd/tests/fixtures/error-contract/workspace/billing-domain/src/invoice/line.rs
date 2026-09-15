//! Supported reference variants written through a renamed re-export and through a
//! transparent type alias. Both reach the parent module with `crate` and `super`.

pub use crate::errors::IssueInvoiceError as Rejected;

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

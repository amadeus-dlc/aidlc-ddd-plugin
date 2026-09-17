//! Only the bodies state what the operations return.

pub struct Invoice;

impl Invoice {
    pub fn issue(&mut self) -> impl core::fmt::Debug {
        0
    }

    pub fn open() -> impl core::fmt::Debug {
        1
    }
}
